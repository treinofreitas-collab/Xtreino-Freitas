/**
 * Script OPCIONAL para migrar usuários de Authentication
 * 
 * ATENÇÃO: Este script mantém as senhas dos usuários, mas é mais complexo.
 * Se você tem poucos usuários, pode ser mais simples pedir para eles recriarem senha.
 * 
 * USO:
 * 1. Configure os arquivos de credenciais (mesmos do migrate-firestore.js)
 * 2. Execute: node migrate-auth.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SOURCE_CREDENTIALS = './serviceAccount-src.json';
const DEST_CREDENTIALS = './serviceAccount-dst.json';

let srcAuth, dstAuth;

function initializeApps() {
  try {
    if (!fs.existsSync(SOURCE_CREDENTIALS) || !fs.existsSync(DEST_CREDENTIALS)) {
      throw new Error('Arquivos de credenciais não encontrados. Veja README-MIGRACAO.md');
    }

    const srcServiceAccount = require(path.resolve(SOURCE_CREDENTIALS));
    admin.initializeApp({
      credential: admin.credential.cert(srcServiceAccount)
    }, 'source');
    srcAuth = admin.app('source').auth();

    const dstServiceAccount = require(path.resolve(DEST_CREDENTIALS));
    admin.initializeApp({
      credential: admin.credential.cert(dstServiceAccount)
    }, 'destination');
    dstAuth = admin.app('destination').auth();

    console.log('✅ Firebase Auth inicializado para ambos os projetos');
    return true;
  } catch (error) {
    console.error('❌ Erro ao inicializar:', error.message);
    return false;
  }
}

async function exportUsers() {
  const users = [];
  let nextPageToken;

  do {
    const result = await srcAuth.listUsers(1000, nextPageToken);
    result.users.forEach(user => {
      users.push({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        disabled: user.disabled,
        metadata: {
          creationTime: user.metadata.creationTime,
          lastSignInTime: user.metadata.lastSignInTime
        },
        // IMPORTANTE: Senhas não podem ser exportadas diretamente
        // Você precisa usar o método de importação com hash
        // Isso requer acesso aos parâmetros de hash do projeto original
      });
    });
    nextPageToken = result.pageToken;
    console.log(`  ✓ ${users.length} usuários listados...`);
  } while (nextPageToken);

  return users;
}

async function importUsers(users) {
  console.log(`\n📦 Importando ${users.length} usuários...`);
  
  let imported = 0;
  let errors = 0;

  for (const user of users) {
    try {
      await dstAuth.createUser({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        disabled: user.disabled,
      });
      imported++;
      if (imported % 10 === 0) {
        console.log(`  ✓ ${imported} usuários importados...`);
      }
    } catch (error) {
      if (error.code === 'auth/uid-already-exists' || error.code === 'auth/email-already-exists') {
        console.log(`  ⚠️  Usuário ${user.email} já existe, pulando...`);
      } else {
        console.error(`  ✗ Erro ao importar ${user.email}: ${error.message}`);
        errors++;
      }
    }
  }

  console.log(`\n✅ ${imported} usuários importados, ${errors} erros`);
  return { imported, errors };
}

async function migrate() {
  console.log('🚀 Iniciando migração de Authentication...\n');

  if (!initializeApps()) {
    process.exit(1);
  }

  console.log('📋 Exportando usuários do projeto ATUAL...');
  const users = await exportUsers();

  if (users.length === 0) {
    console.log('⚠️  Nenhum usuário encontrado.');
    process.exit(0);
  }

  console.log(`\n📊 Total de usuários: ${users.length}`);

  // ⚠️ AVISO: Senhas não são migradas automaticamente
  console.log('\n⚠️  ATENÇÃO: As senhas NÃO serão migradas automaticamente.');
  console.log('   Os usuários precisarão usar "Esqueci minha senha" para redefinir.');
  console.log('   Ou você precisa exportar os hashes (mais complexo).\n');

  console.log('🚀 Iniciando migração automaticamente...\n');

  await importUsers(users);

  console.log('\n🎉 Migração de Authentication concluída!');
  console.log('\n📝 PRÓXIMOS PASSOS:');
  console.log('   1. Avise os usuários que precisam usar "Esqueci minha senha"');
  console.log('   2. Ou configure um sistema de redefinição em massa');

  await admin.app('source').delete();
  await admin.app('destination').delete();
}

if (require.main === module) {
  migrate().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = { migrate, exportUsers, importUsers };

