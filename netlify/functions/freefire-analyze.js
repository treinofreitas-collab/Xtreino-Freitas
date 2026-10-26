const { GoogleGenAI } = require("@google/genai");
const { getAdmin, verifyFirebaseUser } = require("../shared/firebase-admin");

const ALLOWED_ROLES = new Set(["admin", "ceo", "gerente", "socio"]);
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGES_PER_ANALYSIS = 5;
const MAX_TOTAL_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = 5_900_000;
const MAX_REQUESTS_PER_MINUTE = 7;
const requestWindows = new Map();
let aiClient;

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function jsonResponse(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function requireScoringAdmin(event) {
  const headers = event.headers || {};
  const authorization = headers.authorization || headers.Authorization || "";
  if (!/^Bearer\s+.+$/i.test(String(authorization))) {
    throw new ApiError(401, "Entre novamente no painel para analisar imagens.");
  }

  let decodedToken;
  try {
    decodedToken = await verifyFirebaseUser(event);
  } catch (error) {
    if (error?.statusCode === 401) {
      throw new ApiError(401, "Sua sessão expirou. Entre novamente no painel.");
    }
    throw error;
  }
  const profile = await getAdmin()
    .firestore()
    .collection("users")
    .doc(decodedToken.uid)
    .get();
  const rawRole = profile.data()?.role;
  const role =
    typeof rawRole === "string"
      ? rawRole.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()
      : "";

  if (!ALLOWED_ROLES.has(role)) {
    throw new ApiError(403, "Este recurso está disponível apenas para a equipe administrativa.");
  }
  return decodedToken.uid;
}

function enforceRateLimit(uid) {
  const now = Date.now();
  for (const [key, window] of requestWindows) {
    if (now - window.startedAt >= 60_000) requestWindows.delete(key);
  }

  const current = requestWindows.get(uid);
  if (!current || now - current.startedAt >= 60_000) {
    requestWindows.set(uid, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= MAX_REQUESTS_PER_MINUTE) {
    throw new ApiError(429, "Muitas análises em sequência. Aguarde um minuto e tente novamente.");
  }
  current.count += 1;
}

function parseImage(value) {
  if (!isRecord(value)) {
    throw new ApiError(400, "Uma das imagens enviadas está inválida.");
  }
  const { mimeType, base64 } = value;
  if (
    typeof mimeType !== "string" ||
    !ALLOWED_MIME_TYPES.has(mimeType) ||
    typeof base64 !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)
  ) {
    throw new ApiError(400, "Envie imagens PNG, JPG ou WebP válidas.");
  }
  return { mimeType, base64 };
}

function parseImageGroup(value, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new ApiError(400, `Envie entre ${min} e ${max} imagem(ns) para esta etapa.`);
  }
  return value.map(parseImage);
}

function enforceImagePayload(images) {
  if (images.length > MAX_IMAGES_PER_ANALYSIS) {
    throw new ApiError(400, "Envie no máximo cinco imagens por análise.");
  }
  const totalBytes = images.reduce(
    (total, image) => total + Buffer.from(image.base64, "base64").byteLength,
    0,
  );
  if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
    throw new ApiError(413, "As imagens passaram do limite de 4 MB. Reduza o tamanho e tente novamente.");
  }
}

function parseOfficialTeams(value) {
  if (!Array.isArray(value) || value.length !== 12) {
    throw new ApiError(400, "A lista oficial deve conter exatamente 12 slots.");
  }
  const teams = value.map((team) => {
    if (
      !isRecord(team) ||
      !Number.isInteger(team.slot) ||
      typeof team.teamName !== "string" ||
      team.teamName.trim().length < 1 ||
      team.teamName.trim().length > 80
    ) {
      throw new ApiError(400, "Confira os números dos slots e os nomes dos 12 times.");
    }
    if (team.slot < 1 || team.slot > 12) {
      throw new ApiError(400, "Os slots precisam estar numerados de 1 a 12.");
    }
    return { slot: team.slot, teamName: team.teamName.trim() };
  });

  if (new Set(teams.map((team) => team.slot)).size !== 12) {
    throw new ApiError(400, "Cada número de slot deve aparecer uma única vez.");
  }
  return teams.sort((a, b) => a.slot - b.slot);
}

function normalizeTeams(result) {
  if (!isRecord(result) || !Array.isArray(result.teams)) {
    throw new ApiError(503, "A IA não conseguiu identificar a lista de slots.");
  }
  const seen = new Set();
  const teams = [];
  for (const item of result.teams) {
    if (!isRecord(item)) continue;
    const slot = Number(item.slot);
    const teamName = typeof item.teamName === "string" ? item.teamName.trim() : "";
    if (!Number.isInteger(slot) || slot < 1 || slot > 12 || !teamName || seen.has(slot)) continue;
    seen.add(slot);
    teams.push({ slot, teamName: teamName.slice(0, 80) });
  }
  return teams.sort((a, b) => a.slot - b.slot);
}

function normalizePlacements(result, officialTeams) {
  if (!isRecord(result) || !Array.isArray(result.placements)) {
    throw new ApiError(503, "A IA não conseguiu identificar os resultados desta queda.");
  }
  const officialNames = new Map(officialTeams.map((team) => [team.slot, team.teamName]));
  const placements = result.placements.flatMap((item) => {
    if (!isRecord(item)) return [];
    const position = Number(item.position);
    const rawSlot = item.slot;
    const slot =
      rawSlot === null || rawSlot === undefined || rawSlot === ""
        ? null
        : Number(rawSlot);
    const kills = Number(item.kills);
    if (
      !Number.isInteger(position) ||
      position < 1 ||
      position > 12 ||
      !Number.isInteger(kills) ||
      kills < 0 ||
      kills > 99 ||
      (slot !== null && (!Number.isInteger(slot) || slot < 1 || slot > 12))
    ) {
      return [];
    }
    const players = Array.isArray(item.players)
      ? item.players
          .flatMap((player) => {
            if (!isRecord(player)) return [];
            const name = typeof player.name === "string" ? player.name.trim().slice(0, 80) : "";
            const playerKills = Number(player.kills);
            const rawLobbySlot = player.lobbySlot;
            const parsedLobbySlot =
              rawLobbySlot === null || rawLobbySlot === undefined || rawLobbySlot === ""
                ? null
                : Number(rawLobbySlot);
            const lobbySlot =
              parsedLobbySlot !== null &&
              Number.isInteger(parsedLobbySlot) &&
              parsedLobbySlot >= 1 &&
              parsedLobbySlot <= 12
                ? parsedLobbySlot
                : null;
            return name && Number.isInteger(playerKills) && playerKills >= 0 && playerKills <= 99
              ? [{ name, kills: playerKills, lobbySlot }]
              : [];
          })
          .slice(0, 6)
      : [];
    const playerSlotCounts = new Map();
    for (const player of players) {
      if (player.lobbySlot !== null) {
        playerSlotCounts.set(
          player.lobbySlot,
          (playerSlotCounts.get(player.lobbySlot) || 0) + 1,
        );
      }
    }
    const sortedPlayerSlots = [...playerSlotCounts.entries()].sort((a, b) => b[1] - a[1]);
    const majorityPlayerSlot =
      sortedPlayerSlots[0]?.[1] >= 2 && sortedPlayerSlots[0][1] > (sortedPlayerSlots[1]?.[1] || 0)
        ? sortedPlayerSlots[0][0]
        : null;
    const resolvedSlot = majorityPlayerSlot ?? slot;
    const playerSlotConflict = playerSlotCounts.size > 1;
    const playerSlotMismatch = majorityPlayerSlot !== null && majorityPlayerSlot !== slot;
    const playerKillsTotal = players.reduce((total, player) => total + player.kills, 0);
    const killTotalMismatch = players.length > 0 && playerKillsTotal !== kills;
    const modelConfidence =
      item.confidence === "high" || item.confidence === "medium" || item.confidence === "low"
        ? item.confidence
        : "low";
    const confidence =
      killTotalMismatch || playerSlotConflict || playerSlotMismatch ? "low" : modelConfidence;
    const modelNotes = typeof item.notes === "string" ? item.notes.trim() : "";
    const validationNotes = [];
    if (killTotalMismatch) {
      validationNotes.push(
        `A soma individual (${playerKillsTotal}) difere do total (${kills}); confira os abates no placar.`,
      );
    }
    if (playerSlotMismatch) {
      validationNotes.push(`Os jogadores indicam o slot ${majorityPlayerSlot}; confira a equipe atribuída.`);
    } else if (playerSlotConflict) {
      validationNotes.push("Os jogadores foram associados a mais de um slot; confira a equipe.");
    }
    const notes = [modelNotes, ...validationNotes]
      .filter(Boolean)
      .join(" ")
      .slice(0, 220);
    return [
      {
        position,
        slot: resolvedSlot,
        teamName: resolvedSlot === null ? null : officialNames.get(resolvedSlot) || null,
        kills,
        players,
        confidence,
        notes,
      },
    ];
  });

  const unmatchedPlayers = Array.isArray(result.unmatchedPlayers)
    ? result.unmatchedPlayers
        .filter((name) => typeof name === "string")
        .map((name) => name.trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 40)
    : [];
  return { placements, unmatchedPlayers };
}

function normalizePlayerName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function playerFingerprint(placement) {
  return placement.players
    .map((player) => `${normalizePlayerName(player.name)}:${player.kills}:${player.lobbySlot ?? ""}`)
    .sort()
    .join("|");
}

function markPlacementForReview(placement, note) {
  return {
    ...placement,
    confidence: "low",
    notes: [note, placement.notes].filter(Boolean).join(" ").slice(0, 220),
  };
}

function reconcilePlacements(first, second) {
  const firstByPosition = new Map(first.placements.map((placement) => [placement.position, placement]));
  const secondPositions = new Set(second.placements.map((placement) => placement.position));
  const placements = second.placements.map((reviewed) => {
    const initial = firstByPosition.get(reviewed.position);
    if (!initial) {
      return markPlacementForReview(
        reviewed,
        "Só a segunda conferência identificou esta posição; confira no placar.",
      );
    }

    const differences = [];
    if (initial.kills !== reviewed.kills) {
      differences.push(`abates: ${initial.kills} vs ${reviewed.kills}`);
    }
    if (initial.slot !== reviewed.slot) {
      differences.push(`slot: ${initial.slot ?? "?"} vs ${reviewed.slot ?? "?"}`);
    }
    if (playerFingerprint(initial) !== playerFingerprint(reviewed)) {
      differences.push("jogadores/abates individuais");
    }

    return differences.length
      ? markPlacementForReview(
          reviewed,
          `As conferências divergiram (${differences.join("; ")}); confira no placar.`,
        )
      : reviewed;
  });

  for (const initial of first.placements) {
    if (!secondPositions.has(initial.position)) {
      placements.push(
        markPlacementForReview(
          initial,
          "A primeira conferência identificou esta posição, mas a segunda não; confira no placar.",
        ),
      );
    }
  }

  const unmatchedPlayers = [];
  const seenUnmatched = new Set();
  for (const name of [...first.unmatchedPlayers, ...second.unmatchedPlayers]) {
    const key = normalizePlayerName(name);
    if (key && !seenUnmatched.has(key)) {
      unmatchedPlayers.push(name);
      seenUnmatched.add(key);
    }
  }

  return {
    placements: placements.sort((a, b) => a.position - b.position),
    unmatchedPlayers: unmatchedPlayers.slice(0, 40),
  };
}

function getAiClient() {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new ApiError(503, "A chave do Google AI Studio não está configurada na Netlify.");
  }
  if (!aiClient) aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
}

async function generateJson(prompt, images) {
  const parts = [{ text: prompt }];
  for (const [index, image] of images.entries()) {
    parts.push({ text: `Imagem ${index + 1}:` });
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.base64,
      },
    });
  }

  let response;
  try {
    response = await getAiClient().models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: [{ role: "user", parts }],
      config: {
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const statusValue = [
      error?.status,
      error?.statusCode,
      error?.response?.status,
      error?.code,
    ].find((value) => {
      const numericValue = Number(value);
      return Number.isInteger(numericValue) && numericValue >= 400 && numericValue < 600;
    });
    const statusCode = statusValue === undefined ? null : Number(statusValue);
    const rawProviderCode =
      typeof error?.status === "string"
        ? error.status
        : typeof error?.code === "string"
          ? error.code
          : "";
    const providerCode = /^[A-Za-z0-9_.-]{1,64}$/.test(rawProviderCode)
      ? rawProviderCode
      : null;
    const rawName = typeof error?.name === "string" ? error.name : "";
    const errorName = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(rawName) ? rawName : "Error";
    console.error("[Free Fire] Gemini request failed", {
      statusCode,
      providerCode,
      errorName,
    });

    if (statusCode === 429) {
      throw new ApiError(429, "O Gemini atingiu um limite temporário. Aguarde e tente novamente.");
    }
    if (statusCode === 401 || statusCode === 403) {
      throw new ApiError(
        503,
        "O Google AI Studio recusou a análise. A equipe precisa revisar a configuração da chave na Netlify.",
      );
    }
    if (statusCode === 404) {
      throw new ApiError(
        503,
        "O modelo de análise não está disponível para esta configuração. A equipe precisa revisar o serviço.",
      );
    }
    if (statusCode === 400) {
      throw new ApiError(
        503,
        "O Google não aceitou os dados desta análise. Confira as imagens e tente novamente.",
      );
    }
    throw new ApiError(
      503,
      "O serviço de análise não concluiu esta leitura. Nenhuma pontuação foi aplicada; tente novamente.",
    );
  }

  const raw = response.text?.trim();
  if (!raw) {
    console.error("[Free Fire] Gemini returned empty output");
    throw new ApiError(
      503,
      "A IA não retornou dados válidos. Nenhuma pontuação foi aplicada; tente novamente.",
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    console.error("[Free Fire] Gemini returned invalid JSON");
    throw new ApiError(
      503,
      "A resposta da IA veio em formato inválido. Nenhuma pontuação foi aplicada; tente novamente.",
    );
  }
}

function parseRequestBody(event) {
  if (!event.body) throw new ApiError(400, "Envie uma solicitação de análise.");
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) {
    throw new ApiError(413, "As imagens ultrapassaram o limite de envio. Reduza o tamanho e tente novamente.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, "O conteúdo enviado não está em um formato válido.");
  }
}

async function analyze(body) {
  if (!isRecord(body) || (body.mode !== "roster" && body.mode !== "drop")) {
    throw new ApiError(400, "Solicitação de análise inválida.");
  }

  if (body.mode === "roster") {
    const images = parseImageGroup(body.images, 1, 2);
    enforceImagePayload(images);
    const prompt = [
      "Leia a lista oficial de slots para um campeonato Free Fire nestas imagens.",
      "Retorne somente JSON no formato {\"teams\":[{\"slot\":1,\"teamName\":\"NOME DO TIME\"}]}.",
      "A lista tem até 12 slots; preserve o número do slot e o nome oficial como aparecem.",
      "Não use nomes de jogadores, tags de clã ou suposições para substituir o nome do time.",
      "Se um número ou nome não puder ser lido, omita esse item em vez de inventar.",
    ].join(" ");
    return { teams: normalizeTeams(await generateJson(prompt, images)) };
  }

  if (!Number.isInteger(body.dropNumber) || body.dropNumber < 1 || body.dropNumber > 5) {
    throw new ApiError(400, "O número da queda precisa estar entre 1 e 5.");
  }
  const officialTeams = parseOfficialTeams(body.teams);
  const slotImages = parseImageGroup(body.slotImages, 3, 3);
  const resultImages = parseImageGroup(body.resultImages, 1, 2);
  const images = [...slotImages, ...resultImages];
  enforceImagePayload(images);

  const teamList = officialTeams.map((team) => `Slot ${team.slot}: ${team.teamName}`).join("\n");
  const prompt = [
    `Analise as imagens da queda ${body.dropNumber} de um campeonato Free Fire.`,
    "As primeiras imagens mostram a sala/lobby e a composição de jogadores em cada slot; depois estão as imagens com o resultado final e abates individuais.",
    "Use o número do slot no lobby para atribuir cada jogador ao time da lista oficial abaixo.",
    "A lista oficial por slot é a fonte de verdade: ignore tags ou nomes de clã que indiquem outro time.",
    "Trabalhe em duas etapas: primeiro leia os nicks e slots do lobby; depois associe cada nick do placar a esse registro. Não use a posição da equipe no ranking para inferir o slot.",
    "Se um jogador aparecer no placar final dentro do grupo/slot de um time, mas não aparecer nas fotos iniciais do lobby, trate-o como reserva daquele time e inclua os abates dele na soma da equipe.",
    "Não marque um jogador como sem vínculo somente por ele não aparecer no lobby inicial. Use o grupo/slot em que aparece no placar final para associar reservas; não invente uma associação se o placar não mostrar claramente o time.",
    teamList,
    "Leia a coluna de abates de cada jogador visível, sem pular linhas. Inclua reservas agrupadas com o time. Retorne cada jogador e seus abates em players; kills deve ser exatamente a soma dos abates listados.",
    "Em cada jogador, inclua lobbySlot com o slot correspondente no lobby; use null para reserva não encontrada. Os jogadores reconhecidos da mesma equipe devem apontar para o mesmo slot. Se houver conflito, mantenha confidence como low e explique em notes.",
    "Faça uma conferência final: compare o total kills com a soma de players. Se algum número ou jogador estiver ilegível, não adivinhe; mantenha confidence como low e explique em notes.",
    "Não invente posições, slots, nomes, abates ou dados fora das imagens. Se não conseguir ligar um time ao resultado, use slot:null, teamName:null e explique em notes.",
    "Retorne somente JSON no formato: {\"placements\":[{\"position\":1,\"slot\":1,\"teamName\":\"nome oficial ou null\",\"kills\":5,\"players\":[{\"name\":\"jogador\",\"kills\":2,\"lobbySlot\":1}],\"confidence\":\"high|medium|low\",\"notes\":\"\"}],\"unmatchedPlayers\":[\"jogador não associado\"]}.",
    "Inclua no máximo 12 posições; cada jogador deve aparecer em players com o número de abates lido.",
    "A pontuação é calculada pelo sistema depois; não calcule pontos de colocação.",
  ].join("\n");
  const firstResult = normalizePlacements(await generateJson(prompt, images), officialTeams);
  const verificationPrompt = [
    "Faça uma segunda conferência independente das imagens abaixo para validar o placar.",
    "Primeiro, leia o lobby, os slots, todos os jogadores visíveis e cada valor de abates diretamente nas imagens sem usar os valores da primeira leitura.",
    "Depois, compare sua leitura independente com a primeira e corrija qualquer slot, jogador ou abate que não corresponda às imagens. Não presuma que a primeira leitura está correta.",
    "Retorne o resultado completo no mesmo formato JSON solicitado, incluindo todas as posições e jogadores reconhecidos. Não retorne apenas as diferenças.",
    "Primeira leitura para conferir:",
    JSON.stringify(firstResult),
    "Instruções e lista oficial:",
    prompt,
  ].join("\n");
  const secondResult = normalizePlacements(
    await generateJson(verificationPrompt, images),
    officialTeams,
  );
  return reconcilePlacements(firstResult, secondResult);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Método não permitido." }, { Allow: "POST" });
  }

  try {
    const uid = await requireScoringAdmin(event);
    enforceRateLimit(uid);
    const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"] || "";
    if (!String(contentType).toLowerCase().includes("application/json")) {
      throw new ApiError(415, "Envie os dados no formato JSON.");
    }
    const result = await analyze(parseRequestBody(event));
    return jsonResponse(200, result);
  } catch (error) {
    const statusCode =
      Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 503;
    const message =
      error instanceof ApiError || Number.isInteger(error?.statusCode)
        ? error.message
        : "A análise automática está temporariamente indisponível.";
    return jsonResponse(statusCode, { error: message });
  }
};
