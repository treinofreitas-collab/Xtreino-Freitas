import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Admin enables SOLO in Diário and binds /solo only to a Diário SOLO event', async () => {
  const [adminHtml, adminJs] = await Promise.all([
    read('../../artifacts/xtreino/public/admin.html'),
    read('../../artifacts/xtreino/public/admin.js'),
  ]);

  assert.match(adminHtml, /<option value="diario-solo">Diário Solo → \/solo<\/option>/);
  assert.match(adminHtml, /id="evtEventType" onchange="onEvtUrlTypeChange\(\)"/);
  assert.match(adminJs, /if \(tab === 'camp' \|\| tab === 'diario'\)/);
  assert.match(adminJs, /urlType === 'diario-solo' && \(category !== 'diario' \|\| tipo !== 'SOLO'\)/);
  assert.match(adminJs, /option\.value === 'SOLO'/);
  assert.match(adminJs, /urlSlug: usesCampSeason7Url \? 'camp-season-7' : usesIntensivoFreitasUrl \? 'intensivo' : usesDiarioSoloUrl \? 'solo' : null/);
  assert.match(adminJs, /ev\.urlSlug === 'solo'/);
});

test('Diário Solo displays its configured capacity and collects player details without a logo', async () => {
  const [adminJs, publicScript] = await Promise.all([
    read('../../artifacts/xtreino/public/admin.js'),
    read('../../artifacts/xtreino/public/script.js'),
  ]);

  assert.ok(adminJs.includes("if (urlSlug === 'solo') {"));
  assert.ok(adminJs.includes("opt.dataset.capacity = String(configuredCapacity > 0 ? configuredCapacity : 48);"));
  assert.ok(adminJs.includes("selectedOpt?.dataset?.urlSlug === 'solo'"));
  assert.ok(adminJs.includes('const cap = capacityForHour(hour);'));

  assert.ok(publicScript.includes("heading.textContent = isSoloPlayerEvent ? 'Dados do Jogador' : 'Dados do Time';"));
  assert.ok(publicScript.includes("const nameLabel = isSoloPlayerEvent ? 'NICK DO JOGADOR' : 'NOME DO TIME';"));
  assert.ok(publicScript.includes("const logoField = isSoloPlayerEvent ? '' : `"));
  assert.ok(publicScript.includes('teamLogoUrl: isSoloPlayerEvent ? null :'));
});

test('Public /solo route resolves the event by its saved unique URL slug', async () => {
  const [eventoHtml, netlifyConfig, viteConfig] = await Promise.all([
    read('../../artifacts/xtreino/public/evento.html'),
    read('../../netlify.toml'),
    read('../../artifacts/xtreino/vite.config.ts'),
  ]);

  assert.match(eventoHtml, /new Set\(\['camp-season-7', 'intensivo', 'solo'\]\)/);
  assert.match(eventoHtml, /where\('urlSlug', '==', _querySlug\)/);
  assert.match(netlifyConfig, /from = "\/solo"\s+to = "\/evento\.html\?slug=solo"/);
  assert.match(viteConfig, /new Set\(\["camp-season-7", "intensivo", "solo"\]\)/);
});
