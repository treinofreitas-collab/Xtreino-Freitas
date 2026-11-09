import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('Admin offers /intensivo only to Intensivo Freitas in Diário', async () => {
  const [adminHtml, adminJs] = await Promise.all([
    read('../../artifacts/xtreino/public/admin.html'),
    read('../../artifacts/xtreino/public/admin.js'),
  ]);

  assert.match(adminHtml, /<option value="intensivo-freitas">Intensivo Freitas \(Diário\) → \/intensivo<\/option>/);
  assert.match(adminJs, /urlType === 'intensivo-freitas' && \(category !== 'diario' \|\| !isIntensivoFreitasEventName\(name\)\)/);
  assert.match(adminJs, /eventType: usesCampSeason7Url \? 'camp-freitas' : \(usesIntensivoFreitasUrl \|\| usesDiarioSoloUrl\) \? null/);
  assert.match(adminJs, /urlSlug: usesCampSeason7Url \? 'camp-season-7' : usesIntensivoFreitasUrl \? 'intensivo' : usesDiarioSoloUrl \? 'solo' : null/);
  assert.match(adminJs, /ev\.urlSlug === 'intensivo' \|\| \(ev\.category === 'diario' && isIntensivoFreitasEventName\(ev\.name\)\)/);
});

test('Public event page resolves /intensivo by its unique saved URL slug', async () => {
  const [eventoHtml, homepageScript, netlifyConfig, viteConfig] = await Promise.all([
    read('../../artifacts/xtreino/public/evento.html'),
    read('../../artifacts/xtreino/public/script.js'),
    read('../../netlify.toml'),
    read('../../artifacts/xtreino/vite.config.ts'),
  ]);

  assert.match(eventoHtml, /new Set\(\['camp-season-7', 'intensivo', 'solo'\]\)/);
  assert.match(eventoHtml, /where\('urlSlug', '==', _querySlug\)/);
  assert.match(homepageScript, /if \(\/\^\[a-z0-9\]\+\(\?:-\[a-z0-9\]\+\)\*\$\/\.test\(urlSlug\)\) return '\/' \+ encodeURIComponent\(urlSlug\)/);
  assert.match(netlifyConfig, /from = "\/intensivo"\s+to = "\/evento\.html\?slug=intensivo"/);
  assert.match(viteConfig, /new Set\(\["camp-season-7", "intensivo", "solo"\]\)/);
});
