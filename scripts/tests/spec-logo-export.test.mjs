import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { handler, isAllowedDownloadRole } = require('../../netlify/functions/spec-logos-export.js');
const { handler: deleteHandler } = require('../../netlify/functions/spec-logo-delete.js');
const { handler: clearHandler } = require('../../netlify/functions/spec-logos-clear.js');

test('SPEC ZIP download authorizes the Streamer role without granting editor access', () => {
  assert.equal(isAllowedDownloadRole('Streamer'), true);
  assert.equal(isAllowedDownloadRole('operador'), true);
  assert.equal(isAllowedDownloadRole('vendedor'), false);
});

test('SPEC logo export only accepts GET requests', async () => {
  const response = await handler({
    httpMethod: 'POST',
    queryStringParameters: { hour: '19' },
  });

  assert.equal(response.statusCode, 405);
  assert.deepEqual(JSON.parse(response.body), { error: 'Método não permitido.' });
});

test('SPEC logo export rejects hours outside the published schedule', async () => {
  const response = await handler({
    httpMethod: 'GET',
    queryStringParameters: { hour: '18' },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), {
    error: 'Horário inválido para exportar logos.',
  });
});

test('SPEC logo deletion only accepts DELETE requests', async () => {
  const response = await deleteHandler({
    httpMethod: 'POST',
    queryStringParameters: { hour: '19', code: '902000034' },
  });

  assert.equal(response.statusCode, 405);
  assert.deepEqual(JSON.parse(response.body), { error: 'Método não permitido.' });
});

test('SPEC logo deletion rejects invalid hours and codes before accessing storage', async () => {
  const response = await deleteHandler({
    httpMethod: 'DELETE',
    queryStringParameters: { hour: '19', code: '../other-file' },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), {
    error: 'Horário ou código de logo inválido.',
  });
});

test('SPEC logo clear only accepts DELETE requests', async () => {
  const response = await clearHandler({
    httpMethod: 'POST',
    queryStringParameters: { hour: '19' },
  });

  assert.equal(response.statusCode, 405);
  assert.deepEqual(JSON.parse(response.body), { error: 'Método não permitido.' });
});

test('SPEC logo clear rejects invalid hours before accessing storage', async () => {
  const response = await clearHandler({
    httpMethod: 'DELETE',
    queryStringParameters: { hour: '18' },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), {
    error: 'Horário inválido para limpar as logos.',
  });
});
