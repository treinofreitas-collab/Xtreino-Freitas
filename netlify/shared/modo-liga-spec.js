const SPEC_HOURS = new Set(["19", "20", "21", "22", "23", "00"]);
const SPEC_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const FIRST_SPEC_CODE = 902000034;
const SPEC_STORAGE_ROOT = "teams/modo-liga/logos/spec";
const SPEC_LOCK_COLLECTION = "modo_liga_spec_letter_locks";
const SPEC_HOLD_MS = 30 * 60 * 1000;
const ALLOWED_SOURCE_TYPES = new Set(["image/png"]);
// These names are alternate SPEC codes; the customer's logo is the image uploaded to the slot.
const SPEC_AVATARS = [
  { selection: "avatar:kelly", name: "Kelly", code: "902000007" },
  { selection: "avatar:maxim", name: "Maxim", code: "902000030" },
  { selection: "avatar:andrew", name: "Andrew", code: "902000006" },
];

function normalizedText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

function isModoLigaType(value) {
  const normalized = normalizedText(value);
  return normalized === "liga" || normalized.includes("modo-liga");
}

function normalizeSpecLetter(value) {
  const letter = String(value || "").trim().toUpperCase();
  return SPEC_LETTERS.includes(letter) ? letter : "";
}

function normalizeSpecAvatar(value) {
  const avatar = String(value || "").trim().toLowerCase();
  return SPEC_AVATARS.some(item => item.selection === avatar) ? avatar : "";
}

function normalizeSpecSelection(value) {
  return normalizeSpecLetter(value) || normalizeSpecAvatar(value);
}

function normalizeSpecHour(value) {
  const match = String(value ?? "").match(/(?<!\d)(\d{1,2})(?!\d)(?:\s*h|\s*:|$)/i);
  if (!match) return "";
  const hour = String(Number(match[1])).padStart(2, "0");
  return SPEC_HOURS.has(hour) ? hour : "";
}

function specCodeForSelection(value) {
  const letter = normalizeSpecLetter(value);
  if (letter) return String(FIRST_SPEC_CODE + SPEC_LETTERS.indexOf(letter));
  return SPEC_AVATARS.find(item => item.selection === normalizeSpecAvatar(value))?.code || "";
}

function specPathForSelection(hour, selection) {
  const normalizedHour = normalizeSpecHour(hour);
  const code = specCodeForSelection(selection);
  return normalizedHour && code ? `${SPEC_STORAGE_ROOT}/${normalizedHour}H/${code}.png` : "";
}

function fail(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function objectPathFromUrl(value, bucketName) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    let objectPath = "";
    if (url.protocol === "gs:") {
      if (url.hostname !== bucketName) return "";
      objectPath = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    } else if (url.hostname === "firebasestorage.googleapis.com") {
      const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (!match || decodeURIComponent(match[1]) !== bucketName) return "";
      objectPath = decodeURIComponent(match[2]);
    } else if (url.hostname === "storage.googleapis.com") {
      const path = url.pathname.replace(/^\/+/, "");
      const separator = path.indexOf("/");
      if (separator < 1 || decodeURIComponent(path.slice(0, separator)) !== bucketName) return "";
      objectPath = decodeURIComponent(path.slice(separator + 1));
    }
    if (
      !objectPath
      || objectPath.startsWith("/")
      || objectPath.includes("\\")
      || objectPath.split("/").some(part => !part || part === "." || part === "..")
    ) return "";
    return objectPath;
  } catch (_) {
    return "";
  }
}

function validOriginalLogoPath(url, { bucketName, userId, eventType }) {
  const objectPath = objectPathFromUrl(url, bucketName);
  const folder = String(eventType || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const eventLogoPrefix = `teams/${folder}/logos/`;
  const profileLogoPrefix = `profile-photos/${userId}/team-logos/`;
  if (objectPath.startsWith(eventLogoPrefix) && objectPath.length > eventLogoPrefix.length) {
    return objectPath;
  }
  if (objectPath.startsWith(profileLogoPrefix) && objectPath.length > profileLogoPrefix.length) {
    return objectPath;
  }
  return "";
}

function registrationHour(registration) {
  return normalizeSpecHour(registration?.hour || registration?.schedule);
}

function registrationTeamKey(registration) {
  const name = String(registration?.teamName || "").trim().toLowerCase().replace(/\s+/g, " ");
  const email = String(registration?.email || "").trim().toLowerCase();
  return `${name}|${email}`;
}

function registrationTeamKeyForSpec(registration) {
  return registrationTeamKey(registration);
}

async function prepareModoLigaSpecClaims(sources, { reference, userId, bucket }) {
  const selected = (sources || []).map(source => ({
    source,
    registration: source.data() || {},
  })).filter(item => (
    item.registration.modoLigaSpecLetter != null && item.registration.modoLigaSpecLetter !== ""
  ) || (
    item.registration.modoLigaSpecAvatar != null && item.registration.modoLigaSpecAvatar !== ""
  ));
  if (!selected.length) return [];
  const bucketName = String(bucket?.name || "");
  if (!bucketName) fail("Não foi possível validar o armazenamento da logo.");

  const selectionsByTeam = new Map();
  const slots = new Map();
  const claimsBySlot = new Map();
  const metadataCache = new Map();

  for (const { source, registration } of selected) {
    if (!isModoLigaType(registration.eventType)) {
      fail("A escolha de letra ou avatar está disponível apenas no Modo Liga.", 400);
    }
    if (registration.userId !== userId || registration.status !== "pending"
        || registration.external_reference !== reference) {
      fail("A inscrição mudou. Reabra o formulário e tente novamente.");
    }
    const letter = normalizeSpecLetter(registration.modoLigaSpecLetter);
    const avatar = normalizeSpecAvatar(registration.modoLigaSpecAvatar);
    if (letter && avatar) fail("Escolha uma letra ou um avatar, não ambos.", 400);
    const selection = letter || avatar;
    const hour = registrationHour(registration);
    if (!selection || !hour) {
      fail("A escolha de letra ou avatar não é válida para um dos horários selecionados.", 400);
    }
    const teamKey = registrationTeamKey(registration);
    if (!teamKey || teamKey === "|") fail("Não foi possível identificar o time da inscrição.");
    const previousSelection = selectionsByTeam.get(teamKey);
    if (previousSelection && previousSelection !== selection) {
      fail("Escolha a mesma letra ou o mesmo avatar para todos os horários deste time.", 400);
    }
    selectionsByTeam.set(teamKey, selection);

    const logoUrl = String(registration.teamLogoUrl || registration.logoOriginalUrl || "").trim();
    const logoObjectPath = validOriginalLogoPath(logoUrl, {
      bucketName,
      userId,
      eventType: registration.eventType,
    });
    if (!logoObjectPath) {
      fail("A logo original deste time não foi encontrada. Envie a logo novamente ou retire a escolha de identificação.", 400);
    }
    if (!metadataCache.has(logoObjectPath)) {
      metadataCache.set(logoObjectPath, bucket.file(logoObjectPath).getMetadata());
    }
    let logoMetadata;
    try {
      [logoMetadata] = await metadataCache.get(logoObjectPath);
    } catch (_) {
      fail("A logo original não está mais disponível. Envie a logo novamente ou retire a escolha de identificação.", 400);
    }
    if (!ALLOWED_SOURCE_TYPES.has(String(logoMetadata?.contentType || "").toLowerCase())) {
      fail("Para enviar ao SPEC, envie a logo novamente pelo formulário.");
    }

    const slotKey = `${hour}_${selection}`;
    const currentOwner = slots.get(slotKey);
    if (currentOwner && currentOwner !== teamKey) {
      fail(`A escolha ${letter || `Avatar ${avatar}`} já foi selecionada por outro time para ${hour}h.`);
    }
    slots.set(slotKey, teamKey);

    const current = claimsBySlot.get(slotKey) || {
      hour,
      selection,
      letter,
      avatar,
      teamKey,
      teamName: String(registration.teamName || "").trim(),
      logoObjectPath,
      storagePath: specPathForSelection(hour, selection),
      registrationPaths: [],
    };
    if (current.logoObjectPath !== logoObjectPath) {
      fail("O time selecionou logos diferentes para a mesma letra e horário.");
    }
    current.registrationPaths.push(source.ref.path);
    claimsBySlot.set(slotKey, current);
  }

  const claims = [...claimsBySlot.values()].map(claim => ({
    ...claim,
    registrationPaths: [...new Set(claim.registrationPaths)],
    bucketName,
  }));
  for (const claim of claims) {
    const [assetExists] = await bucket.file(claim.storagePath).exists();
    if (assetExists) {
      fail(claim.letter
        ? `A letra ${claim.letter} já está ocupada em ${claim.hour}h. Escolha outra letra.`
        : `O código do avatar ${claim.avatar} já está ocupado em ${claim.hour}h. Escolha outro.`);
    }
  }
  return claims;
}

async function getAvailableModoLigaSpecOptions({ db, bucket, hours }) {
  const normalizedHours = [...new Set((hours || []).map(normalizeSpecHour).filter(Boolean))];
  if (!normalizedHours.length || normalizedHours.length !== new Set(hours || []).size) {
    fail("Selecione horários SPEC válidos.", 400);
  }
  const blockedByHour = new Map(normalizedHours.map(hour => [hour, new Set()]));
  const occupiedAvatarsByHour = new Map(normalizedHours.map(hour => [hour, new Set()]));
  const fileLists = await Promise.all(normalizedHours.map(hour =>
    bucket.getFiles({ prefix: `${SPEC_STORAGE_ROOT}/${hour}H/` })));
  for (let index = 0; index < normalizedHours.length; index++) {
    const hour = normalizedHours[index];
    const [files] = fileLists[index];
    for (const file of files || []) {
      const match = String(file.name || "").match(/\/(\d+)\.png$/i);
      if (!match) continue;
      const code = match[1];
      const letterIndex = Number(code) - FIRST_SPEC_CODE;
      if (Number.isInteger(letterIndex) && letterIndex >= 0 && letterIndex < SPEC_LETTERS.length) {
        blockedByHour.get(hour).add(SPEC_LETTERS[letterIndex]);
      }
      const avatar = SPEC_AVATARS.find(item => item.code === code);
      if (avatar) occupiedAvatarsByHour.get(hour).add(avatar.selection);
    }
  }

  const lockSnapshot = await db.collection(SPEC_LOCK_COLLECTION).where("hour", "in", normalizedHours).get();
  const now = Date.now();
  for (const lock of lockSnapshot.docs || []) {
    const data = lock.data() || {};
    const hour = normalizeSpecHour(data.hour);
    const selection = normalizeSpecSelection(data.selection || data.letter || data.avatar);
    const expiresAt = data.expiresAt?.toMillis?.() ?? new Date(data.expiresAt || 0).getTime();
    if (
      hour && selection && blockedByHour.has(hour)
      && (data.status === "paid" || expiresAt > now)
    ) {
      if (selection.startsWith("avatar:")) {
        occupiedAvatarsByHour.get(hour).add(`locked:${selection}`);
      } else {
        blockedByHour.get(hour).add(selection);
      }
    }
  }

  return {
    availableLetters: SPEC_LETTERS.filter(letter => normalizedHours.every(hour =>
      !blockedByHour.get(hour).has(letter))),
    availableAvatars: SPEC_AVATARS.filter(avatar => normalizedHours.every(hour =>
      !occupiedAvatarsByHour.get(hour).has(avatar.selection)
      && !occupiedAvatarsByHour.get(hour).has(`locked:${avatar.selection}`),
    )),
  };
}

async function getAvailableModoLigaSpecLetters(options) {
  return (await getAvailableModoLigaSpecOptions(options)).availableLetters;
}

function specLockId(hour, selection) {
  const normalized = normalizeSpecSelection(selection);
  return `${hour}_${normalized.replace(":", "-")}`;
}

module.exports = {
  SPEC_HOURS,
  SPEC_LETTERS,
  SPEC_AVATARS,
  SPEC_LOCK_COLLECTION,
  SPEC_HOLD_MS,
  getAvailableModoLigaSpecOptions,
  getAvailableModoLigaSpecLetters,
  isModoLigaType,
  normalizeSpecHour,
  normalizeSpecAvatar,
  normalizeSpecLetter,
  normalizeSpecSelection,
  objectPathFromUrl,
  prepareModoLigaSpecClaims,
  registrationTeamKeyForSpec,
  specLockId,
  specPathForSelection,
};
