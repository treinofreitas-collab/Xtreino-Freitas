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
const GENERIC_TEAM_WORDS = new Set(['team', 'time', 'equipe', 'esport', 'esports', 'sport', 'sports', 'org']);

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

  const identityTokens = value => matchResultTeamKey(value)
    .split(' ')
    .filter(token => token.length > 1 && !GENERIC_TEAM_WORDS.has(token));
  const inputTokens = identityTokens(inputKey);
  if (!inputTokens.length) return { status: 'unmatched', candidates: [] };

  const tokenSimilarity = (left, right) => {
    if (left === right) {
      return { score: left.length >= 3 ? 4 : 1, strong: left.length >= 3 };
    }

    const shorter = left.length <= right.length ? left : right;
    const longer = shorter === left ? right : left;
    if (shorter.length >= 3 && longer.startsWith(shorter) && shorter.length / longer.length >= 0.65) {
      return { score: 3, strong: true };
    }

    if (Math.max(left.length, right.length) < 5) return null;
    let differences = 0;
    let leftIndex = 0;
    let rightIndex = 0;
    while (leftIndex < left.length && rightIndex < right.length) {
      if (left[leftIndex] === right[rightIndex]) {
        leftIndex += 1;
        rightIndex += 1;
        continue;
      }
      differences += 1;
      if (differences > 1) return null;
      if (left.length > right.length) leftIndex += 1;
      else if (right.length > left.length) rightIndex += 1;
      else {
        leftIndex += 1;
        rightIndex += 1;
      }
    }
    if (leftIndex < left.length || rightIndex < right.length) differences += 1;
    return differences === 1 ? { score: 2.5, strong: true } : null;
  };

  const scored = entries.map(entry => {
    const targetTokens = identityTokens(entry.teamName);
    const available = new Set(targetTokens.map((_, index) => index));
    let score = 0;
    let strongMatches = 0;
    for (const inputToken of inputTokens) {
      let best = null;
      let bestIndex = -1;
      for (const targetIndex of available) {
        const similarity = tokenSimilarity(inputToken, targetTokens[targetIndex]);
        if (similarity && (!best || similarity.score > best.score)) {
          best = similarity;
          bestIndex = targetIndex;
        }
      }
      if (!best) continue;
      score += best.score;
      if (best.strong) strongMatches += 1;
      available.delete(bestIndex);
    }
    return { team: entry, score, strongMatches };
  }).filter(candidate => candidate.score > 0);

  const strongCandidates = scored
    .filter(candidate => candidate.strongMatches > 0)
    .sort((left, right) => right.score - left.score);
  if (strongCandidates.length) {
    const best = strongCandidates[0];
    const runnerUp = strongCandidates[1];
    if (!runnerUp || best.score - runnerUp.score >= 1.5) {
      return { status: 'partial', team: best.team, candidates: [best.team] };
    }
    const tied = strongCandidates.filter(candidate => best.score - candidate.score < 1.5);
    return { status: 'ambiguous', candidates: tied.map(candidate => candidate.team) };
  }

  // Short shared codes such as "4S" are not enough to guess a team.
  if (scored.length > 1) return { status: 'ambiguous', candidates: scored.map(candidate => candidate.team) };
  if (scored.length === 1) {
    return { status: 'partial', team: scored[0].team, candidates: [scored[0].team] };
  }
  return { status: 'unmatched', candidates: [] };
}

export function mapMatchResultTeamsToRoster(parsed, roster) {
  const warnings = [];
  const errors = [];
  const ignored = [];
  const usedSlots = new Set();
  const results = Array.isArray(parsed?.teams) ? parsed.teams : [];
  const resolutions = results.map(result => resolveMatchResultTeam(result.teamName, roster));
  const mappedByIndex = new Map();
  const handled = new Set();

  const assign = (index, team, matchType, contextual = false) => {
    if (usedSlots.has(team.slot)) {
      errors.push(`Mais de um nome do log corresponde ao slot ${team.label || team.slot} (${team.teamName}).`);
      return false;
    }
    usedSlots.add(team.slot);
    const result = results[index];
    mappedByIndex.set(index, {
      ...result,
      sourceTeamName: result.teamName,
      teamName: team.teamName,
      slot: team.slot,
      slotLabel: team.label || `SLOT ${String(team.slot).padStart(2, '0')}`,
      matchType: contextual ? 'contextual' : matchType,
    });
    if (contextual) {
      warnings.push(`Nome "${result.teamName}" associado a ${team.label || `slot ${team.slot}`} · ${team.teamName}, pois o outro time da organização já foi identificado no log. Confira a correspondência.`);
    } else if (matchType === 'partial') {
      warnings.push(`Nome parcial reconhecido: "${result.teamName}" → ${team.label || `slot ${team.slot}`} · ${team.teamName}. Confira a correspondência.`);
    }
    return true;
  };

  // Reserve exact and uniquely partial matches first, regardless of their
  // position in the log, so they can disambiguate a shared organization name.
  resolutions.forEach((resolution, index) => {
    if (resolution.status !== 'exact' && resolution.status !== 'partial') return;
    handled.add(index);
    assign(index, resolution.team, resolution.status);
  });

  // An organization-only name such as "REAL CRIA" can identify the remaining
  // A/B roster slot once the explicitly named sibling has claimed its own slot.
  let assignedContextualMatch = true;
  while (assignedContextualMatch) {
    assignedContextualMatch = false;
    resolutions.forEach((resolution, index) => {
      if (handled.has(index) || resolution.status !== 'ambiguous') return;
      const baseKey = matchResultTeamKey(results[index].teamName);
      const candidateKeys = resolution.candidates.map(candidate => matchResultTeamKey(candidate.teamName));
      const isExplicitABPair = candidateKeys.length === 2 &&
        candidateKeys.includes(`${baseKey} a`) &&
        candidateKeys.includes(`${baseKey} b`);
      if (!isExplicitABPair) return;
      const availableCandidates = resolution.candidates.filter(candidate => !usedSlots.has(candidate.slot));
      if (availableCandidates.length !== 1) return;
      handled.add(index);
      if (assign(index, availableCandidates[0], 'partial', true)) assignedContextualMatch = true;
    });
  }

  resolutions.forEach((resolution, index) => {
    if (handled.has(index)) return;
    const result = results[index];
    const availableCandidates = resolution.status === 'ambiguous'
      ? resolution.candidates.filter(candidate => !usedSlots.has(candidate.slot))
      : [];
    const candidateNames = resolution.candidates
      .map(candidate => candidate.teamName)
      .join(', ');
    const reason = resolution.status === 'ambiguous'
      ? availableCandidates.length
        ? `pode corresponder a ${candidateNames}`
        : `corresponde a equipes já identificadas (${candidateNames})`
      : 'não consta na lista oficial';
    ignored.push(result.teamName);
    warnings.push(`"${result.teamName}" ${reason}; sua pontuação será ignorada.`);
  });

  const teams = Array.from(mappedByIndex.entries())
    .sort(([left], [right]) => left - right)
    .map(([, team]) => team);

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
      warnings.push(
        `"${team.teamName}": KillScore inválido no cabeçalho; será usada a soma individual (${team.kills}).`,
      );
    } else if (team.reportedKills !== team.kills) {
      warnings.push(
        `"${team.teamName}": KillScore do cabeçalho (${team.reportedKills}) difere da soma individual (${team.kills}); será usada a soma individual.`,
      );
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
      warnings.push(
        `"${team.teamName}": TotalScore informado (${team.reportedTotalPoints}) difere do cálculo com os abates individuais (${expectedTotal}); será usado ${expectedTotal}.`,
      );
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
    slot: Number(team.slot) || index + 1,
    wins: team.wins,
    kills: team.kills,
    points: team.points,
  }));
}
