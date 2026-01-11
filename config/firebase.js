// Firebase client initialization via ES Modules (CDN)
// Para habilitar, defina window.FIREBASE_CONFIG com as credenciais do projeto Firebase.

let app = null;
let auth = null;
let db = null;
let providers = {};

async function initializeIfConfigured() {
    try {
        if (!window.FIREBASE_CONFIG) {
            return;
        }

        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js');
        const { getAuth, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
        const { getFirestore, setLogLevel } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');

        app = initializeApp(window.FIREBASE_CONFIG);
        auth = getAuth(app);
        db = getFirestore(app);
        // Reduz ruído de logs no console
        try { setLogLevel('error'); } catch (_) {}
        providers.google = new GoogleAuthProvider();

        window.firebaseApp = app;
        window.firebaseAuth = auth;
        window.firebaseDb = db;
        window.firebaseProviders = providers;
        window.firebaseReady = true;
    } catch (err) {
        console.error('Firebase init error:', err);
        window.firebaseReady = false;
    }
}

initializeIfConfigured();


