/**
 * Script para importar links do WhatsApp
 * Preencha os links abaixo com os valores reais das imagens
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount-dst.json');

// Inicializar Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function importWhatsAppLinks() {
  console.log('📦 Importando links do WhatsApp...\n');
  
  // PREENCHA OS LINKS ABAIXO COM OS VALORES REAIS DAS IMAGENS
  // Formato: { eventType: 'tipo-evento', schedule: 'horario', link: 'url-completa', status: 'active' }
  
  const links = [
    // ========== CAMP FREITAS ==========
    { eventType: 'camp-freitas', schedule: '19h', link: 'COLE_AQUI_O_LINK_19H', status: 'active', description: 'Camp Freitas - 19h' },
    { eventType: 'camp-freitas', schedule: '20h', link: 'COLE_AQUI_O_LINK_20H', status: 'active', description: 'Camp Freitas - 20h' },
    { eventType: 'camp-freitas', schedule: '21h', link: 'COLE_AQUI_O_LINK_21H', status: 'active', description: 'Camp Freitas - 21h' },
    { eventType: 'camp-freitas', schedule: '22h', link: 'COLE_AQUI_O_LINK_22H', status: 'active', description: 'Camp Freitas - 22h' },
    { eventType: 'camp-freitas', schedule: '23h', link: 'COLE_AQUI_O_LINK_23H', status: 'active', description: 'Camp Freitas - 23h' },
    
    // ========== MODO LIGA ==========
    { eventType: 'modo-liga', schedule: '1h', link: 'COLE_AQUI_O_LINK_1H', status: 'active', description: 'Modo Liga - 1h' },
    { eventType: 'modo-liga', schedule: '15h', link: 'COLE_AQUI_O_LINK_15H', status: 'active', description: 'Modo Liga - 15h' },
    { eventType: 'modo-liga', schedule: '17h', link: 'COLE_AQUI_O_LINK_17H', status: 'active', description: 'Modo Liga - 17h' },
    { eventType: 'modo-liga', schedule: '19h', link: 'COLE_AQUI_O_LINK_19H', status: 'active', description: 'Modo Liga - 19h' },
    { eventType: 'modo-liga', schedule: '20h', link: 'COLE_AQUI_O_LINK_20H', status: 'active', description: 'Modo Liga - 20h' },
    { eventType: 'modo-liga', schedule: '21h', link: 'COLE_AQUI_O_LINK_21H', status: 'active', description: 'Modo Liga - 21h' },
    { eventType: 'modo-liga', schedule: '22h', link: 'COLE_AQUI_O_LINK_22H', status: 'active', description: 'Modo Liga - 22h' },
    { eventType: 'modo-liga', schedule: '23h', link: 'COLE_AQUI_O_LINK_23H', status: 'active', description: 'Modo Liga - 23h' },
    
    // ========== SEMANAL FREITAS ==========
    { eventType: 'semanal-freitas', schedule: '1h', link: 'COLE_AQUI_O_LINK_1H', status: 'active', description: 'Semanal Freitas - 1h' },
    { eventType: 'semanal-freitas', schedule: '15h', link: 'COLE_AQUI_O_LINK_15H', status: 'active', description: 'Semanal Freitas - 15h' },
    { eventType: 'semanal-freitas', schedule: '17h', link: 'COLE_AQUI_O_LINK_17H', status: 'active', description: 'Semanal Freitas - 17h' },
    { eventType: 'semanal-freitas', schedule: '19h', link: 'COLE_AQUI_O_LINK_19H', status: 'active', description: 'Semanal Freitas - 19h' },
    { eventType: 'semanal-freitas', schedule: '20h', link: 'COLE_AQUI_O_LINK_20H', status: 'active', description: 'Semanal Freitas - 20h' },
    { eventType: 'semanal-freitas', schedule: '21h', link: 'COLE_AQUI_O_LINK_21H', status: 'active', description: 'Semanal Freitas - 21h' },
    { eventType: 'semanal-freitas', schedule: '22h', link: 'COLE_AQUI_O_LINK_22H', status: 'active', description: 'Semanal Freitas - 22h' },
    
    // ========== XTREINO TOKENS ==========
    { eventType: 'xtreino-tokens', schedule: '1h', link: 'COLE_AQUI_O_LINK_1H', status: 'active', description: 'XTreino Tokens - 1h' },
    { eventType: 'xtreino-tokens', schedule: '15h', link: 'COLE_AQUI_O_LINK_15H', status: 'active', description: 'XTreino Tokens - 15h' },
    { eventType: 'xtreino-tokens', schedule: '17h', link: 'COLE_AQUI_O_LINK_17H', status: 'active', description: 'XTreino Tokens - 17h' },
    { eventType: 'xtreino-tokens', schedule: '19h', link: 'COLE_AQUI_O_LINK_19H', status: 'active', description: 'XTreino Tokens - 19h' },
    { eventType: 'xtreino-tokens', schedule: '20h', link: 'COLE_AQUI_O_LINK_20H', status: 'active', description: 'XTreino Tokens - 20h' },
    { eventType: 'xtreino-tokens', schedule: '21h', link: 'COLE_AQUI_O_LINK_21H', status: 'active', description: 'XTreino Tokens - 21h' },
    { eventType: 'xtreino-tokens', schedule: '22h', link: 'COLE_AQUI_O_LINK_22H', status: 'active', description: 'XTreino Tokens - 22h' },
    { eventType: 'xtreino-tokens', schedule: '23h', link: 'COLE_AQUI_O_LINK_23H', status: 'active', description: 'XTreino Tokens - 23h' },
  ];
  
  // Verificar se há links com placeholder
  const hasPlaceholders = links.some(link => link.link.includes('COLE_AQUI_O_LINK'));
  if (hasPlaceholders) {
    console.error('❌ ERRO: Você precisa preencher os links antes de executar!');
    console.error('   Substitua todos os "COLE_AQUI_O_LINK_XXh" pelos links reais do WhatsApp.');
    process.exit(1);
  }
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  
  for (const linkData of links) {
    try {
      // Verificar se já existe um link com mesmo eventType e schedule
      const existingQuery = await db.collection('whatsapp_links')
        .where('eventType', '==', linkData.eventType)
        .where('schedule', '==', linkData.schedule)
        .limit(1)
        .get();
      
      if (!existingQuery.empty) {
        // Atualizar link existente
        const docId = existingQuery.docs[0].id;
        await db.collection('whatsapp_links').doc(docId).update({
          ...linkData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        updated++;
        console.log(`🔄 Atualizado: ${linkData.eventType} - ${linkData.schedule || 'geral'}`);
      } else {
        // Criar novo link
        await db.collection('whatsapp_links').add({
          ...linkData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        created++;
        console.log(`✅ Criado: ${linkData.eventType} - ${linkData.schedule || 'geral'}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao processar ${linkData.eventType} - ${linkData.schedule}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Criados: ${created}`);
  console.log(`   🔄 Atualizados: ${updated}`);
  console.log(`   ⏭️  Ignorados: ${skipped}`);
  console.log(`   📦 Total processado: ${links.length}`);
}

async function main() {
  try {
    await importWhatsAppLinks();
    console.log('\n✅ Importação concluída!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

main();

