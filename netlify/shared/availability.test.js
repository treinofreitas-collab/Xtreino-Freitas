const test = require("node:test");
const assert = require("node:assert/strict");
const { checkAvailability, validateRequest } = require("./availability");

function database(seed = {}, failCollection = null) {
  const reads = [];
  function snapshot(path) {
    return { exists: path in seed, data: () => seed[path] };
  }
  function collection(name, filters = [], limit = Infinity) {
    return {
      doc: id => ({ get: async () => {
        reads.push({ name, id });
        if (failCollection === name) throw Object.assign(new Error("read unavailable"), { code: 8 });
        return snapshot(`${name}/${id}`);
      } }),
      where: (key, op, value) => {
        assert.equal(op, "==");
        return collection(name, [...filters, [key, value]], limit);
      },
      limit: value => collection(name, filters, value),
      get: async () => {
        reads.push({ name, filters });
        if (failCollection === name) throw Object.assign(new Error("read unavailable"), { code: 8 });
        const docs = Object.keys(seed).filter(path => path.startsWith(`${name}/`)
          && filters.every(([key, value]) => seed[path][key] === value))
          .slice(0, limit).map(snapshot);
        return { docs, empty: docs.length === 0 };
      },
    };
  }
  return { collection, reads };
}

const request = { date: "2026-10-14", eventType: "custom-event", selectedTimes: ["Quarta - 17h"], numberOfTeams: 1 };
const catalog = { "adminEvents/custom-event": { vagas: 2, eventType: "treino-freitas", status: "Aberto" } };
const registration = { date: request.date, eventType: request.eventType, schedule: "Quarta - 17h", status: "paid" };

test("availability reads only the chosen date/event and ignores pending, canceled and historical registrations", async () => {
  const db = database({
    ...catalog, "registrations/current": registration,
    "registrations/pending": { ...registration, status: "pending" },
    "registrations/canceled": { ...registration, status: "canceled" },
    "registrations/old": { ...registration, date: "2025-10-14" },
    "registrations/other": { ...registration, eventType: "other-event" },
  });
  assert.equal((await checkAvailability(db, request)).available, true);
  assert.deepEqual(db.reads.find(read => read.name === "registrations").filters,
    [["date", "2026-10-14"], ["eventType", "custom-event"]]);
  assert.equal((await checkAvailability(db, { ...request, numberOfTeams: 2 })).available, false);
});

test("availability returns slot totals and duplicate counts without exposing team data", async () => {
  const result = await checkAvailability(database({
    ...catalog,
    "registrations/paid": {
      ...registration,
      teamName: "Time Alpha B",
      email: "captain@example.com",
      slotNumber: 4,
    },
    "registrations/pending": {
      ...registration,
      status: "pending",
      teamName: "Time Alpha",
      email: "CAPTAIN@example.com",
      slotNumber: 7,
    },
    "registrations/other-hour": {
      ...registration,
      schedule: "Quarta - 18h",
      teamName: "Other Team",
      email: "other@example.com",
      slotNumber: 3,
    },
  }), {
    ...request,
    teamCandidates: [{ name: "Time Alpha", email: "captain@example.com" }],
  });

  assert.equal(result.available, true);
  assert.deepEqual(result.allocation, {
    slotCountsByHour: { "17": 1 },
    maxSlotsByHour: { "17": 7 },
    occupiedByHour: { "17": 1 },
    duplicateCounts: [{ "17": 2 }],
  });
  assert.doesNotMatch(JSON.stringify(result), /captain@example\.com|Time Alpha/);
});

test("availability returns per-hour status and aggregate counts even when one requested hour is full", async () => {
  const db = database({
    ...catalog,
    "adminEvents/custom-event": { vagas: 1, eventType: "treino-freitas", status: "Aberto" },
    "registrations/full-hour": {
      ...registration,
      schedule: "Quarta - 17h",
      status: "paid",
      slotNumber: 2,
    },
  });
  const result = await checkAvailability(db, {
    ...request,
    selectedTimes: ["Quarta - 17h", "Quarta - 18h"],
  });

  assert.equal(result.available, false);
  assert.deepEqual(result.availabilityByHour, { "17": false, "18": true });
  assert.deepEqual(result.allocation.occupiedByHour, { "17": 1, "18": 0 });
  assert.match(result.message, /Não há vagas suficientes às 17h/);
});

test("availability rejects malformed team candidates", () => {
  assert.throws(() => validateRequest({
    ...request,
    teamCandidates: [{ name: "A".repeat(121), email: "a@example.com" }],
  }), /Dados de time inválidos/);
  assert.throws(() => validateRequest({
    ...request,
    teamCandidates: "not-an-array",
  }), /Lista de times inválida/);
});

test("Camp Season 7 keeps 15 November closed and opens bookings on 16 November", async () => {
  const eventId = "season-7-event";
  const eventConfig = {
    [`adminEvents/${eventId}`]: {
      name: "CAMPEONATO SEASON 7 - INÍCIO: 15/11",
      eventType: "camp-freitas",
      status: "Aberto",
      vagas: 15,
    },
  };
  const campRequest = {
    ...request,
    eventType: "camp-freitas",
    adminEventId: eventId,
    selectedTimes: ["Domingo - 19h"],
  };
  const beforeStart = await checkAvailability(database(eventConfig), {
    ...campRequest,
    date: "2026-11-15",
  });
  assert.equal(beforeStart.available, false);
  assert.match(beforeStart.message, /16\/11\/2026/);

  const onStartDateDb = database(eventConfig);
  const onStartDate = await checkAvailability(onStartDateDb, {
    ...campRequest,
    date: "2026-11-16",
  });
  assert.equal(onStartDate.available, true);
  assert.ok(onStartDateDb.reads.some(read => read.name === "adminEvents" && read.id === eventId));
});

test("availability does not count Modo Liga registrations against Camp Season 7 when they share eventType", async () => {
  const campId = "camp-season-7-event";
  const campName = "CAMPEONATO SEASON 7 - INÍCIO: 15/11";
  const eventConfig = {
    [`adminEvents/${campId}`]: {
      name: campName,
      eventType: "modo-liga",
      status: "Aberto",
      vagas: 15,
    },
  };
  const campRequest = {
    ...request,
    date: "2026-11-16",
    eventType: "modo-liga",
    adminEventId: campId,
    selectedTimes: ["Segunda - 20h"],
    numberOfTeams: 15,
  };
  const modeLigaRegistration = {
    date: campRequest.date,
    eventType: "modo-liga",
    adminEventId: "treino-modo-liga-event",
    title: "TREINO MODO LIGA - 20h",
    schedule: "Segunda - 20h",
    status: "paid",
  };

  assert.equal(
    (await checkAvailability(database({
      ...eventConfig,
      "registrations/modo-liga-sale": modeLigaRegistration,
    }), campRequest)).available,
    true,
  );

  const campSale = {
    ...modeLigaRegistration,
    adminEventId: campId,
    title: `${campName} - 20h`,
  };
  const soldCampSlot = await checkAvailability(database({
    ...eventConfig,
    "registrations/camp-sale": campSale,
  }), campRequest);
  assert.equal(soldCampSlot.available, false);
  assert.match(soldCampSlot.message, /Não há vagas suficientes/);

  const legacyCampSale = { ...campSale };
  delete legacyCampSale.adminEventId;
  assert.equal((await checkAvailability(database({
    ...eventConfig,
    "registrations/legacy-camp-sale": legacyCampSale,
  }), campRequest)).available, false);
});

test("every selected hour must have enough room for every team", async () => {
  const db = database({ ...catalog, "registrations/full1": registration, "registrations/full2": registration });
  assert.equal((await checkAvailability(db, { ...request, selectedTimes: ["17h", "18h"] })).available, false);
});

test("Diário Solo uses its configured 48 player slots per hour", async () => {
  const eventId = "daily-solo-48";
  const soloConfig = {
    [`adminEvents/${eventId}`]: {
      name: "DIÁRIO SOLO FREITAS",
      urlSlug: "solo",
      status: "Aberto",
      vagas: 48,
    },
  };
  const soloRequest = {
    ...request,
    eventType: eventId,
    adminEventId: eventId,
    numberOfTeams: 1,
  };
  const registrationsFor = count => Object.fromEntries(
    Array.from({ length: count }, (_, index) => [`registrations/solo-${index}`, {
      date: soloRequest.date,
      eventType: eventId,
      adminEventId: eventId,
      schedule: "Quarta - 17h",
      status: "paid",
    }]),
  );

  const oneSeatLeft = await checkAvailability(database({
    ...soloConfig,
    ...registrationsFor(47),
  }), soloRequest);
  assert.equal(oneSeatLeft.available, true);
  assert.equal(oneSeatLeft.allocation.occupiedByHour["17"], 47);

  const full = await checkAvailability(database({
    ...soloConfig,
    ...registrationsFor(48),
  }), soloRequest);
  assert.equal(full.available, false);
  assert.match(full.message, /1 jogador\./);
});

test("global, permanent and per-date locks block the reservation; extra occupied slots count", async () => {
  for (const lock of [
    { "event_global_locks/custom-event": { locked: true } },
    { "event_global_locks/treino-freitas": { locked: true } },
    { "event_hour_locks/one": { eventType: "treino-freitas", hour: "17h", locked: true } },
    { "schedule_overrides/one": { date: request.date, hour: "17", locked: true } },
    { "schedule_overrides/one": { date: request.date, eventType: "custom-event", hour: "17h", extraOccupied: 2 } },
  ]) {
    assert.equal((await checkAvailability(database({ ...catalog, ...lock }), request)).available, false);
  }
});

test("Diário Solo recognizes legacy name-scoped locks without affecting another event", async () => {
  const eventId = "daily-solo-event-id";
  const eventName = "DIÁRIO SOLO FREITAS";
  const soloConfig = {
    [`adminEvents/${eventId}`]: {
      name: eventName,
      urlSlug: "solo",
      status: "Aberto",
      vagas: 12,
    },
  };
  const soloRequest = {
    ...request,
    eventType: eventId,
    adminEventId: eventId,
  };
  const legacyLocks = [
    { [`event_global_locks/${eventName}`]: { locked: true } },
    { "event_hour_locks/solo-legacy": { eventType: eventName, hour: "17h", locked: true } },
    { "schedule_overrides/solo-legacy": {
      date: request.date, eventType: eventName, hour: "17h", locked: true,
    } },
    { "schedule_overrides/solo-legacy-snake": {
      date: request.date, event_type: eventName, hour: "17h", locked: true,
    } },
  ];

  for (const lock of legacyLocks) {
    const result = await checkAvailability(database({ ...soloConfig, ...lock }), soloRequest);
    assert.equal(result.available, false, JSON.stringify(lock));
  }

  const sameNameDifferentEvent = await checkAvailability(database({
    "adminEvents/other-daily-event": {
      name: eventName,
      status: "Aberto",
      vagas: 12,
    },
    "event_hour_locks/solo-legacy": {
      eventType: eventName, hour: "17h", locked: true,
    },
  }), {
    ...request,
    eventType: "other-daily-event",
    adminEventId: "other-daily-event",
  });
  assert.equal(sameNameDifferentEvent.available, true);
});

test("unknown/closed events and malformed selections never return approval", async () => {
  assert.equal((await checkAvailability(database(), request)).available, false);
  assert.equal((await checkAvailability(database({ "adminEvents/custom-event": { vagas: 2, status: "Encerrado" } }), request)).available, false);
  for (const patch of [
    { date: "2026-02-30" }, { date: "" }, { selectedTimes: [] },
    { selectedTimes: ["17h", "17h"] }, { selectedTimes: ["99h"] },
    { numberOfTeams: 0 }, { numberOfTeams: -1 }, { numberOfTeams: 1.5 },
    { eventType: "../event" },
  ]) assert.throws(() => validateRequest({ ...request, ...patch }));
});

test("any failed Firestore read rejects instead of returning available", async () => {
  for (const name of ["adminEvents", "registrations", "schedule_overrides", "event_hour_locks", "event_global_locks"]) {
    await assert.rejects(checkAvailability(database(catalog, name), request), /read unavailable/);
  }
});

const firebase = require("./firebase-admin");
let handlerDb;
let authenticationFailure = false;
firebase.getAdmin = () => ({ firestore: () => handlerDb });
firebase.verifyFirebaseUser = async () => {
  if (authenticationFailure) throw Object.assign(new Error("Authentication required"), { statusCode: 401 });
  return { uid: "test-user" };
};
const { handler } = require("../functions/check-availability");
const event = { httpMethod: "POST", body: JSON.stringify(request) };

test("endpoint responds 503/available=false to exhausted quota without exposing underlying errors", async () => {
  handlerDb = database(catalog, "registrations");
  const response = await handler(event);
  assert.equal(response.statusCode, 503);
  const body = JSON.parse(response.body);
  assert.equal(body.available, false);
  assert.match(body.message, /Nenhuma cobrança/);
  assert.doesNotMatch(response.body, /read unavailable/);
});

test("unauthenticated and malformed requests are rejected before reading Firestore", async () => {
  handlerDb = database(catalog);
  authenticationFailure = true;
  assert.equal((await handler(event)).statusCode, 401);
  authenticationFailure = false;
  assert.equal((await handler({ ...event, body: "{}" })).statusCode, 400);
  assert.equal(handlerDb.reads.length, 0);
});

test("endpoint returns a strict boolean contract and performs no writes", async () => {
  handlerDb = database(catalog);
  const response = await handler(event);
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.available, true);
  assert.deepEqual(body.allocation, {
    slotCountsByHour: { "17": 0 },
    maxSlotsByHour: { "17": 0 },
    occupiedByHour: { "17": 0 },
    duplicateCounts: [],
  });
  assert.equal((await handler({ httpMethod: "GET" })).statusCode, 405);
});

const saturdayMidnightLiga = {
  date: "2026-10-17",
  eventType: "modo-liga",
  selectedTimes: ["Sábado - 0h"],
  numberOfTeams: 1,
};

test("Modo Liga accepts midnight reservations on weekends", async () => {
  assert.deepEqual(validateRequest(saturdayMidnightLiga).hours, [0]);
  const db = database({
    "adminEvents/modo-liga": { eventType: "modo-liga", status: "Aberto", vagas: 15 },
  });
  assert.equal((await checkAvailability(db, saturdayMidnightLiga)).available, true);
});

test("Modo Liga availability snapshot can check all 11 calendar hours without raising the booking limit", async () => {
  const selectedTimes = ["0h", "14h", "15h", "16h", "17h", "18h", "19h", "20h", "21h", "22h", "23h"];
  const snapshotRequest = {
    ...saturdayMidnightLiga,
    selectedTimes,
    availabilitySnapshot: true,
  };
  assert.equal(validateRequest(snapshotRequest).hours.length, 11);
  assert.throws(() => validateRequest({ ...snapshotRequest, availabilitySnapshot: false }), /horários válidos/);
  assert.throws(() => validateRequest({
    ...snapshotRequest,
    teamCandidates: [{ name: "Team", email: "team@example.com" }],
  }), /Consulta de disponibilidade inválida/);

  const db = database({
    "adminEvents/modo-liga": { eventType: "modo-liga", status: "Aberto", vagas: 15 },
    "registrations/taken": {
      date: saturdayMidnightLiga.date,
      eventType: "modo-liga",
      schedule: "Sábado - 20h",
      status: "paid",
    },
  });
  const result = await checkAvailability(db, snapshotRequest);
  assert.equal(result.available, true);
  assert.deepEqual(Object.keys(result.availabilityByHour).sort(), selectedTimes.map(time =>
    String(parseInt(time, 10)).padStart(2, "0")).sort());
  assert.equal(result.allocation.occupiedByHour["20"], 1);

  await assert.rejects(checkAvailability(database(catalog), {
    ...snapshotRequest,
    eventType: "custom-event",
  }), /no máximo 10 horários/);
});

test("Modo Liga applies the same per-hour lock check to 19h and 00h", async () => {
  const catalog = {
    "adminEvents/modo-liga": { eventType: "modo-liga", status: "Aberto", vagas: 15 },
  };
  const requestFor = hour => ({
    ...saturdayMidnightLiga,
    selectedTimes: [`Quarta - ${String(hour).padStart(2, "0")}h`],
  });
  const unlocked = database(catalog);
  assert.equal((await checkAvailability(unlocked, requestFor(19))).available, true);
  assert.equal((await checkAvailability(unlocked, requestFor(0))).available, true);

  const onlyMidnightLocked = database({
    ...catalog,
    "event_hour_locks/midnight-alias-lock": { event_type: "acesso", hour: 0, locked: true },
  });
  assert.equal((await checkAvailability(onlyMidnightLocked, requestFor(19))).available, true);
  assert.equal((await checkAvailability(onlyMidnightLocked, requestFor(0))).available, false);
});

test("Intensivo Freitas fixed locks block its hours but not other events", async () => {
  const intensiveId = "intensivo-freitas-event";
  const requestFor = (eventType, adminEventId = eventType) => ({
    date: "2026-11-02",
    eventType,
    adminEventId,
    selectedTimes: ["Segunda - 15h"],
    numberOfTeams: 1,
  });
  const sharedLock = {
    "event_hour_locks/intensivo-15": {
      event_type: "INTENSIVO FREITAS",
      hour: "15",
      locked: true,
    },
  };
  const intensiveDb = database({
    ...sharedLock,
    [`adminEvents/${intensiveId}`]: {
      name: "INTENSIVO FREITAS",
      category: "SQUAD",
      status: "Aberto",
      vagas: 12,
    },
  });
  const locked = await checkAvailability(intensiveDb, requestFor(intensiveId));
  assert.equal(locked.available, false);
  assert.match(locked.message, /horário 15h está bloqueado/);

  const otherId = "other-daily-event";
  const otherDb = database({
    ...sharedLock,
    [`adminEvents/${otherId}`]: {
      name: "OUTRO EVENTO",
      category: "SQUAD",
      status: "Aberto",
      vagas: 12,
    },
  });
  assert.equal((await checkAvailability(otherDb, requestFor(otherId))).available, true);
});

test("Modo Liga midnight availability uses the event catalog, not only its Firestore document ID", async () => {
  const events = [
    ["EventDocumentAa", { name: "TREINO MODO LIGA", eventType: "modo-liga" }],
    ["EventDocumentAb", { name: "TREINO MODO LIGA" }],
  ];
  for (const [eventId, config] of events) {
    const db = database({
      [`adminEvents/${eventId}`]: { ...config, status: "Aberto", vagas: 15 },
    });
    assert.equal((await checkAvailability(db, {
      ...saturdayMidnightLiga, eventType: eventId,
    })).available, true);
  }
});

test("Modo Liga midnight slot still respects manual admin locks", async () => {
  const db = database({
    "adminEvents/modo-liga": { eventType: "modo-liga", status: "Aberto", vagas: 15 },
    "event_hour_locks/mode-liga-midnight": { eventType: "modo-liga", hour: "00:00", locked: true },
  });
  const result = await checkAvailability(db, saturdayMidnightLiga);
  assert.equal(result.available, false);
  assert.match(result.message, /bloqueado pelo administrador/);
});

test("midnight locks stored as numeric zero are interpreted as 00:00", async () => {
  const lockedEventHour = await checkAvailability(database({
    "adminEvents/modo-liga": { eventType: "modo-liga", status: "Aberto", vagas: 15 },
    "event_hour_locks/numeric-midnight": { eventType: "modo-liga", hour: 0, locked: true },
  }), saturdayMidnightLiga);
  assert.equal(lockedEventHour.available, false);
  assert.match(lockedEventHour.message, /horário 0h está bloqueado/);

  const lockedDateHour = await checkAvailability(database({
    "adminEvents/modo-liga": { eventType: "modo-liga", status: "Aberto", vagas: 15 },
    "schedule_overrides/numeric-midnight": {
      date: saturdayMidnightLiga.date, eventType: "modo-liga", hour: 0, locked: true,
    },
  }), saturdayMidnightLiga);
  assert.equal(lockedDateHour.available, false);
  assert.match(lockedDateHour.message, /horário 0h está bloqueado/);
});

test("legacy snake_case lock types stay scoped to their event and Modo Liga aliases", async () => {
  const eventConfig = {
    "adminEvents/modo-liga": { eventType: "modo-liga", status: "Aberto", vagas: 15 },
  };
  for (const lock of [
    { "event_hour_locks/other-event": { event_type: "xtreino-tokens", hour: 0, locked: true } },
    { "schedule_overrides/other-event": {
      date: saturdayMidnightLiga.date, event_type: "xtreino-tokens", hour: 0, locked: true,
    } },
  ]) {
    assert.equal((await checkAvailability(database({ ...eventConfig, ...lock }), saturdayMidnightLiga)).available, true);
  }

  for (const lock of [
    { "event_hour_locks/legacy-modo-liga": { event_type: "TREINO MODO LIGA", hour: 0, locked: true } },
    { "event_hour_locks/underscored-modo-liga": { event_type: "modo_liga", hour: 0, locked: true } },
    { "event_hour_locks/access-alias": { eventType: "acesso", hour: 0, locked: true } },
    { "schedule_overrides/legacy-modo-liga": {
      date: saturdayMidnightLiga.date, event_type: "TREINO MODO LIGA", hour: 0, locked: true,
    } },
    { "event_hour_locks/global": { hour: 0, locked: true } },
  ]) {
    assert.equal((await checkAvailability(database({ ...eventConfig, ...lock }), saturdayMidnightLiga)).available, false);
  }
});

test("midnight reservations are restricted using the resolved event type", async () => {
  const db = database({
    "adminEvents/EventDocumentBb": {
      name: "TREINO FREITAS", eventType: "xtreino-tokens", status: "Aberto", vagas: 12,
    },
  });
  await assert.rejects(
    checkAvailability(db, { ...saturdayMidnightLiga, eventType: "EventDocumentBb" }),
    /apenas no Modo Liga/,
  );
});

test("availability endpoint accepts 00h after resolving a Modo Liga event document", async () => {
  handlerDb = database({
    "adminEvents/EventDocumentAa": {
      name: "TREINO MODO LIGA", eventType: "modo-liga", status: "Aberto", vagas: 15,
    },
  });
  const response = await handler({
    httpMethod: "POST",
    body: JSON.stringify({ ...saturdayMidnightLiga, eventType: "EventDocumentAa" }),
  });
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).available, true);
});

test("malformed three-digit lock hour does not accidentally block midnight", async () => {
  const result = await checkAvailability(database({
    "adminEvents/modo-liga": { eventType: "modo-liga", status: "Aberto", vagas: 15 },
    "event_hour_locks/modo-liga__100": { eventType: "modo-liga", hour: "100", locked: true },
  }), saturdayMidnightLiga);
  assert.equal(result.available, true);
});
