const SPEC_LETTERS = Array.from({ length: 26 }, (_, index) =>
  String.fromCharCode(65 + index)
);
const MAX_EXPORT_SLOTS = 15;
const AVATAR_LABELS = {
  kelly: '𝑲𝑬𝑳𝑳𝒀',
  maxim: '𝑴𝑨𝑿𝑰𝑴',
  andrew: '𝑨𝑵𝑫𝑹𝑬𝑾',
};

function normalizeModoLigaExportEventType(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function matchesModoLigaExportEventType(selectedEventType, registrationEventType) {
  const getFamily = value => {
    const normalized = normalizeModoLigaExportEventType(value);
    if (normalized.includes('acesso')) return 'acesso';
    if (normalized.includes('liga')) return 'liga';
    return '';
  };
  const selectedFamily = getFamily(selectedEventType);
  return Boolean(selectedFamily) && selectedFamily === getFamily(registrationEventType);
}

function teamName(team) {
  return String(team?.name ?? team?.team ?? '');
}

function specLetter(team) {
  const value = String(team?.specLetter ?? team?.modoLigaSpecLetter ?? '')
    .trim()
    .toUpperCase();
  return /^[A-Z]$/.test(value) ? value : '';
}

function specAvatar(team) {
  const value = String(team?.specAvatar ?? team?.modoLigaSpecAvatar ?? team?.avatar ?? '')
    .trim()
    .toLowerCase()
    .replace(/^avatar:/u, '');
  return Object.hasOwn(AVATAR_LABELS, value) ? value : '';
}

function buildModoLigaExportEntries(teams) {
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
    registration: teamsByLetter.get(letter) || null,
  }));
}

export function buildModoLigaExportAssignments(teams) {
  return buildModoLigaExportEntries(teams)
    .filter(entry => entry.registration);
}

export function buildModoLigaExportSlots(teams) {
  return buildModoLigaExportEntries(teams).map(({ idx, registration }) => ({
    idx,
    team: teamName(registration),
    avatar: specAvatar(registration),
  }));
}

export function formatModoLigaExport(hour, teams) {
  const slots = buildModoLigaExportSlots(teams);
  const teamLines = slots.map(slot => {
    const label = slot.avatar
      ? `𝑨𝑽𝑻 ${AVATAR_LABELS[slot.avatar]}`
      : `𝑻𝑰𝑴𝑬 ${slot.idx}`;
    return `   ⃟🩵 ${label}: ${slot.team}`;
  });

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
