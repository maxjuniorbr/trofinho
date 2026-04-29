# Plano de Evolução de Testes — Trofinho

> Documento de referência para a evolução da suíte de testes.
> Baseline: 1139 testes | 73.6% stmts | 67.1% branches | 62.7% funcs | 75.1% lines

---

## Visão Geral

O projeto tem uma base sólida de testes na camada `lib/` (92.8%) e route tests para as telas principais. As lacunas estão concentradas em três áreas: **query hooks** (ponte entre lib e UI), **componentes de formulário** (interação do usuário com dados), e **telas sem cobertura** (historico, redemptions child).

O plano está organizado em **5 fases** executáveis sequencialmente, cada uma com critérios de aceite mensuráveis.

---

## Fase 1 — Hooks e Utilitários Críticos

**Objetivo:** Cobrir os hooks que conectam a camada de dados às telas.
**Impacto estimado:** +8-10% cobertura global

### 1.1 Hooks utilitários sem teste dedicado

| Arquivo | Situação | Ação |
|---------|----------|------|
| `src/hooks/use-transient-message.ts` | Sem teste | Criar `use-transient-message.test.ts` |
| `src/hooks/use-footer-items.ts` | Sem teste | Criar `use-footer-items.test.ts` |

**Cenários `use-transient-message`:**
- Retorna a mensagem enquanto o timer está ativo
- Limpa a mensagem após o timeout
- Reseta o timer quando `resetKey` muda
- Retorna null quando não há mensagem

**Cenários `use-footer-items`:**
- `useChildFooterItems`: retorna badge com contagem de tarefas pendentes + rejeitadas com retry
- `useChildFooterItems`: retorna 0 quando não há tarefas pendentes
- `useAdminFooterItems`: retorna badges de validações pendentes e resgates pendentes
- `useAdminFooterItems`: retorna 0 quando não há pendências

### 1.2 Query hooks — mutations e invalidação

| Arquivo | Cobertura atual | Meta |
|---------|----------------|------|
| `use-tasks.ts` | 41% stmts | 80%+ |
| `use-children.ts` | 30% stmts | 80%+ |
| `use-balances.ts` | 55% stmts | 80%+ |
| `use-prizes.ts` | 54% stmts | 80%+ |
| `use-profile.ts` | 59% stmts | 80%+ |
| `use-redemptions.ts` | 68% stmts | 80%+ |

**Para cada hook de mutation, testar:**
- Chamada da função `lib/` com os parâmetros corretos
- `onSuccess` invalida as query keys corretas
- Erro propagado corretamente para o caller
- `isPending` reflete o estado da mutation

**Cenários específicos:**
- `useCreateTask`: cria tarefa e invalida `tasks.all`
- `useApproveAssignment`: invalida `tasks.all` + `balances.all`
- `useCompleteAssignment`: upload de evidência + invalidação
- `useRenewRecurringTasks`: efeito colateral de invalidação após sucesso
- `useDeactivateTask` / `useDeleteTask`: retorna `pendingValidationCount`
- `useTransferToPiggyBank`: invalida balances
- `useRequestRedemption`: invalida redemptions + balances

### Critério de aceite Fase 1
- [ ] Todos os hooks utilitários com teste dedicado
- [ ] Todos os query hooks com ≥80% statements
- [ ] Cobertura global ≥78% statements
- [ ] Zero testes falhando

---

## Fase 2 — Componentes de Formulário

**Objetivo:** Testar a interação do usuário com formulários de criação/edição.
**Impacto estimado:** +4-5% cobertura global

### 2.1 Formulários de prêmios e tarefas

| Componente | Situação | Ação |
|------------|----------|------|
| `prize-form-fields.tsx` | Teste existe, expandir | Adicionar validação de campos |
| `task-form-fields.tsx` | Sem teste | Criar `task-form-fields.test.tsx` |
| `child-new-sheet.tsx` | 43% | Expandir para 80%+ |

**Cenários `task-form-fields`:**
- Renderiza campos: título, descrição, pontos, dias da semana, exige evidência
- Validação: título obrigatório, pontos > 0, pelo menos 1 dia selecionado
- Callback `onChange` dispara com valores corretos
- Estado de edição: campos preenchidos com dados existentes

**Cenários `child-new-sheet`:**
- Renderiza campos: nome, email, senha temporária
- Validação: nome obrigatório, email válido, senha ≥8 chars
- Submit chama mutation com dados corretos
- Erro de email duplicado exibe mensagem localizada
- Loading state durante submit

### 2.2 Componentes de perfil

| Componente | Situação | Ação |
|------------|----------|------|
| `notification-card.tsx` | Sem teste | Criar teste |
| `theme-card.tsx` | Sem teste | Criar teste |
| `personal-data-card.tsx` | Sem teste | Criar teste |
| `password-card.tsx` | Sem teste | Criar teste |

**Cenários `notification-card`:**
- Renderiza toggles para cada preferência de notificação
- Toggle dispara `onPreferencesChange` com o valor correto
- Exibe estado de saving
- Exibe mensagem de erro quando falha
- Modo read-only desabilita toggles

### Critério de aceite Fase 2
- [ ] Todos os formulários com teste de validação
- [ ] Componentes de perfil com teste de interação
- [ ] Cobertura global ≥82% statements
- [ ] Zero testes falhando

---

## Fase 3 — Telas sem Cobertura

**Objetivo:** Fechar as lacunas de telas que não têm nenhum teste.
**Impacto estimado:** +3-4% cobertura global

### 3.1 Telas child sem teste

| Tela | Cobertura | Ação |
|------|-----------|------|
| `child/historico.tsx` | 0% | Criar `test/routes/child-historico.test.tsx` |
| `child/redemptions/index.tsx` | 0% | Criar `test/routes/child-redemptions.test.tsx` |

**Cenários `child-historico`:**
- Loading state com skeleton
- Lista de transações por período
- Navegação entre períodos (mês anterior/próximo)
- Empty state quando não há transações
- Pull-to-refresh

**Cenários `child-redemptions`:**
- Loading state
- Lista de resgates com status (pendente, confirmado, cancelado)
- Tabs de filtro por status
- Empty state por tab
- Pull-to-refresh

### 3.2 Telas admin com cobertura baixa

| Tela | Cobertura | Ação |
|------|-----------|------|
| `admin/tasks/[id].tsx` | 56% | Expandir route test existente |
| `admin/redemptions/index.tsx` | 61% | Expandir route test existente |

**Cenários a adicionar em `admin-task-detail`:**
- Ação de pausar tarefa com confirmação
- Ação de arquivar tarefa
- Ação de excluir tarefa com contagem de pendências
- Edição de tarefa (abre form sheet)

**Cenários a adicionar em `redemptions`:**
- Confirmar resgate com feedback de sucesso
- Cancelar resgate com confirmação
- Filtro por tabs (pendentes, confirmados, cancelados)

### Critério de aceite Fase 3
- [ ] `child/historico.tsx` e `child/redemptions/index.tsx` com ≥70% coverage
- [ ] Remover esses arquivos da lista de exclusão do vitest.config.ts
- [ ] Cobertura global ≥84% statements
- [ ] Zero testes falhando

---

## Fase 4 — Componentes UI Base

**Objetivo:** Completar a cobertura dos building blocks reutilizáveis.
**Impacto estimado:** +2-3% cobertura global

### 4.1 Componentes sem teste dedicado

| Componente | Cobertura | Prioridade |
|------------|-----------|------------|
| `empty-state.tsx` | 100% (via route tests) | Baixa — já coberto indiretamente |
| `inline-message.tsx` | 73% | Média — testar variantes |
| `list-footer.tsx` | 20% | Alta — loading state |
| `fullscreen-image-viewer.tsx` | 33% | Média — abrir/fechar |
| `home-footer-bar.tsx` | 91% | Baixa — quase completo |
| `avatar.tsx` | 89% | Baixa — quase completo |
| `badge.tsx` | 100% | Nenhuma — já coberto |

**Cenários `inline-message`:**
- Renderiza com variante `success` (cor verde)
- Renderiza com variante `error` (cor vermelha)
- Renderiza com variante `warning` (cor amarela)
- Renderiza com variante `info` (cor azul)

**Cenários `list-footer`:**
- Renderiza ActivityIndicator quando `loading=true`
- Renderiza null quando `loading=false`

**Cenários `fullscreen-image-viewer`:**
- Renderiza imagem quando `visible=true`
- Chama `onClose` ao pressionar botão de fechar
- Não renderiza quando `visible=false`

### Critério de aceite Fase 4
- [ ] Todos os componentes UI com ≥80% coverage
- [ ] Cobertura global ≥85% statements
- [ ] Zero testes falhando

---

## Fase 5 — Testes de Integração e Qualidade

**Objetivo:** Adicionar testes que validam fluxos completos e invariantes de negócio.
**Impacto estimado:** +1-2% cobertura + confiabilidade

### 5.1 Property tests para regras de negócio

| Módulo | Cenário | Tipo |
|--------|---------|------|
| `lib/balances.ts` | `calculateProjection` sempre ≥1 quando rate > 0 e cofrinho > 0 | Property |
| `lib/balances.ts` | `formatTransactionDates` nunca retorna string vazia | Property |
| `lib/tasks.ts` | `formatWeekdays` retorna "Todos os dias" para 127 e string não-vazia para qualquer valor 1-126 | Property |
| `lib/prizes.ts` | `PRIZE_EMOJIS` contém apenas emojis válidos | Property |
| `lib/validation.ts` | `isValidEmail` rejeita strings sem @ e aceita formato user@domain.tld | Property |

### 5.2 Testes de fluxo integrado

| Fluxo | Descrição | Arquivos envolvidos |
|-------|-----------|---------------------|
| Aprovação de tarefa | Admin aprova → pontos creditados → cache invalidado | `use-tasks.ts`, `lib/tasks.ts`, `lib/balances.ts` |
| Resgate de prêmio | Child solicita → admin confirma → saldo debitado | `use-redemptions.ts`, `lib/redemptions.ts` |
| Transferência cofrinho | Child transfere → saldo atualizado → projeção recalculada | `use-balances.ts`, `lib/balances.ts` |

### 5.3 Expandir E2E (Maestro)

| Flow | Situação | Ação |
|------|----------|------|
| `login.yaml` | ✓ Existe | — |
| `logout.yaml` | ✓ Existe | — |
| `create-account.yaml` | ✓ Existe | — |
| `create-task.yaml` | ✓ Existe | — |
| `approve-task.yaml` | Não existe | Criar |
| `redeem-prize.yaml` | Não existe | Criar |
| `piggy-bank-transfer.yaml` | Não existe | Criar |
| `admin-invite.yaml` | Não existe | Criar |

### Critério de aceite Fase 5
- [ ] ≥5 novos property tests cobrindo invariantes de negócio
- [ ] ≥3 testes de fluxo integrado
- [ ] ≥4 novos E2E flows no Maestro
- [ ] Cobertura global ≥87% statements
- [ ] SonarCloud Quality Gate: todas as métricas A

---

## Métricas-Alvo por Fase

| Métrica | Baseline | Fase 1 | Fase 2 | Fase 3 | Fase 4 | Fase 5 |
|---------|----------|--------|--------|--------|--------|--------|
| Statements | 73.6% | 78% | 82% | 84% | 85% | 87% |
| Branches | 67.1% | 73% | 77% | 79% | 81% | 83% |
| Functions | 62.7% | 70% | 75% | 78% | 80% | 83% |
| Lines | 75.1% | 80% | 83% | 85% | 87% | 88% |
| Testes | 1139 | ~1350 | ~1450 | ~1530 | ~1590 | ~1650 |

---

## Regras de Execução

1. **Cada fase é um commit (ou branch) independente** — não misturar fases
2. **Rodar `npm run typecheck && npm run lint && npm test` antes de cada commit**
3. **Não alterar código de produção** — apenas adicionar testes
4. **Seguir os padrões existentes** — mocks em `vi.hoisted()`, `createSingleQuery()`, `createOrderQuery()`
5. **Cada teste deve ser significativo** — sem assertions triviais para inflar cobertura
6. **Property tests usam `fast-check`** — já configurado no projeto
7. **Route tests usam `test-renderer`** — via `test/helpers/test-renderer-compat`
