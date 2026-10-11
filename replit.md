# XTreino Freitas

Plataforma eSports de treinamento e campeonatos (Free Fire) com sistema de agendamento, pagamento, painel administrativo e notificações.

## Run & Operate

- `pnpm --filter @workspace/xtreino run dev` — rodar o app principal (porta via `$PORT`)
- Workflow registrado: **"artifacts/xtreino: web"** — inicia automaticamente

## Stack

- **Frontend:** Vanilla HTML + CSS + JavaScript (sem framework)
- **Estilos:** Tailwind CSS via CDN + `styles.css` + `mobile-optimizations.css` + `admin-styles.css`
- **Backend/DB:** Firebase Firestore (NoSQL) + Firebase Auth (Google + email/senha)
- **Pagamentos:** Mercado Pago (API externa, integração via `script.js`)
- **Build:** Vite (multi-page, sem React)
- **Monorepo:** pnpm workspaces

## Where things live

```
artifacts/xtreino/public/
├── index.html              — Página principal (home, carrossel de destaques)
├── admin.html              — Painel administrativo
├── admin.js                — Lógica do admin (board de horários, gestão de inscrições)
├── admin-styles.css        — Estilos exclusivos do admin
├── client.html             — Área do cliente (pedidos, perfil, tokens)
├── client.js               — Lógica da área do cliente
├── evento.html             — Página de eventos/agendamento
├── script.js               — Lógica principal (auth, agendamento, pagamento, carrossel)
├── styles.css              — Estilos globais
├── mobile-optimizations.css
├── error-codes.js          — Mapa de erros com mensagens amigáveis
├── error-handler.js        — Handler global de erros
├── firebase-cache.js       — Cache de consultas Firestore
├── password-reset.html     — Reset de senha
├── maintenance.html        — Página de manutenção
├── config/
│   └── firebase.js         — Init do Firebase via window.FIREBASE_CONFIG
├── js/                     — Módulos JS auxiliares
├── assets/                 — Imagens, ícones, banners de eventos
└── logos/                  — Logos da marca
```

## Coleções Firestore

| Coleção | Uso |
|---|---|
| `registrations` | Inscrições em eventos (`status`: `pending` / `paid` / `confirmed` / `approved`) |
| `users` | Perfis de usuário, saldo de tokens, histórico |
| `event_hour_locks` | Travas permanentes por horário/evento (independente de data) |
| `event_global_locks` | Trava geral de um evento em todas as datas |
| `schedule_overrides` | Travas e ajustes manuais por data específica |
| `notifications` | Notificações para usuários (credenciais de sala, avisos) |
| `whatsapp_links` | Links de WhatsApp por evento/horário |

## Tipos de eventos

| ID | Nome | Preço |
|---|---|---|
| `xtreino-tokens` | XTreino Freitas | R$ 1,00 |
| `modo-liga` | XTreino Modo Liga | R$ 3,00 |
| `semanal-freitas` | Semanal Freitas | R$ 3,50 |
| `camp-freitas` | Campeonato Freitas | R$ 8,00 |

## Architecture decisions

- **Firebase inicializado via `window.FIREBASE_CONFIG`** — as credenciais são injetadas externamente para não expor no código-fonte. Sem `window.FIREBASE_CONFIG`, o app roda sem banco (modo degradado).
- **Verificação de disponibilidade direto no Firestore** — `checkMultipleSlotAvailability` consulta `event_hour_locks`, `schedule_overrides` e `registrations` diretamente (substituiu chamada a endpoint Netlify inexistente). Falhas técnicas não bloqueiam a compra.
- **Trava permanente com 3 camadas de proteção:** (1) UI oculta o botão de horário, (2) `checkMultipleSlotAvailability` bloqueia antes do pagamento, (3) `createRegistrationsForEvent` lança exceção antes do `addDoc`.
- **FOUC eliminado com CSS inline crítico** — `body { visibility: hidden }` no `<head>` antes do Tailwind carregar; `revealPage()` torna visível após Tailwind processar.
- **Carrossel sem scroll horizontal** — `overflow-x: hidden` global + classe `.carousel-wrapper` com contenção e slides com `flex-shrink: 0`.

## Product

- Agendamento de vagas em 4 modalidades de treino/campeonato
- Pagamento via Mercado Pago ou tokens da plataforma
- Painel admin com board de horários por data/evento, gestão de inscrições, envio de ID/senha da sala por horário
- Área do cliente: pedidos, histórico, saldo de tokens, perfil
- Sistema de cupons de desconto e afiliados
- Notificações in-app (credenciais da sala, avisos de evento)

## User preferences

- Código em português (nomes de variáveis, comentários, mensagens)
- Manter estrutura vanilla JS/HTML existente — sem migrar para React

## Gotchas

- **Firebase não conecta sem `window.FIREBASE_CONFIG`** — o app roda mas todas as funções que dependem de Firestore falham silenciosamente. Para conectar, injetar o objeto de configuração do projeto Firebase antes que `config/firebase.js` seja executado.
- **Tailwind via CDN** — aviso no console é esperado em dev. Em produção considerar instalar via npm.
- **`pnpm run dev` na raiz não funciona** — usar o workflow ou `pnpm --filter @workspace/xtreino run dev`.
- **Regras Firestore** — em `public/firestore.rules`. Verificar permissões ao adicionar novas coleções.
- **`registrations.status = 'pending'`** — criado no momento da compra; muda para `paid` após webhook do Mercado Pago. O painel admin exibe ambos os status no modal de gerenciamento de horário.

## Pointers

- Skill `pnpm-workspace` — estrutura do monorepo e TypeScript
- Skill `artifacts` — criar/atualizar artefatos e workflows
