# Auditoria de Product Design & UX — Trofinho

**Consultor:** GitHub Copilot Senior Product Design Advisor
**Data de análise:** 14/03/2026
**Escopo:** Revisão total do código-fonte + inspeção visual via navegador; fluxo completo Pai, Filho e cadastro

---

## 1. Análise Geral da Experiência

O Trofinho é um aplicativo de gamificação familiar com mecânica de tarefas → pontos → prêmios. A proposta de valor é sólida e o design system subjacente — tokens de cor, tipografia Nunito, sombras, gradientes dourados — está bem estruturado e é mais sofisticado do que a média de MVPs. As animações de entrada com `Animated.spring` dão personalidade ao produto.

Porém, a consistência cai progressivamente à medida que o usuário avança para telas secundárias. As telas mais trabalhadas (Login, Home do Filho) criam uma expectativa visual alta que as telas de gestão (Novo Prêmio, Onboarding, Resgates) não atendem. Esse delta de qualidade é o principal ponto a endereçar.

---

## 2. Pontos Fortes

| # | Ponto Forte |
|---|---|
| 1 | **Design system robusto** — `theme.ts` com tokens de espaçamento, bordas, cores semânticas, tipografia e sombras bem definidos, incluindo `goldGlow` e `goldButton` |
| 2 | **Dark mode** funcional com paleta independente alinhada ao design studio |
| 3 | **Animações de entrada expressivas** — mascote com `spring` + rotação, fade + translateY em conteúdo |
| 4 | **Dois estados do mascote** no home do Filho (tarefas pendentes vs. "Troféu conquistado! 🎉") — microinteração deliciosa e motivacional |
| 5 | **Barra de progresso por prêmio** no catálogo — mecânica visual de motivação excelente |
| 6 | **Cofrinho com valorização** (taxa de juros configurável) — diferencial de produto único e educativo |
| 7 | `useFocusEffect` para refresh consistente ao voltar para qualquer tela |
| 8 | **Limpeza de erro ao digitar** (`setError('')` no onChange) — microinteração correta |
| 9 | **EmptyState, ScreenHeader, Badge, Avatar, PointsDisplay** — biblioteca de componentes consolidada |
| 10 | **Acessibilidade** — `accessibilityRole`, `accessibilityLabel`, `accessibilityState` em elementos interativos |
| 11 | **Filtros em abas** na lista de tarefas do Filho (Pendentes / Em validação / Histórico) |
| 12 | Mensagem de orientação após rejeição de tarefa: *"Converse com o responsável para alinhar os próximos passos."* — empatia bem calibrada |

---

## 3. Problemas Identificados

### 3.1 Onboarding — Ruptura Visual Crítica do Fluxo de Conversão

A tela de onboarding é a **terceira tela que todo usuário novo vê** e apresenta identidade visual completamente diferente das telas de Login e Registro.

| Atributo | Login/Registro | Onboarding |
|---|---|---|
| Mascote animado | ✅ Spring + rotação | ❌ Emoji 🏠 estático |
| Botão primário | Gradiente dourado + sombra 3D | Botão plano roxo (`accent.admin`) |
| BorderRadius dos inputs | `radii.inner` (16px) | `radii.md` (12px) |
| FontFamily no botão "Voltar" | Definida | ❌ Não definida (fallback do sistema) |
| Animações de entrada | Parallax mascote + fade conteúdo | ❌ Nenhuma |
| `KeyboardAvoidingView` | `behavior="padding"` | `behavior={iOS ? 'padding' : 'height'}` |

**Impacto:** O usuário sente que entrou em um produto diferente imediatamente após criar a conta.

---

### 3.2 Lista de Filhos (Admin) — Card Não-Navegável

Em `/(admin)/children/index.tsx`, os cards da lista são `<View>`, não `<Pressable>`. O usuário **não consegue clicar para navegar** ao saldo ou detalhes de um filho a partir dessa tela.

No entanto, no dashboard home do Admin, os cards horizontais de filhos **são** `<Pressable>` e navegam para `/(admin)/balances/${item.id}`. Essa incongruência é um bug de UX: a tela "official" de lista de filhos é uma dead-end.

---

### 3.3 Estados de Erro com Layout Quebrado

Em `/(admin)/tasks/[id].tsx` e `/(child)/tasks/[id].tsx`, o container de erro usa:

```tsx
<View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
  <ScreenHeader ... />
  <EmptyState ... />
</View>
```

Onde `styles.center = { flex: 1, alignItems: 'center', justifyContent: 'center' }`. O `ScreenHeader` fica centralizado verticalmente no meio da tela em vez de fixado no topo.

---

### 3.4 Botão "Guardar no Cofrinho" — Semântica de Cor Errada

Em `/(child)/balance.tsx`, o botão de transferência usa `colors.semantic.warning` (#D97706 laranja/âmbar) como cor de fundo. Cor semântica de alerta/aviso aplicada a uma **ação positiva de poupança** — semanticamente incorreto e potencialmente confuso.

---

### 3.5 Localização de "Sair" — Ação Destrutiva Enterrada

Ambas as home screens (Admin e Filho) colocam o botão "Sair" no final do `ScrollView`, após todo o conteúdo. Em dispositivos com telas pequenas ou em contas com muitos dados, o botão será completamente invisível na primeira visualização. Não há ponto de entrada fixo para logout.

---

### 3.6 Inconsistência no Padrão de Confirmação Destrutiva

| Tela | Padrão de confirmação |
|---|---|
| Resgates (confirmar/cancelar) | `Alert.alert` nativo |
| Saldo — transferir ao cofrinho | `Modal` customizado |
| Penalização de saldo | `Modal` customizado |

`Alert.alert` foge completamente do design system (tipografia, cores, bordas). Qualquer dialog de confirmação deveria usar o `Modal` estilizado já existente.

---

### 3.7 Ausência de Pull-to-Refresh

Nenhuma das listas (`FlatList`) implementa `RefreshControl`. A única forma de atualizar dados é voltar e retornar à tela. O `useFocusEffect` mitiga isso, mas não é suficiente — o usuário não tem controle sobre quando atualizar sem navegar.

---

### 3.8 Tamanho Inconsistente do Mascote entre Login e Registro

| Tela | Mascote |
|---|---|
| Login | 140 × 140px |
| Registro | 100 × 100px |

A redução foi provavelmente intencional para acomodar 4 campos (+1 que o login), mas cria descontinuidade visual no fluxo de conversão. A abordagem correta seria manter o tamanho e reduzir o logo/headline.

---

### 3.9 Ausência de Feedback Visual em Estado de Sucesso (Criação de Tarefas e Prêmios)

- `/(admin)/tasks/new.tsx`: Após criar → `router.back()` silencioso
- `/(admin)/prizes/new.tsx`: Após criar → `router.back()` silencioso

`/(admin)/children/new.tsx` mostra uma tela de sucesso com emoji 🎉 e exibe as credenciais — um padrão muito superior. Os outros formulários de criação deveriam ter ao menos um toast ou tela de confirmação.

---

### 3.10 Parâmetro de Nome Frágil na Tela de Saldo do Filho (Admin)

Em `/(admin)/balances/[filho_id].tsx`:
```tsx
const { filho_id, nome } = useLocalSearchParams<{ filho_id: string; nome: string }>();
// ...
<ScreenHeader title={nome ?? 'Saldo'} .../>
```

O `nome` vem via query param. Se o usuário navegar diretamente pela URL (deep link, histórico), `nome` será `undefined` e o header mostrará apenas *"Saldo"* — sem identificar de qual filho.

---

### 3.11 Mensagens de Erro em Inglês do Supabase

`setError(createError.message)` / `setError(signUpError.message)` retornam mensagens brutas da API Supabase, que são em inglês: *"User already registered"*, *"Invalid login credentials"*, *"Password should be at least 6 characters"*. Essas strings chegam diretamente ao usuário.

---

### 3.12 Botão Primário de "Novo Prêmio" sem Consistência

Em `prizes/new.tsx`, o botão primário "Criar prêmio" tem estilo local com `backgroundColor: colors.accent.admin` — completamente diferente do gradiente dourado usado em Login e Registro. O padrão visual para CTAs primários não está centralizado em um componente.

---

### 3.13 Indicador de Foco em Inputs Ausente

Nenhum `TextInput` do app tem estilo visual de `focus` (borda colorida, mudança de cor de fundo). O campo focado é indistinguível do campo não-focado, o que resulta em navegação de teclado confusa, especialmente em formulários com 4+ campos (Registro, Novo Filho).

---

### 3.14 Rótulo do Status "Aguardando Validação" Inconsistente

| Contexto | Rótulo |
|---|---|
| Aba de filtro (tasks do Filho) | "Em validação" |
| Tag de status nos cards | Retorno de `getStatusLabel()` — verificar |
| Badge no admin dashboard | "aguardando" |

O mesmo estado tem três representações textuais diferentes dependendo da superfície.

---

### 3.15 Linha com Alinhamento Quebrado na Tela de Resgates

Em `/(admin)/redemptions/index.tsx`:

```tsx
<View style={{ flex: 1, gap: spacing['1'] }}>
  <Text style={[styles.premioNome, ...]}>...</Text>
  <Text style={styles.cardFilho}>...</Text>
</View>
```

O primeiro `<Text>` de `premioNome` não tem `flex: 1` próprio e está num container com `flex: 1`, enquanto o container ao lado tem `<View>` com `statusBadge` + `cardData`. Em larguras menores, o texto do prêmio e o badge se sobrepõem ou trocam de linha de forma inesperada.

---

## 4. Problemas Críticos

| Prioridade | Problema | Impacto |
|---|---|---|
| 🔴 P0 | Children list cards não são Pressable | Dead-end de navegação — usuário não consegue acessar saldo a partir da tela canônica de filhos |
| 🔴 P0 | Error state com `flex: 1 + center` renderiza ScreenHeader no meio da tela | UI quebrada em qualquer erro de carregamento de tarefa |
| 🔴 P1 | Onboarding com identidade visual completamente diferente | Ruptura de confiança no momento de maior intenção do usuário (end of registration funnel) |
| 🔴 P1 | Mensagens de erro Supabase em inglês exibidas ao usuário | Experiência não-localizada, confusa e antiproissional |

---

## 5. Inconsistências de UX/UI

| # | Inconsistência |
|---|---|
| 1 | Botão primário: gradiente dourado (auth) vs. plano roxo (onboarding, prêmios, filhos) |
| 2 | Confirmações destrutivas: `Alert.alert` nativo (resgates) vs. `Modal` customizado (saldo, penalidade) |
| 3 | Feedback pós-criação: tela de sucesso (filhos) vs. `router.back()` silencioso (tarefas, prêmios) |
| 4 | Mascote: 140px (login) vs. 100px (registro) |
| 5 | `borderRadius` de inputs: `radii.inner`/16px (login/registro) vs. `radii.md`/12px (onboarding, filhos) |
| 6 | Cor do botão "Guardar no cofrinho": semântica de warning para ação positiva |
| 7 | Rótulo de status "aguardando validação" aparece como 3 textos diferentes |
| 8 | Cards de filhos: navegáveis no home (Pressable) vs. não-navegáveis na lista dedicada (View) |
| 9 | Pull-to-refresh: ausente em todas as telas, exceto via `useFocusEffect` implícito |
| 10 | Foco de input: sem indicador visual em nenhuma tela |

---

## 6. Sugestões Práticas de Melhoria

### 6.1 Unificar o Botão Primário em um Componente

O `Button` component em `src/components/ui/button.tsx` já existe. Mapear todas as variantes (`gradient-gold`, `solid-admin`, `solid-filho`, `outline`, `ghost`) e usá-lo de forma exclusiva em todo o app elimina as inconsistências de CTA de uma vez.

### 6.2 Corrigir Onboarding — 3 mudanças de alto impacto

```tsx
// 1. Adicionar mascote com animation (manter mesmo padrão do login)
// 2. Substituir o botão plano pelo gradiente dourado
// 3. Usar radii.inner nos inputs
```

O onboarding deve usar a mesma linguagem visual das telas de auth para comunicar que ainda é o mesmo produto.

### 6.3 Tornar Children List Cards Navegáveis

```tsx
// Em /(admin)/children/index.tsx — trocar View por Pressable
<Pressable
  style={[styles.card, ...]}
  onPress={() => router.push(`/(admin)/balances/${item.id}?nome=${encodeURIComponent(item.nome)}`)}
>
```

### 6.4 Corrigir Error States nos Detalhes de Tarefa

Mudar o container de erro para `flex: 1` simples (sem `justifyContent: 'center'`) ou extrair o ScreenHeader para fora do bloco condicional:

```tsx
return (
  <View style={{ flex: 1, backgroundColor: colors.bg.canvas }}>
    <ScreenHeader title="Detalhes" onBack={() => router.back()} />
    {loading ? <ActivityIndicator ... /> : error ? <EmptyState ... /> : <Content />}
  </View>
);
```

### 6.5 Mapear Erros Supabase para Português

Criar um utilitário em `lib/api-error.ts`:

```ts
const ERROR_MAP: Record<string, string> = {
  'User already registered': 'Este e-mail já está cadastrado.',
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
  'Password should be at least 6 characters': 'A senha deve ter ao menos 6 caracteres.',
};
export function localizeSupabaseError(msg: string): string {
  return ERROR_MAP[msg] ?? 'Algo deu errado. Tente novamente.';
}
```

### 6.6 Substituir Alert.alert por Modal Customizado nos Resgates

Reutilizar o padrão de Modal já implementado em `balance.tsx` para confirmações em `redemptions/index.tsx`. O alert nativo quebra a imersão visual do produto.

### 6.7 Adicionar RefreshControl nas FlatLists

```tsx
<FlatList
  refreshControl={
    <RefreshControl
      refreshing={loading}
      onRefresh={loadData}
      tintColor={colors.brand.vivid}
    />
  }
```

### 6.8 Indicador de Foco nos Inputs

```tsx
// Em cada TextInput, usar estado de foco
const [focused, setFocused] = useState(false);
<TextInput
  style={[styles.input, { borderColor: focused ? colors.border.focus : colors.border.default }]}
  onFocus={() => setFocused(true)}
  onBlur={() => setFocused(false)}
/>
```

A `border.focus = '#F5C518'` (dourado) já existe no design system — basta conectar.

### 6.9 Mover "Sair" para o Header

Adicionar um ícone de logout no `rightAction` do ScreenHeader das home pages, ou criar um menu de perfil acessível pelo Avatar.

```tsx
// No Admin Home — no lugar de scroll + botão Sair
<Avatar name={profile?.nome ?? 'A'} size={52} onPress={handleSignOut} />
```

### 6.10 Padronizar Cor do Botão "Guardar no Cofrinho"

Trocar `colors.semantic.warning` por `colors.accent.filho` (azul) ou `colors.brand.vivid` (dourado) — correspondendo ao cofrinho como destino positivo.

---

## 7. Recomendações Estratégicas

### 7.1 Implementar um `PrimaryButton` Component Global

A inconsistência de botões é o sintoma mais visível da ausência de um contrato de design. Um único componente `<PrimaryButton variant="gold|admin|filho" />` elimina ~8 inconsistências de uma vez e serve como guardrail para telas futuras.

### 7.2 Criar um Hook `useFormError` Padronizado

O padrão `useState<string | null>` + `setError(supabaseError.message)` repetido em 12+ telas poderia ser um hook que centraliza a localização do erro, limpeza no onChange e o mapeamento Supabase → PT-BR.

### 7.3 Skeleton Screens em Vez de ActivityIndicator Isolado

Substituir o `ActivityIndicator` centrado na tela por skeleton placeholders que imitam o layout real. Reduz a percepção de latência e mantém o usuário contextualizado enquanto carrega.

### 7.4 Toast/Snackbar para Feedback de Ações

Ações de sucesso atualmente são silenciosas (telas de criação), enquanto os poucos que têm feedback usam telas completas (cadastro de filho). Um componente de toast leve (lib `react-native-toast-message` ou implementação customizada usando `Animated`) padronizaria esse feedback sem interromper o fluxo.

### 7.5 Gamificação do Progresso no Home do Filho

O home do Filho já tem dois estados do mascote, mas poderia ir além:
- **Streak de dias** completando tarefas
- **Level/rank** baseado nos pontos acumulados
- **Animação de confetti** ao completar todas as tarefas do dia

Esses elementos transformam o app de funcional para **memorable e recorrente**.

### 7.6 Onboarding como Sequência de Slides

O onboarding atual resolve apenas a criação de família, mas não apresenta o produto. Uma sequência de 3–4 slides after sign-up (o que são pontos, como funcionam os prêmios, o cofrinho) reduziria a curva de aprendizado e aumentaria a ativação.

### 7.7 Navegação Bottom Tab para o Admin

A estrutura de navegação do Admin é inteiramente baseada em push/back via quick links no home. A medida que o produto cresce, um bottom tab bar com Início / Tarefas / Filhos / Prêmios / Resgates oferece acesso imediato e reduz a hierarquia de navegação de 3 toques para 1.

### 7.8 Deep Link para Validação de Tarefas

O admin poderia receber push notification → deep link direto para a tarefa aguardando validação, eliminando todo o caminho `Home → Tarefas → Tarefa específica`. Isso é especialmente relevante quando o produto evoluir para múltiplos filhos com alta frequência de submissões.

---

## 8. Resumo Executivo de Prioridades

| Prioridade | Ação | Esforço estimado |
|---|---|---|
| 🔴 1 | Corrigir cards de filhos não-navegáveis | Trivial (View → Pressable + onPress) |
| 🔴 2 | Corrigir error state layout (ScreenHeader fora do centro) | Pequeno (refatorar condicional) |
| 🔴 3 | Localizar erros Supabase para PT-BR | Pequeno (1 arquivo utilitário) |
| 🟠 4 | Unificar botões primários (PrimaryButton component) | Médio |
| 🟠 5 | Refatorar Onboarding para consistência visual | Médio |
| 🟠 6 | Substituir Alert.alert por Modal customizado | Médio |
| 🟡 7 | Indicador de foco nos inputs | Pequeno (estado local por campo) |
| 🟡 8 | Adicionar RefreshControl | Pequeno (copiar padrão) |
| 🟡 9 | Hook de localização de erros e formulário | Médio |
| 🟡 10 | Mover "Sair" para o header | Pequeno |
| 🟢 11 | Toast de sucesso em criação de tarefas/prêmios | Médio |
| 🟢 12 | Skeleton screens | Grande |
| 🟢 13 | Bottom tab navigation para admin | Grande |
| 🟢 14 | Gamificação avançada no home do filho | Grande |

---

## 9. Conclusão

O Trofinho tem uma base de design e arquitetura sólidas. Os problemas não são estruturais — são de **consistência e polish**. Resolvendo os P0/P1, o app já atinge um nível de qualidade percebida muito superior. Com as demais melhorias, estará pronto para escala de produto.
