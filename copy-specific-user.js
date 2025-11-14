/**
 * Script para copiar um usuário específico do Firebase antigo para o novo
 * 
 * USO:
 * node copy-specific-user.js <email>
 * 
 * Exemplo:
 * node copy-specific-user.js cleitondouglass@gmail.com
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SOURCE_CREDENTIALS = './serviceAccount-src.json';
const DEST_CREDENTIALS = './serviceAccount-dst.json';

let srcDb, dstDb;

function initializeApps() {
  try {
    if (!fs.existsSync(SOURCE_CREDENTIALS)) {
      throw new Error(`Arquivo de credenciais não encontrado: ${SOURCE_CREDENTIALS}`);
    }
    if (!fs.existsSync(DEST_CREDENTIALS)) {
      throw new Error(`Arquivo de credenciais não encontrado: ${DEST_CREDENTIALS}`);
    }

    const srcServiceAccount = require(path.resolve(SOURCE_CREDENTIALS));
    admin.initializeApp({
      credential: admin.credential.cert(srcServiceAccount)
    }, 'source');
    srcDb = admin.app('source').firestore();

    const dstServiceAccount = require(path.resolve(DEST_CREDENTIALS));
    admin.initializeApp({
      credential: admin.credential.cert(dstServiceAccount)
    }, 'destination');
    dstDb = admin.app('destination').firestore();

    console.log('✅ Firebase inicializado para ambos os projetos');
    return true;
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error.message);
    return false;
  }
}

async function copyUserByEmail(email) {
  try {
    console.log(`\n🔍 Buscando usuário: ${email}`);
    
    // Buscar no projeto de origem
    const usersRef = srcDb.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();
    
    if (snapshot.empty) {
      console.log('❌ Usuário não encontrado no projeto de origem');
      return;
    }
    
    snapshot.forEach(async (doc) => {
      const userData = doc.data();
      console.log(`\n📋 Dados do usuário encontrado:`);
      console.log(`   - UID: ${doc.id}`);
      console.log(`   - Email: ${userData.email}`);
      console.log(`   - Nome: ${userData.name || userData.displayName}`);
      console.log(`   - Role: ${userData.role || 'N/A'}`);
      console.log(`   - Tokens: ${userData.tokens || 0}`);
      console.log(`   - Todos os campos:`, Object.keys(userData).join(', '));
      
      // Verificar se já existe no destino
      const destRef = dstDb.collection('users');
      const destSnapshot = await destRef.where('email', '==', email).get();
      
      if (!destSnapshot.empty) {
        console.log(`\n⚠️  Usuário já existe no projeto de destino. Atualizando...`);
        destSnapshot.forEach(async (destDoc) => {
          // Atualizar documento existente
          await destDoc.ref.set(userData, { merge: false }); // Substitui completamente
          console.log(`✅ Usuário atualizado no documento: ${destDoc.id}`);
        });
      } else {
        // Criar novo documento usando o mesmo ID
        const destDocRef = dstDb.collection('users').doc(doc.id);
        await destDocRef.set(userData);
        console.log(`✅ Usuário copiado com ID: ${doc.id}`);
      }
      
      console.log(`\n✅ Processo concluído para ${email}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao copiar usuário:', error);
  }
}

// Obter email da linha de comando
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Uso: node copy-specific-user.js <email>');
  console.log('Exemplo: node copy-specific-user.js cleitondouglass@gmail.com');
  process.exit(1);
}

const email = args[0];

if (!initializeApps()) {
  process.exit(1);
}

copyUserByEmail(email)
  .then(() => {
    console.log('\n✅ Processo concluído!');
    setTimeout(() => {
      admin.app('source').delete();
      admin.app('destination').delete();
      process.exit(0);
    }, 2000);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

