/**
 * Script para criar contas no Firebase Auth para usuários que têm tokens no Firestore
 * mas não existem no Firebase Authentication
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount-dst.json');

// Inicializar Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

// Função para gerar senha temporária
function generateTempPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function findUsersWithTokens() {
  console.log('🔍 Buscando usuários com tokens no Firestore...\n');
  
  // Buscar todos os documentos em 'users' que têm tokens > 0
  const usersSnapshot = await db.collection('users').get();
  const usersWithTokens = [];
  
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    const tokens = Number(data.tokens || 0);
    const email = data.email;
    
    if (tokens > 0 && email) {
      usersWithTokens.push({
        docId: doc.id,
        email: email.toLowerCase().trim(),
        tokens: tokens,
        displayName: data.displayName || data.name || email.split('@')[0],
        role: data.role || 'Usuario',
        existingData: data
      });
    }
  });
  
  console.log(`📊 Encontrados ${usersWithTokens.length} usuários com tokens no Firestore\n`);
  return usersWithTokens;
}

async function findUsersFromOrders() {
  console.log('🔍 Buscando usuários em orders (compras de tokens)...\n');
  
  // Buscar em orders por compras de tokens
  const ordersSnapshot = await db.collection('orders')
    .where('status', 'in', ['paid', 'approved', 'confirmed'])
    .get();
  
  const usersFromOrders = new Map();
  
  ordersSnapshot.forEach(doc => {
    const order = doc.data();
    const title = (order.title || '').toLowerCase();
    const description = (order.description || '').toLowerCase();
    
    // Verificar se é compra de token
    if (title.includes('token') || description.includes('token')) {
      const email = (order.customer || order.buyerEmail || order.email || '').toLowerCase().trim();
      
      if (email) {
        if (!usersFromOrders.has(email)) {
          usersFromOrders.set(email, {
            email: email,
            orders: []
          });
        }
        usersFromOrders.get(email).orders.push(order);
      }
    }
  });
  
  console.log(`📊 Encontrados ${usersFromOrders.size} emails únicos em orders de tokens\n`);
  return Array.from(usersFromOrders.values());
}

async function createAuthUser(email, displayName) {
  try {
    // Tentar criar usuário no Auth
    const userRecord = await auth.createUser({
      email: email,
      displayName: displayName,
      emailVerified: false,
      disabled: false
    });
    
    return { success: true, uid: userRecord.uid, userRecord };
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      // Usuário já existe, buscar o UID
      try {
        const userRecord = await auth.getUserByEmail(email);
        return { success: true, uid: userRecord.uid, userRecord, alreadyExists: true };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: error.message };
  }
}

async function migrateUserDocument(oldDocId, newUid, userData) {
  try {
    // Verificar se já existe documento com o novo UID
    const newDocRef = db.collection('users').doc(newUid);
    const newDoc = await newDocRef.get();
    
    if (newDoc.exists) {
      // Documento já existe, mesclar dados (preservar tokens)
      const existingData = newDoc.data();
      const existingTokens = Number(existingData.tokens || 0);
      const newTokens = Number(userData.tokens || 0);
      
      // Usar o maior valor de tokens
      const finalTokens = Math.max(existingTokens, newTokens);
      
      await newDocRef.update({
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        tokens: finalTokens,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`   🔄 Documento atualizado (tokens: ${finalTokens})`);
    } else {
      // Criar novo documento com o UID do Auth
      await newDocRef.set({
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        tokens: userData.tokens,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`   ✅ Documento criado com UID do Auth`);
    }
    
    // Se o documento antigo tem um ID diferente do UID, deletar o antigo
    if (oldDocId !== newUid) {
      const oldDocRef = db.collection('users').doc(oldDocId);
      const oldDoc = await oldDocRef.get();
      
      if (oldDoc.exists) {
        // Verificar se não é o mesmo documento
        const oldData = oldDoc.data();
        if (oldData.email === userData.email) {
          await oldDocRef.delete();
          console.log(`   🗑️  Documento antigo removido (${oldDocId})`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error(`   ❌ Erro ao migrar documento:`, error.message);
    return false;
  }
}

async function processUsers() {
  console.log('🚀 Iniciando processo de criação de usuários...\n');
  
  // 1. Buscar usuários com tokens no Firestore
  const usersWithTokens = await findUsersWithTokens();
  
  // 2. Buscar usuários de orders
  const usersFromOrders = await findUsersFromOrders();
  
  // Combinar e remover duplicatas
  const allUsers = new Map();
  
  usersWithTokens.forEach(user => {
    allUsers.set(user.email, {
      ...user,
      source: 'firestore'
    });
  });
  
  usersFromOrders.forEach(user => {
    if (!allUsers.has(user.email)) {
      allUsers.set(user.email, {
        email: user.email,
        tokens: 0, // Será calculado depois
        displayName: user.email.split('@')[0],
        role: 'Usuario',
        source: 'orders',
        orders: user.orders
      });
    }
  });
  
  console.log(`📊 Total de usuários únicos para processar: ${allUsers.size}\n`);
  
  let created = 0;
  let updated = 0;
  let alreadyExists = 0;
  let errors = 0;
  const passwords = []; // Armazenar senhas temporárias
  
  for (const [email, userData] of allUsers) {
    try {
      console.log(`\n👤 Processando: ${email}`);
      console.log(`   Tokens: ${userData.tokens || 0}`);
      
      // Verificar se usuário existe no Auth
      let authResult;
      try {
        const existingUser = await auth.getUserByEmail(email);
        console.log(`   ✅ Já existe no Auth (UID: ${existingUser.uid})`);
        authResult = { success: true, uid: existingUser.uid, alreadyExists: true };
        alreadyExists++;
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          // Criar usuário no Auth
          console.log(`   🔨 Criando conta no Auth...`);
          authResult = await createAuthUser(email, userData.displayName);
          
          if (authResult.success) {
            if (authResult.alreadyExists) {
              alreadyExists++;
            } else {
              created++;
              // Gerar senha temporária
              const tempPassword = generateTempPassword();
              await auth.updateUser(authResult.uid, {
                password: tempPassword
              });
              passwords.push({ email, password: tempPassword });
              console.log(`   ✅ Conta criada no Auth (UID: ${authResult.uid})`);
            }
          } else {
            console.error(`   ❌ Erro ao criar conta: ${authResult.error}`);
            errors++;
            continue;
          }
        } else {
          console.error(`   ❌ Erro ao verificar usuário: ${error.message}`);
          errors++;
          continue;
        }
      }
      
      // Migrar/atualizar documento no Firestore
      const docId = userData.docId || authResult.uid;
      const migrated = await migrateUserDocument(docId, authResult.uid, {
        email: email,
        displayName: userData.displayName,
        role: userData.role,
        tokens: userData.tokens || 0
      });
      
      if (migrated) {
        if (authResult.alreadyExists) {
          // Não incrementar updated aqui, já foi contado em alreadyExists
        } else {
          updated++;
        }
      }
      
    } catch (error) {
      console.error(`   ❌ Erro ao processar ${email}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n\n📊 RESUMO FINAL:`);
  console.log(`   ✅ Contas criadas no Auth: ${created}`);
  console.log(`   🔄 Documentos atualizados: ${updated}`);
  console.log(`   ⏭️  Já existiam: ${alreadyExists}`);
  console.log(`   ❌ Erros: ${errors}`);
  console.log(`   📦 Total processado: ${allUsers.size}`);
  
  if (passwords.length > 0) {
    console.log(`\n\n🔑 SENHAS TEMPORÁRIAS GERADAS:`);
    console.log(`   (Salve essas senhas! Os usuários precisarão fazer reset de senha)`);
    passwords.forEach(({ email, password }) => {
      console.log(`   ${email}: ${password}`);
    });
    console.log(`\n   ⚠️  IMPORTANTE: Esses usuários precisarão usar "Esqueci minha senha" para definir uma senha.`);
  }
}

async function main() {
  try {
    await processUsers();
    console.log('\n✅ Processo concluído!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

main();

