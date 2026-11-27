import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildModoLigaExportAssignments,
  buildModoLigaExportSlots,
  formatModoLigaExport,
  matchesModoLigaExportEventType,
} from './admin-modo-liga-export.mjs';

test('keeps Modo Liga and Acesso exports separate', () => {
  assert.equal(matchesModoLigaExportEventType('TREINO MODO LIGA', 'modo-liga'), true);
  assert.equal(matchesModoLigaExportEventType('TREINO MODO LIGA', 'Acesso'), false);
  assert.equal(matchesModoLigaExportEventType('Acesso', 'TREINO ACESSO'), true);
  assert.equal(matchesModoLigaExportEventType('Acesso', 'Modo Liga Freitas'), false);
});

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

test('exposes the same calculated letters to the manage roster', () => {
  const teams = [
    { id: 'rangers-a', name: 'Rangers Sport A' },
    { id: 'rangers-b', name: 'Rangers Sports B' },
    { id: 'rangers-c', name: 'Rangers Sports C' },
    { id: 'xtrem', name: 'Xtrem' },
    { id: 'vortex', name: 'Vortex', specLetter: 'E' },
    { id: 'vortex-esports', name: 'VORTEX ESPORTS', specLetter: 'H' },
    { id: 'havoc', name: 'HAVOC', specLetter: 'K' },
  ];

  const assignments = buildModoLigaExportAssignments(teams);

  assert.equal(assignments.find(entry => entry.registration.id === 'xtrem')?.idx, 'D');
  assert.equal(assignments.find(entry => entry.registration.id === 'vortex')?.idx, 'E');
  assert.equal(assignments.find(entry => entry.registration.id === 'vortex-esports')?.idx, 'H');
});

test('treats avatar selections as unassigned roster positions', () => {
  const slots = buildModoLigaExportSlots([
    { name: 'AVATAR TEAM', modoLigaSpecAvatar: 'avatar:kelly' },
  ]);

  assert.equal(slots[0].idx, 'A');
  assert.equal(slots[0].team, 'AVATAR TEAM');
  assert.equal(slots[0].avatar, 'kelly');
});

test('prints selected avatars as AVT names instead of TIME letters', () => {
  const output = formatModoLigaExport('21', [
    { name: 'THEFOXYSGG', specLetter: 'X' },
    { name: 'TEAM KELLY', modoLigaSpecAvatar: 'avatar:kelly' },
    { name: 'TEAM ANDREW', modoLigaSpecAvatar: 'avatar:andrew' },
    { name: 'TEAM MAXIM', specAvatar: 'maxim' },
  ]);

  assert.match(output, /𝑨𝑽𝑻 𝑲𝑬𝑳𝑳𝒀: TEAM KELLY/);
  assert.match(output, /𝑨𝑽𝑻 𝑨𝑵𝑫𝑹𝑬𝑾: TEAM ANDREW/);
  assert.match(output, /𝑨𝑽𝑻 𝑴𝑨𝑿𝑰𝑴: TEAM MAXIM/);
  assert.match(output, /𝑻𝑰𝑴𝑬 X: THEFOXYSGG/);
  assert.equal((output.match(/⃟🩵 𝑻𝑰𝑴𝑬 [A-Z]:/g) || []).length, 12);
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
