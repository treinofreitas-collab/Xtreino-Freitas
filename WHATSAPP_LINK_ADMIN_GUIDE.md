# 🔗 Guia: Gerenciar Links do WhatsApp no Firestore

## 📍 Como Acessar

1. Abra [Firebase Console](https://console.firebase.google.com)
2. Selecione o projeto `Xtreino-Freitas`
3. Clique em **Firestore Database**
4. No painel esquerdo, procure por **`whatsapp_links`**

---

## ✅ Estrutura Esperada

Cada documento em `whatsapp_links` deve ter:

```javascript
{
  // ✅ Obrigatório
  eventType: "xtreino-tokens" | "modo-liga" | "semanal-freitas" | "camp-freitas" | "xtreino-gratuito",
  link: "https://chat.whatsapp.com/XXXXXXXXXXXXXX",
  status: "active" | "inactive",
  
  // ✅ Obrigatório (pode ser null para link geral)
  schedule: "14h" | "19h" | "20h" | null,
  
  // 📌 Opcional (mas recomendado)
  createdAt: timestamp,
  updatedAt: timestamp,
  description: "Link do grupo de X-treino"
}
```

---

## 🆕 Adicionar Novo Link

### Método 1: Via Firestore Console

1. Abra **Firestore Database**
2. Clique em **whatsapp_links** (se não existir, crie a collection)
3. Clique em **"➕ Adicionar documento"**
4. Escolha **"Gerar ID automático"**
5. Preencha os campos:

```
eventType: "xtreino-tokens"
link: "https://chat.whatsapp.com/XXXXX..."
schedule: null
status: "active"
```

6. Clique **Salvar**

---

### Método 2: Via Admin Script (Recomendado)

Se tiver acesso ao Node.js:

```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

async function addWhatsAppLink(eventType, schedule, link) {
    try {
        const docRef = await db.collection('whatsapp_links').add({
            eventType: eventType,
            schedule: schedule || null,  // null para link geral
            link: link,
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Link adicionado com ID:', docRef.id);
        console.log(`   Evento: ${eventType}`);
        console.log(`   Horário: ${schedule || 'Geral'}`);
        console.log(`   Link: ${link}`);
    } catch (error) {
        console.error('❌ Erro ao adicionar link:', error);
    }
}

// Exemplos de uso:
await addWhatsAppLink('xtreino-tokens', null, 'https://chat.whatsapp.com/ABC123');
await addWhatsAppLink('modo-liga', '19h', 'https://chat.whatsapp.com/DEF456');
await addWhatsAppLink('semanal-freitas', null, 'https://chat.whatsapp.com/GHI789');
```

---

## 📝 Exemplos de Documentos

### Exemplo 1: Link Geral para Tokens
```javascript
{
  eventType: "xtreino-tokens",
  schedule: null,  // null significa "link geral para qualquer horário"
  link: "https://chat.whatsapp.com/L0Kxxx...",
  status: "active",
  description: "Grupo principal de X-treino",
  createdAt: 2024-12-12T10:00:00Z,
  updatedAt: 2024-12-12T10:00:00Z
}
```

### Exemplo 2: Link Específico para Horário
```javascript
{
  eventType: "modo-liga",
  schedule: "19h",  // Específico para as 19h
  link: "https://chat.whatsapp.com/M1Pyyy...",
  status: "active",
  description: "Grupo Modo Liga - 19h",
  createdAt: 2024-12-12T11:00:00Z,
  updatedAt: 2024-12-12T11:00:00Z
}
```

### Exemplo 3: Link Inativo (não será usado)
```javascript
{
  eventType: "semanal-freitas",
  schedule: "14h",
  link: "https://chat.whatsapp.com/OLD_LINK...",
  status: "inactive",  // ❌ Será ignorado pelo sistema
  description: "Link antigo - substituído",
  createdAt: 2024-12-01T10:00:00Z,
  updatedAt: 2024-12-12T10:00:00Z
}
```

---

## 📊 Mapeamento de Tipos de Evento

```javascript
// Mapeamento de nomes no sistema
{
  'xtreino-tokens':     "X-Treino (Tokens)",
  'xtreino-gratuito':   "X-Treino Gratuito",
  'modo-liga':          "Modo Liga",
  'semanal-freitas':    "Semanal Freitas",
  'camp-freitas':       "Camp de Fases",
  'treino':             "Treino Normal"
}

// Possíveis aliases (o sistema tenta encontrar com essas variações):
'modo-liga'           ← 'modoLiga', 'modo liga'
'semanal-freitas'     ← 'semanal', 'semanal freitas'
'camp-freitas'        ← 'camp', 'camp freitas'
'xtreino-tokens'      ← 'xtreino-tokens'
```

---

## 🔄 Atualizar Link Existente

### Via Firestore Console

1. Abra **whatsapp_links**
2. Encontre o documento que deseja editar
3. Clique nele
4. Clique no campo a editar
5. Modifique o valor
6. Clique fora para salvar

### Via Firestore CLI

```javascript
const docRef = db.collection('whatsapp_links').doc('DOC_ID');
await docRef.update({
    link: 'https://chat.whatsapp.com/NOVO_LINK...',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
});
```

---

## 🔍 Verificar Qual Link Será Usado

O sistema tenta encontrar um link **nesta ordem**:

```
1. Link específico para [eventType + horário]
   Exemplo: eventType='modo-liga', schedule='19h' → busca documento com schedule='19h'

2. Link geral para [eventType]
   Exemplo: eventType='modo-liga', schedule=null → busca documento com schedule=null

3. Link com schedule vazio ''
   Exemplo: eventType='modo-liga', schedule='' → busca documento com schedule=''

4. Qualquer link ativo para [eventType]
   Exemplo: eventType='modo-liga' → primeiro documento ativo encontrado
```

**Resultado**: Se nenhum encontro, retorna string vazia (link indisponível)

---

## 📋 Checklist: Validação de Links

### Antes de Colocar em Produção

- [ ] Todos os eventos têm pelo menos 1 link?
  ```
  ✅ xtreino-tokens
  ✅ modo-liga
  ✅ semanal-freitas
  ✅ camp-freitas
  ✅ xtreino-gratuito (opcional)
  ```

- [ ] Todos os links têm `status: 'active'`?
  ```
  NOT status='inactive' ou status='old'
  ```

- [ ] Todos os links começam com `https://chat.whatsapp.com/`?
  ```
  ❌ Não: "chat.whatsapp.com/..." (falta https://)
  ❌ Não: "http://..." (http é inseguro)
  ❌ Não: "whatsapp://" (protocolo especial)
  ```

- [ ] Links não têm espaços em branco?
  ```
  ❌ "https://chat.whatsapp.com/ABC " (espaço no final)
  ✅ "https://chat.whatsapp.com/ABC" (correto)
  ```

- [ ] Cada link leva a um grupo válido?
  ```
  1. Copie um link
  2. Cole em um browser
  3. Deve abrir uma página do WhatsApp ou tela de adicionar grupo
  4. Se der erro 404, o link é inválido
  ```

---

## 🚀 Teste: Verificar se Está Funcionando

### Teste 1: Console do Navegador

1. Abra [client.html](https://seu-site.com/client.html)
2. Abra DevTools (F12)
3. Abra "Meus Pedidos - Eventos"
4. No Console, procure por:
   ```
   ✅ Link específico encontrado para modo-liga 19h : https://chat.whatsapp.com/...
   // OU
   ✅ Link geral encontrado para xtreino-tokens schedule: null -> https://chat.whatsapp.com/...
   // OU
   ❌ Nenhum link encontrado no Firestore para: { type: 'xtreino-tokens', ... }
   ```

### Teste 2: Verificar no Firestore

1. Abra Firestore Console
2. Clique em **whatsapp_links**
3. Verifique se tem documentos com:
   - `eventType` preenchido
   - `link` começando com `https://chat.whatsapp.com/`
   - `status: 'active'`

---

## 🔐 Boas Práticas

### ✅ Faça
- [ ] Manter links atualizados
- [ ] Deletar grupos antigos do WhatsApp (e marcar link como `inactive`)
- [ ] Testar cada link antes de usar
- [ ] Ter backup dos links (anotar em um lugar seguro)
- [ ] Revisar regularmente (a cada mês)

### ❌ Não Faça
- [ ] Copiar um link incompleto
- [ ] Adicionar espaços em branco
- [ ] Usar links públicos (private é melhor)
- [ ] Reutilizar links de grupos antigos
- [ ] Deixar links com `status='inactive'` ocupando espaço

---

## 🆘 Solucionar Problemas

### Problema: "Link indisponível" apareça

**1. Verificar se link existe no Firestore**
```
Firestore → whatsapp_links → procure eventType
Se não encontrar:
→ Adicionar novo link
```

**2. Verificar Console do Navegador**
```
F12 → Console → procure por "❌ Nenhum link encontrado"
Anota o tipo de evento (eventType) que falhou
Volte ao Firestore e procure por esse tipo
```

**3. Verificar se status é 'active'**
```
Firestore → whatsapp_links → clique no documento
Verifique se status='active' (não 'inactive')
```

**4. Copiar um novo link**
```
Vá para o grupo do WhatsApp
Clique nos 3 pontos (⋮) → "Adicionar participante"
Copie o link do convite
Cole no Firestore, substituindo o antigo
```

---

## 📞 Fluxo de Adição de Novo Evento

Quando adicionar um novo tipo de evento:

1. **Criar o grupo no WhatsApp**
   ```
   Copiar o link do convite
   ```

2. **Adicionar em whatsapp_links**
   ```
   eventType: "novo-evento"
   schedule: null  (para começar com link geral)
   link: "https://chat.whatsapp.com/..."
   status: "active"
   ```

3. **Testar**
   ```
   F12 → Console
   Procure por: "✅ Link encontrado"
   ```

4. **Validar no client**
   ```
   Abra "Meus Pedidos"
   Procure por um pedido do novo evento
   Verifique se link aparece
   ```

---

## 📊 Exemplo Completo: Adicionar Link de Modo Liga

### Situação:
Você criou um novo grupo do WhatsApp para Modo Liga às 19h

### Passos:

1. **No WhatsApp**: Copie o link do convite
   ```
   Link copiado: https://chat.whatsapp.com/XXXXXXXXXX
   ```

2. **Abra Firestore Console** na aba `whatsapp_links`

3. **Clique em "➕ Adicionar documento"**

4. **Preencha assim**:
   ```
   Campo          | Valor
   --------------|-----------------------------------
   eventType      | modo-liga
   schedule       | 19h
   link           | https://chat.whatsapp.com/XXXXXXX
   status         | active
   description    | Grupo Modo Liga - 19h (opcional)
   ```

5. **Clique Salvar**

6. **Teste**:
   - F12 → Console
   - Procure por: `✅ Link específico encontrado para modo-liga 19h`

7. **Sucesso!** ✅
   - Cliente consome token para Modo Liga 19h
   - Link aparece em "Meus Pedidos"
   - Botão "Entrar no Grupo" funciona

---

**Última atualização**: 12 de Dezembro de 2024  
**Versão**: 1.0  
**Status**: ✅ Pronto para uso
