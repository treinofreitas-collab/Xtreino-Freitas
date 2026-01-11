# 📊 Estimativa de Custos Firebase - X-TREINO FREITAS

## 📈 Uso Atual (Baseado no Gráfico)

### Leituras (Reads)
- **Uso semanal**: ~298.000 leituras
- **Uso mensal estimado**: ~1.192.000 leituras (4 semanas)

### Gravações (Writes)
- **Uso semanal**: ~20.000 gravações
- **Uso mensal estimado**: ~80.000 gravações (4 semanas)

---

## 💰 Cálculo de Custos (Plano Blaze)

### Cota Gratuita (Spark Plan)
- **Leituras**: 50.000/dia = 1.500.000/mês ✅
- **Gravações**: 20.000/dia = 600.000/mês ✅
- **Autenticação**: 50.000 usuários ativos/mês ✅
- **Storage**: 1 GB ✅

### Cenário 1: Uso Semanal (Mais Provável)
- **Leituras**: 1.192.000/mês < 1.500.000 → **GRATUITO** ✅
- **Gravações**: 80.000/mês < 600.000 → **GRATUITO** ✅
- **Total**: **R$ 0,00/mês** (dentro do plano gratuito)

### Cenário 2: Uso Diário (Pico Máximo)
- **Leituras**: 298.000/dia = 8.940.000/mês
  - Excedente: 8.940.000 - 1.500.000 = **7.440.000 leituras**
  - Custo: (7.440.000 ÷ 100.000) × US$ 0,06 = **US$ 4,46** ≈ **R$ 22,30**

- **Gravações**: 20.000/dia = 600.000/mês
  - Excedente: 600.000 - 600.000 = **0 gravações**
  - Custo: **R$ 0,00**

- **Total estimado**: **R$ 22,30/mês**

---

## 🔍 Outros Custos Potenciais

### Firebase Authentication
- **Gratuito**: Até 50.000 usuários ativos/mês
- **Acima**: US$ 0,0055 por usuário adicional
- **Estimativa**: Se tiver ~100 usuários/mês → **GRATUITO** ✅

### Firebase Storage
- **Gratuito**: 1 GB
- **Acima**: US$ 0,18/GB
- **Estimativa**: Fotos de perfil (~100 usuários × 200KB) = ~20MB → **GRATUITO** ✅

### Hosting (Netlify)
- **Gratuito**: 100 GB de largura de banda/mês
- **Acima**: US$ 0,15/GB
- **Estimativa**: Site pequeno → **GRATUITO** ✅

---

## 📊 Resumo Final

### Cenário Conservador (Uso Semanal)
**Total: R$ 0,00/mês** ✅

### Cenário Máximo (Uso Diário no Pico)
**Total: ~R$ 22,30/mês**

### Cenário Realista (Média)
**Total: ~R$ 5,00 - R$ 15,00/mês**

---

## 💡 Recomendações para Reduzir Custos

1. **Otimizar Consultas**
   - Usar cache local quando possível
   - Limitar número de documentos retornados
   - Usar índices adequados

2. **Reduzir Leituras Desnecessárias**
   - Evitar queries em loops
   - Usar listeners apenas quando necessário
   - Implementar paginação eficiente

3. **Monitorar Uso**
   - Acompanhar no Firebase Console
   - Configurar alertas de uso
   - Revisar queries mais custosas

4. **Considerar Alternativas**
   - Cache em localStorage para dados estáticos
   - Reduzir frequência de atualizações em tempo real
   - Usar batch operations quando possível

---

## 📅 Atualização
*Estimativa baseada em dados de Novembro 2025*

