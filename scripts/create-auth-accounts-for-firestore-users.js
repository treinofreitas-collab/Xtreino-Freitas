/**
 * Script para criar contas no Firebase Auth para usuários que existem no Firestore
 * mas não no Auth. Isso resolve o problema de contas vazias sendo criadas.
 * 
 * USO:
 * node create-auth-accounts-for-firestore-users.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount-dst.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

// Função para gerar senha temporária
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function createAuthAccountsForFirestoreUsers() {
  try {
    console.log('🚀 Iniciando criação de contas Auth para usuários do Firestore...\n');
    
    // Buscar todos os usuários do Firestore
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    console.log(`📊 Total de usuários no Firestore: ${snapshot.size}\n`);
    
    let created = 0;
    let alreadyExists = 0;
    let errors = 0;
    let noEmail = 0;
    const usersToNotify = []; // Usuários que precisam redefinir senha
    
    for (const doc of snapshot.docs) {
      try {
        const userData = doc.data();
        const email = userData.email;
        const uid = doc.id; // Usar o ID do documento como UID preferencial
        
        if (!email) {
          console.log(`⚠️  Usuário ${doc.id} não tem email, pulando...`);
          noEmail++;
          continue;
        }
        
        console.log(`\n👤 Processando: ${email}`);
        console.log(`   UID do documento: ${uid}`);
        console.log(`   Nome: ${userData.name || userData.displayName || 'N/A'}`);
        console.log(`   Role: ${userData.role || 'N/A'}`);
        console.log(`   Tokens: ${userData.tokens || 0}`);
        
        // Verificar se usuário já existe no Auth
        let authUser;
        try {
          authUser = await auth.getUserByEmail(email);
          console.log(`   ✅ Já existe no Auth (UID: ${authUser.uid})`);
          
          // Se o UID do Auth é diferente do UID do documento, atualizar o documento
          if (authUser.uid !== uid) {
            console.log(`   🔄 UIDs diferentes! Auth: ${authUser.uid}, Firestore: ${uid}`);
            console.log(`   ⚠️  Mantendo Auth UID (${authUser.uid}) e atualizando Firestore...`);
            
            // Atualizar documento no Firestore para usar o UID do Auth
            const authUidRef = db.collection('users').doc(authUser.uid);
            const authUidDoc = await authUidRef.get();
            
            if (!authUidDoc.exists) {
              // Criar documento com UID do Auth
              await authUidRef.set({
                ...userData,
                uid: authUser.uid,
                migratedFrom: uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              console.log(`   ✅ Documento criado com UID do Auth`);
              
              // Opcional: deletar documento antigo se quiser
              // await db.collection('users').doc(uid).delete();
            } else {
              // Mesclar dados
              await authUidRef.update({
                ...userData,
                uid: authUser.uid,
                migratedFrom: uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              console.log(`   ✅ Documento atualizado com dados do Firestore`);
            }
          }
          
          alreadyExists++;
          continue;
        } catch (error) {
          if (error.code !== 'auth/user-not-found') {
            throw error;
          }
        }
        
        // Usuário não existe no Auth, criar
        console.log(`   🔨 Criando conta no Auth...`);
        
        try {
          // Validar número de telefone (formato E.164)
          let phoneNumber = null;
          if (userData.phone) {
            const phone = String(userData.phone).trim();
            // Verificar se está no formato E.164 (começa com +)
            if (phone.startsWith('+') && phone.length >= 10) {
              phoneNumber = phone;
            } else if (/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) {
              // Tentar converter para E.164 (assumindo Brasil +55)
              const digits = phone.replace(/\D/g, '');
              if (digits.length >= 10) {
                phoneNumber = `+55${digits}`;
              }
            }
            // Se não for válido, deixar null
          }
          
          // Validar photoURL (deve ser URL válida ou null)
          let photoURL = null;
          if (userData.photoURL) {
            try {
              const url = String(userData.photoURL).trim();
              if (url.startsWith('http://') || url.startsWith('https://')) {
                new URL(url); // Valida se é URL válida
                photoURL = url;
              }
            } catch (_) {
              // URL inválida, deixar null
            }
          }
          
          // Preparar objeto de criação (só incluir campos válidos)
          const createData = {
            uid: uid,
            email: email,
            emailVerified: false,
            displayName: userData.name || userData.displayName || email.split('@')[0],
            disabled: false
          };
          
          // Só adicionar photoURL se for válido
          if (photoURL) {
            createData.photoURL = photoURL;
          }
          
          // Só adicionar phoneNumber se for válido
          if (phoneNumber) {
            createData.phoneNumber = phoneNumber;
          }
          
          // Tentar criar com o UID do documento
          const newUser = await auth.createUser(createData);
          
          // Gerar senha temporária
          const tempPassword = generateTempPassword();
          await auth.updateUser(newUser.uid, {
            password: tempPassword
          });
          
          console.log(`   ✅ Conta criada no Auth (UID: ${newUser.uid})`);
          console.log(`   🔑 Senha temporária gerada`);
          
          // Adicionar à lista de usuários que precisam redefinir senha
          usersToNotify.push({
            email: email,
            tempPassword: tempPassword,
            name: userData.name || userData.displayName || email.split('@')[0]
          });
          
          // Atualizar documento no Firestore para garantir que tem o UID correto
          await doc.ref.update({
            uid: newUser.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          created++;
        } catch (createError) {
          if (createError.code === 'auth/uid-already-exists') {
            // UID já existe, tentar criar sem UID específico
            console.log(`   ⚠️  UID já existe, criando sem UID específico...`);
            
            // Validar número de telefone (formato E.164)
            let phoneNumber = null;
            if (userData.phone) {
              const phone = String(userData.phone).trim();
              if (phone.startsWith('+') && phone.length >= 10) {
                phoneNumber = phone;
              } else if (/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) {
                const digits = phone.replace(/\D/g, '');
                if (digits.length >= 10) {
                  phoneNumber = `+55${digits}`;
                }
              }
            }
            
            // Validar photoURL (deve ser URL válida ou null)
            let photoURL = null;
            if (userData.photoURL) {
              try {
                const url = String(userData.photoURL).trim();
                if (url.startsWith('http://') || url.startsWith('https://')) {
                  new URL(url); // Valida se é URL válida
                  photoURL = url;
                }
              } catch (_) {
                // URL inválida, deixar null
              }
            }
            
            // Preparar objeto de criação (só incluir campos válidos)
            const createData2 = {
              email: email,
              emailVerified: false,
              displayName: userData.name || userData.displayName || email.split('@')[0],
              disabled: false
            };
            
            // Só adicionar photoURL se for válido
            if (photoURL) {
              createData2.photoURL = photoURL;
            }
            
            // Só adicionar phoneNumber se for válido
            if (phoneNumber) {
              createData2.phoneNumber = phoneNumber;
            }
            
            const newUser = await auth.createUser(createData2);
            
            const tempPassword = generateTempPassword();
            await auth.updateUser(newUser.uid, {
              password: tempPassword
            });
            
            console.log(`   ✅ Conta criada no Auth (UID: ${newUser.uid})`);
            
            // Atualizar documento no Firestore com o novo UID
            await doc.ref.update({
              uid: newUser.uid,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            usersToNotify.push({
              email: email,
              tempPassword: tempPassword,
              name: userData.name || userData.displayName || email.split('@')[0]
            });
            
            created++;
          } else {
            throw createError;
          }
        }
        
      } catch (error) {
        console.error(`   ❌ Erro ao processar ${doc.id}:`, error.message);
        errors++;
      }
    }
    
    // Resumo
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMO');
    console.log('='.repeat(50));
    console.log(`✅ Contas criadas: ${created}`);
    console.log(`⏭️  Já existiam: ${alreadyExists}`);
    console.log(`⚠️  Sem email: ${noEmail}`);
    console.log(`❌ Erros: ${errors}`);
    console.log(`📦 Total processado: ${snapshot.size}`);
    
    if (usersToNotify.length > 0) {
      console.log('\n' + '='.repeat(50));
      console.log('📧 USUÁRIOS QUE PRECISAM REDEFINIR SENHA');
      console.log('='.repeat(50));
      console.log('\n⚠️  IMPORTANTE: Esses usuários precisam usar "Recuperar Senha" no site.');
      console.log('   As senhas temporárias foram geradas mas não foram enviadas por email.\n');
      
      // Salvar em arquivo para referência
      const fs = require('fs');
      const passwordsFile = 'temp-passwords.json';
      fs.writeFileSync(passwordsFile, JSON.stringify(usersToNotify, null, 2));
      console.log(`📄 Senhas temporárias salvas em: ${passwordsFile}`);
      console.log(`   (Este arquivo contém senhas temporárias - mantenha seguro!)\n`);
    }
    
    console.log('\n✅ Processo concluído!');
    console.log('\n💡 PRÓXIMOS PASSOS:');
    console.log('   1. Os usuários devem usar "Recuperar Senha" no site');
    console.log('   2. Ou você pode enviar as senhas temporárias manualmente');
    console.log('   3. Após o primeiro login, eles devem redefinir a senha\n');
    
  } catch (error) {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  }
}

// Executar
createAuthAccountsForFirestoreUsers()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

