import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createMercadoDaBalaService,
  isSafeMarketUrl,
  redactMarketContactInfo,
  sanitizeMarketplaceProfile,
  sanitizeMarketplaceVacancy
} from "../../artifacts/xtreino/public/js/mercado-da-bala-data.mjs";

const firestoreRules = readFileSync(
  new URL("../../artifacts/xtreino/public/config/firestore.rules", import.meta.url),
  "utf8"
);
const firestoreIndexes = JSON.parse(readFileSync(
  new URL("../../firestore.indexes.json", import.meta.url),
  "utf8"
));
const marketUi = readFileSync(
  new URL("../../artifacts/xtreino/public/mercado-da-bala/mercado.js", import.meta.url),
  "utf8"
);
const marketHtml = readFileSync(
  new URL("../../artifacts/xtreino/public/mercado-da-bala/index.html", import.meta.url),
  "utf8"
);
const adminHtml = readFileSync(
  new URL("../../artifacts/xtreino/public/admin.html", import.meta.url),
  "utf8"
);
const adminJs = readFileSync(
  new URL("../../artifacts/xtreino/public/admin.js", import.meta.url),
  "utf8"
);

test("currículo só aceita funções conhecidas e remove contatos de texto público", () => {
  const profile = sanitizeMarketplaceProfile({
    nickname: "  Falcão  ",
    mainRole: "Fragger",
    secondaryRoles: ["Coach", "Inventada", "Coach"],
    city: "São Paulo",
    state: "sp",
    availability: "looking",
    bio: "Fale comigo teste@example.com ou +55 (11) 99999-1234",
    age: 17,
    email: "teste@example.com",
    phone: "+5511999991234",
    socialLinks: [
      { url: "https://instagram.com/player" },
      { url: "javascript:alert(1)" },
      { url: "mailto:test@example.com" }
    ]
  });

  assert.equal(profile.nickname, "Falcão");
  assert.equal(profile.mainRole, "Fragger");
  assert.deepEqual(profile.secondaryRoles, ["Coach"]);
  assert.equal(profile.state, "SP");
  assert.match(profile.bio, /e-mail removido/);
  assert.match(profile.bio, /telefone removido/);
  assert.equal("age" in profile, false);
  assert.equal("email" in profile, false);
  assert.equal("phone" in profile, false);
  assert.deepEqual(profile.socialLinks, [{ label: "Contato", url: "https://instagram.com/player" }]);
  assert.equal(profile.contactAvailable, true);
});

test("perfil exige nickname, função e disponibilidade válidos", () => {
  assert.throws(() => sanitizeMarketplaceProfile({ nickname: "A", mainRole: "Fragger", availability: "looking" }));
  assert.throws(() => sanitizeMarketplaceProfile({ nickname: "Atleta", mainRole: "Desenvolvedor", availability: "looking" }));
  assert.throws(() => sanitizeMarketplaceProfile({ nickname: "Atleta", mainRole: "Fragger", availability: "now" }));
});

test("links públicos aceitam somente HTTP e HTTPS", () => {
  assert.equal(isSafeMarketUrl("https://example.com/player"), true);
  assert.equal(isSafeMarketUrl("http://example.com"), true);
  assert.equal(isSafeMarketUrl("javascript:alert(1)"), false);
  assert.equal(isSafeMarketUrl("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isSafeMarketUrl("mailto:user@example.com"), false);
});

test("vagas restringem quantidade, prazo e campos públicos", () => {
  const vacancy = sanitizeMarketplaceVacancy({
    teamName: "Equipe Freitas",
    title: "Procura suporte",
    roles: ["Suporte", "Inválida", "Suporte"],
    level: "Intermediário",
    slots: "3",
    validityDays: "30",
    description: "Contato jogador@exemplo.com"
  });

  assert.equal(vacancy.slots, 3);
  assert.equal(vacancy.validityDays, 30);
  assert.deepEqual(vacancy.roles, ["Suporte"]);
  assert.match(vacancy.description, /e-mail removido/);
  assert.throws(() => sanitizeMarketplaceVacancy({ teamName: "Equipe", title: "Vaga", slots: "0" }));
  assert.throws(() => sanitizeMarketplaceVacancy({ teamName: "Equipe", title: "Vaga", slots: "13" }));
  assert.throws(() => sanitizeMarketplaceVacancy({ teamName: "Equipe", title: "Vaga", slots: "1", validityDays: "90" }));
});

test("service bloqueia leituras privadas em nome de outra conta", async () => {
  const service = createMercadoDaBalaService({
    auth: { currentUser: { uid: "user-a" } },
    db: {},
    sdk: {}
  });
  await assert.rejects(service.getMyProfile("user-b"), /Entre na sua conta/);
});

test("diretório público limita cada consulta a 100 resultados e reutiliza a leitura por 30 segundos", async () => {
  let readCount = 0;
  let appliedLimit = 0;
  const sdk = {
    collection: (_db, name) => name,
    where: (...args) => ({ type: "where", args }),
    limit: value => { appliedLimit = value; return { type: "limit", value }; },
    query: (...parts) => parts,
    getDocs: async () => {
      readCount += 1;
      return { docs: [{ id: "player-1", data: () => ({ status: "published", nickname: "Falcão" }) }] };
    }
  };
  const service = createMercadoDaBalaService({ db: {}, sdk });
  const first = await service.listProfiles();
  const second = await service.listProfiles();
  assert.equal(readCount, 1);
  assert.equal(appliedLimit, 100);
  assert.equal(first[0].nickname, "Falcão");
  assert.deepEqual(second, first);
});

test("login busca os IDs de favoritos sem ler todos os currículos salvos", async () => {
  let profileReads = 0;
  const sdk = {
    collection: (_db, name) => name,
    where: (...args) => ({ type: "where", args }),
    limit: value => ({ type: "limit", value }),
    query: (...parts) => parts,
    getDocs: async () => ({
      docs: [
        { id: "account-1__player-1", data: () => ({ ownerUid: "account-1", profileUid: "player-1" }) },
        { id: "account-1__player-2", data: () => ({ ownerUid: "account-1", profileUid: "player-2" }) }
      ]
    }),
    getDoc: async () => { profileReads += 1; }
  };
  const service = createMercadoDaBalaService({
    auth: { currentUser: { uid: "account-1" } },
    db: {},
    sdk
  });
  assert.deepEqual(await service.listFavoriteIds("account-1"), ["player-1", "player-2"]);
  assert.equal(profileReads, 0);
});

test("favoritar o mesmo jogador cria um documento independente para cada usuário", async () => {
  const auth = { currentUser: { uid: "account-1" } };
  const saved = [];
  const sdk = {
    doc: (_db, collection, id) => ({ collection, id }),
    getDoc: async () => ({ exists: () => true, data: () => ({ status: "published" }) }),
    setDoc: async (ref, data) => saved.push({ ref, data }),
    serverTimestamp: () => "server-time"
  };
  const service = createMercadoDaBalaService({ auth, db: {}, sdk });

  await service.setFavorite("account-1", "player-1", true);
  auth.currentUser.uid = "account-2";
  await service.setFavorite("account-2", "player-1", true);

  assert.deepEqual(saved.map(item => item.ref.id), ["account-1__player-1", "account-2__player-1"]);
  assert.deepEqual(saved.map(item => item.data.ownerUid), ["account-1", "account-2"]);
});

test("regras do Firestore vinculam favoritos ao dono e ao currículo escolhido", () => {
  assert.match(firestoreRules, /match \/market_favorites\/\{favoriteId\}/);
  assert.match(firestoreRules, /resource\.data\.ownerUid == request\.auth\.uid/);
  assert.match(firestoreRules, /favoriteId == request\.auth\.uid \+ '__' \+ request\.resource\.data\.profileUid/);
  assert.match(firestoreRules, /request\.resource\.data\.profileUid == resource\.data\.profileUid/);
});

test("regras mantêm desativadas as coleções antigas de notificações", () => {
  assert.match(firestoreRules, /match \/notifications\/\{notifId\}\s*\{\s*allow read, write: if false;/);
  assert.match(firestoreRules, /match \/notificationReads\/\{readId\}\s*\{\s*allow read, write: if false;/);
});

test("links de contato são gravados fora do currículo público e exigem sessão para leitura", async () => {
  const documents = new Map();
  const key = ref => `${ref.collection}/${ref.id}`;
  const auth = { currentUser: { uid: "player-1" } };
  const sdk = {
    doc: (_db, collection, id) => ({ collection, id }),
    getDoc: async ref => ({
      exists: () => documents.has(key(ref)),
      data: () => documents.get(key(ref))
    }),
    writeBatch: () => {
      const operations = [];
      return {
        set: (ref, data) => operations.push(() => documents.set(key(ref), data)),
        delete: ref => operations.push(() => documents.delete(key(ref))),
        commit: async () => operations.forEach(operation => operation())
      };
    },
    serverTimestamp: () => "server-time"
  };
  const service = createMercadoDaBalaService({ auth, db: {}, sdk });
  await service.saveMyProfile("player-1", {
    nickname: "Falcão",
    mainRole: "Fragger",
    availability: "looking",
    socialLinks: [{ url: "https://instagram.com/falcao" }]
  });

  const publicProfile = documents.get("market_profiles/player-1");
  assert.equal("socialLinks" in publicProfile, false);
  assert.equal(publicProfile.contactAvailable, true);
  assert.deepEqual(documents.get("market_contact_links/player-1").links, [
    { label: "Contato", url: "https://instagram.com/falcao" }
  ]);
  assert.deepEqual(await service.getProfileContactLinks("player-1", "player-1"), [
    { label: "Contato", url: "https://instagram.com/falcao" }
  ]);

  auth.currentUser = null;
  await assert.rejects(service.getProfileContactLinks("player-1", "player-1"), /Entre na sua conta/);
});

test("avaliador só abre o currículo publicado do candidato ligado à própria vaga", async () => {
  const documents = new Map([
    ["market_applications/vacancy-1__player-1", {
      vacancyOwnerUid: "team-1",
      applicantUid: "player-1"
    }],
    ["market_profiles/player-1", {
      nickname: "Falcão",
      mainRole: "Fragger",
      secondaryRoles: ["Suporte", "Desconhecida"],
      city: "São Paulo",
      state: "sp",
      experience: "2 temporadas",
      availability: "looking",
      availabilitySchedule: "Seg–Sex, 19h",
      teamHistory: "Alpha",
      championships: "Copa Regional",
      achievements: "Finalista",
      bio: "Atleta focado.",
      contactAvailable: false,
      socialLinks: [{ url: "https://example.com/private" }],
      email: "private@example.com",
      status: "published"
    }]
  ]);
  const calls = [];
  const key = ref => `${ref.collection}/${ref.id}`;
  const auth = { currentUser: { uid: "team-1" } };
  const sdk = {
    doc: (_db, collection, id) => ({ collection, id }),
    getDoc: async ref => {
      calls.push(key(ref));
      return {
        id: ref.id,
        exists: () => documents.has(key(ref)),
        data: () => documents.get(key(ref))
      };
    }
  };
  const service = createMercadoDaBalaService({ auth, db: {}, sdk });
  const profile = await service.getApplicantProfile("team-1", "vacancy-1__player-1", "player-1");

  assert.deepEqual(calls, [
    "market_applications/vacancy-1__player-1",
    "market_profiles/player-1"
  ]);
  assert.deepEqual(profile, {
    id: "player-1",
    uid: "player-1",
    nickname: "Falcão",
    mainRole: "Fragger",
    secondaryRoles: ["Suporte"],
    city: "São Paulo",
    state: "SP",
    experience: "2 temporadas",
    availability: "looking",
    availabilitySchedule: "Seg–Sex, 19h",
    teamHistory: "Alpha",
    championships: "Copa Regional",
    achievements: "Finalista",
    bio: "Atleta focado.",
    contactAvailable: true
  });
  assert.equal("socialLinks" in profile, false);
  assert.equal("email" in profile, false);
  assert.equal(JSON.stringify(profile).includes("example.com"), false);

  documents.set("market_applications/vacancy-1__player-1", {
    vacancyOwnerUid: "another-team",
    applicantUid: "player-1"
  });
  calls.length = 0;
  await assert.rejects(service.getApplicantProfile("team-1", "vacancy-1__player-1", "player-1"), /não pertence a uma vaga sua/);
  assert.deepEqual(calls, ["market_applications/vacancy-1__player-1"]);

  auth.currentUser = null;
  await assert.rejects(service.getApplicantProfile("team-1", "vacancy-1__player-1", "player-1"), /Entre na sua conta/);
});

test("candidato pode retirar somente a própria candidatura e a retirada preserva o histórico", async () => {
  const documents = new Map([
    ["market_applications/vacancy-1__player-1", {
      applicantUid: "player-1",
      status: "reviewing"
    }],
    ["market_applications/vacancy-2__player-2", {
      applicantUid: "player-2",
      status: "new"
    }]
  ]);
  const updates = [];
  const key = ref => `${ref.collection}/${ref.id}`;
  const sdk = {
    doc: (_db, collection, id) => ({ collection, id }),
    getDoc: async ref => ({
      exists: () => documents.has(key(ref)),
      data: () => documents.get(key(ref))
    }),
    updateDoc: async (ref, patch) => {
      updates.push({ ref: key(ref), patch });
      documents.set(key(ref), { ...documents.get(key(ref)), ...patch });
    },
    serverTimestamp: () => "server-time"
  };
  const auth = { currentUser: { uid: "player-1" } };
  const service = createMercadoDaBalaService({ auth, db: {}, sdk });

  await service.withdrawApplication("player-1", "vacancy-1__player-1");
  assert.deepEqual(updates, [{
    ref: "market_applications/vacancy-1__player-1",
    patch: { status: "withdrawn", updatedAt: "server-time" }
  }]);
  assert.equal(documents.get("market_applications/vacancy-1__player-1").status, "withdrawn");
  await assert.rejects(
    service.withdrawApplication("player-1", "vacancy-2__player-2"),
    /Candidatura não encontrada ou sem permissão/
  );
  assert.equal(updates.length, 1);

  auth.currentUser = null;
  await assert.rejects(
    service.withdrawApplication("player-1", "vacancy-1__player-1"),
    /Entre na sua conta/
  );
});

test("pedido de contato só é criado para perfil sem link e mantém o link privado até o aceite", async () => {
  const documents = new Map([
    ["market_vacancies/vacancy-1", {
      ownerUid: "team-1",
      teamName: "Freitas",
      title: "Procurando fragger",
      status: "open",
      expiresAt: new Date(Date.now() + 60_000)
    }],
    ["market_vacancies/vacancy-2", {
      ownerUid: "team-2",
      teamName: "Outra equipe",
      title: "Procurando suporte",
      status: "open",
      expiresAt: new Date(Date.now() + 60_000)
    }],
    ["market_profiles/player-1", {
      uid: "player-1",
      nickname: "Falcão",
      status: "published",
      contactAvailable: false
    }],
    ["market_profiles/player-with-link", {
      uid: "player-with-link",
      nickname: "Atleta",
      status: "published",
      contactAvailable: true
    }],
    ["market_profiles/player-legacy-link", {
      uid: "player-legacy-link",
      nickname: "Legado",
      status: "published",
      contactAvailable: false,
      socialLinks: [{ url: "https://instagram.com/legacy" }]
    }],
    ["market_profiles/player-private-link", {
      uid: "player-private-link",
      nickname: "Contato privado",
      status: "published",
      contactAvailable: false
    }],
    ["market_contact_links/player-private-link", {
      ownerUid: "player-private-link",
      links: [{ label: "Contato", url: "https://instagram.com/private" }]
    }]
  ]);
  const key = ref => `${ref.collection}/${ref.id}`;
  const auth = { currentUser: { uid: "team-1" } };
  const sdk = {
    doc: (_db, collection, id) => ({ collection, id }),
    getDoc: async ref => ({
      exists: () => documents.has(key(ref)),
      data: () => documents.get(key(ref))
    }),
    writeBatch: () => {
      const operations = [];
      return {
        set: (ref, data) => operations.push(() => documents.set(key(ref), data)),
        commit: async () => operations.forEach(operation => operation())
      };
    },
    serverTimestamp: () => "server-time"
  };
  const service = createMercadoDaBalaService({ auth, db: {}, sdk });

  const id = await service.createContactRequest(
    "team-1", "player-1", "vacancy-1", "Gostaríamos de conversar com você.", "https://wa.me/5511999999999"
  );
  assert.equal(id, "player-1__team-1");
  assert.deepEqual(documents.get(`market_contact_requests/${id}`), {
    senderUid: "team-1",
    recipientUid: "player-1",
    vacancyId: "vacancy-1",
    teamName: "Freitas",
    vacancyTitle: "Procurando fragger",
    playerName: "Falcão",
    message: "Gostaríamos de conversar com você.",
    status: "pending",
    createdAt: "server-time",
    updatedAt: "server-time"
  });
  assert.equal("senderContactUrl" in documents.get(`market_contact_requests/${id}`), false);
  assert.equal(documents.get(`market_contact_request_details/${id}`).senderContactUrl, "https://wa.me/5511999999999");
  await assert.rejects(
    service.createContactRequest("team-1", "player-1", "vacancy-1", "Outra mensagem", "https://wa.me/5511999999999"),
    /já enviou um pedido/
  );

  auth.currentUser.uid = "team-2";
  await assert.rejects(
    service.createContactRequest("team-2", "player-with-link", "vacancy-2", "Temos interesse", "https://wa.me/5511888888888"),
    /já compartilhou um link/
  );
  await assert.rejects(
    service.createContactRequest("team-2", "player-legacy-link", "vacancy-2", "Temos interesse", "https://wa.me/5511888888888"),
    /já compartilhou um link/
  );
  await assert.rejects(
    service.createContactRequest("team-2", "player-private-link", "vacancy-2", "Temos interesse", "https://wa.me/5511888888888"),
    /já compartilhou um link/
  );
});

test("aceitar pedido libera um link de cada lado apenas para as duas contas", async () => {
  const id = "player-1__team-1";
  const documents = new Map([
    [`market_contact_requests/${id}`, {
      senderUid: "team-1",
      recipientUid: "player-1",
      status: "pending"
    }],
    [`market_contact_request_details/${id}`, {
      senderContactUrl: "https://wa.me/5511999999999",
      senderContactLabel: "Contato do time"
    }]
  ]);
  const key = ref => `${ref.collection}/${ref.id}`;
  const auth = { currentUser: { uid: "player-1" } };
  const sdk = {
    doc: (_db, collection, docId) => ({ collection, id: docId }),
    getDoc: async ref => ({
      exists: () => documents.has(key(ref)),
      data: () => documents.get(key(ref))
    }),
    writeBatch: () => {
      const operations = [];
      return {
        update: (ref, patch) => operations.push(() => documents.set(key(ref), { ...documents.get(key(ref)), ...patch })),
        commit: async () => operations.forEach(operation => operation())
      };
    },
    serverTimestamp: () => "accepted-time"
  };
  const service = createMercadoDaBalaService({ auth, db: {}, sdk });

  auth.currentUser.uid = "team-1";
  await assert.rejects(
    service.acceptContactRequest("team-1", id, "https://instagram.com/team"),
    /não está pendente para sua conta/
  );
  auth.currentUser.uid = "player-1";
  await service.acceptContactRequest("player-1", id, "https://instagram.com/falcao");
  assert.equal(documents.get(`market_contact_requests/${id}`).status, "accepted");
  assert.equal(documents.get(`market_contact_request_details/${id}`).recipientContactUrl, "https://instagram.com/falcao");
  assert.deepEqual(await service.getSharedContactForRequest("player-1", id), {
    label: "Contato do time",
    url: "https://wa.me/5511999999999"
  });
  auth.currentUser.uid = "team-1";
  assert.deepEqual(await service.getSharedContactForRequest("team-1", id), {
    label: "Contato do jogador",
    url: "https://instagram.com/falcao"
  });
  auth.currentUser.uid = "intruso";
  await assert.rejects(service.getSharedContactForRequest("intruso", id), /só fica disponível depois que o jogador aceita/);
});

test("recusar o pedido atualiza somente o status e não libera os contatos privados", async () => {
  const id = "player-2__team-2";
  const documents = new Map([
    [`market_contact_requests/${id}`, {
      senderUid: "team-2",
      recipientUid: "player-2",
      status: "pending"
    }],
    [`market_contact_request_details/${id}`, {
      senderContactUrl: "https://wa.me/5511999999999",
      senderContactLabel: "Contato do time"
    }]
  ]);
  const key = ref => `${ref.collection}/${ref.id}`;
  const sdk = {
    doc: (_db, collection, docId) => ({ collection, id: docId }),
    getDoc: async ref => ({
      exists: () => documents.has(key(ref)),
      data: () => documents.get(key(ref))
    }),
    updateDoc: async (ref, patch) => documents.set(key(ref), { ...documents.get(key(ref)), ...patch }),
    serverTimestamp: () => "declined-time"
  };
  const auth = { currentUser: { uid: "player-2" } };
  const service = createMercadoDaBalaService({
    auth,
    db: {},
    sdk
  });
  await service.declineContactRequest("player-2", id);
  assert.equal(documents.get(`market_contact_requests/${id}`).status, "declined");
  assert.equal("recipientContactUrl" in documents.get(`market_contact_request_details/${id}`), false);
  auth.currentUser.uid = "team-2";
  await assert.rejects(service.getSharedContactForRequest("team-2", id), /só fica disponível depois que o jogador aceita/);
});

test("lista de pedidos de contato é limitada, recente primeiro e consultada por participante", async () => {
  let queryParts;
  const sdk = {
    collection: (_db, name) => name,
    where: (...args) => ({ type: "where", args }),
    orderBy: (...args) => ({ type: "orderBy", args }),
    limit: value => ({ type: "limit", value }),
    query: (...parts) => { queryParts = parts; return parts; },
    getDocs: async () => ({ docs: [{ id: "request-1", data: () => ({ status: "pending" }) }] })
  };
  const service = createMercadoDaBalaService({
    auth: { currentUser: { uid: "player-1" } },
    db: {},
    sdk
  });
  const results = await service.listContactRequests("player-1", "received");
  assert.equal(results[0].id, "request-1");
  assert.deepEqual(queryParts[1], { type: "where", args: ["recipientUid", "==", "player-1"] });
  assert.deepEqual(queryParts[2], { type: "orderBy", args: ["createdAt", "desc"] });
  assert.deepEqual(queryParts[3], { type: "limit", value: 50 });
});

test("pedido de contato só aparece como alternativa quando o jogador não compartilhou link", () => {
  assert.match(marketUi, /hasContact \|\| allowContactCheck \|\| appState\.user/);
  assert.match(marketUi, /data-action="contact-profile"/);
  assert.match(marketUi, /data-action="request-contact"/);
  assert.match(marketUi, /getProfileContactLinks\(appState\.user\.uid, id\)/);
  assert.match(marketUi, /getProfileContactLinks\(appState\.user\.uid, profileUid\)/);
  assert.match(marketUi, /Este jogador já compartilhou um link\. Use o botão CONTATO\./);
  assert.match(marketUi, /O link da equipe e o seu ficarão visíveis somente para vocês dois/);
  assert.match(marketHtml, /data-tab="contact-requests"/);
  const requestRules = firestoreRules.split("match /market_contact_requests/")[1].split("match /market_contact_request_details/")[0];
  const detailsRules = firestoreRules.split("match /market_contact_request_details/")[1].split("match /market_favorites/")[0];
  assert.match(requestRules, /profileHasNoSharedMarketContact/);
  assert.match(requestRules, /request\.resource\.data\.status == 'pending'/);
  assert.match(detailsRules, /allow list: if false;/);
  assert.match(detailsRules, /data\.status == 'accepted'/);
  assert.match(firestoreRules, /market_contact_links\/\$\(\s*profileId\s*\)/);
  assert.deepEqual(
    firestoreIndexes.indexes
      .filter(index => index.collectionGroup === "market_contact_requests")
      .map(index => index.fields[0].fieldPath)
      .sort(),
    ["recipientUid", "senderUid"]
  );
});

test("abrir o espaço próprio migra links de perfis legados para a coleção privada", async () => {
  const documents = new Map([
    ["market_profiles/player-legacy", {
      uid: "player-legacy",
      nickname: "Atleta legado",
      mainRole: "Suporte",
      secondaryRoles: [],
      city: "",
      state: "",
      experience: "",
      availability: "looking",
      availabilitySchedule: "",
      teamHistory: "",
      championships: "",
      achievements: "",
      bio: "",
      socialLinks: [{ label: "Contato", url: "https://instagram.com/legacy" }],
      status: "published",
      createdAt: "created",
      updatedAt: "updated"
    }]
  ]);
  const key = ref => `${ref.collection}/${ref.id}`;
  const sdk = {
    doc: (_db, collection, id) => ({ collection, id }),
    getDoc: async ref => ({
      exists: () => documents.has(key(ref)),
      data: () => documents.get(key(ref))
    }),
    writeBatch: () => {
      const operations = [];
      return {
        set: (ref, data) => operations.push(() => documents.set(key(ref), data)),
        delete: ref => operations.push(() => documents.delete(key(ref))),
        commit: async () => operations.forEach(operation => operation())
      };
    },
    serverTimestamp: () => "server-time"
  };
  const service = createMercadoDaBalaService({
    auth: { currentUser: { uid: "player-legacy" } },
    db: {},
    sdk
  });

  const ownProfile = await service.getMyProfile("player-legacy");
  assert.equal("socialLinks" in documents.get("market_profiles/player-legacy"), false);
  assert.deepEqual(documents.get("market_contact_links/player-legacy").links, [
    { label: "Contato", url: "https://instagram.com/legacy" }
  ]);
  assert.equal(ownProfile.contactAvailable, true);
  assert.equal(ownProfile.socialLinks[0].url, "https://instagram.com/legacy");
});

test("candidaturas recebidas oferecem uma ação para abrir o currículo do candidato", () => {
  assert.match(marketUi, /data-action="view-applicant-profile"/);
  assert.match(marketUi, /case "view-applicant-profile"/);
  assert.match(marketUi, /isReceived && !isWithdrawn \? `[\s\S]*data-action="view-applicant-profile"/);
  assert.match(marketUi, /getApplicantProfile\(appState\.user\.uid, applicationId, profileUid\)/);
  assert.match(marketUi, /profileDetail\(profile, \{ allowContactCheck: true \}\)/);
  assert.match(marketUi, /"Clique para verificar os links de contato compartilhados pelo jogador\."/);
});

test("candidatos podem retirar a própria candidatura e a organização vê o estado final", () => {
  assert.match(marketUi, /data-action="withdraw-application"/);
  assert.match(marketUi, /case "withdraw-application": await withdrawApplication\(id\)/);
  assert.match(marketUi, /service\.withdrawApplication\(appState\.user\.uid, id\)/);
  assert.match(marketUi, /withdrawn: "Candidatura retirada"/);
  assert.match(marketUi, /O candidato retirou esta candidatura\./);
  assert.match(marketUi, /isReceived && !isWithdrawn/);
  const applicationRules = firestoreRules.split("match /market_applications/")[1].split("match /market_favorites/")[0];
  assert.match(applicationRules, /resource\.data\.applicantUid == request\.auth\.uid[\s\S]*request\.resource\.data\.status == 'withdrawn'/);
});

test("Firestore mantém os links privados e o admin tem uma fila de denúncias do Mercado da Bala", () => {
  const profileRules = firestoreRules.split("function validMarketProfile")[1].split("function validMarketVacancy")[0];
  assert.doesNotMatch(profileRules, /socialLinks/);
  assert.match(firestoreRules, /match \/market_contact_links\/\{profileId\}/);
  assert.match(firestoreRules, /allow list: if false;/);
  assert.match(firestoreRules, /request\.auth\.uid == profileId/);
  assert.match(adminHtml, /id="sectionMarketReports"/);
  assert.match(adminHtml, /Denúncias Mercado da Bala/);
  assert.match(adminHtml, /admin-market-reports\.mjs/);
  assert.match(adminJs, /'sectionMarketReports'/);
  assert.match(marketUi, /data-action="contact-applicant"/);
  assert.match(marketUi, /data-action="contact-profile"/);
  assert.match(marketUi, /disabled aria-disabled="true">CONTATO/);
});

test("redator remove e-mail e telefone brasileiros em texto livre", () => {
  const safe = redactMarketContactInfo("e-mail: pessoa@site.com | WhatsApp: (21) 98888-7777");
  assert.doesNotMatch(safe, /pessoa@site\.com/i);
  assert.doesNotMatch(safe, /98888-7777/);
  assert.match(safe, /e-mail removido/);
  assert.match(safe, /telefone removido/);
});
