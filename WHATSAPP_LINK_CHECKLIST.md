# ✅ Checklist de Verificação - Link WhatsApp

## 1️⃣ Verificar Collection `whatsapp_links` no Firestore

```
📍 Caminho: Firestore → whatsapp_links
```

**Necessário ter documentos como:**
```javascript
// Exemplo 1: Link específico para horário
{
  eventType: "xtreino-tokens",
  schedule: "14h",
  link: "https://chat.whatsapp.com/XXXXXXXXXXXX",
  status: "active"
}

// Exemplo 2: Link geral (sem horário específico)
{
  eventType: "xtreino-tokens",
  schedule: null,  // ou ""
  link: "https://chat.whatsapp.com/YYYYYYYYYYYY",
  status: "active"
}

// Exemplo 3: Evento em horário específico
{
  eventType: "modo-liga",
  schedule: "19h",
  link: "https://chat.whatsapp.com/ZZZZZZZZZZZZ",
  status: "active"
}
```

**✅ Validação:**
- [ ] Collection existe
- [ ] Tem pelo menos um documento para `xtreino-tokens`
- [ ] Todos têm `status: "active"`
- [ ] Todos têm um campo `link` com URL válido do WhatsApp

---

## 2️⃣ Testar Fluxo de Token

**Passo 1:** Abrir DevTools (F12)
- [ ] Aba "Console" aberta
- [ ] Filtro para "whatsapp" limpo

**Passo 2:** Consumir um token
- [ ] Ir para a página principal
- [ ] Clicar em "Reservar com Token"
- [ ] Selecionar um evento e horário
- [ ] Clicar em "Confirmar uso de tokens"

**Passo 3:** Verificar Console
- Procurar por logs como:
  ```
  ✅ Link do WhatsApp adicionado ao registro...
  // OU
  ❌ Nenhum link encontrado no Firestore para:
  ```
- [ ] Se viu `✅` - link foi encontrado ✓
- [ ] Se viu `❌` - verificar se whatsapp_links tem dados

**Passo 4:** Abrir "Meus Pedidos"
- [ ] Novo pedido aparece com "Token Consumido"
- [ ] Campo "Link:" exibe a URL do WhatsApp
- [ ] Botão "Entrar no Grupo" está clicável

---

## 3️⃣ Testar Fluxo de Pagamento

**Passo 1:** Fazer uma compra de evento
- [ ] Selecionar um evento
- [ ] Ir até o carrinho
- [ ] Clicar "Finalizar Compra"
- [ ] Escolher "Pagar agora"

**Passo 2:** Simular pagamento (dev/test)
- [ ] Se estiver em ambiente de testes, usar o cartão de teste do Mercado Pago
- [ ] Aguardar confirmação (pode levar 5-10 segundos)

**Passo 3:** Verificar Firestore
- [ ] Ir para Firestore → collections → orders
- [ ] Procurar pelo pedido mais recente
- [ ] Campo `status` deve ser `paid`
- [ ] Campo `whatsappLink` deve ter a URL do grupo

**Passo 4:** Abrir "Meus Pedidos"
- [ ] Pedido aparece
- [ ] Link do WhatsApp está visível
- [ ] Botão "Entrar no Grupo" funciona

---

## 4️⃣ Debug: Se Link Não Aparecer

### 🔴 Problema: "Link indisponível" ou campo vazio

**Verificar:**

1. **Firestore - orders collection**
   ```
   Procurar o pedido:
   - Campo 'whatsappLink' existe? ✅ ou ❌
   - Se existe, tem um valor? ✅ ou ❌
   - Se vazio, qual é o valor de 'eventType'?
   ```

2. **Firestore - whatsapp_links collection**
   ```
   Buscar documentos com eventType = [valor acima]:
   - Tem algum documento? ✅ ou ❌
   - O 'status' é 'active'? ✅ ou ❌
   - O 'link' começa com 'https://chat.whatsapp.com/'? ✅ ou ❌
   ```

3. **Console do Navegador (F12)**
   ```
   Procurar por logs:
   - 🔍 getWhatsAppLinkForOrder - Order: {...}
   - ✅ Usando link salvo no pedido: https://chat.whatsapp.com/...
   // OU
   - ❌ Nenhum link encontrado no Firestore para: { type: '...', hour: '...' }
   ```

4. **Logs do Netlify (payment-notification.js)**
   ```
   Verificar se pagamento acionou a busca:
   - 🔍 Link do WhatsApp não encontrado no pedido, buscando...
   - ✅ Link do WhatsApp adicionado ao pedido...
   // OU
   - ⚠️ Nenhum link do WhatsApp encontrado para o pedido
   ```

---

## 5️⃣ Solução Rápida: Adicionar Links Manualmente

**Se não tiver links no Firestore:**

1. Abra **Firestore Console**
2. Clique em **whatsapp_links** (ou crie a collection se não existir)
3. Clique em **"Adicionar documento"**
4. Preencha:
   ```javascript
   eventType: "xtreino-tokens"
   schedule: null  // deixar como null para link geral
   link: "https://chat.whatsapp.com/COPIE_AQUI_O_LINK"
   status: "active"
   ```
5. Clique **Salvar**
6. Repita para outros eventos (modo-liga, semanal-freitas, camp-freitas, etc.)

---

## 6️⃣ Validação Final

**Depois de fazer as correções, verificar:**

- [ ] Consumir 1 token
  - [ ] Link aparece em "Meus Pedidos"
  - [ ] Botão "Entrar no Grupo" é clicável
  
- [ ] Fazer 1 compra de evento
  - [ ] Pagamento é confirmado
  - [ ] Link aparece em "Meus Pedidos"
  
- [ ] Verificar Console
  - [ ] Sem erros vermelhos de JavaScript
  - [ ] Logs mostram `✅` para sucesso

---

## 🎯 Resultado Esperado

**Antes da Correção:**
```
Meus Pedidos - Eventos:
├─ Treino - 04/12 - Consumo: -1 token
│  └─ Link: Link indisponível ❌
└─ Modo Liga - 18/12 - Pagamento: R$ 30,00
   └─ Link: [vazio] ❌
```

**Depois da Correção:**
```
Meus Pedidos - Eventos:
├─ Treino - 04/12 - Consumo: -1 token
│  ├─ Link: https://chat.whatsapp.com/XXXXXX ✅
│  └─ Botão: [Entrar no Grupo] 🟢
└─ Modo Liga - 18/12 - Pagamento: R$ 30,00
   ├─ Link: https://chat.whatsapp.com/YYYYYY ✅
   └─ Botão: [Entrar no Grupo] 🟢
```

---

## 📞 Suporte

Se encontrar erros, verifique:

1. **Console do Navegador** (F12 → Console)
   - Mensagens vermelhas indicam problemas no frontend
   - Procurar por padrão: `❌ Erro...`

2. **Logs do Netlify**
   - Ir para https://app.netlify.com
   - Clicar no site → Functions → payment-notification
   - Procurar por "Error" ou "❌"

3. **Firestore** 
   - Verificar se documentos existem
   - Verificar se campos estão preenchidos corretamente
   - Não há espaços em branco extras ou caracteres especiais

---

**Última atualização**: 12 de Dezembro de 2024
**Versão**: 1.0
