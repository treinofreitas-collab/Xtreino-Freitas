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

function validateRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid("Dados da reserva inválidos.");
  const { date, eventType, selectedTimes } = body;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())
      || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) invalid("Data inválida.");
  if (typeof eventType !== "string" || !/^[\w.-]{1,128}$/.test(eventType)) invalid("Evento inválido.");
  const rawAdminEventId = body.adminEventId;
  if (rawAdminEventId != null && (typeof rawAdminEventId !== "string"
      || !rawAdminEventId.trim() || rawAdminEventId.includes("/"))) invalid("Evento inválido.");
  const adminEventId = typeof rawAdminEventId === "string" ? rawAdminEventId.trim() : "";
  if (!Array.isArray(selectedTimes) || selectedTimes.length < 1 || selectedTimes.length > 10
      || selectedTimes.some(time => typeof time !== "string" || time.length > 80)) invalid("Selecione horários válidos.");
  const hours = selectedTimes.map(hourOf);
  if (hours.some(hour => hour == null || hour < 0 || hour > 23)
      || new Set(hours).size !== hours.length) invalid("Selecione horários válidos, sem repetições.");
  const numberOfTeams = Number(body.numberOfTeams);
  if (!Number.isInteger(numberOfTeams) || numberOfTeams < 1 || numberOfTeams > 100) invalid("Quantidade de times inválida.");
  return { date, eventType, hours, numberOfTeams, ...(adminEventId ? { adminEventId } : {}) };
}

async function checkAvailability(db, body) {
  const { date, eventType, adminEventId, hours, numberOfTeams } = validateRequest(body);
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
  if (!isModoLiga && hours.includes(0)) invalid("O horário 00h00 está disponível apenas no Modo Liga.");
  const canonicalType = isModoLiga ? "modo-liga" : (config?.eventType || eventType);
  const types = [...new Set([eventType, canonicalType])];
  const [registrations, overrides, hourLocks, globalLocks] = await Promise.all([
    db.collection("registrations").where("date", "==", date).where("eventType", "==", eventType).get(),
    db.collection("schedule_overrides").where("date", "==", date).get(),
    // This small configuration collection includes legacy generic locks without an event type.
    db.collection("event_hour_locks").get(),
    Promise.all(types.map(type => db.collection("event_global_locks").doc(type).get())),
  ]);
  if (globalLocks.some(lock => lock.exists && lock.data().locked === true)) {
    return { available: false, message: "Este evento está temporariamente suspenso." };
  }
  const applies = record => {
    const recordType = record.eventType || record.event_type || "";
    if (!recordType) return true;
    return types.includes(recordType) || (isModoLiga && isModoLigaType(recordType));
  };
  const counts = {};
  for (const doc of registrations.docs) {
    const record = doc.data();
    if (!ACTIVE_STATUSES.has(record.status)) continue;
    const hour = [record.schedule, record.hour, record.time]
      .map(hourOf)
      .find(value => value != null);
    if (hour != null) counts[hour] = (counts[hour] || 0) + 1;
  }

  for (const hour of hours) {
    const locked = hourLocks.docs.some(doc => {
      const record = doc.data();
      return applies(record) && hourOf(record.hour) === hour && record.locked === true;
    });
    const relevantOverrides = overrides.docs.map(doc => doc.data())
      .filter(record => applies(record) && (hourOf(record.hour) ?? hourOf(record.hh)) === hour);
    if (locked || relevantOverrides.some(record => record.locked === true)) {
      return { available: false, message: `O horário ${hour}h está bloqueado pelo administrador.` };
    }
    let defaultCapacity = DEFAULT_CAPACITIES[canonicalType] || 12;
    if (canonicalType === "semanal-freitas" && hour === 22) defaultCapacity = 4;
    if (canonicalType === "camp-freitas" && hour === 17
        && ["2024-11-22", "2024-11-23", "2025-11-22", "2025-11-23"].includes(date)) defaultCapacity = 3;
    const capacity = Number(config?.vagas) > 0 ? Number(config.vagas) : defaultCapacity;
    const extra = relevantOverrides.reduce((total, record) => total + Math.max(0, Number(record.extraOccupied) || 0), 0);
    if ((counts[hour] || 0) + extra + numberOfTeams > capacity) {
      return { available: false, message: `Não há vagas suficientes às ${hour}h para ${numberOfTeams} time(s). Escolha outro horário ou reduza os times.` };
    }
  }
  return { available: true };
}

module.exports = { checkAvailability, validateRequest, UNAVAILABLE_MESSAGE };
