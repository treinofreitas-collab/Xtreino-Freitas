#!/usr/bin/env node
/**
 * Normalize `hour` field on registrations documents.
 * Usage:
 *   node normalize-registrations-hour.js --dry   (dry-run, no writes)
 *   node normalize-registrations-hour.js        (apply updates)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function initAdmin() {
  // Prefer serviceAccount-dst.json, then serviceAccount-src.json, then env
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'serviceAccount-dst.json'),
    path.join(cwd, 'serviceAccount-src.json')
  ];
  let credPath = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { credPath = p; break; }
  }

  if (credPath) {
    const serviceAccount = require(credPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('Initialized Firebase Admin with', credPath);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
    console.log('Initialized Firebase Admin with GOOGLE_APPLICATION_CREDENTIALS');
  } else {
    console.error('No service account found. Place serviceAccount-dst.json or set GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(1);
  }
}

function parseHourFromString(s) {
  if (!s) return null;
  const str = String(s).toLowerCase();
  // Try patterns like "14h", "14:00", "14"
  const hMatch = str.match(/\b([01]?\d|2[0-3])(?=h\b|:\d{2}|\b)/);
  if (hMatch) return parseInt(hMatch[1], 10);
  // Try patterns like "às 14h" or "- 14h"
  const hMatch2 = str.match(/(\d{1,2})\s*h/);
  if (hMatch2) return parseInt(hMatch2[1], 10);
  // fallback: any two-digit hour present
  const anyNum = str.match(/\b(\d{1,2})\b/);
  if (anyNum) {
    const v = parseInt(anyNum[1], 10);
    if (v >= 0 && v <= 23) return v;
  }
  return null;
}

async function run() {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry') || argv.includes('-d');

  initAdmin();

  const db = admin.firestore();
  const collectionRef = db.collection('registrations');

  console.log('Fetching registrations...');
  const snapshot = await collectionRef.get();
  console.log('Total registrations fetched:', snapshot.size);

  const updates = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    // Skip if hour already present and numeric
    if (data.hour !== undefined && typeof data.hour === 'number' && Number.isFinite(data.hour)) return;

    // Candidate fields
    const candidates = [data.hour, data.schedule, data.time, data.hourString, data.createdAt, data.startTime, data.date];
    let hour = null;
    for (const c of candidates) {
      if (hour !== null) break;
      if (c === undefined || c === null) continue;
      if (typeof c === 'number') {
        if (c >= 0 && c <= 23) { hour = c; break; }
        // if it's timestamp in seconds, try to interpret
        if (c > 1000000000) {
          const dt = new Date(c.seconds ? c.seconds * 1000 : c);
          if (!isNaN(dt.getTime())) { hour = dt.getHours(); break; }
        }
      }
      if (typeof c === 'string') {
        const parsed = parseHourFromString(c);
        if (parsed !== null) { hour = parsed; break; }
      }
      if (typeof c === 'object' && c !== null && c.seconds) {
        const dt = new Date(c.seconds * 1000);
        hour = dt.getHours();
        break;
      }
    }

    if (hour === null) {
      // Try other fields in the document: look through all string values for an hour
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (typeof val === 'string') {
          const p = parseHourFromString(val);
          if (p !== null) { hour = p; break; }
        }
      }
    }

    if (hour !== null) {
      updates.push({ id: doc.id, hour });
    }
  });

  console.log('Documents to update:', updates.length);
  if (updates.length === 0) {
    console.log('Nothing to update. Exiting.');
    process.exit(0);
  }

  if (dry) {
    console.log('Dry-run mode. The following updates would be applied:');
    updates.slice(0, 100).forEach(u => console.log(` - ${u.id} => hour: ${u.hour}`));
    if (updates.length > 100) console.log(` ...and ${updates.length - 100} more`);
    process.exit(0);
  }

  console.log('Applying updates...');
  let applied = 0;
  for (const u of updates) {
    try {
      await collectionRef.doc(u.id).update({ hour: u.hour });
      applied++;
      if (applied % 50 === 0) console.log(`Applied ${applied}/${updates.length}`);
    } catch (err) {
      console.error('Failed to update', u.id, err.message || err);
    }
  }

  console.log(`Done. Applied ${applied} updates.`);
  process.exit(0);
}

run().catch(err => { console.error('Script failed:', err); process.exit(1); });
