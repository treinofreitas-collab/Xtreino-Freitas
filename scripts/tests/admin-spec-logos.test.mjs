import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  getModoLigaSpecLogoItems,
  getSpecLogoViewMode,
  specLogoCodeForLetter,
  specLogoLetterForCode,
  specLogoStoragePath,
} from '../../artifacts/xtreino/public/js/admin-spec-logos.mjs';

test('limits Streamer to hour selection and ZIP download mode', () => {
  assert.equal(getSpecLogoViewMode('Streamer'), 'download-only');
  assert.equal(getSpecLogoViewMode('streamer'), 'download-only');
  assert.equal(getSpecLogoViewMode('admin'), 'manage');
  assert.equal(getSpecLogoViewMode('operador'), 'view');
  assert.equal(getSpecLogoViewMode('user'), 'denied');
});

test('hides training award from Streamer and refreshes the admin script', async () => {
  const adminScript = await readFile(
    new URL('../../artifacts/xtreino/public/admin.js', import.meta.url),
    'utf8',
  );
  const adminPage = await readFile(
    new URL('../../artifacts/xtreino/public/admin.html', import.meta.url),
    'utf8',
  );

  assert.match(adminScript, /const hideTrainingAward = resolvedRole === 'streamer'/);
  assert.match(adminScript, /trainingAwardSection\.hidden = hideTrainingAward/);
  assert.match(adminPage, /id="sectionPremiacaoTreino" hidden/);
  assert.match(adminPage, /src="admin\.js\?v=streamer-prize-5"/);
});

test('maps the exact SPEC code range from A through Z', () => {
  assert.equal(specLogoCodeForLetter('A'), '902000034');
  assert.equal(specLogoCodeForLetter('Z'), '902000059');
  assert.equal(specLogoLetterForCode('902000034'), 'A');
  assert.equal(specLogoLetterForCode('902000059'), 'Z');
});

test('keeps every letter and code paired in both directions', () => {
  for (let index = 0; index < 26; index += 1) {
    const letter = String.fromCharCode(65 + index);
    const code = String(902000034 + index);
    assert.equal(specLogoCodeForLetter(letter), code);
    assert.equal(specLogoLetterForCode(code), letter);
  }
});

test('rejects unsupported letters and codes', () => {
  assert.equal(specLogoCodeForLetter('AA'), '');
  assert.equal(specLogoCodeForLetter('1'), '');
  assert.equal(specLogoLetterForCode('902000033'), '');
  assert.equal(specLogoLetterForCode('902000060'), '');
  assert.equal(specLogoLetterForCode('902000034.png'), '');
});

test('stores files under the selected hour with only the numeric code as filename', () => {
  assert.equal(
    specLogoStoragePath('19', specLogoCodeForLetter('A')),
    'teams/modo-liga/logos/spec/19H/902000034.png',
  );
  assert.equal(
    specLogoStoragePath('00', specLogoCodeForLetter('Z')),
    'teams/modo-liga/logos/spec/00H/902000059.png',
  );
});

test('MatchResult only reads logos A–O from the selected hour catalog', () => {
  const entries = getModoLigaSpecLogoItems([
    { name: '902000049.png' },
    { name: '902000048.png' },
    { name: '902000034.png' },
    { name: 'logo.png' },
    { name: 'nested/902000035.png' },
  ]);

  assert.deepEqual(
    entries.map(({ code, letter }) => ({ code, letter })),
    [
      { code: '902000034', letter: 'A' },
      { code: '902000048', letter: 'O' },
    ],
  );
});
