# Trofinho

Aplicativo mobile de educacao financeira familiar. Um adulto administra a familia, cadastra filhos, cria tarefas com pontuacao, acompanha saldos e gerencia premios. A crianca conclui tarefas, envia evidencia quando necessario, transfere pontos para o cofrinho e solicita resgates.

## Stack

| Camada | Tecnologia |
| --- | --- |
| App mobile | React Native 0.81 |
| Runtime | Expo SDK 54 |
| Navegacao | Expo Router v6 |
| Linguagem | TypeScript em `strict` |
| Backend | Supabase (`Auth`, Postgres, Storage, RLS) |
| Testes | Vitest |

## Estado Atual Do Produto

### Fluxo de autenticacao

- Login por e-mail e senha
- Cadastro de adulto
- Onboarding para criar a familia logo apos o cadastro
- Persistencia de sessao em `expo-secure-store`

### Area do administrador

- Home com resumo da familia, filhos, pendencias e acoes rapidas
- Cadastro de filhos
- Criacao de tarefas
- Validacao e rejeicao de atribuicoes com motivo
- Consulta de saldos e historico por filho
- Configuracao e aplicacao manual de valorizacao do cofrinho
- Aplicacao de penalizacao
- Cadastro, edicao, ativacao e desativacao de premios
- Acompanhamento e confirmacao/cancelamento de resgates
- Edicao basica de perfil, avatar, senha, tema e preferencias locais de notificacao

### Area da crianca

- Home com resumo de tarefas e saldo
- Lista de tarefas por status
- Conclusao de tarefa com ou sem foto
- Consulta de saldo livre, cofrinho e historico
- Transferencia de pontos para o cofrinho
- Lista de premios disponiveis
- Solicitacao de resgates
- Consulta do historico de resgates

## Arquitetura

O projeto segue uma divisao simples e direta:

- `app/`: telas e composicao de rotas do Expo Router.
- `lib/`: acesso a dados, integracao com Supabase, validacoes e regras de negocio reutilizaveis.
- `src/components/`: componentes visuais reutilizaveis.
- `src/constants/`: tokens do design system e utilitarios de apresentacao.
- `src/context/`: providers globais, hoje com tema.
- `supabase/migrations/`: fonte de verdade do banco.

### Organizacao de rotas

- `app/(auth)`: login, cadastro e onboarding.
- `app/(admin)`: experiencia do responsavel.
- `app/(child)`: experiencia da crianca.
- `app/_layout.tsx`: bootstrap do app, fontes, tema e redirecionamento por sessao/perfil.

### Fluxo de dados

- Componentes de tela chamam funcoes de `lib/*`.
- `lib/supabase.ts` centraliza o client do Supabase.
- `lib/auth-state.ts` trata mudancas de autenticacao sem bloquear o listener do Supabase.
- Tipos de apresentacao baseados em tema ficam em `src/constants/*`, nao em `lib/*`.

## Estrutura De Pastas

```text
app/
  _layout.tsx
  index.tsx
  (auth)/
  (admin)/
  (child)/
lib/
  auth.ts
  balances.ts
  children.ts
  prizes.ts
  tasks.ts
  supabase.ts
  validation.ts
src/
  components/
    auth/
    balance/
    prizes/
    profile/
    ui/
  constants/
    assets.ts
    colors.ts
    radius.ts
    shadows.ts
    spacing.ts
    status.ts
    theme.ts
    typography.ts
  context/
    theme-context.tsx
  types/
supabase/
  migrations/
  schema.sql
  seed.sql
```

## Design System

Os tokens ficam em `src/constants/`:

- `colors.ts`: paleta light/dark e estados semanticos.
- `spacing.ts`: escala de espacamento.
- `typography.ts`: familias, tamanhos e pesos.
- `radius.ts`: raios padrao.
- `shadows.ts`: sombras, gradientes e easing.
- `theme.ts`: barrel para compatibilidade de import.
- `status.ts`: labels e cores de status para a camada de apresentacao.

Regra obrigatoria: nao criar cor, fonte, espacamento, radius ou sombra diretamente em componentes se o valor puder virar token.

## Instalacao

### Pre-requisitos

- Node.js 18+
- npm
- Expo Go ou simulador/emulador
- Docker, se for usar o Supabase local

### Setup

```bash
git clone <url-do-repositorio>
cd trofinho
npm install
cp .env.example .env.local
```

Preencha `.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=SEU_ANON_KEY_AQUI
```

## Desenvolvimento

### App

```bash
npm start
npm run android
npm run ios
npm run web
npm run tunnel
```

### Validacao

```bash
npm run typecheck
npm test
```

### Supabase local

```bash
npm run db:start
npm run db:status
npm run db:reset
npm run db:stop
```

## Build

O repositorio nao versiona `eas.json` neste momento.

- Bundle web/local: `npx expo export --platform web`
- Build nativo: configure o EAS antes de usar `npx eas build --platform android` ou `npx eas build --platform ios`

Se a equipe decidir formalizar pipeline de build, o proximo passo recomendado e versionar `eas.json` e documentar perfis de ambiente.

## Convencoes De Codigo

- Codigo-fonte para maquina em ingles: variaveis, funcoes, tipos, arquivos e nomes tecnicos.
- Texto para pessoas em pt-BR: interface, erros, logs, comentarios, README e instrucoes.
- Telas em `app/` nao devem concentrar acesso direto ao Supabase em novas implementacoes.
- Regras visuais devem usar tokens de `src/constants/`.
- Componentes compartilhados ficam em `src/components/`.
- Comentarios so devem existir para restricao tecnica, regra de negocio ou decisao nao obvia.
- Nao manter codigo morto ou hooks nao usados.

## Regras De Idioma

- Interface, mensagens, logs e documentacao: pt-BR.
- Codigo e API externa: ingles.
- Termos do ecossistema podem permanecer em ingles quando isso melhora a clareza tecnica, como `hook`, `layout`, `router`, `storage` e `build`.

## Uso Do Supabase

- `lib/supabase.ts` cria o client compartilhado.
- Sessao fica persistida em `deviceStorage`, com suporte a chunking por limite do `SecureStore`.
- RPCs concentram mutacoes criticas como criacao de familia, tarefas, valorizacao e resgates.
- O schema operacional deve ser mantido pelas migrations em `supabase/migrations/`.
- Politicas de RLS fazem parte do desenho da aplicacao e nao devem ser contornadas pelo app.

## Uso Do Expo Router

- As rotas sao file-based e separadas por grupo de acesso.
- O projeto usa `headerShown: false` e cabecalho proprio com `ScreenHeader`.
- `app/_layout.tsx` decide o fluxo inicial com base em sessao e perfil.
- Ao criar novas telas, preserve a separacao `(auth)`, `(admin)` e `(child)`.

## Verificacao Antes De Fechar Mudancas

Sempre rode:

```bash
npm run typecheck
npm test
```

Em alteracoes com impacto visual, valide tambem manualmente no tema claro e escuro.
