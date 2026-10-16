import test from "node:test";
import assert from "node:assert/strict";
import {
  createMercadoDaBalaService,
  isSafeMarketUrl,
  redactMarketContactInfo,
  sanitizeMarketplaceProfile,
  sanitizeMarketplaceVacancy
} from "../../artifacts/xtreino/public/js/mercado-da-bala-data.mjs";

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
    getDocs: async () => ({ docs: [{ id: "player-1" }, { id: "player-2" }] }),
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

test("redator remove e-mail e telefone brasileiros em texto livre", () => {
  const safe = redactMarketContactInfo("e-mail: pessoa@site.com | WhatsApp: (21) 98888-7777");
  assert.doesNotMatch(safe, /pessoa@site\.com/i);
  assert.doesNotMatch(safe, /98888-7777/);
  assert.match(safe, /e-mail removido/);
  assert.match(safe, /telefone removido/);
});
