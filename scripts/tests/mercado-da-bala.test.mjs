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
const marketUi = readFileSync(
  new URL("../../artifacts/xtreino/public/mercado-da-bala/mercado.js", import.meta.url),
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
