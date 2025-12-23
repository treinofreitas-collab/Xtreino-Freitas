#!/usr/bin/env node
/**
 * Adicionar link geral para xtreino-tokens (sem horário específico)
 * Usage: node scripts/add-general-whatsapp-link.js
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
  console.error('❌ Não conseguiu carregar service account.');
  process.exit(1);
}

const db = admin.firestore();

async function addGeneralLinks() {
  console.log('\n' + '='.repeat(70));
  console.log('➕ Adicionando links gerais (sem horário específico)');
  console.log('='.repeat(70));
  
  try {
    // 1. Buscar link mais recente para xtreino-tokens (para usar como geral)
    console.log('\n🔍 Buscando link mais popular para xtreino-tokens...');
    const xtreino = await db.collection('whatsapp_links')
      .where('eventType', '==', 'xtreino-tokens')
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (xtreino.empty) {
      console.log('❌ Nenhum link de xtreino-tokens encontrado!');
      process.exit(1);
    }
    
    const xtreinoLink = xtreino.docs[0].data().link;
    console.log(`  ✅ Link encontrado: ${xtreinoLink}`);
    
    // 2. Adicionar link geral para xtreino-tokens
    console.log('\n📝 Adicionando link geral para xtreino-tokens...');
    const xtreinoGeneral = await db.collection('whatsapp_links')
      .where('eventType', '==', 'xtreino-tokens')
      .where('schedule', '==', null)
      .limit(1)
      .get();
    
    if (xtreinoGeneral.empty) {
      await db.collection('whatsapp_links').add({
        eventType: 'xtreino-tokens',
        schedule: null,
        link: xtreinoLink,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('  ✅ Link geral adicionado para xtreino-tokens');
    } else {
      console.log('  ℹ️ Link geral já existe para xtreino-tokens');
    }
    
    // 3. Buscar link mais popular para modo-liga
    console.log('\n🔍 Buscando link mais popular para modo-liga...');
    const modoLiga = await db.collection('whatsapp_links')
      .where('eventType', '==', 'modo-liga')
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (!modoLiga.empty) {
      const modoLigaLink = modoLiga.docs[0].data().link;
      console.log(`  ✅ Link encontrado: ${modoLigaLink}`);
      
      console.log('\n📝 Adicionando link geral para modo-liga...');
      const modoLigaGeneral = await db.collection('whatsapp_links')
        .where('eventType', '==', 'modo-liga')
        .where('schedule', '==', null)
        .limit(1)
        .get();
      
      if (modoLigaGeneral.empty) {
        await db.collection('whatsapp_links').add({
          eventType: 'modo-liga',
          schedule: null,
          link: modoLigaLink,
          status: 'active',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('  ✅ Link geral adicionado para modo-liga');
      } else {
        console.log('  ℹ️ Link geral já existe para modo-liga');
      }
    }
    
    // 4. Fazer o mesmo para camp-freitas e semanal-freitas
    const eventTypes = ['camp-freitas', 'semanal-freitas'];
    for (const eventType of eventTypes) {
      console.log(`\n🔍 Buscando link popular para ${eventType}...`);
      const event = await db.collection('whatsapp_links')
        .where('eventType', '==', eventType)
        .where('status', '==', 'active')
        .limit(1)
        .get();
      
      if (!event.empty) {
        const link = event.docs[0].data().link;
        console.log(`  ✅ Link encontrado: ${link}`);
        
        console.log(`\n📝 Adicionando link geral para ${eventType}...`);
        const eventGeneral = await db.collection('whatsapp_links')
          .where('eventType', '==', eventType)
          .where('schedule', '==', null)
          .limit(1)
          .get();
        
        if (eventGeneral.empty) {
          await db.collection('whatsapp_links').add({
            eventType: eventType,
            schedule: null,
            link: link,
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`  ✅ Link geral adicionado para ${eventType}`);
        } else {
          console.log(`  ℹ️ Link geral já existe para ${eventType}`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Links gerais adicionados com sucesso!');
    console.log('='.repeat(70) + '\n');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro:', err);
    process.exit(1);
  }
}

addGeneralLinks();
