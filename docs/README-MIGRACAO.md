# 📦 Guia de Migração do Firestore (SEM Blaze)

Este script copia todos os dados do Firestore de um projeto para outro **sem precisar do plano Blaze**.

## 📋 Pré-requisitos

1. **Node.js instalado** (versão 14 ou superior)
   - Baixe em: https://nodejs.org/

2. **Acesso aos dois projetos Firebase**
   - Projeto ATUAL (de onde vem os dados)
   - Projeto NOVO (para onde vai os dados)

3. **Credenciais de Service Account** de ambos os projetos

---

## 🔑 Passo 1: Obter Credenciais do Projeto ATUAL

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione o **projeto ATUAL** (onde estão os dados agora)
3. Vá em **Configurações do Projeto** (ícone de engrenagem)
4. Aba **Contas de serviço**
5. Clique em **Gerar nova chave privada**
6. Baixe o arquivo JSON (ex: `xtreino-atual-abc123.json`)
7. Renomeie para `serviceAccount-src.json` e coloque na pasta do projeto

---

## 🔑 Passo 2: Obter Credenciais do Projeto NOVO

1. No Firebase Console, selecione o **projeto NOVO** (do dono)
2. Repita os passos acima
3. Baixe o JSON e renomeie para `serviceAccount-dst.json`
4. Coloque na mesma pasta do projeto

**⚠️ IMPORTANTE:** O projeto NOVO precisa ter o **Firestore criado** (pode estar vazio, mas precisa existir).

---

## 📦 Passo 3: Instalar Dependências

Abra o terminal na pasta do projeto e execute:

```bash
npm install firebase-admin
```

---

## 🚀 Passo 4: Executar a Migração

No terminal, execute:

```bash
node migrate-firestore.js
```

O script vai:
- ✅ Conectar nos dois projetos
- ✅ Listar todas as coleções
- ✅ Copiar cada documento (em lotes de 500)
- ✅ Mostrar progresso em tempo real
- ✅ Exibir resumo final

---

## 📊 Coleções que serão migradas

- `users` - Todos os usuários
- `orders` - Todos os pedidos
- `registrations` - Todas as inscrições/agendamentos
- `schedule_overrides` - Travas e ocupações extras
- `whatsapp_links` - Links do WhatsApp
- `news` - Notícias
- `highlights` - Destaques

---

## ⚠️ O que NÃO é migrado automaticamente

1. **Usuários de Authentication (login)**
   - O script copia a coleção `users`, mas os logins (email/senha) precisam ser migrados separadamente
   - Veja a seção abaixo sobre migração de Authentication

2. **Regras do Firestore**
   - Copie manualmente o arquivo `firestore.rules` e faça deploy no projeto novo:
     ```bash
     firebase deploy --only firestore:rules --project PROJETO_NOVO
     ```

3. **Índices compostos**
   - Se você criou índices personalizados, recrie-os no projeto novo
   - Vá em Firestore → Índices e recrie manualmente

4. **Storage (imagens)**
   - Se você usa imagens no Firebase Storage, precisa copiar separadamente
   - Veja seção abaixo

---

## 🔐 Migração de Authentication (usuários de login)

O script `migrate-firestore.js` **NÃO migra** os usuários de login (email/senha). Você tem duas opções:

### Opção A: Pedir para usuários recriarem senha (mais simples) ⭐ RECOMENDADO

Se a base de usuários é pequena, avise que o site foi migrado e eles precisam criar senha novamente. A coleção `users` já foi copiada, então os dados deles (tokens, perfil) continuam lá.

### Opção B: Usar o script migrate-auth.js (migra usuários, mas não senhas)

Execute o script adicional:

```bash
node migrate-auth.js
```

**⚠️ IMPORTANTE:** Este script migra os usuários (email, nome, etc.), mas **NÃO migra as senhas**. Os usuários precisarão usar "Esqueci minha senha" para redefinir.

**Para manter as senhas:** Isso é muito mais complexo e requer acesso aos parâmetros de hash do projeto original. Geralmente não vale a pena - é mais simples pedir para redefinirem.

---

## 🖼️ Migração de Storage (imagens/banners)

Se você usa Firebase Storage para guardar imagens:

1. **No projeto ATUAL:**
   ```bash
   gsutil -m rsync -r gs://PROJETO_ATUAL.appspot.com gs://PROJETO_NOVO.appspot.com
   ```

2. **Atualizar URLs no Firestore:**
   - Se as URLs mudaram, você precisa atualizar os documentos que referenciam essas imagens
   - Exemplo: se `news` tem campo `imageUrl`, atualize para o novo bucket

---

## 🔧 Depois da Migração

1. **Atualizar o código do site:**
   - Substitua o `firebaseConfig` em `script.js`, `admin.js`, etc.
   - Pegue as novas chaves em: Firebase Console → Configurações do Projeto → Configuração do SDK Web

2. **Atualizar Netlify Functions:**
   - Se suas funções usam Service Account, atualize a variável de ambiente
   - Ou use o novo arquivo `serviceAccount-dst.json`

3. **Testar tudo:**
   - Login
   - Agendamentos
   - Painel admin
   - Webhooks de pagamento

---

## ❓ Problemas Comuns

### "Arquivo de credenciais não encontrado"
- Verifique se os arquivos `serviceAccount-src.json` e `serviceAccount-dst.json` estão na pasta do projeto
- Verifique se os nomes estão corretos

### "Permission denied"
- Verifique se as Service Accounts têm permissão de **Editor** ou **Owner** nos projetos
- No Firebase Console → IAM & Admin, adicione a service account com permissão adequada

### "Collection not found"
- Normal, algumas coleções podem não existir
- O script ignora coleções vazias

### Script muito lento
- Normal para bases grandes
- O script processa em lotes de 500 documentos
- Pode levar alguns minutos dependendo do tamanho

---

## 📞 Precisa de Ajuda?

Se encontrar algum problema, me avise com:
- Mensagem de erro completa
- Quantos documentos tem em cada coleção (aproximado)
- Se conseguiu gerar as Service Accounts

---

## ✅ Checklist Final

- [ ] Service Account do projeto ATUAL baixada (`serviceAccount-src.json`)
- [ ] Service Account do projeto NOVO baixada (`serviceAccount-dst.json`)
- [ ] `npm install firebase-admin` executado
- [ ] Script executado com sucesso
- [ ] Regras do Firestore copiadas
- [ ] `firebaseConfig` atualizado no código
- [ ] Testes realizados
- [ ] Site funcionando no projeto novo

---

**Boa migração! 🚀**

