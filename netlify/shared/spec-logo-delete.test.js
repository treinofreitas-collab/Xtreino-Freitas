const assert = require("node:assert/strict");
const test = require("node:test");
const firebaseAdmin = require("./firebase-admin");

const removedPaths = [];
const adminMock = {
  firestore() {
    return {
      collection(name) {
        if (name === "users") {
          return {
            doc: () => ({
              get: async () => ({ data: () => ({ role: "ceo" }) }),
            }),
          };
        }

        return {
          doc: () => ({
            get: async () => ({ exists: false, data: () => ({}) }),
            delete: async () => {},
          }),
        };
      },
    };
  },
  storage() {
    return {
      file(path) {
        return {
          exists: async () => [true],
          delete: async () => { removedPaths.push(path); },
        };
      },
    };
  },
};

firebaseAdmin.getAdmin = () => adminMock;
firebaseAdmin.verifyFirebaseUser = async () => ({ uid: "admin-test" });
const { handler } = require("../functions/spec-logo-delete");

async function deleteLogo({ path, hour, code }) {
  return handler({
    httpMethod: "DELETE",
    path,
    rawUrl: path ? `https://example.test${path}` : undefined,
    queryStringParameters: hour || code ? { hour, code } : null,
    headers: { authorization: "Bearer test-token" },
  });
}

test("deletes avatar logos when hour and code arrive in the request path", async () => {
  removedPaths.length = 0;
  const response = await deleteLogo({ path: "/api/spec-logos/19H/902000007" });

  assert.equal(response.statusCode, 204);
  assert.deepEqual(removedPaths, ["teams/modo-liga/logos/spec/19H/902000007.png"]);
});

test("deletes avatar logos when hour and code arrive as query parameters", async () => {
  removedPaths.length = 0;
  const response = await deleteLogo({
    path: "/.netlify/functions/spec-logo-delete",
    hour: "19",
    code: "902000030",
  });

  assert.equal(response.statusCode, 204);
  assert.deepEqual(removedPaths, ["teams/modo-liga/logos/spec/19H/902000030.png"]);
});

test("keeps the third avatar code and A–Z numeric logo codes valid", async () => {
  removedPaths.length = 0;
  const andrew = await deleteLogo({
    path: "/api/spec-logos/20/902000006",
  });
  const letterA = await deleteLogo({
    path: "/.netlify/functions/spec-logo-delete",
    hour: "20H",
    code: "902000034",
  });

  assert.equal(andrew.statusCode, 204);
  assert.equal(letterA.statusCode, 204);
  assert.deepEqual(removedPaths, [
    "teams/modo-liga/logos/spec/20H/902000006.png",
    "teams/modo-liga/logos/spec/20H/902000034.png",
  ]);
});

test("rejects unsupported avatar codes and hours before contacting storage", async () => {
  removedPaths.length = 0;
  const invalidAvatar = await deleteLogo({
    path: "/api/spec-logos/19/902000008",
  });
  const invalidHour = await deleteLogo({
    path: "/api/spec-logos/24/902000007",
  });

  assert.equal(invalidAvatar.statusCode, 400);
  assert.equal(invalidHour.statusCode, 400);
  assert.deepEqual(removedPaths, []);
});
