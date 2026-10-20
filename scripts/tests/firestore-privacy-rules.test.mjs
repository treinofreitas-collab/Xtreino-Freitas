import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rulePaths = [
  new URL("../../artifacts/xtreino/public/config/firestore.rules", import.meta.url),
  new URL("../../public/config/firestore.rules", import.meta.url),
];

function matchBlock(source, collection) {
  const match = source.match(new RegExp(`match /${collection}/\\{[^}]+\\}\\s*\\{`));
  assert.ok(match, `missing match block for ${collection}`);
  const open = match.index + match[0].length - 1;
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  assert.fail(`unclosed match block for ${collection}`);
}

test("both Firestore rule copies keep user profiles private", () => {
  for (const path of rulePaths) {
    const rules = readFileSync(path, "utf8");
    const users = matchBlock(rules, "users");
    assert.match(users, /allow read:\s*if isSelf\(userId\)\s*\|\|\s*canReadAll\(\);/);
    assert.doesNotMatch(users, /allow read:\s*if true|affiliateStatus in \['active', 'pending', 'inactive'\]/);
  }
});

test("registration reads require authentication and ownership or an authorized role", () => {
  for (const path of rulePaths) {
    const rules = readFileSync(path, "utf8");
    const registrations = matchBlock(rules, "registrations");
    assert.match(registrations, /allow get, list:\s*if isSignedIn\(\)/);
    assert.match(registrations, /resource\.data\.userId == request\.auth\.uid/);
    assert.match(registrations, /canReadAll\(\)/);
    assert.doesNotMatch(registrations, /allow list:\s*if true/);
  }
});

test("clients cannot create affiliate commissions directly", () => {
  for (const path of rulePaths) {
    const rules = readFileSync(path, "utf8");
    const affiliateSales = matchBlock(rules, "affiliate_sales");
    assert.match(affiliateSales, /allow create:\s*if false;/);
  }
});
