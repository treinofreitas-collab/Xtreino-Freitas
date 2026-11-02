import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { handler, createHandler, isAllowedDownloadRole } = require('../../netlify/functions/spec-logos-export.js');
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

test('SPEC logo deletion accepts hours with or without an H suffix', async () => {
  for (const hour of ['19', '19H', '19h', '00', '00H']) {
    const response = await deleteHandler({
      httpMethod: 'DELETE',
      queryStringParameters: { hour, code: '902000034' },
      headers: {},
    });

    assert.equal(response.statusCode, 401, `${hour} should pass validation and reach authentication`);
  }
});

test('SPEC logo deletion accepts the original route path without query parameters', async () => {
  const response = await deleteHandler({
    httpMethod: 'DELETE',
    path: '/api/spec-logos/19H/902000034',
    rawUrl: 'https://orgfreitas.com.br/api/spec-logos/19H/902000034',
    queryStringParameters: {},
    headers: {},
  });

  assert.equal(response.statusCode, 401, 'valid path parameters should pass validation and reach authentication');
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

test('SPEC logo clear accepts hours with or without an H suffix', async () => {
  for (const hour of ['19', '19H', '19h', '00', '00H']) {
    const response = await clearHandler({
      httpMethod: 'DELETE',
      queryStringParameters: { hour },
      headers: {},
    });

    assert.equal(response.statusCode, 401, `${hour} should pass validation and reach authentication`);
  }
});

test('SPEC logo clear accepts the original route path without query parameters', async () => {
  const response = await clearHandler({
    httpMethod: 'DELETE',
    path: '/api/spec-logos/19H',
    rawUrl: 'https://orgfreitas.com.br/api/spec-logos/19H',
    queryStringParameters: {},
    headers: {},
  });

  assert.equal(response.statusCode, 401, 'valid path parameters should pass validation and reach authentication');
});

test('SPEC logo export provides a manifest and resumable bounded chunks', async () => {
  const data = Buffer.alloc(3 * 1024 * 1024 + 29, 7);
  const file = { name: 'teams/modo-liga/logos/spec/19H/902000034.png', metadata: { size: data.byteLength }, download: async () => [data] };
  const mockAdmin = {
    firestore: () => ({ collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ role: 'ceo' }) }) }) }) }),
    storage: () => ({ getFiles: async () => [[file]] }),
  };
  const exportHandler = createHandler({ getAdminFn: () => mockAdmin, verifyFirebaseUserFn: async () => ({ uid: 'admin-1' }) });
  const manifest = await exportHandler({ httpMethod: 'GET', queryStringParameters: { hour: '19', manifest: '1' } });
  assert.deepEqual(JSON.parse(manifest.body).files, [{ code: '902000034', totalBytes: data.byteLength }]);
  const first = await exportHandler({ httpMethod: 'GET', queryStringParameters: { hour: '19', fileIndex: '0', offset: '0', endFileIndex: '1' } });
  const firstBody = JSON.parse(first.body);
  assert.equal(first.statusCode, 200);
  assert.equal(Buffer.from(firstBody.logos[0].base64, 'base64').byteLength, 3 * 1024 * 1024);
  assert.deepEqual(firstBody.next, { fileIndex: 0, offset: 3 * 1024 * 1024 });
  assert.equal(firstBody.complete, false);
  const second = await exportHandler({ httpMethod: 'GET', queryStringParameters: { hour: '19', fileIndex: '0', offset: 3 * 1024 * 1024, endFileIndex: '1' } });
  const secondBody = JSON.parse(second.body);
  assert.equal(second.statusCode, 200);
  assert.equal(Buffer.from(secondBody.logos[0].base64, 'base64').byteLength, 29);
  assert.deepEqual(secondBody.next, { fileIndex: 1, offset: 0 });
  assert.equal(secondBody.complete, true);
});
