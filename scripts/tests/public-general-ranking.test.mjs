import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexHtml = readFileSync(
  new URL("../../artifacts/xtreino/public/index.html", import.meta.url),
  "utf8",
);
const rankingHtml = readFileSync(
  new URL("../../artifacts/xtreino/public/ranking.html", import.meta.url),
  "utf8",
);
const clientHtml = readFileSync(
  new URL("../../artifacts/xtreino/public/client.html", import.meta.url),
  "utf8",
);
const clientJs = readFileSync(
  new URL("../../artifacts/xtreino/public/client.js", import.meta.url),
  "utf8",
);
const publicModule = readFileSync(
  new URL("../../artifacts/xtreino/public/js/public-general-ranking.mjs", import.meta.url),
  "utf8",
);
const ruleFiles = [
  new URL("../../public/config/firestore.rules", import.meta.url),
  new URL("../../artifacts/xtreino/public/config/firestore.rules", import.meta.url),
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

test("General Ranking lives on its own public page linked beside the marketplace", () => {
  assert.match(indexHtml, /RANKING GERAL/);
  assert.match(indexHtml, /href="mercado-da-bala\/"[^>]*>MERCADO DA BALA<\/a>\s*<a href="ranking\.html"/);
  assert.doesNotMatch(indexHtml, /id="publicGeneralRankingRows"/);
  assert.match(rankingHtml, /id="publicGeneralRankingRows"/);
  assert.match(rankingHtml, /id="loadMorePublicGeneralRanking"/);
  assert.match(rankingHtml, /src="js\/public-general-ranking\.mjs/);
  assert.match(publicModule, /getGeneralRankingPage/);
  assert.doesNotMatch(publicModule, /currentUser|isSignedIn/);
});

test("Minha Equipe links to the purchased team ranking in the account dashboard", () => {
  assert.match(rankingHtml, /href="client\.html#teamPerformanceCard"[^>]*>[\s\S]*?Minha equipe/);
  assert.match(clientHtml, /id="teamPerformanceCard"/);
  assert.match(clientJs, /function scrollToRequestedTeamRanking\(\)/);
  assert.match(clientJs, /window\.location\.hash !== '#teamPerformanceCard'/);
});

test("General Ranking reads are public while writes and private records stay restricted", () => {
  for (const path of ruleFiles) {
    const rules = readFileSync(path, "utf8");
    const teams = matchBlock(rules, "freefire_general_ranking");
    const sessions = matchBlock(rules, "freefire_general_ranking_sessions");
    const meta = matchBlock(rules, "freefire_general_ranking_meta");

    assert.match(teams, /allow get, list:\s*if true;/);
    assert.match(teams, /allow create, update:\s*if isAuthorizedAdmin\(\) \|\| isGerente\(\) \|\| isAdminRole\(\);/);
    assert.match(teams, /allow delete:\s*if false;/);
    for (const block of [sessions, meta]) {
      assert.match(block, /allow get, list:\s*if isAuthorizedAdmin\(\) \|\| isGerente\(\) \|\| isAdminRole\(\);/);
      assert.match(block, /allow create, update:\s*if isAuthorizedAdmin\(\) \|\| isGerente\(\) \|\| isAdminRole\(\);/);
      assert.match(block, /allow delete:\s*if false;/);
    }
  }
});
