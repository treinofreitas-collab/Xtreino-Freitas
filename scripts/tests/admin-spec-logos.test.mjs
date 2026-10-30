import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  getModoLigaSpecLogoItems,
  getSpecLogoViewMode,
  normalizeModoLigaSpecLetter,
  specLogoCodeForLetter,
  specLogoLetterForCode,
  specLogoStoragePath,
} from '../../artifacts/xtreino/public/js/admin-spec-logos.mjs';

test('limits Streamer to hour selection and ZIP download mode', () => {
  assert.equal(getSpecLogoViewMode('Streamer'), 'download-only');
  assert.equal(getSpecLogoViewMode('streamer'), 'download-only');
  assert.equal(getSpecLogoViewMode('ceo'), 'manage');
  assert.equal(getSpecLogoViewMode('gerente'), 'manage');
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
  assert.match(adminPage, /src="admin\.js\?v=modo-liga-manager-spec-1"/);
});

test('accepts only the 26 Modo Liga letters for purchase-logo assignment', () => {
  assert.equal(normalizeModoLigaSpecLetter('a'), 'A');
  assert.equal(normalizeModoLigaSpecLetter('P'), 'P');
  assert.equal(normalizeModoLigaSpecLetter(' O '), 'O');
  assert.equal(normalizeModoLigaSpecLetter('z'), 'Z');
  assert.equal(normalizeModoLigaSpecLetter('AA'), '');
  assert.equal(normalizeModoLigaSpecLetter(''), '');
});

test('Modo Liga Vaga assignment saves the original logo to its hour and separate SPEC letter', async () => {
  const adminSource = await readFile(
    new URL('../../artifacts/xtreino/public/admin.js', import.meta.url),
    'utf8',
  );
  const specSource = await readFile(
    new URL('../../artifacts/xtreino/public/js/admin-spec-logos.mjs', import.meta.url),
    'utf8',
  );

  assert.match(adminSource, /resolveSpecOriginalLogoUrl\(registration\)/);
  assert.match(adminSource, /saveRegistrationLogoToSpec\(logoFile,\s*\{/);
  assert.match(adminSource, /hour:\s*targetHH,\s*letter,/);
  assert.match(adminSource, /modoLigaSpecLetter:\s*letter/);
  assert.match(adminSource, /modoLigaSpecHour:\s*targetHH/);
  assert.match(adminSource, /data-edit-slot-current-letter/);
  assert.match(adminSource, /const isModoLigaRegistration = registration =>/);
  assert.match(adminSource, /window\.adminRoleLower \|\| ''\)\.toLowerCase\(\)\.trim\(\) !== 'gerente'/);
  assert.match(adminSource, /if \(String\(window\.adminRoleLower \|\| ''\)\.toLowerCase\(\)\.trim\(\) !== 'gerente'\) \{\s*return existingDetection;\s*\}/);
  assert.match(adminSource, /registration\?\.eventName[\s\S]*registration\?\.eventId[\s\S]*registration\?\.eventTitle/);
  assert.match(adminSource, /const _isLigaRow = isModoLigaRegistration\(r\)/);
  assert.match(adminSource, /const isModoLiga = isModoLigaRegistration\(registration\)/);
  assert.match(adminSource, /🔠 LETRA SPEC/);
  assert.match(adminSource, /Letra SPEC desta vaga \(A–Z\)/);
  assert.match(adminSource, /Use uma letra de A a Z/);
  assert.match(adminSource, /slot:\s*novoNum/);
  assert.match(specSource, /const path = storagePath\(normalizedHour, code\)/);
  assert.match(specSource, /hasUniformEdgeBackground\(source\)/);
  assert.match(specSource, /loadBackgroundRemover\(onProgress\)/);
  assert.match(specSource, /window\.confirm\(/);
  assert.match(specSource, /sourceRegistrationId:/);
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
