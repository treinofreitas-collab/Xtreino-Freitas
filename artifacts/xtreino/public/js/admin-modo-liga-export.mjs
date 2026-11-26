const SPEC_LETTERS = Array.from({ length: 26 }, (_, index) =>
  String.fromCharCode(65 + index)
);
const MAX_EXPORT_SLOTS = 15;

function teamName(team) {
  return String(team?.name ?? team?.team ?? '');
}

function specLetter(team) {
  const value = String(team?.specLetter ?? team?.modoLigaSpecLetter ?? '')
    .trim()
    .toUpperCase();
  return /^[A-Z]$/.test(value) ? value : '';
}

export function buildModoLigaExportSlots(teams) {
  const registrations = Array.isArray(teams) ? teams : [];
  if (registrations.length > MAX_EXPORT_SLOTS) {
    throw new Error('A exportação do Modo Liga aceita até 15 times.');
  }

  const teamsByLetter = new Map();
  const unassignedTeams = [];

  for (const team of registrations) {
    const letter = specLetter(team);
    if (!letter) {
      unassignedTeams.push(team);
      continue;
    }

    const existing = teamsByLetter.get(letter);
    if (existing) {
      throw new Error(
        `A letra SPEC ${letter} está atribuída a mais de um time: ${teamName(existing)} e ${teamName(team)}. Corrija as inscrições antes de exportar.`
      );
    }
    teamsByLetter.set(letter, team);
  }

  const freeLetters = SPEC_LETTERS.filter(letter => !teamsByLetter.has(letter));
  unassignedTeams.forEach((team, index) => {
    const letter = freeLetters[index];
    if (!letter) {
      throw new Error('Não há posições livres para todos os times desta exportação.');
    }
    teamsByLetter.set(letter, team);
  });

  const outputLetters = Array.from(teamsByLetter.keys());
  for (const letter of SPEC_LETTERS) {
    if (outputLetters.length >= MAX_EXPORT_SLOTS) break;
    if (!teamsByLetter.has(letter)) outputLetters.push(letter);
  }
  outputLetters.sort();

  return outputLetters.map(letter => ({
    idx: letter,
    team: teamName(teamsByLetter.get(letter)),
  }));
}

export function formatModoLigaExport(hour, teams) {
  const slots = buildModoLigaExportSlots(teams);
  const namesByLetter = new Map(slots.map(slot => [slot.idx, slot.team]));
  const teamLines = slots.map(slot =>
    `   ⃟🩵 𝑻𝑰𝑴𝑬 ${slot.idx}: ${namesByLetter.get(slot.idx) || ''}`
  );

  return [
    `ㅤㅤ 𝑴𝑶𝑫𝑶 𝑳𝑰𝑮𝑨 𝑭𝑹𝑬𝑰𝑻𝑨𝑺 » ${hour}𝐇`,
    'ㅤ┉────┉────┉────┉────┉',
    '🔐➺ 𝑺𝑨𝑳𝑨 𝑬 𝑺𝑬𝑵𝑯𝑨 𝟏𝟎𝑴𝑰𝑵 𝑨𝑵𝑻𝑬𝑺',
    '🏷️➺ 𝑹𝑬𝑮𝑹𝑨𝑺 𝑵𝑨 𝑫𝑬𝑺𝑪𝑹𝑰𝑪̧𝑨̃𝑶!',
    '',
    ...teamLines,
    '',
    '⌞📽️⌝ 𝑺𝑻𝑹𝑬𝑨𝑴𝑬𝑹: SMITHZEIRA',
    '',
    '⎾‣⏌FREITAS TV | @Xtreino_freitas'
  ].join('\n');
}
