import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const sources = [
  {
    name: 'Netlify',
    path: new URL('../../netlify/functions/freefire-analyze.js', import.meta.url),
    typescript: false,
  },
  {
    name: 'API server',
    path: new URL('../../artifacts/api-server/src/routes/freefire-scoring.ts', import.meta.url),
    typescript: true,
  },
];

async function loadHelpers(source, typescript) {
  const start = source.indexOf('function duplicateSlotGroups(');
  const endCandidates = [
    source.indexOf('\nfunction getAiClient(', start),
    source.indexOf('\nrouter.post(', start),
    source.indexOf('\nexports.handler =', start),
  ].filter(index => index >= 0);
  const end = Math.min(...endCandidates);
  assert.ok(start >= 0 && end > start, 'duplicate-slot helpers should exist');

  let code = `${source.slice(start, end)}
globalThis.testHelpers = { duplicateSlotGroups, applySlotRecheck, clearDuplicateSlots };`;
  if (typescript) {
    code = ts.transpileModule(code, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
  }

  const context = {
    isRecord: value => typeof value === 'object' && value !== null && !Array.isArray(value),
    markPlacementForReview: (placement, note) => ({
      ...placement,
      confidence: 'low',
      notes: [note, placement.notes].filter(Boolean).join(' ').slice(0, 220),
    }),
  };
  vm.runInNewContext(code, context);
  return context.testHelpers;
}

const loaded = await Promise.all(
  sources.map(async source => ({
    ...source,
    text: await readFile(source.path, 'utf8'),
  })),
);

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

for (const source of loaded) {
  test(`${source.name}: a slot may repeat across different drops`, async () => {
    const { duplicateSlotGroups } = await loadHelpers(source.text, source.typescript);
    const firstDrop = [{ position: 5, slot: 6 }];
    const secondDrop = [{ position: 8, slot: 6 }];

    assert.deepEqual(plain(duplicateSlotGroups(firstDrop)), []);
    assert.deepEqual(plain(duplicateSlotGroups(secondDrop)), []);
  });

  test(`${source.name}: lobby recheck can correct duplicate slot assignments`, async () => {
    const { duplicateSlotGroups, applySlotRecheck } = await loadHelpers(
      source.text,
      source.typescript,
    );
    const placements = [
      { position: 5, slot: 6, teamName: 'Equipe 6', confidence: 'high', notes: '' },
      { position: 8, slot: 6, teamName: 'Equipe 6', confidence: 'high', notes: '' },
    ];
    const corrected = plain(applySlotRecheck(
      placements,
      { assignments: [{ position: 5, slot: 6 }, { position: 8, slot: 11 }] },
      Array.from({ length: 12 }, (_, index) => ({
        slot: index + 1,
        teamName: `Equipe ${index + 1}`,
      })),
      new Set([5, 8]),
    ));

    assert.equal(corrected[0].slot, 6);
    assert.equal(corrected[1].slot, 11);
    assert.equal(corrected[1].teamName, 'Equipe 11');
    assert.deepEqual(plain(duplicateSlotGroups(corrected)), []);
    assert.ok(corrected.every(placement => placement.confidence === 'low'));
  });

  test(`${source.name}: unresolved duplicate slots require manual assignment`, async () => {
    const { duplicateSlotGroups, clearDuplicateSlots } = await loadHelpers(
      source.text,
      source.typescript,
    );
    const placements = [
      { position: 5, slot: 6, teamName: 'Equipe 6', confidence: 'high', notes: '' },
      { position: 8, slot: 6, teamName: 'Equipe 6', confidence: 'high', notes: '' },
    ];
    const groups = duplicateSlotGroups(placements);
    const unresolved = plain(clearDuplicateSlots(placements, groups));

    assert.deepEqual(unresolved.map(placement => placement.slot), [null, null]);
    assert.deepEqual(plain(duplicateSlotGroups(unresolved)), []);
    assert.ok(unresolved.every(placement => placement.confidence === 'low'));
    assert.ok(unresolved.every(placement => /associe manualmente/.test(placement.notes)));
  });

  test(`${source.name}: a duplicate triggers a targeted lobby-image recheck`, () => {
    assert.match(source.text, /Confira especificamente se algum slot foi atribuído a mais de uma colocação/);
    assert.match(source.text, /Reavalie os slots repetidos na queda/);
    assert.match(source.text, /generateJson\(slotRecheckPrompt, images\)/);
  });
}
