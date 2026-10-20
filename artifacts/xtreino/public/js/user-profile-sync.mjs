export function buildUserProfileRecord({ uid, authUser, registrationData = {}, now = Date.now() } = {}) {
  if (!uid) throw new Error('É necessário informar o UID do usuário.');

  const authEmail = typeof authUser?.email === 'string' ? authUser.email : '';
  const fallbackName = authUser?.displayName
    || authEmail.split('@')[0]
    || 'Usuário';
  const name = typeof registrationData.name === 'string' && registrationData.name.trim()
    ? registrationData.name.trim()
    : fallbackName;

  return {
    ...registrationData,
    name,
    email: authEmail || registrationData.email || '',
    role: 'Usuario',
    level: 'Associado Treino',
    tokens: 0,
    createdAt: registrationData.createdAt ?? now,
  };
}

export function hasUserProfileDocument(snapshot) {
  const exists = typeof snapshot?.exists === 'function'
    ? snapshot.exists()
    : Boolean(snapshot?.exists);
  return exists && typeof snapshot?.data === 'function';
}

export async function writeUserProfileRecord({
  uid,
  authUser,
  registrationData = {},
  db,
  firestore,
  now = Date.now(),
} = {}) {
  if (!db || !firestore?.collection || !firestore?.doc || !firestore?.setDoc) {
    throw new Error('Firestore não está pronto para salvar o perfil.');
  }

  const profile = buildUserProfileRecord({ uid, authUser, registrationData, now });
  const ref = firestore.doc(firestore.collection(db, 'users'), uid);
  await firestore.setDoc(ref, profile, { merge: true });
  return profile;
}

export async function writeUserProfileWithFallback(options = {}) {
  try {
    const profile = await writeUserProfileRecord(options);
    return { status: 'saved', profile };
  } catch (error) {
    const { registrationData = {} } = options;
    const basicRegistrationData = {
      name: registrationData.name,
      email: registrationData.email,
      createdAt: registrationData.createdAt,
    };

    try {
      const profile = await writeUserProfileRecord({
        ...options,
        registrationData: basicRegistrationData,
      });
      return { status: 'recovered', profile, originalError: error };
    } catch (recoveryError) {
      return { status: 'failed', originalError: error, recoveryError };
    }
  }
}
