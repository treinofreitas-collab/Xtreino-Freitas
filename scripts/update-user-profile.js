/**
 * Script para atualizar perfil de usuário no Firestore
 * 
 * USO:
 * node update-user-profile.js <email> <role> <tokens>
 * 
 * Exemplo:
 * node update-user-profile.js cleitondouglass@gmail.com Ceo 150
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount-dst.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateUserProfile(email, role, tokens) {
  try {
    console.log(`\n🔍 Buscando usuário: ${email}`);
    
    // Buscar usuário por email
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();
    
    if (snapshot.empty) {
      console.log('❌ Usuário não encontrado no Firestore');
      return;
    }
    
    snapshot.forEach(async (doc) => {
      const userData = doc.data();
      console.log(`\n📋 Dados atuais do usuário:`);
      console.log(`   - Role: ${userData.role || 'N/A'}`);
      console.log(`   - Tokens: ${userData.tokens || 0}`);
      console.log(`   - UID: ${doc.id}`);
      
      const updates = {};
      if (role) {
        updates.role = role;
        console.log(`\n✅ Atualizando role para: ${role}`);
      }
      if (tokens !== undefined && tokens !== null) {
        updates.tokens = Number(tokens);
        console.log(`✅ Atualizando tokens para: ${tokens}`);
      }
      
      if (Object.keys(updates).length > 0) {
        await doc.ref.update(updates);
        console.log(`\n✅ Perfil atualizado com sucesso!`);
        console.log(`\n📋 Novos dados:`);
        if (updates.role) console.log(`   - Role: ${updates.role}`);
        if (updates.tokens !== undefined) console.log(`   - Tokens: ${updates.tokens}`);
      } else {
        console.log(`\n⚠️  Nenhuma atualização necessária`);
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao atualizar perfil:', error);
  }
}

// Obter argumentos da linha de comando
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Uso: node update-user-profile.js <email> [role] [tokens]');
  console.log('Exemplo: node update-user-profile.js cleitondouglass@gmail.com Ceo 150');
  process.exit(1);
}

const email = args[0];
const role = args[1] || null;
const tokens = args[2] !== undefined ? args[2] : null;

updateUserProfile(email, role, tokens)
  .then(() => {
    console.log('\n✅ Processo concluído!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

