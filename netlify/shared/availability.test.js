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

test("every selected hour must have enough room for every team", async () => {
  const db = database({ ...catalog, "registrations/full1": registration, "registrations/full2": registration });
  assert.equal((await checkAvailability(db, { ...request, selectedTimes: ["17h", "18h"] })).available, false);
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
  assert.deepEqual(JSON.parse(response.body), { available: true });
  assert.equal((await handler({ httpMethod: "GET" })).statusCode, 405);
});
