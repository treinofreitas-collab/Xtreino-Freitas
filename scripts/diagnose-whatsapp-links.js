#!/usr/bin/env node
/**
 * Diagnóstico: verificar estado de whatsapp_links e registrations
 * Usage: node scripts/diagnose-whatsapp-links.js
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

async function diagnose() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 DIAGNÓSTICO: WhatsApp Links');
  console.log('='.repeat(70));
  
  // 1. Verificar coleção whatsapp_links
  console.log('\n📊 [1/5] Verificando coleção whatsapp_links...');
  try {
    const whatsappLinksSnap = await db.collection('whatsapp_links').get();
    console.log(`  → Total de documentos: ${whatsappLinksSnap.size}`);
    
    if (whatsappLinksSnap.size === 0) {
      console.log('  ⚠️ AVISO: whatsapp_links está vazia! Nenhum link para buscar.');
      return;
    }
    
    const linksData = {};
    whatsappLinksSnap.forEach(doc => {
      const data = doc.data();
      const key = `${data.eventType || 'N/A'} | ${data.schedule || 'geral'}`;
      if (!linksData[key]) linksData[key] = [];
      linksData[key].push({ id: doc.id, link: data.link, status: data.status });
    });
    
    console.log('\n  📍 Links cadastrados:');
    for (const [key, entries] of Object.entries(linksData)) {
      entries.forEach(entry => {
        const icon = entry.status === 'active' ? '✅' : '⚠️';
        console.log(`    ${icon} ${key} → ${entry.link} (${entry.status})`);
      });
    }
  } catch (err) {
    console.error('  ❌ Erro ao ler whatsapp_links:', err.message);
  }
  
  // 2. Verificar registrations com whatsappLink vazio/nulo
  console.log('\n📋 [2/5] Verificando registrations...');
  try {
    const regWithoutLink = await db.collection('registrations')
      .where('whatsappLink', 'in', [null, ''])
      .limit(5)
      .get();
    
    console.log(`  → Registrations com whatsappLink vazio: ${regWithoutLink.size} (mostrando até 5)`);
    
    regWithoutLink.forEach(doc => {
      const data = doc.data();
      console.log(`\n    📌 Doc: ${doc.id}`);
      console.log(`      - eventType: "${data.eventType}"`);
      console.log(`      - schedule: "${data.schedule}"`);
      console.log(`      - hour: "${data.hour}"`);
      console.log(`      - date: "${data.date}"`);
      console.log(`      - whatsappLink: ${data.whatsappLink === null ? '(null)' : `"${data.whatsappLink}"`}`);
    });
  } catch (err) {
    console.error('  ❌ Erro ao ler registrations:', err.message);
  }
  
  // 3. Verificar orders com whatsappLink vazio/nulo
  console.log('\n📦 [3/5] Verificando orders...');
  try {
    const ordersWithoutLink = await db.collection('orders')
      .where('whatsappLink', 'in', [null, ''])
      .limit(5)
      .get();
    
    console.log(`  → Orders com whatsappLink vazio: ${ordersWithoutLink.size} (mostrando até 5)`);
    
    ordersWithoutLink.forEach(doc => {
      const data = doc.data();
      console.log(`\n    📌 Doc: ${doc.id}`);
      console.log(`      - eventType: "${data.eventType}"`);
      console.log(`      - schedule: "${data.schedule}"`);
      console.log(`      - title: "${data.title}"`);
      console.log(`      - whatsappLink: ${data.whatsappLink === null ? '(null)' : `"${data.whatsappLink}"`}`);
    });
  } catch (err) {
    console.error('  ❌ Erro ao ler orders:', err.message);
  }
  
  // 4. Testar query específica
  console.log('\n🧪 [4/5] Testando queries (exemplo: xtreino-tokens)...');
  try {
    // Testar busca por tipo específico
    const testQueries = [
      { eventType: 'xtreino-tokens', schedule: null },
      { eventType: 'xtreino-tokens', schedule: '19h' },
      { eventType: 'modo-liga', schedule: null }
    ];
    
    for (const testQ of testQueries) {
      try {
        const result = await db.collection('whatsapp_links')
          .where('eventType', '==', testQ.eventType)
          .where('schedule', '==', testQ.schedule)
          .where('status', '==', 'active')
          .limit(1)
          .get();
        
        const found = !result.empty ? `✅ ENCONTRADO: ${result.docs[0].data().link}` : '❌ não encontrado';
        console.log(`\n    Query: eventType="${testQ.eventType}", schedule=${testQ.schedule === null ? 'null' : `"${testQ.schedule}"`}`);
        console.log(`    → ${found}`);
      } catch (queryErr) {
        console.log(`\n    Query: eventType="${testQ.eventType}", schedule=${testQ.schedule === null ? 'null' : `"${testQ.schedule}"`}`);
        console.log(`    → ❌ Erro na query: ${queryErr.message}`);
      }
    }
  } catch (err) {
    console.error('  ❌ Erro ao testar queries:', err.message);
  }
  
  // 5. Sugestões
  console.log('\n💡 [5/5] Análise e sugestões:');
  console.log('  Se whatsapp_links está vazia:');
  console.log('    1. Cadastre links em Admin → Seção de WhatsApp Links');
  console.log('    2. Certifique-se que status = "active"');
  console.log('    3. Eventualidades: eventType deve estar normalizado (ex: "xtreino-tokens", "modo-liga")');
  console.log('\n  Se queries falharem:');
  console.log('    - Verifique se campos estão com tipo correto no Firestore');
  console.log('    - eventType deve ser string');
  console.log('    - schedule deve ser null ou string (não número)');
  console.log('\n  Próximos passos:');
  console.log('    1. Revisar dados acima');
  console.log('    2. Se whatsapp_links está vazia: preencher no Admin');
  console.log('    3. Depois rodar: node scripts/backfill-whatsapp-links.js');
  
  console.log('\n' + '='.repeat(70) + '\n');
  process.exit(0);
}

diagnose().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
