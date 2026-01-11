# 🚨 URGENTE: Deploy das Regras do Firestore

## ⚠️ PROBLEMA IDENTIFICADO
O login está funcionando (cargo "Ceo" foi encontrado), mas **TODAS as funcionalidades estão falhando** devido a erros de permissões do Firebase:

```
❌ Erro ao carregar usuários: Missing or insufficient permissions
❌ Erro ao carregar usuários para permissões: Missing or insufficient permissions  
❌ Erro ao carregar usuários para tokens: Missing or insufficient permissions
❌ Erro ao carregar histórico do admin: Missing or insufficient permissions
❌ Erro ao carregar dados de tokens: Missing or insufficient permissions
❌ Erro ao carregar dados de uso de tokens: Missing or insufficient permissions
❌ Erro ao carregar pedidos confirmados: Missing or insufficient permissions
```

## 🔧 SOLUÇÃO: Deploy das Regras do Firestore

### Passo 1: Acessar o Firebase Console
1. **Abra o navegador** e vá para: https://console.firebase.google.com/
2. **Faça login** com a conta do Google
3. **Selecione o projeto:** X-TREINO FREITAS

### Passo 2: Navegar para Firestore
1. **No menu lateral esquerdo**, clique em **"Firestore Database"**
2. **Clique na aba "Rules"** (ao lado de "Data")

### Passo 3: Substituir as Regras
1. **Selecione todo o conteúdo** do editor de regras (Ctrl+A)
2. **Delete o conteúdo atual**
3. **Copie TODO o conteúdo** do arquivo `firestore.rules` deste projeto
4. **Cole no editor** do Firebase Console
5. **Clique em "Publish"** (botão azul no canto superior direito)

### Passo 4: Verificar o Deploy
1. **Aguarde a confirmação** "Rules published successfully"
2. **Recarregue a página** do admin
3. **Faça login novamente**
4. **Verifique o console** - não deve haver mais erros de permissões

## 📋 Regras Completas que Precisam ser Deployadas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isSelf(userId) { return isSignedIn() && request.auth.uid == userId; }
    function isAdmin() {
      return isSignedIn() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','Admin','ADMIN','Ceo','CEO','ceo'];
    }
    
    function isVendedor() {
      return isSignedIn() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['vendedor','Vendedor','VENDEDOR'];
    }
    
    function isGerente() {
      return isSignedIn() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['gerente','Gerente','GERENTE','admin','Admin','ADMIN','Ceo','CEO','ceo'];
    }
    
    function isAuthorizedAdmin() {
      return isSignedIn() && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','Admin','ADMIN','Ceo','CEO','ceo'] &&
        request.auth.token.email in ['cleitondouglass@gmail.com','cleitondouglass123@hotmail.com','gilmariofreitas378@gmail.com','gilmariofreitas387@gmail.com'];
    }
    
    function isAuthorizedAdminOrDesign() {
      return isSignedIn() && (
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','Admin','ADMIN','Ceo','CEO','ceo'] &&
         request.auth.token.email in ['cleitondouglass@gmail.com','cleitondouglass123@hotmail.com','gilmariofreitas378@gmail.com','gilmariofreitas387@gmail.com']) ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['design','Design','DESIGN','Designer','DESIGNER','designer','Desgin','DESGIN','desgin']
      );
    }
    
    function isDesign() {
      return isSignedIn() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['design','Design','DESIGN','Designer','DESIGNER','designer','Desgin','DESGIN','desgin'];
    }
    
    function isSocio() {
      return isSignedIn() && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['socio','Socio','SOCIO','sócio','Sócio','SÓCIO'];
    }
    
    function canReadAll() {
      return isAdmin() || isGerente() || isVendedor() || isDesign() || isSocio();
    }

    // users: cada usuário lê/escreve o próprio documento; Staff pode ler todos
    match /users/{userId} {
      allow read: if isSelf(userId) || canReadAll();
      allow write: if isSelf(userId) || isAdmin();
    }

    // schedules: leitura pública para contagem; escrita para logados
    match /schedules/{scheduleId} {
      allow read: if true;
      allow write: if isSignedIn();
    }

    // orders: leitura para staff (admin/gerente/vendedor/sócio) e para o próprio usuário; escrita para logados
    match /orders/{orderId} {
      allow read: if isSignedIn() && (resource.data.userId == request.auth.uid || canReadAll());
      allow write: if isSignedIn();
    }

    // registrations: leitura para staff (admin/gerente/vendedor/sócio) e para o próprio usuário; escrita para logados
    match /registrations/{registrationId} {
      allow read: if isSignedIn() && (resource.data.userId == request.auth.uid || canReadAll());
      allow write: if isSignedIn();
    }

    // digital_deliveries: leitura para o próprio usuário e sócio; escrita para logados
    match /digital_deliveries/{deliveryId} {
      allow read: if isSignedIn() && (resource.data.customerEmail == request.auth.token.email || canReadAll());
      allow write: if isSignedIn();
    }

    // highlights: leitura pública; escrita para admins autorizados e design
    match /highlights/{highlightId} {
      allow read: if true;
      allow create, update, delete: if isAuthorizedAdmin() || isDesign();
    }

    // news: leitura pública; escrita para admins autorizados e design
    match /news/{newsId} {
      allow read: if true;
      allow create, update, delete: if isAuthorizedAdmin() || isDesign();
    }

    // config: leitura pública; escrita apenas para admins autorizados
    match /config/{configId} {
      allow read: if true;
      allow create, update, delete: if isAuthorizedAdmin();
    }

    // products: leitura pública; escrita apenas para admins autorizados
    match /products/{productId} {
      allow read: if true;
      allow create, update, delete: if isAuthorizedAdminOrDesign();
    }

    // product_downloads: leitura para o próprio usuário; escrita para logados
    match /product_downloads/{downloadId} {
      allow read: if isSignedIn() && (resource.data.customerEmail == request.auth.token.email || isAdmin());
      allow create: if isSignedIn() && resource.data.customerEmail == request.auth.token.email && resource.data.status == 'delivered';
    }

    // product_categories: leitura pública; escrita apenas para admins autorizados
    match /product_categories/{categoryId} {
      allow read: if true;
      allow create, update, delete: if isAuthorizedAdminOrDesign();
    }

    // product_inventory: leitura para admins; escrita apenas para admins autorizados
    match /product_inventory/{inventoryId} {
      allow read: if isAdmin() || isDesign();
      allow create, update, delete: if isAuthorizedAdminOrDesign();
    }

    // product_reviews: leitura pública; escrita para usuários logados
    match /product_reviews/{reviewId} {
      allow read: if true;
      allow create: if isSignedIn() && 
        resource.data.productId is string &&
        resource.data.customerEmail == request.auth.token.email &&
        resource.data.rating >= 1 && resource.data.rating <= 5 &&
        resource.data.comment.size() <= 500;
    }

    // product_analytics: leitura para admins; escrita apenas para admins autorizados
    match /product_analytics/{analyticsId} {
      allow read: if isAdmin() || isDesign();
      allow create, update, delete: if isAuthorizedAdminOrDesign();
    }

    // product_discounts: leitura pública; escrita apenas para admins autorizados
    match /product_discounts/{discountId} {
      allow read: if true;
      allow create: if isAuthorizedAdminOrDesign() &&
        resource.data.code is string &&
        resource.data.discountType in ['percentage', 'fixed'] &&
        resource.data.value > 0 &&
        resource.data.active is bool;
    }

    // product_audit_logs: leitura para admins; escrita apenas para admins autorizados
    match /product_audit_logs/{logId} {
      allow read: if isAdmin() || isDesign();
      allow create, update, delete: if isAuthorizedAdminOrDesign();
    }

    // product_usage_stats: leitura para admins; escrita apenas para admins autorizados
    match /product_usage_stats/{statsId} {
      allow read: if isAdmin() || isDesign();
      allow create, update, delete: if isAuthorizedAdminOrDesign();
    }

    // product_backups: leitura para admins; escrita apenas para admins autorizados
    match /product_backups/{backupId} {
      allow read: if isAdmin() || isDesign();
      allow create, update, delete: if isAuthorizedAdminOrDesign();
    }

    // adminHistory: leitura para staff (admin/gerente/sócio); escrita apenas para admins autorizados
    match /adminHistory/{historyId} {
      allow read: if isAdmin() || isGerente() || isSocio();
      allow create, update, delete: if isAuthorizedAdmin();
    }
  }
}
```

## ✅ Após o Deploy - Teste:

1. **Recarregue a página** do admin
2. **Faça login** com CEO ou Design
3. **Verifique o console** - deve estar limpo de erros
4. **Teste as funcionalidades:**
   - ✅ Gerenciamento de Tokens
   - ✅ Histórico do Admin
   - ✅ Usuários & Permissões
   - ✅ Todos os dados devem carregar

## 🆘 Se Ainda Houver Problemas:

1. **Verifique se o deploy foi bem-sucedido** (deve aparecer "Rules published successfully")
2. **Aguarde 1-2 minutos** para propagação das regras
3. **Limpe o cache do navegador** (Ctrl+F5)
4. **Verifique se está logado** com o usuário correto
