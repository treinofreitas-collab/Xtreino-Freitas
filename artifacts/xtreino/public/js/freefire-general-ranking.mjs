import { matchResultTeamKey } from './freefire-matchresult.mjs';

export const GENERAL_RANKING_EVENT_TYPES = Object.freeze({
  'treino-freitas': 'TREINO FREITAS',
  'modo-liga': 'TREINO MODO LIGA',
});

export function generalRankingTeamKey(teamName) {
  const normalized = matchResultTeamKey(teamName);
  if (normalized) return normalized;
  const raw = String(teamName ?? '')
    .normalize('NFKC')
    .replace(/[\u200b-\u200f\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
  return raw
    ? `special ${[...raw].map(character => character.codePointAt(0).toString(16)).join(' ')}`
    : '';
}

const MAX_IMPORT_ROWS = 20_000;
export const MIN_GENERAL_RANKING_SEED_ROWS = 4_000;

function parsePoints(value) {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  if (!digits) return null;
  const points = Number(digits);
  return Number.isSafeInteger(points) ? points : null;
}

function parseDelimitedLine(line, delimiter) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cellTeamName(value) {
  const imageAlt = String(value ?? '').match(/!\[([^\]]+)\]/)?.[1];
  const cleaned = String(imageAlt || value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

function parseMarkdownRows(lines) {
  const rows = [];
  for (const line of lines) {
    if (!line.trim().startsWith('|') || /^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    if (cells.length < 2 || /standings/i.test(cells.join(' ')) && !/\d/.test(cells.at(-1))) continue;
    const points = parsePoints(cells.at(-1));
    if (points === null) continue;
    const imageName = cells.map(cell => cellTeamName(cell)).find((cell, index) =>
      Boolean(cell) && index > 0 && index < cells.length - 1 && /[\p{L}]/u.test(cell),
    );
    const teamName = imageName || cells
      .slice(1, -1)
      .map(cellTeamName)
      .filter(cell => /[\p{L}]/u.test(cell))
      .sort((a, b) => b.length - a.length)[0] || '';
    if (teamName) rows.push({ teamName, points });
  }
  return rows;
}

function findColumn(headers, patterns) {
  return headers.findIndex(header => patterns.some(pattern => pattern.test(normalizeHeader(header))));
}

function parseTableRows(lines) {
  const delimiter = lines.slice(0, 8).some(line => line.includes('\t')) ? '\t' : ',';
  const matrix = lines.map(line => parseDelimitedLine(line, delimiter));
  const headerIndex = matrix.findIndex(row =>
    row.some(cell => /team|competitor|equipe|time|name|standings/i.test(normalizeHeader(cell))) &&
    row.some(cell => /point|ponto|score|^p$/i.test(normalizeHeader(cell))),
  );

  if (headerIndex >= 0) {
    const headers = matrix[headerIndex];
    const teamIndex = findColumn(headers, [/team/, /competitor/, /equipe/, /^time$/, /^name$/, /standings/]);
    const pointsIndex = findColumn(headers, [/point/, /ponto/, /score/, /^p$/]);
    return matrix.slice(headerIndex + 1).flatMap(row => {
      const points = parsePoints(row[pointsIndex]);
      const preferred = teamIndex >= 0 ? cellTeamName(row[teamIndex]) : '';
      const teamName = preferred || row
        .filter((_, index) => index !== pointsIndex)
        .map(cellTeamName)
        .filter(cell => /[\p{L}]/u.test(cell))
        .sort((a, b) => b.length - a.length)[0] || '';
      return teamName && points !== null ? [{ teamName, points }] : [];
    });
  }

  return matrix.flatMap(row => {
    if (row.length < 2) return [];
    const pointsIndex = row.length - 1;
    const points = parsePoints(row[pointsIndex]);
    if (points === null) return [];
    const teamName = row
      .slice(0, pointsIndex)
      .map(cellTeamName)
      .filter(cell => /[\p{L}]/u.test(cell))
      .sort((a, b) => b.length - a.length)[0] || '';
    return teamName ? [{ teamName, points }] : [];
  });
}

function decodeHtmlText(value) {
  return String(value ?? '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function parseHtmlTable(source) {
  const tables = [...String(source).matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
  const candidates = [];
  const parseCells = markup => [...markup.matchAll(/<t([dh])\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)]
    .map(([, , attributes, cell]) => {
      const imageAlt = [...cell.matchAll(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*>/gi)]
        .map(([, alt]) => alt)
        .join(' ');
      const text = cell
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');
      return {
        value: decodeHtmlText(imageAlt || text).replace(/\s+/g, ' ').trim(),
        imageAlt: decodeHtmlText(imageAlt).replace(/\s+/g, ' ').trim(),
        colspan: Math.max(1, Number(attributes.match(/\bcolspan=["']?(\d+)/i)?.[1] || 1)),
      };
    });

  for (const [, tableMarkup] of tables) {
    const rowMarkups = [...tableMarkup.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map(([, row]) => row);
    const rows = rowMarkups.map(parseCells).filter(row => row.length);
    const headerIndex = rows.findIndex(row =>
      row.some(cell => /team|competitor|equipe|time|name|standings/i.test(normalizeHeader(cell.value))) &&
      row.some(cell => /point|ponto|score|^p$/i.test(normalizeHeader(cell.value))),
    );
    if (headerIndex < 0) continue;

    const expandedHeaders = [];
    for (const cell of rows[headerIndex]) {
      for (let index = 0; index < cell.colspan; index += 1) {
        expandedHeaders.push(cell.value);
      }
    }
    const headerTexts = rows[headerIndex].map(cell => cell.value);
    const isStandingsTable = headerTexts.some(cell => /standings/i.test(normalizeHeader(cell)));
    const pointsIndex = findColumn(expandedHeaders, [/point/, /ponto/, /score/, /^p$/]);
    const teamIndex = findColumn(expandedHeaders, [/team/, /competitor/, /equipe/, /^time$/, /^name$/, /standings/]);
    const parsedRows = rows.slice(headerIndex + 1).flatMap(row => {
      const resolvedPointsIndex = pointsIndex >= 0 && pointsIndex < row.length
        ? pointsIndex
        : row.length - 1;
      const points = parsePoints(row[resolvedPointsIndex]?.value);
      const preferred = teamIndex >= 0
        ? cellTeamName(row[teamIndex]?.value)
        : '';
      const imageName = row.find((cell, index) =>
        index !== resolvedPointsIndex && cell.imageAlt,
      )?.imageAlt || '';
      const teamName = preferred || cellTeamName(imageName) || row
        .filter((_, index) => index !== resolvedPointsIndex)
        .map(cell => cell.imageAlt || cell.value)
        .map(cellTeamName)
        .filter(cell => /[\p{L}\p{N}]/u.test(cell))
        .sort((a, b) => b.length - a.length)[0] || '';
      return teamName && points !== null ? [{ teamName, points }] : [];
    });
    if (parsedRows.length) candidates.push({ isStandingsTable, rows: parsedRows });
  }

  if (!candidates.length) return [];
  const standingsCandidates = candidates.filter(candidate => candidate.isStandingsTable);
  const preferredCandidates = standingsCandidates.length ? standingsCandidates : candidates;
  return preferredCandidates.sort((a, b) => b.rows.length - a.rows.length)[0].rows;
}

export function parseGeneralRankingImport(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '').trim();
  if (!source) return { rows: [], errors: ['O arquivo está vazio.'] };

  let rawRows = null;
  try {
    const parsed = JSON.parse(source);
    const entries = Array.isArray(parsed) ? parsed : parsed?.rows;
    if (Array.isArray(entries)) {
      rawRows = entries.map(entry => ({
        teamName: String(
          entry?.teamName ?? entry?.team ?? entry?.competitor ?? entry?.name ?? entry?.Standings ?? '',
        ).trim(),
        points: parsePoints(
          entry?.points ?? entry?.point ?? entry?.score ?? entry?.P ?? entry?.pontos ?? '',
        ),
      })).filter(row => row.teamName && row.points !== null);
    }
  } catch {
    // Text/CSV/TSV import is handled below.
  }

  if (rawRows === null) {
    const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    rawRows = /<table\b/i.test(source)
      ? parseHtmlTable(source)
      : lines.some(line => line.startsWith('|'))
      ? parseMarkdownRows(lines)
      : parseTableRows(lines);
  }

  const rows = rawRows
    .map(row => ({
      teamName: String(row.teamName || '').trim(),
      key: generalRankingTeamKey(row.teamName),
      points: Number(row.points),
    }))
    .filter(row => row.teamName && row.key && Number.isSafeInteger(row.points) && row.points >= 0);

  const errors = [];
  if (!rows.length) errors.push('Não encontrei linhas válidas com nome de equipe e pontuação.');
  if (rows.length > MAX_IMPORT_ROWS) errors.push(`O arquivo excede o limite de ${MAX_IMPORT_ROWS} linhas.`);
  return { rows: rows.slice(0, MAX_IMPORT_ROWS), errors };
}

export function aggregateGeneralRankingImport(rows) {
  const teams = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const teamName = String(row?.teamName || '').trim();
    const key = generalRankingTeamKey(row?.key || teamName);
    const points = Number(row?.points);
    if (!teamName || !key || !Number.isSafeInteger(points) || points < 0) continue;
    const current = teams.get(key) || {
      key,
      teamName,
      baselinePoints: 0,
      sourceRows: 0,
      sourceNames: [],
    };
    current.baselinePoints += points;
    current.sourceRows += 1;
    if (!current.sourceNames.includes(teamName)) current.sourceNames.push(teamName);
    if (points > current._largestSourcePoints) {
      current.teamName = teamName;
      current._largestSourcePoints = points;
    }
    teams.set(key, current);
  }
  return [...teams.values()]
    .map(({ _largestSourcePoints, ...team }) => team)
    .sort((a, b) => b.baselinePoints - a.baselinePoints || a.key.localeCompare(b.key));
}

export function generalRankingSessionKey(eventType, date, hour) {
  if (!Object.hasOwn(GENERAL_RANKING_EVENT_TYPES, eventType)) {
    throw new Error('Este evento não participa do Ranking Geral.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
    throw new Error('Informe a data da apuração.');
  }
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== String(date)) {
    throw new Error('Informe uma data válida para a apuração.');
  }
  const normalizedHour = String(hour || '').trim().replace(/[^\d]/g, '');
  if (!/^\d{1,2}$/.test(normalizedHour) || Number(normalizedHour) > 23) {
    throw new Error('Informe o horário da apuração.');
  }
  return `${eventType}_${date}_${String(Number(normalizedHour)).padStart(2, '0')}`;
}

export function buildGeneralRankingSessionTeams(standings = []) {
  const teams = new Map();
  for (const row of Array.isArray(standings) ? standings : []) {
    const teamName = String(row?.teamName || '').trim();
    const key = generalRankingTeamKey(teamName);
    const points = Number(row?.points);
    const wins = Number(row?.wins || 0);
    const kills = Number(row?.kills || 0);
    if (!key || !teamName || !Number.isSafeInteger(points) || points < 0) continue;
    const current = teams.get(key) || {
      key,
      teamName,
      points: 0,
      wins: 0,
      kills: 0,
      logoUrl: '',
      logoSource: '',
    };
    current.points += points;
    current.wins += Number.isSafeInteger(wins) && wins > 0 ? wins : 0;
    current.kills += Number.isSafeInteger(kills) && kills > 0 ? kills : 0;
    if (!current.logoUrl && row.logoUrl) {
      current.logoUrl = String(row.logoUrl);
      current.logoSource = String(row.logoSource || '');
    }
    teams.set(key, current);
  }
  return [...teams.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function rankGeneralRankingRows(rows = []) {
  const sorted = [...(Array.isArray(rows) ? rows : [])].sort((a, b) =>
    Number(b.totalPoints || 0) - Number(a.totalPoints || 0) ||
    generalRankingTeamKey(a.teamName).localeCompare(generalRankingTeamKey(b.teamName)),
  );
  let previousPoints = null;
  let currentRank = 0;
  return sorted.map((row, index) => {
    const points = Number(row.totalPoints || 0);
    if (previousPoints !== points) currentRank = index + 1;
    previousPoints = points;
    return { ...row, rank: currentRank };
  });
}
