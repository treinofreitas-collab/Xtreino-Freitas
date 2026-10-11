# X-Treino Freitas — auditoria e melhorias

## Alterações implementadas
- Bloqueio do menu de contexto (clique direito) em todas as páginas HTML servidas pelo site.
- Otimização do listener de notificações: removida a leitura `getDocs` inicial duplicada antes de `onSnapshot`, usando o snapshot inicial dos próprios listeners para reduzir leituras repetidas.
- Correção de um erro real no `handleError`: a condição original chamava `.startsWith()` em valores que não eram strings, podendo lançar outro erro durante o tratamento de exceções.
- Vite agora usa a porta `4173` por padrão quando `PORT` não estiver definida; plataformas que definem `PORT` continuam sendo respeitadas.
- Regras Firestore centralizadas em `firestore.rules` e copiadas para `public/config/firestore.rules` e `artifacts/xtreino/public/config/firestore.rules`.
- Regras mais restritivas para listagem de inscrições, notificações direcionadas, alteração de times e resgate de links bônus. O contador `slotCounters` mantém escrita autenticada para não quebrar a alocação atual; a solução definitiva é mover a transação para backend confiável.
- Adicionadas regras para coleções usadas pelo frontend mas ausentes no arquivo de regras fornecido: `faq_kb`, `contatos`, `camp_semifinal_links` e `affiliate_payment_requests`.
- Arquivo `regras-original-cliente.txt` preserva o material recebido para comparação.

## Limitações importantes
- Bloquear clique direito é apenas uma barreira de interface; não impede que conteúdo público seja copiado, inspecionado ou capturado por outras ferramentas.
- As regras Firestore não são publicadas automaticamente pelo ZIP. É necessário revisá-las e publicá-las no Firebase Console ou via Firebase CLI.
- Nenhuma regra consegue aumentar a cota do plano gratuito. Se a cota diária já foi consumida, leituras/escritas só voltam quando a cota reiniciar, ou ao reduzir operações/migrar a arquitetura. O ZIP não acessa a conta do cliente e não consegue verificar o consumo real.
- Restringir a leitura de `registrations` e notificações direcionadas melhora a privacidade, mas pode exigir consultas filtradas pelo app. O formulário de contato continua aceitando envios públicos, com campos e tamanhos limitados. Para mostrar disponibilidade pública sem expor dados pessoais, a solução correta é manter documentos agregados de vagas sem dados dos inscritos, atualizados por backend confiável.
- O código contém integrações externas e pagamentos que exigem testes com credenciais reais e ambiente de produção; não é possível certificar esses fluxos apenas por análise estática.

## Teste local
Na pasta `artifacts/xtreino`, instale as dependências do workspace conforme o ambiente original (pnpm/workspace) e execute `PORT=4173 pnpm run build`. Para desenvolvimento, execute `PORT=4173 pnpm run dev`.

## Publicação das regras
1. Revise `firestore.rules` com o responsável pelo Firebase, principalmente as regras que afetam listagem de inscrições, times e contadores.
2. Teste permissões no Firebase Emulator Suite ou Rules Playground com contas de cliente, vendedor, afiliado, staff, gerente e administrador.
3. Publique somente após validar os fluxos do site. Nunca use regras abertas como `allow read, write: if true` para contornar erros de quota/permissão.
