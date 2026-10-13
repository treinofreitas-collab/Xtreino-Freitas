# Confirmação de pagamentos: Eventos, Loja e Tokens

## Fluxo

- O cliente autenticado salva o pedido/reservas pendentes.
- `create-preference` calcula o preço a partir do catálogo e dos cupons no servidor.
  O valor enviado pela tela serve somente para detectar mudanças de preço.
- O servidor salva a referência, proprietário, fontes e valor de cobrança no checkout.
- O webhook valida a assinatura do Mercado Pago, busca o pagamento na API e confere
  aprovação, referência, moeda e valor. Confirma o pedido sem depender do retorno ao site.
- Compra de tokens continua usando o checkout e o registro de créditos específico.
- Eventos e produtos pagos com saldo usam `pay-with-tokens`: débito e confirmação são
  uma única transação. Repetir a mesma referência não debita novamente.
- As telas e a reconciliação consultam o servidor. `status=approved` na URL não prova pagamento.
- Produto digital: o pedido pago recebe o link do catálogo. Passe Booyah e camisa:
  confirmação financeira automática, entrega manual. Pedido Booyah gera aviso ao admin.

## Produção (Netlify + Firebase)

Nenhuma publicação ou mudança no Firebase é feita por estes arquivos automaticamente.
Antes de liberar as compras:

1. Conferir as variáveis do Netlify com escopo Functions (All scopes também inclui Functions):
   `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `FIREBASE_SERVICE_ACCOUNT_JSON` e
   `PUBLIC_SITE_URL`. O JSON é da conta de serviço do mesmo projeto Firebase do site.
   Nunca colocar os valores no frontend, no Git ou em mensagens.
2. Publicar as funções e o frontend juntos no Netlify.
3. Aplicar `artifacts/xtreino/public/config/firestore.rules` no Firebase Console,
   Firestore → Regras → Publicar, coordenado com a atualização do site.
   As novas regras impedem a conta do comprador de aprovar seu próprio pagamento.
4. Webhooks do Mercado Pago → Modo de produção → Pagamentos (legacy).
   URL: `<PUBLIC_SITE_URL>/.netlify/functions/mp-webhook`.
   Usar a assinatura secreta deste mesmo modo na variável do Netlify.
5. Conferir os logs das Functions. Um teste fictício de webhook com pagamento inexistente
   não confirma uma compra. Não desativar a assinatura para fazer o teste passar.
6. Após a publicação, validar uma compra controlada com consentimento do responsável.
   Verificar pagamento real aprovado, registro pago e entrega/saldo na conta correta;
   repetir a notificação e confirmar que não duplica. Testar também fechamento da aba
   antes do retorno. Os testes locais não verificam os valores dos segredos do Netlify.

Pedidos antigos sem checkout verificado são encaminhados para conferência, não
aprovados por status informado pelo navegador. Não há crédito retroativo automático.
Estornos/chargebacks precisam de conferência; esta mudança trata aprovação e entrega,
não implementa a reversão automática de serviços já usados.

## Verificação local (sem cobrança)

```sh
node --test netlify/shared/*.test.js
pnpm --filter @workspace/api-server run typecheck
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/xtreino run build
```

Os testes usam banco e respostas do Mercado Pago simulados. A API de preview usa
os mesmos handlers do Netlify e falha explicitamente quando faltam credenciais.
