/**
 * Script para importar usuários e seus cargos (roles)
 * Baseado nas imagens fornecidas pelo usuário
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount-dst.json');

// Inicializar Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

// Mapeamento de emails para cargos baseado nas imagens
const usersData = [
  // Página 1
  { email: 'nayrafds@gmail.com', role: 'Usuario', name: 'Nayra França' },
  { email: 'cleitondouglass@gmail.com', role: 'Gerente', name: 'Cleiton Douglas' },
  { email: 'lopeslilian8@gmail.com', role: 'Usuario', name: 'Luis Eduardo Silva' },
  { email: 'ederjunior1909col@gmail.com', role: 'Usuario', name: 'Éder Santos da Silva Junior' },
  { email: 'lucianicolettij5@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'zxjk14390@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'gaara13042005@gmail.com', role: 'Usuario', name: 'João Guilherme Correa castro' },
  { email: 'gilmariofreitas387@gmail.com', role: 'Ceo', name: 'Gilmario Estima de Freitas' },
  { email: 'c4osltda@gmail.com', role: 'Usuario', name: 'MARCELO PEDROSA DE SOUZA' },
  { email: 'agenciaelevarebr123@gmail.com', role: 'Usuario', name: 'TFI' },
  
  // Página 2
  { email: 'flavetyr@gmail.com', role: 'Gerente', name: 'FALL' },
  { email: 'thiagofagner9090@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'mm@gmail.com', role: 'Usuario', name: 'Manuella' },
  { email: 'luizfilipelulipe@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'dudupaludo.gervasio12@gmail.com', role: 'Usuario', name: 'Eduardo Paludo' },
  { email: 'matheuspikenuh@gmail.com', role: 'Usuario', name: 'Matheus Costa Araújo' },
  { email: 'contatogusg@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'matheusmoliveira1709@gmail.com', role: 'Usuario', name: 'Matheus Oliveira' },
  { email: 'vend2417@gmail.com', role: 'Usuario', name: 'Gustavo Marques' },
  { email: 'erikamafort2005@gmail.com', role: 'Usuario', name: 'Erika milena' },
  
  // Página 3
  { email: 'ryandonolacarneiro@gmail.com', role: 'Usuario', name: 'Ryan Donola' },
  { email: 'szsombrasz56@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'freefarifogareu@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'wesley1990jgbr@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'juanpablovieira2025@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'eriksilvaa83@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'diegowalker063@gmail.com', role: 'Usuario', name: 'DIEGO BATISTA DO NASCIMENTO' },
  { email: 'mvzengang888@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'jaineandress@gmail.com', role: 'Design', name: 'JAINE ANDRESSA CANDIDO LEONARDO' },
  { email: 'joaoguilherme6736@gmail.com', role: 'Usuario', name: 'João Guilherme Correa castro' },
  
  // Página 4
  { email: 'tiago.f.machado14@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'luizh3730@gmail.com', role: 'Usuario', name: 'LUIZ HENRIQUE DE SOUSA CARVALHO' },
  { email: 'laurindoruan04@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'davicunha5733@gmail.com', role: 'Usuario', name: 'Davi cunha' },
  { email: 'maysasikanunes552@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'luanmarinho.contato@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'luizgustavcaraujo80@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'kauerikelme2007@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'julia.borges0510@gmail.com', role: 'Usuario', name: 'Júlia Borges Bispo' },
  { email: 'vava.rosa@hotmail.com', role: 'Usuario', name: 'Miguel Rosa dias' },
  
  // Página 5
  { email: 'brayanfelix13051@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'miguelrosadias2022@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'gabrielaphb333@gmail.com', role: 'Usuario', name: 'Gabriela dos Santos Silva' },
  { email: 'cleitondouglass123@hotmail.com', role: 'Desgin', name: 'Cleiton Douglas Miranda da Silva' },
  { email: 'franciscoaugustolopesdasilva@gmail.com', role: 'Usuario', name: 'Francisco Augusto Lopes Da Silva' },
  { email: 'matheusmoliveira1709@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'gabrielaphb333@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'brayanfelix13051@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'miguelrosadias2022@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'cleitondouglass123@hotmail.com', role: 'Desgin', name: 'N/A' },
  
  // Página 6
  { email: 'editsadele056@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'arthurdutra854@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'lucasdavi292009dd@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'nicolasferreiracorteletti2@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'joaovitorsouzadossantos509@gmail.com', role: 'Usuario', name: 'N/A' },
  { email: 'dieguinho.spegoraro@gmail.com', role: 'Usuario', name: 'DIEGO ALCIDES DA SILVA PEGORARO' },
  { email: 'tvl10266@gmail.com', role: 'Usuario', name: 'Leonardo Fellipe Ferreira e Silva' },
  { email: 'washington966@gmail.com', role: 'Usuario', name: 'N/A' },
];

// Normalizar role para o formato padrão
function normalizeRole(role) {
  const roleLower = (role || '').toLowerCase().trim();
  
  // Mapear variações para valores padrão
  if (roleLower === 'usuario' || roleLower === 'usuário') return 'Usuario';
  if (roleLower === 'gerente') return 'Gerente';
  if (roleLower === 'ceo') return 'Ceo';
  if (roleLower === 'design' || roleLower === 'desgin' || roleLower === 'designer') return 'Design';
  if (roleLower === 'admin') return 'Admin';
  if (roleLower === 'sócio' || roleLower === 'socio') return 'Sócio';
  if (roleLower === 'vendedor') return 'Vendedor';
  
  return 'Usuario'; // Default
}

async function importUsersAndRoles() {
  console.log('📦 Importando usuários e cargos...\n');
  
  let created = 0;
  let updated = 0;
  let notFound = 0;
  let errors = 0;
  
  // Remover duplicatas (manter o último)
  const uniqueUsers = new Map();
  usersData.forEach(user => {
    uniqueUsers.set(user.email.toLowerCase(), user);
  });
  
  const uniqueUsersArray = Array.from(uniqueUsers.values());
  console.log(`📊 Total de usuários únicos: ${uniqueUsersArray.length}\n`);
  
  for (const userData of uniqueUsersArray) {
    try {
      const email = userData.email.toLowerCase().trim();
      const normalizedRole = normalizeRole(userData.role);
      
      // Buscar usuário no Auth pelo email
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          console.log(`⚠️  Usuário não encontrado no Auth: ${email}`);
          notFound++;
          continue;
        }
        throw error;
      }
      
      const uid = userRecord.uid;
      
      // Verificar se documento já existe no Firestore
      const userDocRef = db.collection('users').doc(uid);
      const userDoc = await userDocRef.get();
      
      const userDocData = {
        email: email,
        displayName: userData.name !== 'N/A' ? userData.name : userRecord.displayName || email.split('@')[0],
        role: normalizedRole,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (userDoc.exists) {
        // Atualizar documento existente
        const existingData = userDoc.data();
        const existingRole = existingData.role || 'Usuario';
        
        // Só atualizar se o role mudou ou se não tinha role
        if (existingRole !== normalizedRole || !existingData.role) {
          await userDocRef.update(userDocData);
          console.log(`🔄 Atualizado: ${email} - ${existingRole} → ${normalizedRole}`);
          updated++;
        } else {
          console.log(`⏭️  Já atualizado: ${email} - ${normalizedRole}`);
        }
      } else {
        // Criar novo documento
        userDocData.createdAt = admin.firestore.FieldValue.serverTimestamp();
        userDocData.tokens = 0; // Inicializar tokens como 0
        await userDocRef.set(userDocData);
        console.log(`✅ Criado: ${email} - ${normalizedRole}`);
        created++;
      }
    } catch (error) {
      console.error(`❌ Erro ao processar ${userData.email}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Criados: ${created}`);
  console.log(`   🔄 Atualizados: ${updated}`);
  console.log(`   ⚠️  Não encontrados no Auth: ${notFound}`);
  console.log(`   ❌ Erros: ${errors}`);
  console.log(`   📦 Total processado: ${uniqueUsersArray.length}`);
  
  if (notFound > 0) {
    console.log(`\n⚠️  ATENÇÃO: ${notFound} usuários não foram encontrados no Firebase Auth.`);
    console.log(`   Esses usuários precisam se registrar primeiro no sistema.`);
  }
}

async function main() {
  try {
    await importUsersAndRoles();
    console.log('\n✅ Importação concluída!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

main();

