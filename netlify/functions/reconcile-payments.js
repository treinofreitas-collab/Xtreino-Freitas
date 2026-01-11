// Scheduled function: reconcile payments periodically to confirm orders/registrations
const admin = require('firebase-admin');

try {
  if (!admin.apps.length) {
    const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey && privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
    } else if (svc) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(svc)) });
    } else {
      admin.initializeApp();
    }
  }
} catch (_) {}

exports.handler = async () => {
  try {
    const db = admin.firestore();
    const since = Date.now() - 48 * 60 * 60 * 1000; // 48h
    let checked = 0, approved = 0;

    const regsSnap = await db.collection('registrations').where('status','==','pending').get();
    for (const d of regsSnap.docs){
      const r = d.data();
      const ts = r.createdAt?.toDate?.()?.getTime?.() || r.timestamp || 0;
      const ext = r.external_reference;
      if (!ext || ts < since) continue;
      checked++;
      const res = await fetch(process.env.URL + '/.netlify/functions/check-payment-status', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ external_reference: ext })
      });
      if (!res.ok) continue;
      const data = await res.json();
      const st = String(data?.status||'').toLowerCase();
      if (['approved','paid','accredited'].includes(st)){
        await d.ref.update({ status:'paid', paidAt: Date.now() });
        approved++;
      }
    }
    return { statusCode: 200, body: JSON.stringify({ ok:true, checked, approved }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: e.message }) };
  }
};


