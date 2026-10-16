const FIRESTORE_SDK_URL = "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const MARKET_ROLES = Object.freeze([
  "Rushador", "Suporte", "Fragger", "Capitão", "Coringa", "Reserva", "Coach", "Analista"
]);

export const MARKET_AVAILABILITY = Object.freeze([
  "looking", "open", "evaluating", "unavailable", "contracted"
]);

const VACANCY_FIELDS = Object.freeze([
  "teamName", "title", "roles", "level", "state", "slots", "schedule",
  "requirements", "championships", "compensation", "description", "validityDays"
]);
const MAX_LISTING_AGE_MS = 30_000;
const MAX_PUBLIC_RESULTS = 100;
const MAX_FAVORITES = 50;

function plainText(value, maxLength) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function redactMarketContactInfo(value) {
  return String(value ?? "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[e-mail removido]")
    .replace(/(?:\+?55[\s().-]*)?(?:\(?\d{2}\)?[\s.-]*)?9?\d{4}[\s.-]?\d{4}\b/g, "[telefone removido]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSafeMarketUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function boundedText(value, maxLength) {
  return redactMarketContactInfo(plainText(value, maxLength)).slice(0, maxLength);
}

function normalizedRoles(value, { allowEmpty = true } = {}) {
  const roles = [...new Set((Array.isArray(value) ? value : value ? [value] : [])
    .map(role => plainText(role, 30))
    .filter(role => MARKET_ROLES.includes(role)))].slice(0, MARKET_ROLES.length);
  if (!allowEmpty && roles.length === 0) throw new Error("Selecione ao menos uma função.");
  return roles;
}

export function sanitizeMarketplaceProfile(input = {}) {
  const nickname = boundedText(input.nickname, 36);
  const mainRole = plainText(input.mainRole, 30);
  const availability = plainText(input.availability, 20);
  if (nickname.length < 2) throw new Error("Informe um nickname com pelo menos 2 caracteres.");
  if (!MARKET_ROLES.includes(mainRole)) throw new Error("Selecione uma função principal válida.");
  if (!MARKET_AVAILABILITY.includes(availability)) throw new Error("Selecione uma disponibilidade válida.");

  const socialLinks = (Array.isArray(input.socialLinks) ? input.socialLinks : [])
    .slice(0, 4)
    .map(item => {
      const url = plainText(typeof item === "string" ? item : item?.url, 240);
      return { label: "Contato", url };
    })
    .filter(item => isSafeMarketUrl(item.url));

  return {
    nickname,
    mainRole,
    secondaryRoles: normalizedRoles(input.secondaryRoles).filter(role => role !== mainRole),
    city: boundedText(input.city, 60),
    state: boundedText(input.state, 40).toUpperCase(),
    experience: boundedText(input.experience, 70),
    availability,
    availabilitySchedule: boundedText(input.availabilitySchedule, 100),
    teamHistory: boundedText(input.teamHistory, 500),
    championships: boundedText(input.championships, 400),
    achievements: boundedText(input.achievements, 400),
    bio: boundedText(input.bio, 700),
    socialLinks,
    contactAvailable: socialLinks.length > 0
  };
}

export function sanitizeMarketplaceVacancy(input = {}) {
  const teamName = boundedText(input.teamName, 60);
  const title = boundedText(input.title, 70);
  const slots = Number(input.slots);
  const validityDays = Number(input.validityDays || 30);
  if (teamName.length < 2) throw new Error("Informe o nome da equipe.");
  if (title.length < 3) throw new Error("Informe um título para a vaga.");
  if (!Number.isInteger(slots) || slots < 1 || slots > 12) throw new Error("A quantidade de vagas deve ser de 1 a 12.");
  if (![14, 30, 60].includes(validityDays)) throw new Error("Escolha uma validade de 14, 30 ou 60 dias.");

  return {
    teamName,
    title,
    roles: normalizedRoles(input.roles),
    level: boundedText(input.level, 30),
    state: boundedText(input.state, 40).toUpperCase(),
    slots,
    schedule: boundedText(input.schedule, 100),
    requirements: boundedText(input.requirements, 450),
    championships: boundedText(input.championships, 300),
    compensation: boundedText(input.compensation, 120),
    description: boundedText(input.description, 600),
    validityDays
  };
}

function millis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function newestFirst(left, right) {
  return millis(right.updatedAt || right.createdAt) - millis(left.updatedAt || left.createdAt);
}

function snapshotData(snapshot) {
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

function requireCurrentUser(auth, uid) {
  if (!auth?.currentUser?.uid || auth.currentUser.uid !== uid) {
    throw new Error("Entre na sua conta para continuar.");
  }
}

function safeTargetId(value) {
  const id = plainText(value, 140);
  if (!id || id.includes("/")) throw new Error("Referência inválida.");
  return id;
}

function adminRole(role) {
  return ["admin", "ceo"].includes(String(role || "").trim().toLowerCase());
}

export function createMercadoDaBalaService({ auth, db, sdk } = {}) {
  let firestorePromise;
  const getFirestoreSdk = () => {
    firestorePromise ||= sdk ? Promise.resolve(sdk) : import(/* @vite-ignore */ FIRESTORE_SDK_URL);
    return firestorePromise;
  };

  let profilesCache = { expiresAt: 0, rows: [] };
  let vacanciesCache = { expiresAt: 0, rows: [] };
  const favoritesCache = new Map();
  const favoriteIdsCache = new Map();

  function invalidatePublic(kind) {
    if (kind === "profiles") profilesCache = { expiresAt: 0, rows: [] };
    else vacanciesCache = { expiresAt: 0, rows: [] };
  }

  async function ownProfile(uid) {
    requireCurrentUser(auth, uid);
    const sdk = await getFirestoreSdk();
    const profileRef = sdk.doc(db, "market_profiles", uid);
    const contactRef = sdk.doc(db, "market_contact_links", uid);
    const [snapshot, contactSnapshot] = await Promise.all([
      sdk.getDoc(profileRef),
      sdk.getDoc(contactRef)
    ]);
    if (!snapshot.exists()) return null;

    const stored = snapshot.data();
    const privateLinks = contactSnapshot.exists()
      ? (Array.isArray(contactSnapshot.data().links) ? contactSnapshot.data().links : [])
      : [];
    let links = privateLinks;
    let profileData = stored;

    // Move legacy links out of the public profile the next time its owner opens Meu Espaço.
    if (Object.hasOwn(stored, "socialLinks")) {
      const sanitized = sanitizeMarketplaceProfile(stored);
      links = contactSnapshot.exists() ? privateLinks : sanitized.socialLinks;
      const { socialLinks: _legacyLinks, ...publicProfile } = sanitized;
      profileData = {
        ...publicProfile,
        contactAvailable: links.length > 0,
        status: stored.status,
        createdAt: stored.createdAt,
        updatedAt: sdk.serverTimestamp()
      };
      const batch = sdk.writeBatch(db);
      batch.set(profileRef, { uid, ...profileData });
      if (!contactSnapshot.exists() && links.length) {
        batch.set(contactRef, { ownerUid: uid, links, updatedAt: sdk.serverTimestamp() });
      }
      await batch.commit();
    }

    return {
      id: snapshot.id,
      uid: snapshot.id,
      ...profileData,
      contactAvailable: links.length > 0,
      socialLinks: links
    };
  }

  async function roleFor(uid) {
    requireCurrentUser(auth, uid);
    const sdk = await getFirestoreSdk();
    const snapshot = await sdk.getDoc(sdk.doc(db, "users", uid));
    return snapshot.exists() ? String(snapshot.data().role || "") : "";
  }

  async function requireModerator(uid) {
    const role = await roleFor(uid);
    if (!adminRole(role)) throw new Error("Ação reservada a administradores autorizados.");
  }

  async function favoriteIdsFor(uid) {
    const cached = favoriteIdsCache.get(uid);
    if (cached && cached.expiresAt > Date.now()) return cached.ids;
    const sdk = await getFirestoreSdk();
    const favoriteSnapshots = await sdk.getDocs(sdk.query(
      sdk.collection(db, "market_favorites"),
      sdk.where("ownerUid", "==", uid),
      sdk.limit(MAX_FAVORITES)
    ));
    const ids = favoriteSnapshots.docs
      .map(item => item.data().profileUid)
      .filter(profileUid => typeof profileUid === "string" && profileUid.length > 0);
    favoriteIdsCache.set(uid, { expiresAt: Date.now() + MAX_LISTING_AGE_MS, ids });
    return ids;
  }

  return {
    async listProfiles() {
      if (profilesCache.expiresAt > Date.now()) return profilesCache.rows;
      const sdk = await getFirestoreSdk();
      const results = await sdk.getDocs(sdk.query(
        sdk.collection(db, "market_profiles"),
        sdk.where("status", "==", "published"),
        sdk.limit(MAX_PUBLIC_RESULTS)
      ));
      const rows = snapshotData(results).sort(newestFirst);
      profilesCache = { expiresAt: Date.now() + MAX_LISTING_AGE_MS, rows };
      return rows;
    },

    async listVacancies() {
      if (vacanciesCache.expiresAt > Date.now()) {
        return vacanciesCache.rows.filter(item => !item.expiresAt || millis(item.expiresAt) > Date.now());
      }
      const sdk = await getFirestoreSdk();
      const results = await sdk.getDocs(sdk.query(
        sdk.collection(db, "market_vacancies"),
        sdk.where("status", "==", "open"),
        sdk.limit(MAX_PUBLIC_RESULTS)
      ));
      const rows = snapshotData(results)
        .filter(item => !item.expiresAt || millis(item.expiresAt) > Date.now())
        .sort(newestFirst);
      vacanciesCache = { expiresAt: Date.now() + MAX_LISTING_AGE_MS, rows };
      return rows;
    },

    getMyProfile: ownProfile,

    async saveMyProfile(uid, input) {
      requireCurrentUser(auth, uid);
      const sdk = await getFirestoreSdk();
      const ref = sdk.doc(db, "market_profiles", uid);
      const snapshot = await sdk.getDoc(ref);
      const existing = snapshot.exists() ? snapshot.data() : null;
      if (existing?.status === "suspended") throw new Error("Este currículo está suspenso e precisa de análise da equipe.");
      const profile = sanitizeMarketplaceProfile(input);
      const { socialLinks, ...publicProfile } = profile;
      const batch = sdk.writeBatch(db);
      batch.set(ref, {
        ...publicProfile,
        uid,
        contactAvailable: socialLinks.length > 0,
        status: existing?.status || "draft",
        createdAt: existing?.createdAt || sdk.serverTimestamp(),
        updatedAt: sdk.serverTimestamp()
      });
      const contactRef = sdk.doc(db, "market_contact_links", uid);
      if (socialLinks.length) {
        batch.set(contactRef, { ownerUid: uid, links: socialLinks, updatedAt: sdk.serverTimestamp() });
      } else {
        batch.delete(contactRef);
      }
      await batch.commit();
      invalidatePublic("profiles");
      return { id: uid, uid, ...profile, status: existing?.status || "draft" };
    },

    async getProfileContactLinks(uid, profileUid) {
      requireCurrentUser(auth, uid);
      const id = safeTargetId(profileUid);
      const sdk = await getFirestoreSdk();
      const snapshot = await sdk.getDoc(sdk.doc(db, "market_contact_links", id));
      let sourceLinks = snapshot.exists() && Array.isArray(snapshot.data().links) ? snapshot.data().links : null;
      if (!sourceLinks) {
        // Authenticated fallback for profiles saved before contact links were moved to the private collection.
        const legacyProfile = await sdk.getDoc(sdk.doc(db, "market_profiles", id));
        sourceLinks = legacyProfile.exists() && Array.isArray(legacyProfile.data().socialLinks)
          ? legacyProfile.data().socialLinks
          : [];
      }
      return sourceLinks
        .map(item => ({
          label: boundedText(item?.label || "Contato", 30) || "Contato",
          url: plainText(item?.url, 240)
        }))
        .filter(item => isSafeMarketUrl(item.url));
    },

    async setProfileStatus(uid, status) {
      requireCurrentUser(auth, uid);
      if (!["published", "paused"].includes(status)) throw new Error("Status de currículo inválido.");
      const sdk = await getFirestoreSdk();
      const ref = sdk.doc(db, "market_profiles", uid);
      const snapshot = await sdk.getDoc(ref);
      if (!snapshot.exists()) throw new Error("Crie seu currículo antes de publicar.");
      if (snapshot.data().status === "suspended") throw new Error("Este currículo está suspenso e precisa de análise da equipe.");
      await sdk.updateDoc(ref, { status, updatedAt: sdk.serverTimestamp() });
      invalidatePublic("profiles");
    },

    async deleteMyProfile(uid) {
      requireCurrentUser(auth, uid);
      const sdk = await getFirestoreSdk();
      await sdk.deleteDoc(sdk.doc(db, "market_profiles", uid));
      invalidatePublic("profiles");
    },

    async listMyVacancies(uid) {
      requireCurrentUser(auth, uid);
      const sdk = await getFirestoreSdk();
      const results = await sdk.getDocs(sdk.query(
        sdk.collection(db, "market_vacancies"),
        sdk.where("ownerUid", "==", uid),
        sdk.limit(MAX_PUBLIC_RESULTS)
      ));
      return snapshotData(results).sort(newestFirst);
    },

    async createVacancy(uid, input) {
      requireCurrentUser(auth, uid);
      const sdk = await getFirestoreSdk();
      const vacancy = sanitizeMarketplaceVacancy(input);
      const ref = await sdk.addDoc(sdk.collection(db, "market_vacancies"), {
        ...vacancy,
        ownerUid: uid,
        status: "open",
        createdAt: sdk.serverTimestamp(),
        updatedAt: sdk.serverTimestamp(),
        expiresAt: sdk.Timestamp.fromMillis(Date.now() + vacancy.validityDays * 86_400_000)
      });
      invalidatePublic("vacancies");
      return ref.id;
    },

    async updateVacancy(uid, vacancyId, input) {
      requireCurrentUser(auth, uid);
      const id = safeTargetId(vacancyId);
      const sdk = await getFirestoreSdk();
      const ref = sdk.doc(db, "market_vacancies", id);
      const snapshot = await sdk.getDoc(ref);
      if (!snapshot.exists() || snapshot.data().ownerUid !== uid) throw new Error("Vaga não encontrada ou sem permissão.");
      const current = snapshot.data();
      if (current.status === "suspended") throw new Error("Esta vaga está suspensa e precisa de análise da equipe.");
      const vacancy = sanitizeMarketplaceVacancy(input);
      const requestedStatus = ["open", "closed", "filled"].includes(input.status) ? input.status : current.status;
      const nextStatus = ["open", "closed", "filled"].includes(requestedStatus) ? requestedStatus : "open";
      const reopening = nextStatus === "open" && current.status !== "open";
      const changedValidity = Number(current.validityDays) !== vacancy.validityDays;
      await sdk.updateDoc(ref, {
        ...vacancy,
        status: nextStatus,
        updatedAt: sdk.serverTimestamp(),
        ...(reopening || changedValidity
          ? { expiresAt: sdk.Timestamp.fromMillis(Date.now() + vacancy.validityDays * 86_400_000) }
          : {})
      });
      invalidatePublic("vacancies");
    },

    async applyToVacancy(uid, vacancyId, message) {
      requireCurrentUser(auth, uid);
      const id = safeTargetId(vacancyId);
      const sdk = await getFirestoreSdk();
      const vacancySnapshot = await sdk.getDoc(sdk.doc(db, "market_vacancies", id));
      if (!vacancySnapshot.exists()) throw new Error("Esta vaga não está mais disponível.");
      const vacancy = vacancySnapshot.data();
      if (vacancy.status !== "open" || (vacancy.expiresAt && millis(vacancy.expiresAt) <= Date.now())) {
        throw new Error("Esta vaga já foi encerrada ou expirou.");
      }
      if (vacancy.ownerUid === uid) throw new Error("Você não pode se candidatar à própria vaga.");
      const profile = await ownProfile(uid);
      if (!profile || profile.status !== "published") throw new Error("Publique seu currículo antes de se candidatar.");
      const safeMessage = boundedText(message, 600);
      if (safeMessage.length < 5) throw new Error("Escreva uma mensagem curta para apresentar seu interesse.");
      const applicationId = `${id}__${uid}`;
      await sdk.setDoc(sdk.doc(db, "market_applications", applicationId), {
        vacancyId: id,
        vacancyOwnerUid: vacancy.ownerUid,
        vacancyTitle: boundedText(vacancy.title, 70),
        teamName: boundedText(vacancy.teamName, 60),
        applicantUid: uid,
        nickname: profile.nickname,
        mainRole: profile.mainRole,
        message: safeMessage,
        status: "new",
        createdAt: sdk.serverTimestamp(),
        updatedAt: sdk.serverTimestamp()
      });
      return applicationId;
    },

    async listApplications(uid, mode) {
      requireCurrentUser(auth, uid);
      if (!["received", "sent"].includes(mode)) throw new Error("Tipo de candidatura inválido.");
      const sdk = await getFirestoreSdk();
      const field = mode === "received" ? "vacancyOwnerUid" : "applicantUid";
      const results = await sdk.getDocs(sdk.query(
        sdk.collection(db, "market_applications"),
        sdk.where(field, "==", uid),
        sdk.limit(MAX_PUBLIC_RESULTS)
      ));
      return snapshotData(results).sort(newestFirst);
    },

    async getApplicantProfile(uid, applicationId, profileUid) {
      requireCurrentUser(auth, uid);
      const appId = safeTargetId(applicationId);
      const playerId = safeTargetId(profileUid);
      const sdk = await getFirestoreSdk();
      const applicationSnapshot = await sdk.getDoc(sdk.doc(db, "market_applications", appId));
      if (!applicationSnapshot.exists()) throw new Error("Candidatura não encontrada.");
      const application = applicationSnapshot.data();
      if (application.vacancyOwnerUid !== uid || application.applicantUid !== playerId) {
        throw new Error("Esta candidatura não pertence a uma vaga sua.");
      }

      const profileSnapshot = await sdk.getDoc(sdk.doc(db, "market_profiles", playerId));
      if (!profileSnapshot.exists() || profileSnapshot.data().status !== "published") {
        throw new Error("O currículo não está mais disponível.");
      }
      const profile = profileSnapshot.data();
      const validAvailability = MARKET_AVAILABILITY.includes(profile.availability) ? profile.availability : "";
      return {
        id: profileSnapshot.id,
        uid: profileSnapshot.id,
        nickname: boundedText(profile.nickname, 36),
        mainRole: MARKET_ROLES.includes(profile.mainRole) ? profile.mainRole : "",
        secondaryRoles: normalizedRoles(profile.secondaryRoles),
        city: boundedText(profile.city, 60),
        state: boundedText(profile.state, 40).toUpperCase(),
        experience: boundedText(profile.experience, 70),
        availability: validAvailability,
        availabilitySchedule: boundedText(profile.availabilitySchedule, 100),
        teamHistory: boundedText(profile.teamHistory, 500),
        championships: boundedText(profile.championships, 400),
        achievements: boundedText(profile.achievements, 400),
        bio: boundedText(profile.bio, 700),
        contactAvailable: profile.contactAvailable === true
      };
    },

    async updateApplicationStatus(uid, applicationId, status) {
      requireCurrentUser(auth, uid);
      if (!["reviewing", "trial_scheduled", "approved", "rejected"].includes(status)) {
        throw new Error("Etapa da candidatura inválida.");
      }
      const sdk = await getFirestoreSdk();
      const ref = sdk.doc(db, "market_applications", safeTargetId(applicationId));
      const snapshot = await sdk.getDoc(ref);
      if (!snapshot.exists() || snapshot.data().vacancyOwnerUid !== uid) {
        throw new Error("Candidatura não encontrada ou sem permissão.");
      }
      await sdk.updateDoc(ref, { status, updatedAt: sdk.serverTimestamp() });
    },

    async listFavorites(uid) {
      requireCurrentUser(auth, uid);
      const cached = favoritesCache.get(uid);
      if (cached && cached.expiresAt > Date.now()) return cached.rows;
      const sdk = await getFirestoreSdk();
      const favoriteIds = await favoriteIdsFor(uid);
      const profileSnapshots = await Promise.allSettled(favoriteIds.map(profileUid =>
        sdk.getDoc(sdk.doc(db, "market_profiles", profileUid))
      ));
      const rows = profileSnapshots
        .filter(result => result.status === "fulfilled" && result.value.exists() && result.value.data().status === "published")
        .map(result => ({ id: result.value.id, uid: result.value.id, ...result.value.data() }));
      favoritesCache.set(uid, { expiresAt: Date.now() + MAX_LISTING_AGE_MS, rows });
      return rows;
    },

    async listFavoriteIds(uid) {
      requireCurrentUser(auth, uid);
      return favoriteIdsFor(uid);
    },

    async setFavorite(uid, profileUid, isFavorite) {
      requireCurrentUser(auth, uid);
      const targetId = safeTargetId(profileUid);
      const sdk = await getFirestoreSdk();
      const ref = sdk.doc(db, "market_favorites", `${uid}__${targetId}`);
      if (isFavorite) {
        const profileSnapshot = await sdk.getDoc(sdk.doc(db, "market_profiles", targetId));
        if (!profileSnapshot.exists() || profileSnapshot.data().status !== "published") {
          throw new Error("Este currículo não está mais disponível.");
        }
        await sdk.setDoc(ref, { ownerUid: uid, profileUid: targetId, createdAt: sdk.serverTimestamp() });
      } else {
        await sdk.deleteDoc(ref);
      }
      favoritesCache.delete(uid);
      favoriteIdsCache.delete(uid);
    },

    async reportContent(uid, { kind, targetId, reason }) {
      requireCurrentUser(auth, uid);
      if (!["profile", "vacancy"].includes(kind)) throw new Error("Tipo de denúncia inválido.");
      const id = safeTargetId(targetId);
      const safeReason = boundedText(reason, 500);
      if (safeReason.length < 8) throw new Error("Descreva o motivo da denúncia.");
      const sdk = await getFirestoreSdk();
      const collectionName = kind === "profile" ? "market_profiles" : "market_vacancies";
      const target = await sdk.getDoc(sdk.doc(db, collectionName, id));
      if (!target.exists()) throw new Error("Este conteúdo não está mais disponível.");
      const data = target.data();
      const publicNow = kind === "profile"
        ? data.status === "published"
        : data.status === "open" && (!data.expiresAt || millis(data.expiresAt) > Date.now());
      if (!publicNow) throw new Error("Este conteúdo não está mais disponível para denúncia.");
      if ((kind === "profile" ? data.uid : data.ownerUid) === uid) throw new Error("Você não pode denunciar sua própria publicação.");
      const targetName = kind === "profile" ? data.nickname : data.title;
      const reportId = `${uid}__${kind}__${id}`;
      await sdk.setDoc(sdk.doc(db, "market_reports", reportId), {
        reporterUid: uid,
        kind,
        targetId: id,
        targetName: boundedText(targetName, 80),
        reason: safeReason,
        status: "open",
        createdAt: sdk.serverTimestamp()
      });
      return reportId;
    },

    async listModerationQueue(uid, status = "open") {
      requireCurrentUser(auth, uid);
      await requireModerator(uid);
      if (!["open", "resolved"].includes(status)) throw new Error("Filtro de denúncias inválido.");
      const sdk = await getFirestoreSdk();
      const results = await sdk.getDocs(sdk.query(
        sdk.collection(db, "market_reports"),
        sdk.where("status", "==", status),
        sdk.limit(MAX_PUBLIC_RESULTS)
      ));
      return snapshotData(results).sort(newestFirst);
    },

    async moderateContent(uid, { kind, targetId, status, reason }) {
      requireCurrentUser(auth, uid);
      await requireModerator(uid);
      if (!["profile", "vacancy"].includes(kind) || !["approved", "removed"].includes(status)) {
        throw new Error("Decisão de moderação inválida.");
      }
      const id = safeTargetId(targetId);
      const sdk = await getFirestoreSdk();
      const targetCollection = kind === "profile" ? "market_profiles" : "market_vacancies";
      const targetRef = sdk.doc(db, targetCollection, id);
      const targetSnapshot = await sdk.getDoc(targetRef);
      if (!targetSnapshot.exists()) throw new Error("Conteúdo não encontrado.");
      const reports = await sdk.getDocs(sdk.query(
        sdk.collection(db, "market_reports"),
        sdk.where("targetId", "==", id),
        sdk.limit(MAX_PUBLIC_RESULTS)
      ));
      const openReports = reports.docs.filter(item => item.data().kind === kind && item.data().status === "open");
      if (!openReports.length) throw new Error("Não há denúncias pendentes para este conteúdo.");
      const batch = sdk.writeBatch(db);
      if (status === "removed") {
        batch.update(targetRef, {
          status: "suspended",
          moderationReason: boundedText(reason, 500),
          moderatedBy: uid,
          moderatedAt: sdk.serverTimestamp(),
          updatedAt: sdk.serverTimestamp()
        });
      }
      for (const report of openReports) {
        batch.update(report.ref, {
          status: "resolved",
          decision: status,
          decisionReason: boundedText(reason, 500),
          moderatorUid: uid,
          reviewedAt: sdk.serverTimestamp()
        });
      }
      batch.set(sdk.doc(sdk.collection(db, "market_audit_logs")), {
        actorUid: uid,
        action: status === "removed" ? "content_suspended" : "report_resolved",
        kind,
        targetId: id,
        reason: boundedText(reason, 500),
        createdAt: sdk.serverTimestamp()
      });
      await batch.commit();
      invalidatePublic(kind === "profile" ? "profiles" : "vacancies");
    },

    getCurrentUserRole: roleFor
  };
}
