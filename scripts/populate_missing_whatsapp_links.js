// Script to populate missing whatsappLink/groupLink in registrations and orders
// Usage: node scripts/populate_missing_whatsapp_links.js

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

  const normalizeType = (t)=> String(t||'').toLowerCase().trim()
    .replace(/\s+/g,'-')
    .replace('modo liga','modo-liga')
    .replace(/^semanal\s+freitas$/,'semanal-freitas')
    .replace(/^camp$/,'camp-freitas');

  // Map obvious token purchase labels to canonical 'xtreino-tokens'
  // e handle cases like '1 Token XTreino', '5 Tokens XTreino', 'Token Xtreino'
  function normalizeTypeWithTokens(t){
    const s = String(t||'').toLowerCase();
    if (!s) return '';
    if (s.includes('token') && s.includes('xtreino')) return 'xtreino-tokens';
    if (s.match(/\b\d+\s*tokens?\b/)) return 'xtreino-tokens';
    if (s.includes('xtreino') && s.includes('token')) return 'xtreino-tokens';
    return normalizeType(t);
  }

  const normalizeHour = (h)=>{
    if (h === null || typeof h === 'undefined') return null;
    const s = String(h).toLowerCase().trim();
    if (s === '' || s === 'null' || s === 'geral' || s === 'todos' || s === 'all') return null;
    const m = s.match(/(\d{1,2})/);
    return m ? `${parseInt(m[1],10)}h` : s;
  };

  async function findLinkFor(typeRaw, scheduleRaw, dateRaw){
    const type = normalizeTypeWithTokens(typeRaw);
    const hour = normalizeHour(scheduleRaw || null);

    // load whatsapp_links collection and try queries
    const col = db.collection('whatsapp_links');

    if (hour){
      const snap = await col.where('eventType','==',type)
                          .where('schedule','==',hour)
                          .where('status','==','active')
                          .limit(1)
                          .get();
      if (!snap.empty) return snap.docs[0].data().link;
    }
    // try null schedule
    let snap = await col.where('eventType','==',type)
                       .where('schedule','==',null)
                       .where('status','==','active')
                       .limit(1)
                       .get();
    if (!snap.empty) return snap.docs[0].data().link;
    // try empty string
    snap = await col.where('eventType','==',type)
                    .where('schedule','==','')
                    .where('status','==','active')
                    .limit(1)
                    .get();
    if (!snap.empty) return snap.docs[0].data().link;

    // fallback: try any active link for that type
    snap = await col.where('eventType','==',type)
                    .where('status','==','active')
                    .limit(1)
                    .get();
    if (!snap.empty) return snap.docs[0].data().link;

    return null;
  }

  let regsUpdated = 0;
  let ordersUpdated = 0;

  // Helper to process a collection
  async function processCollection(name, whereClauses){
    const col = db.collection(name);
    let query = col;
    for (const wc of whereClauses){
      query = query.where(...wc);
    }
    // limit to 2000 to avoid long runs
    const snapshot = await query.limit(2000).get();
    console.log(`${name}: documents to check =`, snapshot.size);

    for (const doc of snapshot.docs){
      const data = doc.data();
      const eventType = data.eventType || data.item || data.title || data.event || data.type || '';
      const schedule = data.schedule || data.hour || data.time || null;
      const date = data.eventDate || data.date || null;
      const existing = data.whatsappLink || data.groupLink || '';
      if (existing && String(existing).trim()) continue; // already has link

      const link = await findLinkFor(eventType, schedule, date);
      if (link){
        const updates = { whatsappLink: link, groupLink: link };
        if (!data.schedule && schedule){
          updates.schedule = normalizeHour(schedule) || schedule;
        }
        try{
          await doc.ref.update(updates);
          if (name === 'registrations') regsUpdated++; else ordersUpdated++;
          console.log(`Updated ${name}/${doc.id} => link set`);
        }catch(e){
          console.error(`Failed to update ${name}/${doc.id}:`, e.message);
        }
      } else {
        console.log(`No link found for ${name}/${doc.id} (type='${eventType}', schedule='${schedule}')`);
      }
    }
  }

  // Helper to process recent documents and detect missing whatsappLink field
  async function processRecentCollection(name){
    const col = db.collection(name);
    const snapshot = await col.orderBy('createdAt','desc').limit(2000).get();
    console.log(`${name}: recent documents to check =`, snapshot.size);

    for (const doc of snapshot.docs){
      const data = doc.data();
      const hasLink = !!(data.whatsappLink && String(data.whatsappLink).trim());
      if (hasLink) continue;

      const eventType = data.eventType || data.item || data.title || data.event || data.type || '';
      const schedule = data.schedule || data.hour || data.time || null;
      const date = data.eventDate || data.date || null;

      const link = await findLinkFor(eventType, schedule, date);
      if (link){
        const updates = { whatsappLink: link, groupLink: link };
        if (!data.schedule && schedule){
          updates.schedule = normalizeHour(schedule) || schedule;
        }
        try{
          await doc.ref.update(updates);
          if (name === 'registrations') regsUpdated++; else ordersUpdated++;
          console.log(`Updated ${name}/${doc.id} => link set (recent scan)`);
        }catch(e){
          console.error(`Failed to update ${name}/${doc.id}:`, e.message);
        }
      } else {
        console.log(`No link found for ${name}/${doc.id} (recent scan) (type='${eventType}', schedule='${schedule}')`);
      }
    }
  }

  // Process registrations: where whatsappLink == '' OR == null OR missing
  await processCollection('registrations', [['whatsappLink','==','']]);
  await processCollection('registrations', [['whatsappLink','==',null]]);

  // Process orders
  await processCollection('orders', [['whatsappLink','==','']]);
  await processCollection('orders', [['whatsappLink','==',null]]);

  // ALSO process recent documents that may simply be missing the whatsappLink field
  await processRecentCollection('registrations');
  await processRecentCollection('orders');

  console.log('\nDone. registrations updated:', regsUpdated, 'orders updated:', ordersUpdated);
  process.exit(0);
}

main().catch(e=>{ console.error('Fatal:', e); process.exit(2); });
