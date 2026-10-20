import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUserProfileRecord,
  hasUserProfileDocument,
  writeUserProfileRecord,
  writeUserProfileWithFallback,
} from '../../artifacts/xtreino/public/js/user-profile-sync.mjs';

test('a missing Firestore profile gets safe customer defaults from Firebase Auth', () => {
  assert.deepEqual(
    buildUserProfileRecord({
      uid: 'user-123',
      authUser: { displayName: 'Lua Soares', email: 'lua@example.test' },
      now: 1234,
    }),
    {
      name: 'Lua Soares',
      email: 'lua@example.test',
      role: 'Usuario',
      level: 'Associado Treino',
      tokens: 0,
      createdAt: 1234,
    },
  );
});

test('registration details are preserved without allowing role or token escalation', () => {
  const profile = buildUserProfileRecord({
    uid: 'user-123',
    authUser: { displayName: 'Lua', email: 'lua@example.test' },
    registrationData: {
      name: 'Lua Soares',
      phone: '(11) 99999-0000',
      nickname: 'Lua',
      teamName: 'Time A',
      age: '20',
      role: 'admin',
      tokens: 500,
      createdAt: 1234,
    },
  });

  assert.equal(profile.name, 'Lua Soares');
  assert.equal(profile.email, 'lua@example.test');
  assert.equal(profile.phone, '(11) 99999-0000');
  assert.equal(profile.teamName, 'Time A');
  assert.equal(profile.role, 'Usuario');
  assert.equal(profile.tokens, 0);
  assert.equal(profile.createdAt, 1234);
});

test('profile persistence writes to users/{uid} with merge enabled', async () => {
  const calls = [];
  const db = { name: 'fake-db' };
  const firestore = {
    collection: (receivedDb, name) => ({ receivedDb, name }),
    doc: (collection, id) => ({ collection, id }),
    setDoc: async (...args) => calls.push(args),
  };

  const profile = await writeUserProfileRecord({
    uid: 'user-123',
    authUser: { displayName: 'Lua', email: 'lua@example.test' },
    db,
    firestore,
    now: 4321,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].id, 'user-123');
  assert.equal(calls[0][1].email, 'lua@example.test');
  assert.deepEqual(calls[0][2], { merge: true });
  assert.equal(profile.createdAt, 4321);
});

test('profile write failures propagate so the caller can retry and notify', async () => {
  const firestore = {
    collection: () => ({}),
    doc: () => ({}),
    setDoc: async () => { throw Object.assign(new Error('denied'), { code: 'permission-denied' }); },
  };

  await assert.rejects(
    writeUserProfileRecord({
      uid: 'user-123',
      authUser: { email: 'lua@example.test' },
      db: {},
      firestore,
    }),
    error => error.code === 'permission-denied',
  );
});

test('snapshot presence supports Firebase method and boolean shapes', () => {
  assert.equal(hasUserProfileDocument({ exists: () => true, data: () => ({ email: 'a@example.test' }) }), true);
  assert.equal(hasUserProfileDocument({ exists: () => false, data: () => undefined }), false);
  assert.equal(hasUserProfileDocument({ exists: true, data: () => ({ email: 'a@example.test' }) }), true);
  assert.equal(hasUserProfileDocument({ exists: false, data: () => undefined }), false);
});

test('full registration failure retries a basic profile so the account remains visible to admins', async () => {
  const writes = [];
  const firestore = {
    collection: (db, name) => ({ db, name }),
    doc: (collection, id) => ({ collection, id }),
    setDoc: async (ref, profile) => {
      writes.push({ ref, profile });
      if (writes.length === 1) throw Object.assign(new Error('full-profile rejected'), { code: 'invalid-argument' });
    },
  };

  const result = await writeUserProfileWithFallback({
    uid: 'user-123',
    authUser: { displayName: 'Lua', email: 'lua@example.test' },
    registrationData: {
      name: 'Lua Soares',
      email: 'lua@example.test',
      phone: '(11) 99999-0000',
      nickname: 'Lua',
      teamName: 'Time A',
      age: '20',
      createdAt: 9876,
    },
    db: {},
    firestore,
    now: 4321,
  });

  assert.equal(result.status, 'recovered');
  assert.equal(writes.length, 2);
  assert.equal(writes[0].profile.phone, '(11) 99999-0000');
  assert.equal(writes[1].profile.phone, undefined);
  assert.equal(writes[1].profile.name, 'Lua Soares');
  assert.equal(writes[1].profile.tokens, 0);
});

test('profile sync reports failure only when both full and basic writes fail', async () => {
  const firestore = {
    collection: () => ({}),
    doc: () => ({}),
    setDoc: async () => { throw Object.assign(new Error('denied'), { code: 'permission-denied' }); },
  };

  const result = await writeUserProfileWithFallback({
    uid: 'user-123',
    authUser: { email: 'lua@example.test' },
    db: {},
    firestore,
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.originalError.code, 'permission-denied');
  assert.equal(result.recoveryError.code, 'permission-denied');
});
