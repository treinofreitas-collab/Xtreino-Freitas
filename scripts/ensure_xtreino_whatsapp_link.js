// Ensure there's an active whatsapp_links doc for xtreino-tokens (schedule=null)
// Usage: node scripts/ensure_xtreino_whatsapp_link.js

const fs = require('fs');
const path = require('path');

async function main(){
  const admin = require('firebase-admin');
  const candidates = ['serviceAccount-src.json','serviceAccount-dst.json','serviceAccount.json'];
  let credsPath = null;
  for (const c of candidates){
    const p = path.join(__dirname,'..', c);
    if (fs.existsSync(p)) { credsPath = p; break; }
  }
  if (!credsPath){
    console.error('No serviceAccount file found.');
    process.exit(1);
  }
  const svc = require(credsPath);
  admin.initializeApp({ credential: admin.credential.cert(svc) });
  const db = admin.firestore();

  const type = 'xtreino-tokens';
  // search for active docs for this type with schedule null or ''
  const col = db.collection('whatsapp_links');
  const snaps = [];
  const q1 = await col.where('eventType','==',type).where('schedule','==',null).where('status','==','active').get();
  if (!q1.empty) snaps.push(...q1.docs.map(d=>({id:d.id,...d.data()})));
  const q2 = await col.where('eventType','==',type).where('schedule','==','').where('status','==','active').get();
  if (!q2.empty) snaps.push(...q2.docs.map(d=>({id:d.id,...d.data()})));
  const q3 = await col.where('eventType','==',type).where('status','==','active').get();
  if (!q3.empty) snaps.push(...q3.docs.map(d=>({id:d.id,...d.data()})));

  if (snaps.length){
    console.log('Found whatsapp_links documents for', type);
    snaps.forEach(s=> console.log('-', s.id, s.schedule, s.link));

    // If none has schedule === null, create a general doc using first link found
    const hasNull = snaps.some(s => s.schedule === null);
    if (!hasNull) {
      const fallbackLink = snaps[0].link || 'https://chat.whatsapp.com/placeholder';
      const newDoc = {
        eventType: type,
        schedule: null,
        status: 'active',
        link: fallbackLink,
        title: 'XTreino Tokens (geral)'
      };
      const created = await col.add(newDoc);
      console.log('Created general whatsapp_links doc for', type, created.id, '->', fallbackLink);
    }
    process.exit(0);
  }

  console.log('No active whatsapp_links found for', type, '- creating one (schedule:null)');
  const newDoc = {
    eventType: type,
    schedule: null,
    status: 'active',
    // Placeholder safe message link to admin — update later with real link
    link: 'https://chat.whatsapp.com/placeholder',
    title: 'XTreino Tokens (geral)'
  };
  const docRef = await col.add(newDoc);
  console.log('Created whatsapp_links doc:', docRef.id);
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(2); });
