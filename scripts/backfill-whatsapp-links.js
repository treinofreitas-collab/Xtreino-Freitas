#!/usr/bin/env node
/**
 * Backfill script: populate missing whatsappLink/groupLink in registrations and orders
 * Usage: node scripts/backfill-whatsapp-links.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 
  path.join(__dirname, '..', 'serviceAccount-dst.json');

let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (err) {
  console.error('❌ Could not load service account. Set FIREBASE_SERVICE_ACCOUNT_PATH or place serviceAccount-dst.json in root.');
  process.exit(1);
}

const db = admin.firestore();

// Helper to fetch whatsappLink from whatsapp_links collection
async function getWhatsAppLinkForRegistration(eventType, schedule, date) {
  if (!eventType) return null;
  
  try {
    const whatsappLinksRef = db.collection('whatsapp_links');
    
    // Normalize inputs
    const normalizeType = (t) => String(t || '').toLowerCase().trim()
      .replace(/\s+/g, '-')
      .replace('modo-liga', 'modo-liga')
      .replace('camp', 'camp-freitas');
    const normalizeHour = (h) => {
      if (!h) return null;
      const s = String(h).toLowerCase().trim();
      const m = s.match(/(\d{1,2})/);
      return m ? `${parseInt(m[1], 10)}h` : s;
    };
    
    const type = normalizeType(eventType);
    const hour = normalizeHour(schedule);
    
    // Try specific hour first
    if (hour) {
      const q = await whatsappLinksRef
        .where('eventType', '==', type)
        .where('schedule', '==', hour)
        .where('status', '==', 'active')
        .limit(1).get();
      if (!q.empty) return q.docs[0].data().link;
    }
    
    // Try general link (schedule = null)
    const qGeneral = await whatsappLinksRef
      .where('eventType', '==', type)
      .where('schedule', '==', null)
      .where('status', '==', 'active')
      .limit(1).get();
    if (!qGeneral.empty) return qGeneral.docs[0].data().link;
    
    return null;
  } catch (err) {
    console.warn('⚠️ Error fetching whatsappLink:', err.message);
    return null;
  }
}

async function backfillCollection(collectionName, batchSize = 10) {
  console.log(`\n📋 Backfilling ${collectionName}...`);
  
  try {
    const ref = db.collection(collectionName);
    const query = ref.where('whatsappLink', 'in', [null, '']);
    const snapshot = await query.get();
    
    console.log(`Found ${snapshot.size} documents with missing whatsappLink`);
    
    let updated = 0;
    let failed = 0;
    let batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const link = await getWhatsAppLinkForRegistration(data.eventType, data.schedule || data.hour, data.date);
      
      if (link) {
        batch.update(doc.ref, {
          whatsappLink: link,
          groupLink: link || null
        });
        updated++;
        console.log(`✅ [${updated}] Doc ${doc.id}: whatsappLink populated`);
      } else {
        console.log(`⚠️ [${updated}] Doc ${doc.id}: could not find whatsappLink for ${data.eventType}`);
        failed++;
      }
      
      batchCount++;
      if (batchCount >= batchSize) {
        await batch.commit();
        console.log(`📦 Committed ${batchCount} updates`);
        batch = db.batch();
        batchCount = 0;
      }
    }
    
    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`📦 Committed final ${batchCount} updates`);
    }
    
    console.log(`\n✅ ${collectionName} backfill complete: ${updated} updated, ${failed} could not populate`);
    return { updated, failed };
  } catch (err) {
    console.error(`❌ Error backfilling ${collectionName}:`, err);
    return { updated: 0, failed: 0 };
  }
}

async function main() {
  console.log('🔧 Starting whatsappLink backfill...');
  console.log('This will populate missing whatsappLink/groupLink in registrations and orders');
  console.log('---');
  
  const startTime = Date.now();
  
  const registrationsResult = await backfillCollection('registrations');
  const ordersResult = await backfillCollection('orders');
  
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Registrations: ${registrationsResult.updated} updated, ${registrationsResult.failed} failed`);
  console.log(`Orders: ${ordersResult.updated} updated, ${ordersResult.failed} failed`);
  console.log(`Total: ${registrationsResult.updated + ordersResult.updated} updated`);
  console.log(`Time: ${elapsed}s`);
  console.log('='.repeat(60));
  
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
