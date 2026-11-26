const test = require("node:test");
const assert = require("node:assert/strict");
const FIRST_SPEC_CODE = 902000034;
const {
  getAvailableModoLigaSpecOptions,
  getAvailableModoLigaSpecLetters,
  normalizeSpecAvatar,
  normalizeSpecHour,
  normalizeSpecLetter,
  normalizeSpecSelection,
  specPathForSelection,
} = require("./modo-liga-spec");

test("normalizes Modo Liga hours and maps letter codes to the SPEC storage path", () => {
  assert.equal(normalizeSpecHour("Quarta - 00h"), "00");
  assert.equal(normalizeSpecHour("20h"), "20");
  assert.equal(normalizeSpecHour("14h"), "");
  assert.equal(normalizeSpecLetter(" e "), "E");
  assert.equal(normalizeSpecLetter("AA"), "");
  assert.equal(specPathForSelection("21h", "A"), "teams/modo-liga/logos/spec/21H/902000034.png");
  assert.equal(specPathForSelection("21h", "Z"), `teams/modo-liga/logos/spec/21H/${FIRST_SPEC_CODE + 25}.png`);
  assert.equal(normalizeSpecAvatar("avatar:kelly"), "avatar:kelly");
  assert.equal(normalizeSpecAvatar("avatar:unknown"), "");
  assert.equal(normalizeSpecSelection("avatar:maxim"), "avatar:maxim");
  assert.equal(specPathForSelection("21h", "avatar:kelly"), "teams/modo-liga/logos/spec/21H/902000007.png");
});

test("returns only letters free at every selected hour, including active checkout holds", async () => {
  const hours = ["20", "21", "22", "23"];
  const blocked = new Map(hours.map(hour => [hour, new Set()]));
  for (const hour of hours) {
    for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      if (letter !== "A" && letter !== "E") blocked.get(hour).add(letter);
    }
  }
  const bucket = {
    getFiles: async ({ prefix }) => {
      const hour = prefix.match(/\/(\d{2})H\//)[1];
      return [[...blocked.get(hour)].map(letter => ({
        name: `${prefix}${FIRST_SPEC_CODE + letter.charCodeAt(0) - 65}.png`,
      }))];
    },
  };
  let lockDocuments = [];
  const lock = { id: "21_E", data: () => ({
    hour: "21", letter: "E", status: "pending", expiresAt: new Date(Date.now() + 60_000),
  }) };
  const db = {
    collection: name => {
      assert.equal(name, "modo_liga_spec_letter_locks");
      return {
        where: (field, operator, value) => {
          assert.equal(field, "hour");
          assert.equal(operator, "in");
          assert.deepEqual(value, hours);
          return { get: async () => ({ docs: lockDocuments }) };
        },
      };
    },
  };
  assert.deepEqual(await getAvailableModoLigaSpecLetters({ db, bucket, hours }), ["A", "E"]);
  lockDocuments = [lock];
  assert.deepEqual(await getAvailableModoLigaSpecLetters({ db, bucket, hours }), ["A"]);
  lockDocuments = [{
    data: () => ({
      hour: "21", letter: "E", status: "pending", expiresAt: new Date(Date.now() - 1),
    }),
  }];
  assert.deepEqual(await getAvailableModoLigaSpecLetters({ db, bucket, hours }), ["A", "E"]);
});

test("returns avatar codes that are free across every selected hour", async () => {
  const hours = ["20", "21"];
  const occupiedByHour = new Map(hours.map(hour => [hour, new Set()]));
  const bucket = {
    getFiles: async ({ prefix }) => {
      const hour = prefix.match(/\/(\d{2})H\//)[1];
      return [[...occupiedByHour.get(hour)].map(code => ({ name: `${prefix}${code}.png` }))];
    },
  };
  let lockDocuments = [];
  const db = {
    collection: name => {
      assert.equal(name, "modo_liga_spec_letter_locks");
      return {
        where: (field, operator, value) => {
          assert.equal(field, "hour");
          assert.equal(operator, "in");
          assert.deepEqual(value, hours);
          return { get: async () => ({ docs: lockDocuments }) };
        },
      };
    },
  };

  lockDocuments = [{
    data: () => ({
      hour: "21",
      selection: "avatar:kelly",
      status: "paid",
      expiresAt: null,
    }),
  }];
  const options = await getAvailableModoLigaSpecOptions({ db, bucket, hours });
  assert.deepEqual(options.availableAvatars.map(avatar => avatar.selection), [
    "avatar:maxim",
    "avatar:andrew",
  ]);

  occupiedByHour.get("20").add("902000030");
  const afterUpload = await getAvailableModoLigaSpecOptions({ db, bucket, hours });
  assert.deepEqual(afterUpload.availableAvatars.map(avatar => avatar.selection), [
    "avatar:andrew",
  ]);

  lockDocuments = [{
    data: () => ({
      hour: "21",
      selection: "avatar:kelly",
      status: "pending",
      expiresAt: new Date(Date.now() - 1),
    }),
  }];
  const afterExpiry = await getAvailableModoLigaSpecOptions({ db, bucket, hours });
  assert.deepEqual(afterExpiry.availableAvatars.map(avatar => avatar.selection), [
    "avatar:kelly",
    "avatar:andrew",
  ]);
});
