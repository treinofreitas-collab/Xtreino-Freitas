/**
 * Script para migrar dados do Firestore de um projeto para outro
 * SEM precisar do plano Blaze
 * 
 * USO:
 * 1. Instale as dependências: npm install firebase-admin
 * 2. Configure os arquivos de credenciais (veja README-MIGRACAO.md)
 * 3. Execute: node migrate-firestore.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ===== CONFIGURAÇÃO =====
// Substitua pelos caminhos dos seus arquivos de credenciais JSON
const SOURCE_CREDENTIALS = './serviceAccount-src.json'; // Projeto ATUAL (de onde vem)
const DEST_CREDENTIALS = './serviceAccount-dst.json';   // Projeto NOVO (para onde vai)

// Coleções conhecidas (será expandido automaticamente se houver mais)
const KNOWN_COLLECTIONS = [
  'users',
  'orders',
  'registrations',
  'schedule_overrides',
  'whatsapp_links',
  'news',
  'highlights'
];

// ===== INICIALIZAÇÃO =====
let srcDb, dstDb;

function initializeApps() {
  try {
    // Verificar se os arquivos de credenciais existem
    if (!fs.existsSync(SOURCE_CREDENTIALS)) {
      throw new Error(`Arquivo de credenciais não encontrado: ${SOURCE_CREDENTIALS}`);
    }
    if (!fs.existsSync(DEST_CREDENTIALS)) {
      throw new Error(`Arquivo de credenciais não encontrado: ${DEST_CREDENTIALS}`);
    }

    // Inicializar projeto de origem
    const srcServiceAccount = require(path.resolve(SOURCE_CREDENTIALS));
    admin.initializeApp({
      credential: admin.credential.cert(srcServiceAccount)
    }, 'source');
    srcDb = admin.app('source').firestore();

    // Inicializar projeto de destino
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

// ===== FUNÇÕES DE MIGRAÇÃO =====

/**
 * Lista todas as coleções do projeto de origem
 */
async function listAllCollections() {
  const collections = [];
  try {
    // Firestore não tem API direta para listar coleções, então tentamos as conhecidas
    // e verificamos se existem documentos
    for (const colName of KNOWN_COLLECTIONS) {
      try {
        const snapshot = await srcDb.collection(colName).limit(1).get();
        if (!snapshot.empty) {
          collections.push(colName);
          console.log(`  ✓ Encontrada: ${colName}`);
        }
      } catch (err) {
        // Coleção pode não existir ou sem permissão, ignora
      }
    }
    return collections;
  } catch (error) {
    console.error('Erro ao listar coleções:', error);
    return KNOWN_COLLECTIONS; // Fallback: tenta todas conhecidas
  }
}

/**
 * Copia uma coleção completa (sem subcoleções por enquanto)
 */
async function copyCollection(collectionName, batchSize = 500) {
  try {
    console.log(`\n📦 Copiando coleção: ${collectionName}`);
    
    let lastDoc = null;
    let totalCopied = 0;
    let totalErrors = 0;

    while (true) {
      // Buscar em lotes
      let query = srcDb.collection(collectionName).limit(batchSize);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      
      if (snapshot.empty) {
        break; // Fim da coleção
      }

      // Preparar batch de escrita
      const batch = dstDb.batch();
      let batchCount = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const docRef = dstDb.collection(collectionName).doc(doc.id);
        batch.set(docRef, data);
        batchCount++;
        lastDoc = doc;
      });

      // Escrever batch
      if (batchCount > 0) {
        try {
          await batch.commit();
          totalCopied += batchCount;
          console.log(`  ✓ ${totalCopied} documentos copiados...`);
        } catch (err) {
          console.error(`  ✗ Erro no batch: ${err.message}`);
          totalErrors += batchCount;
        }
      }

      // Se retornou menos que o limite, chegamos ao fim
      if (snapshot.size < batchSize) {
        break;
      }
    }

    console.log(`✅ ${collectionName}: ${totalCopied} documentos copiados, ${totalErrors} erros`);
    return { collection: collectionName, copied: totalCopied, errors: totalErrors };
  } catch (error) {
    console.error(`❌ Erro ao copiar ${collectionName}:`, error.message);
    return { collection: collectionName, copied: 0, errors: 1 };
  }
}

/**
 * Função principal de migração
 */
async function migrate() {
  console.log('🚀 Iniciando migração do Firestore...\n');

  if (!initializeApps()) {
    process.exit(1);
  }

  // Listar coleções
  console.log('📋 Listando coleções...');
  const collections = await listAllCollections();

  if (collections.length === 0) {
    console.log('⚠️  Nenhuma coleção encontrada. Verifique as permissões.');
    process.exit(1);
  }

  console.log(`\n📊 Total de coleções a migrar: ${collections.length}\n`);

  // Copiar cada coleção
  const results = [];
  for (const colName of collections) {
    const result = await copyCollection(colName);
    results.push(result);
    
    // Pequena pausa para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Resumo final
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMO DA MIGRAÇÃO');
  console.log('='.repeat(50));
  let totalCopied = 0;
  let totalErrors = 0;
  
  results.forEach(r => {
    console.log(`  ${r.collection}: ${r.copied} documentos, ${r.errors} erros`);
    totalCopied += r.copied;
    totalErrors += r.errors;
  });
  
  console.log('='.repeat(50));
  console.log(`✅ Total: ${totalCopied} documentos copiados`);
  if (totalErrors > 0) {
    console.log(`⚠️  ${totalErrors} erros encontrados`);
  }
  console.log('\n🎉 Migração concluída!');
  
  // Limpar apps
  await admin.app('source').delete();
  await admin.app('destination').delete();
}

// ===== EXECUTAR =====
if (require.main === module) {
  migrate().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = { migrate, copyCollection };

