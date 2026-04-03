# Trofinho

Aplicativo mobile de educação financeira familiar. Um adulto administra a família, cadastra filhos, cria tarefas com pontuação, acompanha saldos e gerencia prêmios. A criança conclui tarefas, envia evidência quando necessário, transfere pontos para o cofrinho e solicita resgates.

## Stack

| Camada | Tecnologia |
| --- | --- |
| App mobile | React Native 0.83 |
| Runtime | Expo SDK 55 |
| Navegação | Expo Router v6 |
| Linguagem | TypeScript em `strict` |
| Estado/Cache | React Query (TanStack Query v5) |
| Backend | Supabase (`Auth`, Postgres, Storage, RLS) |
| Testes | Vitest com cobertura de testes |

## Ferramentas e serviços

| Ferramenta | Papel no projeto |
| --- | --- |
| Supabase | Banco de dados Postgres gerenciado, com autenticação, storage e políticas de RLS |
| Notion | Planejamento e organização do desenvolvimento: roadmap, tarefas e anotações internas |
| SonarCloud | Análise contínua de qualidade de código: cobertura, dívida técnica e inspeção estática |
| Sentry | Monitoramento de erros, logs operacionais e navegação em produção, com suporte a source maps nos builds |
| EAS Build | Geração de builds Android e iOS via Expo Application Services |
| Development Build | Testes locais em dispositivos físicos com hot reload e suporte completo a plugins nativos |
| Jules | Revisão automatizada de código com IA para monitoramento de qualidade e consistência |

## Estado atual do produto

### Fluxo de autenticação

- Login por e-mail e senha
- Cadastro de adulto
- Onboarding para criar a família logo após o cadastro
- Persistência de sessão em `expo-secure-store`

### Área do administrador

- Home com resumo da família, filhos, pendências e ações rápidas
- Cadastro de filhos e consulta de nome/e-mail em tela somente leitura
- Criação e edição de tarefas com regras de bloqueio por execução
- Validação e rejeição de atribuições com motivo
- Consulta de saldos e histórico por filho
- Configuração de valorização automática do cofrinho, com lançamento no histórico e no saldo
- Aplicação de penalização
- Cadastro, edição, ativação e desativação de prêmios com capa opcional
- Acompanhamento e confirmação/cancelamento de resgates
- Edição básica de perfil, avatar, senha, tema e preferências locais de notificação

### Área da criança

- Home com resumo de tarefas e saldo
- Lista de tarefas por status
- Conclusão de tarefa com ou sem foto
- Consulta de saldo livre, cofrinho e histórico
- Transferência de pontos para o cofrinho
- Lista de prêmios disponíveis
- Solicitação de resgates
- Consulta do histórico de resgates

## Arquitetura

O projeto segue uma divisão simples e direta:

- `app/`: telas e composição de rotas do Expo Router.
- `lib/`: acesso a dados, integração com Supabase, validações e regras de negócio reutilizáveis.
- `src/components/`: componentes visuais reutilizáveis.
- `src/constants/`: tokens do design system e utilitários de apresentação.
- `src/context/`: providers base de tema e query client local.
- `src/hooks/`: custom hooks e queries/mutações (usando React Query) que isolam o estado e o acesso a dados das telas.
- `src/types/`: tipagem central e tipos gerados via CLI do Supabase.
- `supabase/migrations/`: fonte de verdade do schema do banco.

### Organização de rotas

- `app/(auth)`: login, cadastro e onboarding.
- `app/(admin)`: experiência do responsável.
- `app/(child)`: experiência da criança.
- `app/_layout.tsx`: bootstrap do app, fontes, tema e redirecionamento por sessão/perfil.

### Fluxo de dados

- Componentes de tela devem usar os custom hooks expostos em `src/hooks/queries` (via React Query) em vez de chamar `lib/*` diretamente para state/fetching, passando a aproveitar o cache global.
- As funções dentro de `lib/*` executam o acesso puro de rede com validação.
- `lib/supabase.ts` centraliza o client do Supabase.
- `lib/auth-state.ts` trata mudanças de autenticação sem bloquear o listener do Supabase.
- Tipos de apresentação baseados em tema ficam em `src/constants/*`, não em `lib/*`.

## Design system

Os tokens ficam em `src/constants/`:

- `colors.ts`: paleta light/dark e estados semânticos.
- `spacing.ts`: escala de espaçamento.
- `typography.ts`: famílias, tamanhos e pesos.
- `radius.ts`: raios padrão.
- `shadows.ts`: sombras, gradientes e easing.
- `theme.ts`: barrel para compatibilidade de import.
- `status.ts`: labels e cores de status para a camada de apresentação.

Regra obrigatória: não criar cor, fonte, espaçamento, radius ou sombra diretamente em componentes se o valor puder virar token.

## Instalação

### Pré-requisitos

- Node.js 20+ (recomendado: 22 LTS)
- npm
- Development build para testes em dispositivo físico (gerado via EAS ou `npx expo run:android`)
- Docker, se for usar o Supabase local

### Setup do repositório

```bash
git clone <url-do-repositorio>
cd trofinho
npm install
cp .env.example .env.local
```

### Configuração do Sentry

O projeto usa Sentry para monitoramento em produção. A integração captura erros e contexto básico de navegação, mas é inicializada somente quando `EXPO_PUBLIC_SENTRY_DSN` estiver definido.

- `EXPO_PUBLIC_SENTRY_DSN`: DSN público do projeto Sentry para envio de eventos do app.
- `SENTRY_AUTH_TOKEN`: token usado apenas em build time para upload de source maps no EAS Build.

Sem `EXPO_PUBLIC_SENTRY_DSN`, o app continua funcionando normalmente e as chamadas ao Sentry viram no-op.

### Para desenvolvedores (Forks)

Se você clonou este repositório para a sua própria máquina e vai rodar os comandos de build via EAS (na nuvem da Expo), é necessário primeiro desvincular o app da conta original do criador:

1. No `app.json`, **apague** a propriedade final `"owner"` e também o `"projectId"` (dentro de `extra.eas`).
2. Se quiser evitar warnings/erros de telemetria, remova também o array do pacote Sentry na seção `plugins` ou altere a "organization" para a sua.
3. No terminal, rode `npx eas init` para criar um projeto correspondente na sua própria conta do Expo.

### Setup do Backend (Supabase)

O Trofinho depende ativamente de tabelas e funções (RPCs) no Postgres (`supabase/migrations/`). Você pode rodar local com Docker ou na nuvem.

> ⚠️ **DICA (Banco em Nuvem): Desligue a confirmação de e-mail.** 
> Se for usar Supabase Remoto sem ter configurado servidor de SMTP, acesse seu Studio Web, vá em **Authentication > Providers > Email** e **desative** a opção "Confirm email" para criar as famílias livremente.
> *(Nota: Para Opção A, via banco local, isso já vem devidamente desabilitado no `config.toml` do repositório).* 

#### Opção A: Supabase Local (Recomendado)

Inicia o banco via Docker e aplica o schema automaticamente:

```bash
npm run db:start
```

O terminal exibirá uma URL e uma key. Cole-as no seu `.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

Use `npm run db:studio` para acessar a interface visual de banco no navegador.

#### Opção B: Supabase Remoto (Nuvem)

Se você criou um projeto no site do Supabase, preencha o `.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=SEU_ANON_KEY_AQUI
```

Em seguida, faça o push do schema local para o seu banco na nuvem:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
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

Observação: o projeto usa development build (`expo-dev-client`) para testes em dispositivo. Gere o APK com o perfil `development` do `eas.json` e instale no celular. Depois, `npm run tunnel` conecta o dev server ao app.

## Build

**Desenvolvimento (EAS - Nuvem)** — gere um development build para iteração no dispositivo:

```bash
npx eas-cli@latest build --profile development --platform android
```

**Desenvolvimento (Local/Nativo)** — se você possui o Android Studio e ferramentas nativas instaladas e prefere rodar tudo no seu próprio PC sem a fila da nuvem:

```bash
npx expo run:android
```

Depois de instalar/compilar o APK, inicie o dev server:

```bash
npm run tunnel
```

**Distribuição interna (Android)** — gera um APK via EAS e disponibiliza um link/QR code para instalação direta, sem passar pela Play Store:

```bash
npm run build
```

Usa o perfil `preview` do `eas.json` (`distribution: internal`). Ideal para testes com usuários externos antes de uma release oficial.

## Convenções de código

- Código-fonte em inglês: variáveis, funções, tipos, arquivos e nomes técnicos.
- Texto para pessoas em pt-BR: interface, erros, logs, comentários, README e instruções.
- Termos do ecossistema podem permanecer em inglês quando isso melhora a clareza, como `hook`, `layout`, `router`, `storage` e `build`.
- Telas em `app/` não devem concentrar acesso direto ao Supabase em novas implementações.
- Regras visuais devem usar tokens de `src/constants/`.
- Componentes compartilhados ficam em `src/components/`.
- Comentários só devem existir para restrição técnica, regra de negócio ou decisão não óbvia.
- Não manter código morto ou hooks não usados.

## Uso do Supabase

- `lib/supabase.ts` cria o client compartilhado.
- Sessão fica persistida em `deviceStorage`, com suporte a chunking por limite do `SecureStore`.
- RPCs concentram mutações críticas como criação de família, tarefas, valorização e resgates.
- O schema operacional deve ser mantido pelas migrations em `supabase/migrations/`.
- Políticas de RLS fazem parte do desenho da aplicação e não devem ser contornadas pelo app.

## Uso do Expo Router

- As rotas são file-based e separadas por grupo de acesso.
- O projeto usa `headerShown: false` e cabeçalho próprio com `ScreenHeader`.
- `app/_layout.tsx` decide o fluxo inicial com base em sessão e perfil.
- Ao criar novas telas, preserve a separação `(auth)`, `(admin)` e `(child)`.

## Verificação antes de fechar mudanças

Sempre rode:

```bash
npm run typecheck
npm test
```

Em alterações com impacto visual, valide também manualmente no tema claro e escuro.
