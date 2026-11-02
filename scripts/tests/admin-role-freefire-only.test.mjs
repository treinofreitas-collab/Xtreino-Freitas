import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('Admin sees and opens only the Free Fire scoreboard', async () => {
  const [adminScript, adminPage, specLogoModule] = await Promise.all([
    read('artifacts/xtreino/public/admin.js'),
    read('artifacts/xtreino/public/admin.html'),
    read('artifacts/xtreino/public/js/admin-spec-logos.mjs'),
  ]);
  const adminRoleSections = adminScript.match(/admin:\s*\[([^\]]*)\]/)?.[1] || '';

  assert.deepEqual([...adminRoleSections.matchAll(/'([^']+)'/g)].map(match => match[1]), [
    'sectionFreefireScoring',
  ]);
  assert.match(adminScript, /admin:\s*\['#sectionFreefireScoring','.sidebar-link','#adminSidebarToggle','#btnLogout'\]/);
  assert.match(adminScript, /else if \(!allowedSections\.includes\(sectionId\)\)/);
  assert.match(adminScript, /window\.adminRoleLower = normalizedRole/);
  assert.match(adminScript, /currentAdminRoleUnsubscribe = onSnapshotRole\(roleRef/);
  assert.match(adminScript, /if \(nextRole === window\.adminRoleLower\) return/);
  assert.match(adminScript, /window\.adminNav\('operacoes', 'sectionFreefireScoring'/);
  assert.match(adminScript, /const hideTrainingAward = \['admin', 'streamer'\]\.includes\(resolvedRole\)/);
  assert.match(adminScript, /if \(\['admin', 'streamer'\]\.includes\(role\)\)/);
  assert.match(adminPage, /scoringOnlyAdmin && hash !== 'operacoes'/);
  assert.match(adminPage, /sectionId = 'sectionFreefireScoring'/);
  assert.match(specLogoModule, /if \(\['ceo', 'gerente'\]\.includes\(normalizedRole\)\) return 'manage'/);
});

test('Admin keeps the Free Fire API but loses other role-based management APIs', async () => {
  const [freefireRoute, freefireFunction, specRoute, specExport, specDelete, specClear, eventAccess, purchase] =
    await Promise.all([
      read('artifacts/api-server/src/routes/freefire-scoring.ts'),
      read('netlify/functions/freefire-analyze.js'),
      read('artifacts/api-server/src/routes/spec-logos.ts'),
      read('netlify/functions/spec-logos-export.js'),
      read('netlify/functions/spec-logo-delete.js'),
      read('netlify/functions/spec-logos-clear.js'),
      read('netlify/shared/event-access.js'),
      read('netlify/shared/purchase.js'),
    ]);

  assert.match(freefireRoute, /ALLOWED_ROLES = new Set\(\["admin", "ceo", "gerente", "socio"\]\)/);
  assert.match(freefireFunction, /ALLOWED_ROLES = new Set\(\["admin", "ceo", "gerente", "socio"\]\)/);
  assert.doesNotMatch(specRoute, /new Set\(\[[^\]]*"admin"/);
  assert.doesNotMatch(specExport, /new Set\(\[[^\]]*"admin"/);
  assert.doesNotMatch(specDelete, /new Set\(\[[^\]]*"admin"/);
  assert.doesNotMatch(specClear, /new Set\(\[[^\]]*"admin"/);
  assert.doesNotMatch(eventAccess, /MANAGERS = new Set\(\[[^\]]*"admin"/);
  assert.doesNotMatch(purchase, /\["admin",\s*"ceo",\s*"gerente"/);
});

test('Firestore and Storage rules restrict Admin to scoreboard data and logos', async () => {
  const [rootRules, appRules, storageRules] = await Promise.all([
    read('public/config/firestore.rules'),
    read('artifacts/xtreino/public/config/firestore.rules'),
    read('artifacts/xtreino/public/config/storage.rules'),
  ]);

  for (const rules of [rootRules, appRules]) {
    assert.match(rules, /function isAdmin\(\)\s*\{\s*return isSignedIn\(\)[\s\S]*?role in \['Ceo','CEO','ceo'\]/);
    assert.match(rules, /function isAdminRole\(\)[\s\S]*?role in \['admin','Admin','ADMIN'\]/);
    assert.doesNotMatch(rules, /function isStaff\(\)[\s\S]*?\['staff','Staff','STAFF','admin','Admin','ADMIN'/);
    assert.match(rules, /isAdminRole\(\) && resource\.data\.eventType == 'modo-liga'/);
    assert.match(rules, /function isFreeFireScoringRole\(\)[\s\S]*?return isAdminRole\(\) \|\|/);
    assert.match(rules, /match \/championship_config\/\{configId\}[\s\S]*isModoLigaScoringLogoType/);
  }

  assert.doesNotMatch(storageRules.match(/function isSpecLogoManager\(\)[\s\S]*?\n    \}/)?.[0] || '', /'admin'/);
  assert.match(storageRules, /isAdminRole\(\) \|\| isFreeFireScoreboardLogoPath\(\)/);
  assert.match(storageRules, /allow write: if request\.auth != null && !isAdminRole\(\)/);
});
