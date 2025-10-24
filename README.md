# XTreino Freitas - Site Oficial

Site oficial do XTreino Freitas, plataforma de treinamentos e produtos para Free Fire.

## 📁 Estrutura do Projeto

```
├── assets/                    # Recursos estáticos
│   ├── images/               # Imagens organizadas
│   │   ├── products/         # Imagens dos produtos
│   │   ├── events/           # Imagens dos eventos
│   │   └── team/             # Fotos da equipe
│   └── downloads/            # Arquivos para download
├── docs/                     # Documentação
│   ├── politica-privacidade.html
│   ├── termos-servico.html
│   └── DEPLOY_FIRESTORE_RULES.md
├── netlify/                  # Funções serverless
│   └── functions/
├── index.html                # Página principal
├── admin.html                # Painel administrativo
├── client.html               # Área do cliente
├── script.js                 # JavaScript principal
├── admin.js                  # JavaScript do admin
├── client.js                 # JavaScript do cliente
├── firebase.js               # Configuração Firebase
├── styles.css                # Estilos CSS
├── firestore.rules           # Regras do Firestore
└── netlify.toml              # Configuração Netlify
```

## 🚀 Funcionalidades

### Para Usuários
- **Loja Virtual**: Produtos digitais e físicos
- **Eventos**: XTreino, Modo Liga, Camp Freitas, Semanal
- **Sistema de Tokens**: Moeda virtual para eventos
- **Downloads**: Sensibilidades, mapas, planilhas
- **Chat Inteligente**: FAQ automático com fallback para WhatsApp

### Para Administradores
- **Painel Admin**: Gestão completa do sistema
- **Controle de Pedidos**: Acompanhamento de vendas
- **Gestão de Cupons**: Criação e controle de descontos
- **Controle Passe Booyah**: Validação de entregas
- **Relatórios**: KPIs e estatísticas

## 🛠️ Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication)
- **Payments**: Mercado Pago
- **Hosting**: Netlify
- **Functions**: Netlify Functions

## 📦 Produtos Disponíveis

### Digitais
- **Sensibilidades**: R$ 8,00 (PC/Android/iOS)
- **Imagens Aéreas**: R$ 2,00 por mapa
- **Planilhas de Análise**: R$ 19,00
- **Passe Booyah**: R$ 11,00

### Físicos
- **Camisa Oficial**: R$ 89,90

### Eventos
- **XTreino Gratuito**: R$ 0,00
- **Modo Liga**: R$ 3,00
- **Camp Freitas**: R$ 5,00
- **Semanal Freitas**: R$ 3,50

## 🔧 Configuração

### Variáveis de Ambiente (Netlify)
```
FIREBASE_PROJECT_ID=supernatural-51e12
FIREBASE_CLIENT_EMAIL=seu-email@projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
MERCADO_PAGO_WEBHOOK_SECRET=a802bac1d15de143834443f97aed2ff4be027eca4f63995ef05242ecf88cd425
```

### Firebase
- Projeto: `supernatural-51e12`
- Authentication: Google OAuth
- Firestore: Regras configuradas
- Storage: Para uploads de imagens

## 📱 Contato

- **WhatsApp**: (11) 94983-0454
- **Email**: contato@xtreinofreitas.com
- **Site**: https://freitasteste.netlify.app

## 📄 Licença

© 2025 X-TREINO FREITAS. Todos os direitos reservados.

---

**Desenvolvido com ❤️ para a comunidade Free Fire**