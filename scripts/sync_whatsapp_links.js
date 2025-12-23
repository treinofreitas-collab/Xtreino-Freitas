// Node script to list and normalize whatsapp_links in Firestore
// Usage: node scripts/sync_whatsapp_links.js

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
    console.error('No serviceAccount file found. Looked for:', candidates.join(', '));
    process.exit(1);
  }

  console.log('Using credentials file:', credsPath);
  const svc = require(credsPath);

  try{
    admin.initializeApp({ credential: admin.credential.cert(svc) });
  }catch(e){
    console.error('Failed to initialize Firebase Admin:', e.message);
    process.exit(1);
  }

  const db = admin.firestore();
  const colRef = db.collection('whatsapp_links');

  const snapshot = await colRef.get();
  console.log('Total whatsapp_links documents:', snapshot.size);

  const normalizeType = (t)=> String(t||'').toLowerCase().trim()
    .replace(/\s+/g,'-')
    .replace(/modo-liga|modo-liga/g, 'modo-liga')
    .replace('modo liga','modo-liga')
    .replace(/^semanal\s+freitas$/, 'semanal-freitas')
    .replace(/^camp$/, 'camp-freitas');

  const normalizeHour = (h)=>{
    if (h === null || typeof h === 'undefined') return null;
    const s = String(h).toLowerCase().trim();
    if (s === '' || s === 'null' || s === 'geral' || s === 'todos' || s === 'all') return null;
    const m = s.match(/(\d{1,2})/);
    return m ? `${parseInt(m[1],10)}h` : s;
  };

  let updated = 0;
  const duplicates = {};

  for (const doc of snapshot.docs){
    const data = doc.data();
    const origType = data.eventType;
    const origSchedule = (typeof data.schedule === 'undefined') ? null : data.schedule;

    const normType = normalizeType(origType);
    const normSchedule = normalizeHour(origSchedule);

    const finalSchedule = (normSchedule === null) ? null : normSchedule;

    // detect duplicates key
    const key = `${normType}___${finalSchedule===null?'__null__':finalSchedule}`;
    duplicates[key] = duplicates[key] || [];
    duplicates[key].push(doc.id);

    // prepare update if needed
    const updates = {};
    if (origType !== normType) updates.eventType = normType;
    // For schedule, treat empty string as null
    const origSchedComparable = (origSchedule === '' ? null : origSchedule);
    if (origSchedComparable !== finalSchedule) updates.schedule = finalSchedule;
    if (!data.status) updates.status = 'active';

    if (Object.keys(updates).length>0){
      console.log(`Updating doc ${doc.id}:`, updates);
      await doc.ref.update(updates);
      updated++;
    } else {
      console.log(`Doc ${doc.id} OK: eventType=${origType} schedule=${origSchedule} status=${data.status}`);
    }
  }

  // report duplicates
  const dupEntries = Object.entries(duplicates).filter(([,arr])=>arr.length>1);
  if (dupEntries.length>0){
    console.log('\nFound duplicate normalized keys:');
    dupEntries.forEach(([k,arr])=>{
      console.log(k, arr.join(', '));
    });
  }

  console.log(`\nNormalization complete. Documents updated: ${updated}`);
  process.exit(0);
}

main().catch(e=>{ console.error('Fatal error:', e); process.exit(2); });
