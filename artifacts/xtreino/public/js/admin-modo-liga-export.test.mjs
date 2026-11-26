import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildModoLigaExportSlots,
  formatModoLigaExport,
} from './admin-modo-liga-export.mjs';

test('places teams in their selected SPEC letter positions, including Z', () => {
  const slots = buildModoLigaExportSlots([
    { name: 'NIGHTMARE', specLetter: 'C' },
    { name: 'TESTE 2 - MANUAL', specLetter: 'z' },
    { name: 'TESTE FREITAS 5', specLetter: 'V' },
  ]);

  assert.equal(slots.length, 15);
  assert.equal(slots.find(slot => slot.idx === 'C').team, 'NIGHTMARE');
  assert.equal(slots.find(slot => slot.idx === 'V').team, 'TESTE FREITAS 5');
  assert.equal(slots.find(slot => slot.idx === 'Z').team, 'TESTE 2 - MANUAL');
});

test('fills remaining letters with teams that have no selected letter', () => {
  const slots = buildModoLigaExportSlots([
    { name: 'NIGHTMARE', specLetter: 'C' },
    { name: 'XD-DOMINATORS' },
    { name: 'TESTE 2 - MANUAL', specLetter: 'Z' },
    { name: 'TESTE' },
  ]);

  assert.equal(slots.find(slot => slot.idx === 'A').team, 'XD-DOMINATORS');
  assert.equal(slots.find(slot => slot.idx === 'B').team, 'TESTE');
  assert.equal(slots.find(slot => slot.idx === 'C').team, 'NIGHTMARE');
  assert.equal(slots.find(slot => slot.idx === 'Z').team, 'TESTE 2 - MANUAL');
});

test('treats avatar selections as unassigned roster positions', () => {
  const slots = buildModoLigaExportSlots([
    { name: 'AVATAR TEAM', specLetter: 'avatar:kelly' },
  ]);

  assert.equal(slots[0].idx, 'A');
  assert.equal(slots[0].team, 'AVATAR TEAM');
});

test('rejects duplicate SPEC letters instead of silently replacing a team', () => {
  assert.throws(
    () => buildModoLigaExportSlots([
      { name: 'TIME UM', specLetter: 'C' },
      { name: 'TIME DOIS', specLetter: 'C' },
    ]),
    /letra SPEC C está atribuída a mais de um time/
  );
});

test('formats 15 positions and preserves selected SPEC letters', () => {
  const output = formatModoLigaExport('00', [
    { name: 'NIGHTMARE', specLetter: 'C' },
    { name: 'TESTE 2 - MANUAL', specLetter: 'Z' },
  ]);

  assert.match(output, /𝑻𝑰𝑴𝑬 C: NIGHTMARE/);
  assert.match(output, /𝑻𝑰𝑴𝑬 Z: TESTE 2 - MANUAL/);
  assert.equal((output.match(/𝑻𝑰𝑴𝑬 [A-Z]:/g) || []).length, 15);
});

test('keeps all chosen letters while limiting the roster to 15 positions', () => {
  const teams = [
    { name: 'TIME C', specLetter: 'C' },
    { name: 'TIME V', specLetter: 'V' },
    { name: 'TIME Z', specLetter: 'Z' },
    ...Array.from({ length: 12 }, (_, index) => ({ name: `TIME ${index + 1}` })),
  ];
  const slots = buildModoLigaExportSlots(teams);

  assert.equal(slots.length, 15);
  assert.deepEqual(
    slots.filter(slot => slot.team).map(slot => slot.team),
    ['TIME 1', 'TIME 2', 'TIME C', 'TIME 3', 'TIME 4', 'TIME 5', 'TIME 6', 'TIME 7', 'TIME 8', 'TIME 9', 'TIME 10', 'TIME 11', 'TIME 12', 'TIME V', 'TIME Z']
  );
  assert.ok(slots.some(slot => slot.idx === 'V'));
  assert.ok(slots.some(slot => slot.idx === 'Z'));
});

test('rejects more registrations than the 15-team Modo Liga capacity', () => {
  assert.throws(
    () => buildModoLigaExportSlots(Array.from({ length: 16 }, (_, index) => ({ name: `TIME ${index + 1}` }))),
    /aceita até 15 times/
  );
});
