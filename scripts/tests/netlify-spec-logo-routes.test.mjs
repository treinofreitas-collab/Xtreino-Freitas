import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { handler: exportHandler } = require('../../netlify/functions/spec-logos-export.js');
const { handler: originalLogoHandler } = require('../../netlify/functions/spec-logo-registration-original.js');

test('SPEC logo export accepts both path-only and query hour formats', async () => {
  for (const event of [
    {
      httpMethod: 'GET',
      path: '/api/spec-logos/19H/export',
      rawUrl: 'https://orgfreitas.com.br/api/spec-logos/19H/export',
      queryStringParameters: {},
      headers: {},
    },
    {
      httpMethod: 'GET',
      path: '/api/spec-logos/20/export',
      rawUrl: 'https://orgfreitas.com.br/api/spec-logos/20/export',
      queryStringParameters: { hour: '20H' },
      headers: {},
    },
  ]) {
    const response = await exportHandler(event);
    assert.equal(response.statusCode, 401, 'valid hour should reach authentication');
  }
});

test('Modo Liga original-logo route is mapped and requires authentication', async () => {
  const config = await readFile(new URL('../../netlify.toml', import.meta.url), 'utf8');
  assert.match(config, /from\s*=\s*"\/api\/spec-logos\/registrations\/:registrationId\/original"/);
  assert.match(config, /to\s*=\s*"\/\.netlify\/functions\/spec-logo-registration-original\?registrationId=:registrationId"/);

  const response = await originalLogoHandler({
    httpMethod: 'GET',
    path: '/api/spec-logos/registrations/registration-1/original',
    rawUrl: 'https://orgfreitas.com.br/api/spec-logos/registrations/registration-1/original',
    queryStringParameters: {},
    headers: {},
  });
  assert.equal(response.statusCode, 401);
});
