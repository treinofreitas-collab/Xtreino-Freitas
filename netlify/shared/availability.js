const UNAVAILABLE_MESSAGE = "Não foi possível confirmar as vagas agora. Nenhuma cobrança foi iniciada. Tente novamente.";
const CAMP_SEASON_7_START_DATE = "2026-11-16";
const ACTIVE_STATUSES = new Set(["paid", "confirmed", "approved", "lisagem_gratis"]);
const DEFAULT_CAPACITIES = {
  "modo-liga": 15, acesso: 15, "camp-final": 2, "camp-freitas": 12,
  "semanal-freitas": 12, "treino-freitas": 12, "xtreino-tokens": 12,
};

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function hourOf(value) {
  const match = String(value ?? "").match(/(?<!\d)(\d{1,2})(?!\d)(?:\s*h|\s*:|$)/i);
  return match ? Number(match[1]) : null;
}

function isModoLigaType(value) {
  const type = String(value || "").toLowerCase().trim().replace(/[\s_]+/g, "-");
  return type === "liga" || type === "acesso" || type.includes("modo-liga");
}

function isCampSeason7(config) {
  const name = [config?.name, config?.label, config?.title]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return name.includes("camp") && /\bseason\s*7\b/.test(name);
}

function isIntensivoFreitas(config) {
  if (String(config?.urlSlug || "").trim().toLowerCase() === "intensivo") return true;
  return [config?.name, config?.label, config?.title]
    .filter(Boolean)
    .some(value => String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim() === "intensivo freitas");
}

function isIntensivoFreitasLockType(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized === "intensivo" || normalized === "intensivo-freitas";
}

function registrationMatchesSelectedEvent(record, eventType, adminEventId, eventName) {
  const normalize = value => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ");
  const selectedId = normalize(adminEventId);
  const selectedType = normalize(eventType);
  const registrationIds = [
    record.adminEventId,
    record.admin_event_id,
    record.eventId,
    record.event_id,
  ].map(normalize).filter(Boolean);
  if (selectedId && registrationIds.length) return registrationIds.includes(selectedId);

  const selectedName = normalize(eventName);
  if (selectedName) {
    const registrationNames = [
      record.eventName,
      record.eventTitle,
      record.title,
      record.itemName,
      record.item,
    ].map(normalize).filter(Boolean);
    if (registrationNames.some(name => name === selectedName || name.startsWith(`${selectedName} -`))) {
      return true;
    }
  }

  const registrationType = normalize(record.eventType || record.event_type);
  if (selectedId && selectedId !== selectedType) return registrationType === selectedId;
  return registrationType === selectedType
    || (isModoLigaType(registrationType) && isModoLigaType(selectedType));
}

function normalizedTeamName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+[B-Z]$/i, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function validateRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid("Dados da reserva inválidos.");
  const { date, eventType, selectedTimes } = body;
  if (body.availabilitySnapshot != null && typeof body.availabilitySnapshot !== "boolean") {
    invalid("Consulta de disponibilidade inválida.");
  }
  const availabilitySnapshot = body.availabilitySnapshot === true;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())
      || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) invalid("Data inválida.");
  if (typeof eventType !== "string" || !/^[\w.-]{1,128}$/.test(eventType)) invalid("Evento inválido.");
  const rawAdminEventId = body.adminEventId;
  if (rawAdminEventId != null && (typeof rawAdminEventId !== "string"
      || !rawAdminEventId.trim() || rawAdminEventId.includes("/"))) invalid("Evento inválido.");
  const adminEventId = typeof rawAdminEventId === "string" ? rawAdminEventId.trim() : "";
  const maxRequestedHours = availabilitySnapshot ? 11 : 10;
  if (!Array.isArray(selectedTimes) || selectedTimes.length < 1 || selectedTimes.length > maxRequestedHours
      || selectedTimes.some(time => typeof time !== "string" || time.length > 80)) invalid("Selecione horários válidos.");
  const hours = selectedTimes.map(hourOf);
  if (hours.some(hour => hour == null || hour < 0 || hour > 23)
      || new Set(hours).size !== hours.length) invalid("Selecione horários válidos, sem repetições.");
  const numberOfTeams = Number(body.numberOfTeams);
  if (!Number.isInteger(numberOfTeams) || numberOfTeams < 1 || numberOfTeams > 100) invalid("Quantidade de times inválida.");
  const rawCandidates = body.teamCandidates;
  if (rawCandidates != null && (!Array.isArray(rawCandidates) || rawCandidates.length > 100)) {
    invalid("Lista de times inválida.");
  }
  const teamCandidates = (rawCandidates || []).map(candidate => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      invalid("Lista de times inválida.");
    }
    const name = candidate.name == null ? "" : candidate.name;
    const email = candidate.email == null ? "" : candidate.email;
    if (typeof name !== "string" || name.length > 120
        || typeof email !== "string" || email.length > 254) {
      invalid("Dados de time inválidos.");
    }
    return { name: name.trim(), email: email.trim().toLowerCase() };
  });
  if (availabilitySnapshot && (numberOfTeams !== 1 || teamCandidates.length > 0)) {
    invalid("Consulta de disponibilidade inválida.");
  }
  return {
    date,
    eventType,
    hours,
    numberOfTeams,
    teamCandidates,
    availabilitySnapshot,
    ...(adminEventId ? { adminEventId } : {}),
  };
}

async function checkAvailability(db, body) {
  const { date, eventType, adminEventId, hours, numberOfTeams, teamCandidates, availabilitySnapshot } = validateRequest(body);
  let catalog = await db.collection("adminEvents").doc(adminEventId || eventType).get();
  if (!catalog.exists && !adminEventId) {
    const matches = await db.collection("adminEvents").where("eventType", "==", eventType).limit(1).get();
    catalog = matches.docs[0];
  }
  const config = catalog?.exists ? catalog.data() : null;
  if (adminEventId && !config) return { available: false, message: "Evento não encontrado." };
  if (!config && !(eventType in DEFAULT_CAPACITIES)) {
    return { available: false, message: "Evento não encontrado." };
  }
  if (config?.status && !["Aberto", "Em breve"].includes(config.status)) {
    return { available: false, message: "Este evento não está disponível para reservas." };
  }
  if (isCampSeason7(config) && date < CAMP_SEASON_7_START_DATE) {
    return { available: false, message: "As vagas do Camp Season 7 estão disponíveis a partir de 16/11/2026." };
  }

  const isModoLiga = [
    eventType, config?.eventType, config?.name, config?.label, config?.title, config?.modo,
  ].some(isModoLigaType);
  if (hours.length > 10 && (!availabilitySnapshot || !isModoLiga)) {
    invalid("Selecione no máximo 10 horários para esta reserva.");
  }
  if (!isModoLiga && hours.includes(0)) invalid("O horário 00h00 está disponível apenas no Modo Liga.");
  const canonicalType = isModoLiga ? "modo-liga" : (config?.eventType || eventType);
  const isIntensivo = isIntensivoFreitas(config);
  const isSoloLegacyEvent = config?.urlSlug === "solo" && !config?.eventType;
  const types = [...new Set([
    eventType,
    canonicalType,
    ...(isIntensivo
      ? [config?.name, config?.label, config?.title, "intensivo-freitas", "intensivo"]
      : []),
    ...(isSoloLegacyEvent ? [config?.name, config?.label, config?.title] : []),
  ].filter(Boolean))];
  const [registrations, overrides, hourLocks, globalLocks] = await Promise.all([
    db.collection("registrations").where("date", "==", date).where("eventType", "==", eventType).get(),
    db.collection("schedule_overrides").where("date", "==", date).get(),
    // This small configuration collection includes legacy generic locks without an event type.
    db.collection("event_hour_locks").get(),
    Promise.all(types.map(type => db.collection("event_global_locks").doc(type).get())),
  ]);
  const globalLocked = globalLocks.some(lock => lock.exists && lock.data().locked === true);
  const applies = record => {
    const recordType = record.eventType || record.event_type || "";
    if (!recordType) return true;
    return types.includes(recordType)
      || (isIntensivo && isIntensivoFreitasLockType(recordType))
      || (isModoLiga && isModoLigaType(recordType));
  };
  const counts = {};
  const slotCountsByHour = Object.fromEntries(hours.map(hour => [String(hour).padStart(2, "0"), 0]));
  const maxSlotsByHour = Object.fromEntries(hours.map(hour => [String(hour).padStart(2, "0"), 0]));
  const occupiedByHour = Object.fromEntries(hours.map(hour => [String(hour).padStart(2, "0"), 0]));
  const duplicateCounts = teamCandidates.map(() =>
    Object.fromEntries(hours.map(hour => [String(hour).padStart(2, "0"), 0])),
  );
  for (const doc of registrations.docs) {
    const record = doc.data();
    if (!registrationMatchesSelectedEvent(
      record,
      eventType,
      adminEventId || eventType,
      config?.name || config?.label || config?.title || "",
    )) continue;
    const hour = [record.schedule, record.hour, record.time]
      .map(hourOf)
      .find(value => value != null);
    if (hour == null || !hours.includes(hour)) continue;

    const hourKey = String(hour).padStart(2, "0");
    if (record.status !== "pending") {
      slotCountsByHour[hourKey] += 1;
    }
    const slotNumber = Number(record.slotNumber || record.slot || 0);
    if (Number.isInteger(slotNumber) && slotNumber > 0 && slotNumber <= 9999) {
      maxSlotsByHour[hourKey] = Math.max(maxSlotsByHour[hourKey], slotNumber);
    }

    if (ACTIVE_STATUSES.has(record.status)) {
      counts[hour] = (counts[hour] || 0) + 1;
      occupiedByHour[hourKey] += 1;
    }

    const teamName = normalizedTeamName(record.teamName);
    const email = String(record.email || "").trim().toLowerCase();
    if (teamName && email) {
      teamCandidates.forEach((candidate, index) => {
        if (normalizedTeamName(candidate.name) === teamName && candidate.email === email) {
          duplicateCounts[index][hourKey] += 1;
        }
      });
    }
  }

  const availabilityByHour = {};
  let unavailableMessage = globalLocked ? "Este evento está temporariamente suspenso." : "";
  for (const hour of hours) {
    const hourKey = String(hour).padStart(2, "0");
    if (globalLocked) {
      availabilityByHour[hourKey] = false;
      continue;
    }

    const locked = hourLocks.docs.some(doc => {
      const record = doc.data();
      return applies(record) && hourOf(record.hour) === hour && record.locked === true;
    });
    const relevantOverrides = overrides.docs.map(doc => doc.data())
      .filter(record => applies(record) && (hourOf(record.hour) ?? hourOf(record.hh)) === hour);
    if (locked || relevantOverrides.some(record => record.locked === true)) {
      availabilityByHour[hourKey] = false;
      unavailableMessage ||= `O horário ${hour}h está bloqueado pelo administrador.`;
      continue;
    }
    let defaultCapacity = DEFAULT_CAPACITIES[canonicalType] || 12;
    if (canonicalType === "semanal-freitas" && hour === 22) defaultCapacity = 4;
    if (canonicalType === "camp-freitas" && hour === 17
        && ["2024-11-22", "2024-11-23", "2025-11-22", "2025-11-23"].includes(date)) defaultCapacity = 3;
    const capacity = Number(config?.vagas) > 0 ? Number(config.vagas) : defaultCapacity;
    const extra = relevantOverrides.reduce((total, record) => total + Math.max(0, Number(record.extraOccupied) || 0), 0);
    const available = (counts[hour] || 0) + extra + numberOfTeams <= capacity;
    availabilityByHour[hourKey] = available;
    if (!available) unavailableMessage ||= `Não há vagas suficientes às ${hour}h para ${numberOfTeams} time(s). Escolha outro horário ou reduza os times.`;
  }

  const available = Object.values(availabilityByHour).every(Boolean);
  return {
    available,
    availabilityByHour,
    ...(unavailableMessage ? { message: unavailableMessage } : {}),
    allocation: { slotCountsByHour, maxSlotsByHour, occupiedByHour, duplicateCounts },
  };
}

module.exports = { checkAvailability, validateRequest, UNAVAILABLE_MESSAGE };
