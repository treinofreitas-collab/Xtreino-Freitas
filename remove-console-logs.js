/**
 * Script para remover todos os console.log, console.debug, console.info, console.warn
 * dos arquivos JavaScript principais
 */

const fs = require('fs');
const path = require('path');

const files = [
  'admin.js',
  'client.js',
  'script.js'
];

function removeConsoleLogs(content) {
  // Remove console.log, console.debug, console.info, console.warn
  // Incluindo casos multi-linha e com diferentes formatos
  
  let result = content;
  
  // Padrão 1: console.log(...); em uma linha
  result = result.replace(/console\.(log|debug|info|warn)\([^;]*?\);?\s*/g, '');
  
  // Padrão 2: console.log(...) em múltiplas linhas (até encontrar ; ou })
  result = result.replace(/console\.(log|debug|info|warn)\([^)]*?\)\s*;?\s*/g, '');
  
  // Padrão 3: console.log com template strings e objetos complexos
  result = result.replace(/console\.(log|debug|info|warn)\([^)]*(?:\([^)]*\))*[^)]*\)\s*;?\s*/g, '');
  
  // Remover linhas vazias duplicadas (máximo 2 linhas vazias seguidas)
  result = result.replace(/\n\s*\n\s*\n+/g, '\n\n');
  
  return result;
}

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Arquivo não encontrado: ${file}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalLength = content.length;
    
    content = removeConsoleLogs(content);
    
    fs.writeFileSync(filePath, content, 'utf8');
    
    const removed = originalLength - content.length;
    console.log(`✅ ${file}: Removidos ~${removed} caracteres de logs`);
  } catch (error) {
    console.error(`❌ Erro ao processar ${file}:`, error.message);
  }
});

console.log('\n✅ Processo concluído!');

