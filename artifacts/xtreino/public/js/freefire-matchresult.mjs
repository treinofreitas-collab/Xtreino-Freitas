export const MATCHRESULT_EVENT_TYPES = [
  { value: 'modo-liga', label: 'Modo Liga' },
  { value: 'acesso', label: 'Acesso' },
  { value: 'camp-fases', label: 'Camp de Fases' },
];

export const MATCHRESULT_DROP_COUNTS = [1, 2, 3, 4, 5];
export const MATCHRESULT_TEAM_LIMIT = 15;
export const LBFF_PLACEMENT_POINTS_15 = [12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0, 0];
export const MAX_MATCHRESULT_FILE_BYTES = 2 * 1024 * 1024;
const TEAM_HEADER = /^TeamName:\s*(.*?)\s+Rank:\s*(-?\d+)\s+KillScore:\s*(-?\d+)\s+RankScore:\s*(-?\d+)\s+TotalScore:\s*(-?\d+)\s*$/u;
const PLAYER_ROW = /^NAME:\s*(.*?)\s+ID:\s*(\d+)\s+KILL:\s*(-?\d+)\s*$/u;
const GENERIC_TEAM_WORDS = new Set(['team', 'time', 'equipe', 'esports', 'org']);

export function matchResultTeamKey(name) {
  return String(name ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200f\uFEFF]/g, '')
    .replace(/[Ɐɐ]/gu, 'a')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/&/g, ' e ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

function cleanRosterTeamName(name) {
  return String(name ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200f\uFEFF\uFE0E\uFE0F]/gu, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '')
    .trim();
}

function slotNumberFromLabel(label) {
  const token = String(label ?? '').normalize('NFKC').trim().match(/(?:slot|time|team)?\s*(\d{1,2}|[a-o])\s*$/iu)?.[1];
  if (!token) return null;
  if (/^\d{1,2}$/u.test(token)) return Number(token);
  return token.toLocaleUpperCase('en-US').charCodeAt(0) - 64;
}

function extractMatchResultRosterEntry(line, fallbackSlot) {
  const normalizedLine = String(line ?? '').normalize('NFKC').trim().replace(
    /^[\s\u200b\ufeff\p{M}\p{P}\p{S}\p{Extended_Pictographic}\u200d\ufe0e\ufe0f]+(?=(?:slot\b|time\b|team\b|\d{1,2}\s*(?:[,;:.\-]|\s)|[a-o]\s*(?:[,;:.\-]|\s)))/iu,
    '',
  );
  const separator = normalizedLine.indexOf(':');
  if (separator >= 0) {
    const label = normalizedLine.slice(0, separator);
    return {
      slot: slotNumberFromLabel(label) ?? fallbackSlot,
      teamName: cleanRosterTeamName(normalizedLine.slice(separator + 1)),
    };
  }
  const prefixedEntry = normalizedLine.match(
    /^(?:slot|time|team)\s*(\d{1,2}|[a-o])\s*(?:[,;|.\-]\s*|\s+)(.+)$/iu,
  );
  const numberedEntry = normalizedLine.match(/^(\d{1,2})\s*(?:[,;|.\-]\s*|\s+)(.+)$/u);
  const letteredEntry = normalizedLine.match(/^([a-o])\s*[,;|.\-]\s*(.+)$/iu);
  const numberedOrLettered = prefixedEntry || numberedEntry || letteredEntry;
  if (!numberedOrLettered) return { slot: fallbackSlot, teamName: cleanRosterTeamName(normalizedLine) };
  return {
    slot: slotNumberFromLabel(numberedOrLettered[1]) ?? fallbackSlot,
    teamName: cleanRosterTeamName(numberedOrLettered[2]),
  };
}

export function parseMatchResultRoster(text) {
  const lines = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(line => line.normalize('NFKC').trim())
    .filter(line => {
      if (!line) return false;
      return !/^(?:slot|time|team|position|posi[cç][aã]o|rank)\s*[,;|]\s*(?:equipe|team|nome(?:\s+da\s+equipe)?|name)\b/iu.test(line);
    });
  const errors = [];
  const roster = Array.from({ length: MATCHRESULT_TEAM_LIMIT }, (_, index) => ({
    slot: index + 1,
    label: `TIME ${String.fromCharCode(65 + index)}`,
    teamName: '',
  }));
  const seenSlots = new Set();
  lines.forEach((line, index) => {
    const entry = extractMatchResultRosterEntry(line, index + 1);
    if (!Number.isInteger(entry.slot) || entry.slot < 1 || entry.slot > MATCHRESULT_TEAM_LIMIT) {
      errors.push(`Slot ${entry.slot} inválido; use posições de 1 a 15.`);
      return;
    }
    if (seenSlots.has(entry.slot)) {
      errors.push(`A posição ${entry.slot} aparece mais de uma vez na lista.`);
      return;
    }
    seenSlots.add(entry.slot);
    const team = roster[entry.slot - 1];
    team.teamName = entry.teamName;
    if (!team.teamName) errors.push(`${team.label}: informe o nome da equipe.`);
  });

  if (lines.length !== MATCHRESULT_TEAM_LIMIT) {
    errors.unshift(`A lista precisa conter exatamente 15 equipes; foram encontradas ${lines.length}.`);
  }
  const seenNames = new Set();
  for (const team of roster) {
    const key = matchResultTeamKey(team.teamName);
    if (key && seenNames.has(key)) errors.push(`O nome "${team.teamName}" aparece mais de uma vez na lista.`);
    if (key) seenNames.add(key);
  }
  return { roster, errors, lineCount: lines.length };
}

export function resolveMatchResultTeam(teamName, roster) {
  const inputKey = matchResultTeamKey(teamName);
  if (!inputKey) return { status: 'unmatched', candidates: [] };
  const entries = (Array.isArray(roster) ? roster : []).map((entry, index) =>
    typeof entry === 'string' ? { slot: index + 1, teamName: entry } : entry,
  ).filter(entry => entry?.teamName && matchResultTeamKey(entry.teamName));
  const exact = entries.filter(entry => matchResultTeamKey(entry.teamName) === inputKey);
  if (exact.length === 1) return { status: 'exact', team: exact[0], candidates: exact };
  if (exact.length > 1) return { status: 'ambiguous', candidates: exact };

  const inputTokens = inputKey.split(' ');
  const inputLength = inputTokens.join('').length;
  const candidates = entries.filter(entry => {
    const targetKey = matchResultTeamKey(entry.teamName);
    const targetTokens = targetKey.split(' ');
    const inputCompact = inputTokens.join('');
    const targetCompact = targetTokens.join('');
    const compactPrefix = inputCompact.length >= 4 &&
      !GENERIC_TEAM_WORDS.has(inputCompact) &&
      targetCompact.startsWith(inputCompact);
    const tokenOffset = targetTokens.findIndex((_, offset) =>
      offset + inputTokens.length <= targetTokens.length &&
      inputTokens.every((token, index) => targetTokens[offset + index].startsWith(token)),
    );
    const tokenSequenceMatch = tokenOffset >= 0;
    if (compactPrefix) return true;
    if (!tokenSequenceMatch) return false;

    const informativeExactToken = inputTokens.some((token, index) =>
      token === targetTokens[tokenOffset + index] &&
      token.length >= 2 &&
      !GENERIC_TEAM_WORDS.has(token),
    );
    if (inputTokens.length === 1) {
      const token = inputTokens[0];
      if (GENERIC_TEAM_WORDS.has(token)) return false;
      return token.length >= 4 ||
        (token.length >= 2 && token === targetTokens[tokenOffset]);
    }
    return inputLength >= 5 || (inputLength >= 4 && informativeExactToken);
  });

  if (candidates.length === 1) return { status: 'partial', team: candidates[0], candidates };
  if (candidates.length > 1) return { status: 'ambiguous', candidates };
  return { status: 'unmatched', candidates: [] };
}

export function mapMatchResultTeamsToRoster(parsed, roster) {
  const teams = [];
  const warnings = [];
  const errors = [];
  const ignored = [];
  const usedSlots = new Set();

  for (const result of parsed?.teams || []) {
    const resolution = resolveMatchResultTeam(result.teamName, roster);
    if (resolution.status === 'exact' || resolution.status === 'partial') {
      const officialTeam = resolution.team;
      if (usedSlots.has(officialTeam.slot)) {
        errors.push(`Mais de um nome do log corresponde ao slot ${officialTeam.label || officialTeam.slot} (${officialTeam.teamName}).`);
        continue;
      }
      usedSlots.add(officialTeam.slot);
      teams.push({
        ...result,
        sourceTeamName: result.teamName,
        teamName: officialTeam.teamName,
        slot: officialTeam.slot,
        slotLabel: officialTeam.label || `SLOT ${String(officialTeam.slot).padStart(2, '0')}`,
        matchType: resolution.status,
      });
      if (resolution.status === 'partial') {
        warnings.push(`Nome parcial reconhecido: "${result.teamName}" → ${officialTeam.label || `slot ${officialTeam.slot}`} · ${officialTeam.teamName}. Confira a correspondência.`);
      }
      continue;
    }

    const candidateNames = resolution.candidates.map(candidate => candidate.teamName).join(', ');
    const reason = resolution.status === 'ambiguous'
      ? `pode corresponder a ${candidateNames}`
      : 'não consta na lista oficial';
    ignored.push(result.teamName);
    warnings.push(`"${result.teamName}" ${reason}; sua pontuação será ignorada.`);
  }

  if (parsed?.teams?.length && !teams.length && !errors.length) {
    errors.push('Nenhuma equipe do log correspondeu à lista de slots. Confira os nomes antes de exportar.');
  }
  return { teams, warnings, errors, ignored };
}

export function parseMatchResultLog(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  const lines = source.split(/\r?\n/);
  const teams = [];
  const errors = [];
  const warnings = [];
  let current = null;

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber].trim();
    if (!line) continue;

    if (/^TeamName:/i.test(line)) {
      const match = line.match(TEAM_HEADER);
      if (!match) {
        errors.push(`Linha ${lineNumber + 1}: cabeçalho de equipe inválido.`);
        current = null;
        continue;
      }
      const [, teamName, rankText, reportedKillsText, reportedRankPointsText, reportedTotalText] = match;
      current = {
        teamName: teamName.trim(),
        rank: Number(rankText),
        kills: 0,
        reportedKills: Number(reportedKillsText),
        rankPoints: 0,
        reportedRankPoints: Number(reportedRankPointsText),
        reportedTotalPoints: Number(reportedTotalText),
        playerCount: 0,
        players: [],
        errors: [],
      };
      teams.push(current);
      continue;
    }

    if (/^NAME:/i.test(line)) {
      if (!current) {
        errors.push(`Linha ${lineNumber + 1}: jogador encontrado antes de uma equipe.`);
        continue;
      }
      const match = line.match(PLAYER_ROW);
      if (!match) {
        current.errors.push(`Linha ${lineNumber + 1}: registro de jogador inválido.`);
        continue;
      }
      const [, name, id, killsText] = match;
      const kills = Number(killsText);
      if (!name.trim() || !Number.isSafeInteger(kills) || kills < 0 || kills > 99) {
        current.errors.push(`Linha ${lineNumber + 1}: nome ou abates do jogador inválidos.`);
        continue;
      }
      current.players.push({ name: name.trim(), id, kills });
      current.kills += kills;
      current.playerCount += 1;
    }
  }

  if (!teams.length) {
    errors.push('O arquivo não contém equipes no formato MatchResult esperado.');
  }
  if (teams.length > MATCHRESULT_TEAM_LIMIT) {
    errors.push(`O arquivo contém ${teams.length} equipes; o limite é ${MATCHRESULT_TEAM_LIMIT}.`);
  }
  if (teams.length > 0 && teams.length < MATCHRESULT_TEAM_LIMIT) {
    warnings.push(`Este log contém ${teams.length} de 15 equipes; confirme se alguma equipe não disputou esta queda.`);
  }

  const seenRanks = new Set();
  const seenTeams = new Set();
  for (const team of teams) {
    const key = matchResultTeamKey(team.teamName);
    const expectedRankPoints = LBFF_PLACEMENT_POINTS_15[team.rank - 1];
    if (!team.teamName) team.errors.push('Nome da equipe ausente.');
    if (!Number.isInteger(team.rank) || team.rank < 1 || team.rank > MATCHRESULT_TEAM_LIMIT) {
      team.errors.push(`Colocação inválida: ${team.rank}.`);
    } else if (seenRanks.has(team.rank)) {
      team.errors.push(`Colocação ${team.rank} repetida neste arquivo.`);
    } else {
      seenRanks.add(team.rank);
    }
    if (key && seenTeams.has(key)) team.errors.push('Equipe repetida neste arquivo.');
    if (key) seenTeams.add(key);

    if (!Number.isSafeInteger(team.reportedKills) || team.reportedKills < 0) {
      team.errors.push('KillScore inválido no cabeçalho.');
    } else if (team.reportedKills !== team.kills) {
      team.errors.push(`KillScore do cabeçalho (${team.reportedKills}) difere da soma individual (${team.kills}).`);
    }
    if (expectedRankPoints === undefined) {
      team.errors.push('Não foi possível calcular a pontuação de colocação.');
      team.rankPoints = 0;
    } else {
      team.rankPoints = expectedRankPoints;
      if (team.reportedRankPoints !== expectedRankPoints) {
        team.errors.push(
          `RankScore informado (${team.reportedRankPoints}) difere do LBFF (${expectedRankPoints}).`,
        );
      }
    }
    const expectedTotal = team.kills + team.rankPoints;
    if (team.reportedTotalPoints !== expectedTotal) {
      team.errors.push(`TotalScore informado (${team.reportedTotalPoints}) difere do cálculo (${expectedTotal}).`);
    }
  }

  return {
    teams: teams.sort((a, b) => a.rank - b.rank),
    errors,
    warnings,
    totalKills: teams.reduce((sum, team) => sum + team.kills, 0),
    totalPlayers: teams.reduce((sum, team) => sum + team.playerCount, 0),
    valid: errors.length === 0 && teams.length > 0 && teams.every(team => team.errors.length === 0),
  };
}

export function getMatchResultSetIssues(drops, dropCount) {
  const issues = [];
  if (!Number.isInteger(dropCount) || dropCount < 1 || dropCount > MATCHRESULT_DROP_COUNTS.length) {
    return ['Selecione entre 1 e 5 quedas.'];
  }

  const selectedDrops = drops.slice(0, dropCount);
  if (selectedDrops.length !== dropCount || selectedDrops.some(drop => !drop?.parsed)) {
    issues.push('Adicione um arquivo MatchResult para cada queda selecionada.');
  }

  const availableDrops = selectedDrops.filter(drop => drop?.parsed);
  const teamKeys = new Set();
  for (const drop of availableDrops) {
    const dropNumber = Number.isInteger(drop.index) ? drop.index + 1 : selectedDrops.indexOf(drop) + 1;
    if (drop.parsed.errors.length) {
      issues.push(`Queda ${dropNumber}: ${drop.parsed.errors[0]}`);
    }
    for (const team of drop.parsed.teams) {
      if (team.errors.length) issues.push(`Queda ${dropNumber} · ${team.teamName}: ${team.errors[0]}`);
      const key = matchResultTeamKey(team.teamName);
      if (key) teamKeys.add(key);
    }
  }
  if (teamKeys.size > MATCHRESULT_TEAM_LIMIT) {
    issues.push(`Foram encontrados ${teamKeys.size} nomes de equipe diferentes; revise a escrita dos nomes entre as quedas.`);
  }
  return issues;
}

export function calculateMatchResultStandings(drops, dropCount, roster = []) {
  const selectedDrops = drops.slice(0, dropCount);
  const teamsByKey = new Map();
  let order = 0;

  for (const [index, team] of (Array.isArray(roster) ? roster : []).entries()) {
    const key = matchResultTeamKey(team?.teamName);
    if (!key || teamsByKey.has(key)) continue;
    teamsByKey.set(key, {
      key,
      teamName: team.teamName.trim(),
      slot: team.slot || index + 1,
      wins: 0,
      kills: 0,
      points: 0,
      firstSeenOrder: (team.slot || index + 1) - 1,
      placementsByDrop: Array.from({ length: dropCount }, () => null),
    });
    order += 1;
  }

  selectedDrops.forEach((drop, dropIndex) => {
    if (!drop?.parsed) return;
    for (const result of drop.parsed.teams) {
      const key = matchResultTeamKey(result.teamName);
      if (!key) continue;
      let standing = teamsByKey.get(key);
      if (!standing) {
        standing = {
          key,
          teamName: result.teamName.trim(),
          slot: result.slot || order + 1,
          wins: 0,
          kills: 0,
          points: 0,
          firstSeenOrder: order++,
          placementsByDrop: Array.from({ length: dropCount }, () => null),
        };
        teamsByKey.set(key, standing);
      }
      standing.placementsByDrop[dropIndex] = result.rank;
      standing.wins += result.rank === 1 ? 1 : 0;
      standing.kills += result.kills;
      standing.points += LBFF_PLACEMENT_POINTS_15[result.rank - 1] + result.kills;
    }
  });

  const standings = [...teamsByKey.values()].sort((a, b) =>
    b.points - a.points || b.wins - a.wins || b.kills - a.kills ||
    a.firstSeenOrder - b.firstSeenOrder,
  );
  const samePrimaryScore = (a, b) =>
    a.points === b.points && a.wins === b.wins && a.kills === b.kills;

  for (let start = 0; start < standings.length;) {
    let end = start + 1;
    while (end < standings.length && samePrimaryScore(standings[start], standings[end])) end += 1;
    const tiedTeams = standings.slice(start, end);
    if (tiedTeams.length > 1) {
      const lastDropIndex = selectedDrops.length - 1;
      const allPlayedLastDrop = lastDropIndex >= 0 &&
        tiedTeams.every(team => team.placementsByDrop[lastDropIndex] !== null);
      if (allPlayedLastDrop) {
        tiedTeams.sort((a, b) =>
          a.placementsByDrop[lastDropIndex] - b.placementsByDrop[lastDropIndex] ||
          a.firstSeenOrder - b.firstSeenOrder,
        );
      } else {
        const headToHeadWins = new Map(tiedTeams.map(team => [team.key, 0]));
        for (let dropIndex = 0; dropIndex < dropCount; dropIndex += 1) {
          for (let left = 0; left < tiedTeams.length; left += 1) {
            for (let right = left + 1; right < tiedTeams.length; right += 1) {
              const teamA = tiedTeams[left];
              const teamB = tiedTeams[right];
              const positionA = teamA.placementsByDrop[dropIndex];
              const positionB = teamB.placementsByDrop[dropIndex];
              if (positionA === null || positionB === null || positionA === positionB) continue;
              const winnerKey = positionA < positionB ? teamA.key : teamB.key;
              headToHeadWins.set(winnerKey, headToHeadWins.get(winnerKey) + 1);
            }
          }
        }
        tiedTeams.sort((a, b) =>
          headToHeadWins.get(b.key) - headToHeadWins.get(a.key) ||
          a.firstSeenOrder - b.firstSeenOrder,
        );
      }
      standings.splice(start, tiedTeams.length, ...tiedTeams);
    }
    start = end;
  }

  return standings.map((team, index) => ({
    rank: index + 1,
    teamName: team.teamName,
    wins: team.wins,
    kills: team.kills,
    points: team.points,
  }));
}
