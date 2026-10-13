const { jsonResponse, parseJsonBody } = require("./token-purchase");

const MANAGERS = new Set(["ceo", "admin", "gerente"]);
const VIEWERS = new Set([...MANAGERS, "socio"]);
const CONFIRMED = new Set(["paid", "confirmed", "approved", "lisagem_gratis"]);
const ID = /^[a-zA-Z0-9_-]{1,160}$/;

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function normalizeEventType(value) {
  const normalized = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/[\s_]+/g, "-");
  const aliases = {
    "treino-freitas": "xtreino-tokens", "xtreino-freitas": "xtreino-tokens",
    "treino-modo-liga": "modo-liga", semanal: "semanal-freitas", camp: "camp-freitas",
  };
  const result = aliases[normalized] || normalized;
  if (!/^[a-z0-9-]{1,96}$/.test(result)) fail("Evento inválido.");
  return result;
}

function normalizeSchedule(value) {
  const match = String(value || "").trim().match(/(?:^|[^\d])(\d{1,2})(?:\s*(?:h|:)\s*(\d{2}))?(?:\s*h)?(?=$|[^\d])/i);
  if (!match || Number(match[1]) > 23 || Number(match[2] || 0) > 59) fail("Horário inválido.");
  return `${Number(match[1])}h${Number(match[2] || 0) ? match[2] : ""}`;
}

function safeUrl(value) {
  if (typeof value !== "string" || value.length > 2048) fail("Link inválido.");
  let url;
  try { url = new URL(value.trim()); } catch { fail("Informe um link completo, começando com https://."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    fail("O link deve usar HTTP ou HTTPS, sem usuário ou senha na URL.");
  }
  return url.href;
}

function linkKey(eventType, schedule) {
  return `${normalizeEventType(eventType)}__${normalizeSchedule(schedule)}`;
}

function serializeLink(doc) {
  const data = doc.data();
  return { id: doc.id, eventType: data.eventType, schedule: data.schedule,
    label: data.label || data.eventType, url: data.url, active: data.active === true };
}

function createEventAccessHandler({ getAdmin, verifyFirebaseUser }) {
  const respond = (status, body) => {
    const result = jsonResponse(status, body);
    result.headers = { ...result.headers, "Cache-Control": "private, no-store" };
    return result;
  };
  return async event => {
    if (event.httpMethod === "OPTIONS") return respond(200, {});
    if (event.httpMethod !== "POST") return respond(405, { error: "Método não permitido." });
    try {
      const user = await verifyFirebaseUser(event);
      const body = parseJsonBody(event);
      if (!body || Array.isArray(body) || typeof body !== "object") fail("Solicitação inválida.");
      if (!["list", "save", "remove", "resolve"].includes(body.action)) fail("Ação inválida.");
      const admin = getAdmin();
      const db = admin.firestore();
      // This collection is server-only. No links are stored in publicly listed registrations.
      const links = db.collection("event_access_links");
      if (body.action !== "resolve") {
        const profile = await db.collection("users").doc(user.uid).get();
        const role = String(profile.data()?.role || "").normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        if (!VIEWERS.has(role)) fail("Sem permissão para gerenciar os links.", 403);
        const canManage = MANAGERS.has(role);
        if (body.action === "list") {
          const [saved, schedules] = await Promise.all([links.get(), db.collection("schedules").get()]);
          return respond(200, {
            links: saved.docs.map(serializeLink),
            events: schedules.docs.map(doc => ({
              id: doc.id, eventType: normalizeEventType(doc.id),
              label: doc.data().label || doc.data().title || doc.data().nome || doc.id,
            })),
            canManage,
          });
        }
        if (!canManage) fail("Seu acesso é somente para visualização.", 403);
        if (body.action === "remove") {
          if (typeof body.id !== "string" || !ID.test(body.id)) fail("Cadastro inválido.");
          await links.doc(body.id).delete();
          return respond(200, { removed: true });
        }
        if (typeof body.eventType !== "string" || !ID.test(body.eventType)) fail("Evento inválido.");
        const eventType = normalizeEventType(body.eventType);
        const schedule = normalizeSchedule(body.schedule);
        const url = safeUrl(body.url);
        if (typeof body.active !== "boolean") fail("Informe se o link está ativo.");
        const catalog = await db.collection("schedules").doc(body.eventType).get();
        if (!catalog.exists) fail("Evento não encontrado.", 404);
        const id = linkKey(eventType, schedule);
        const data = {
          eventType, schedule, url, active: body.active,
          label: catalog.data().label || catalog.data().title || catalog.data().nome || eventType,
          updatedBy: user.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (body.previousId && body.previousId !== id) {
          if (typeof body.previousId !== "string" || !ID.test(body.previousId)) fail("Cadastro anterior inválido.");
          const previous = links.doc(body.previousId);
          const old = await previous.get();
          if (!old.exists) fail("O cadastro anterior não existe mais. Atualize a lista.", 409);
          const batch = db.batch();
          batch.set(links.doc(id), data);
          batch.delete(previous);
          await batch.commit();
        } else {
          await links.doc(id).set(data);
        }
        return respond(200, { link: { id, eventType, schedule, url, active: data.active, label: data.label } });
      }

      const checkouts = new Map();
      const configurations = new Map();
      const checkoutFor = reference => {
        if (!checkouts.has(reference)) checkouts.set(reference, db.collection("purchase_checkouts").doc(reference).get());
        return checkouts.get(reference);
      };
      let ids = body.registrationIds;
      if (body.externalReference !== undefined) {
        if (typeof body.externalReference !== "string" || !ID.test(body.externalReference)) fail("Referência inválida.");
        const checkout = await checkoutFor(body.externalReference);
        if (!checkout.exists || checkout.data().userId !== user.uid) fail("Reserva não disponível para esta conta.", 403);
        if (checkout.data().status !== "paid" || checkout.data().kind !== "event") fail("Vaga ainda não confirmada.", 409);
        ids = (checkout.data().sourcePaths || []).map(path => /^registrations\/([a-zA-Z0-9_-]{1,160})$/.exec(path)?.[1]).filter(Boolean);
      }
      if (!Array.isArray(ids) || !ids.length || (!body.externalReference && ids.length > 200) || ids.some(id => typeof id !== "string" || !ID.test(id))) {
        fail("Informe as reservas que deseja consultar.");
      }
      ids = [...new Set(ids)];
      const sources = await db.getAll(...ids.map(id => db.collection("registrations").doc(id)));
      const access = await Promise.all(sources.map(async (source, index) => {
        const registrationId = ids[index];
        const base = { registrationId };
        if (!source.exists) return { ...base, status: "not_authorized" };
        const data = source.data();
        const owner = data.userId || data.uid;
        const member = Array.isArray(data.membrosUids) && data.membrosUids.includes(user.uid);
        if (owner !== user.uid && !member) return { ...base, status: "not_authorized" };
        if (!CONFIRMED.has(String(data.status || "").toLowerCase())) return { ...base, status: "not_confirmed" };
        const reference = data.external_reference;
        if (typeof reference !== "string" || !ID.test(reference)) return { ...base, status: "needs_review" };
        const checkout = await checkoutFor(reference);
        if (!checkout.exists || checkout.data().status !== "paid" || checkout.data().kind !== "event" ||
            checkout.data().userId !== owner ||
            !Array.isArray(checkout.data().sourcePaths) ||
            !checkout.data().sourcePaths.includes(`registrations/${registrationId}`)) {
          return { ...base, status: "needs_review" };
        }
        let eventType, schedule;
        try { eventType = normalizeEventType(data.eventType); schedule = normalizeSchedule(data.schedule || data.hour); }
        catch { return { ...base, status: "not_configured" }; }
        const key = linkKey(eventType, schedule);
        if (!configurations.has(key)) configurations.set(key, links.doc(key).get());
        const configuration = await configurations.get(key);
        const details = { ...base, eventType, schedule };
        if (!configuration.exists) return { ...details, status: "not_configured" };
        if (configuration.data().active !== true) return { ...details, status: "inactive" };
        return { ...details, status: "available", label: configuration.data().label || eventType,
          url: safeUrl(configuration.data().url) };
      }));
      return respond(200, { access });
    } catch (error) {
      const status = Number(error.statusCode) || 503;
      return respond(status, { error: status >= 500
        ? "Não foi possível consultar ou salvar os links agora. Tente novamente."
        : error.message });
    }
  };
}

module.exports = { createEventAccessHandler, normalizeEventType, normalizeSchedule, linkKey, safeUrl };
