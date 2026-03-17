# Trofinho

Aplicativo mobile de educação financeira familiar. Um adulto administra a família, cadastra filhos, cria tarefas com pontuação, acompanha saldos e gerencia prêmios. A criança conclui tarefas, envia evidência quando necessário, transfere pontos para o cofrinho e solicita resgates.

## Stack

| Camada | Tecnologia |
| --- | --- |
| App mobile | React Native 0.81 |
| Runtime | Expo SDK 54 |
| Navegação | Expo Router v6 |
| Linguagem | TypeScript em `strict` |
| Backend | Supabase (`Auth`, Postgres, Storage, RLS) |
| Testes | Vitest |

## Estado Atual Do Produto

### Fluxo de autenticação

- Login por e-mail e senha
- Cadastro de adulto
- Onboarding para criar a família logo após o cadastro
- Persistência de sessão em `expo-secure-store`

### Área do administrador

- Home com resumo da família, filhos, pendências e ações rápidas
- Cadastro de filhos
- Criação de tarefas
- Validação e rejeição de atribuições com motivo
- Consulta de saldos e histórico por filho
- Configuração e aplicação manual de valorização do cofrinho
- Aplicação de penalização
- Cadastro, edição, ativação e desativação de prêmios
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
- `src/context/`: providers globais, hoje com tema.
- `supabase/migrations/`: fonte de verdade do banco.

### Organização de rotas

- `app/(auth)`: login, cadastro e onboarding.
- `app/(admin)`: experiência do responsável.
- `app/(child)`: experiência da criança.
- `app/_layout.tsx`: bootstrap do app, fontes, tema e redirecionamento por sessão/perfil.

### Fluxo de dados

- Componentes de tela chamam funções de `lib/*`.
- `lib/supabase.ts` centraliza o client do Supabase.
- `lib/auth-state.ts` trata mudanças de autenticação sem bloquear o listener do Supabase.
- Tipos de apresentação baseados em tema ficam em `src/constants/*`, não em `lib/*`.

## Design System

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

- Node.js 18+
- npm
- Expo Go ou simulador/emulador
- Docker, se for usar o Supabase local

### Setup do Repositório

```bash
git clone <url-do-repositorio>
cd trofinho
npm install
cp .env.example .env.local
```

### Setup do Backend (Supabase)

O Trofinho depende ativamente de tabelas e funções (RPCs) no Postgres (`supabase/migrations/`). Você pode rodar local com Docker ou na nuvem.

> ⚠️ **IMPORTANTE: Desligue a confirmação de e-mail.** 
> Para testar o cadastro livremente em ambiente de desenvolvimento (sem configurar SMTP), acesse o painel/Studio do Supabase, vá em **Authentication > Providers > Email** e **desative** a opção "Confirm email". 

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

### Validação

```bash
npm run typecheck
npm test
```

## Build

O repositório não versiona `eas.json` neste momento.

- Bundle web/local: `npx expo export --platform web`
- Build nativo: configure o EAS antes de usar `npx eas build --platform android` ou `npx eas build --platform ios`

Se a equipe decidir formalizar pipeline de build, o próximo passo recomendado é versionar `eas.json` e documentar perfis de ambiente.

## Convenções De Código

- Código-fonte para máquina em inglês: variáveis, funções, tipos, arquivos e nomes técnicos.
- Texto para pessoas em pt-BR: interface, erros, logs, comentários, README e instruções.
- Telas em `app/` não devem concentrar acesso direto ao Supabase em novas implementações.
- Regras visuais devem usar tokens de `src/constants/`.
- Componentes compartilhados ficam em `src/components/`.
- Comentários só devem existir para restrição técnica, regra de negócio ou decisão não óbvia.
- Não manter código morto ou hooks não usados.

## Regras De Idioma

- Interface, mensagens, logs e documentação: pt-BR.
- Código e API externa: inglês.
- Termos do ecossistema podem permanecer em inglês quando isso melhora a clareza técnica, como `hook`, `layout`, `router`, `storage` e `build`.

## Uso Do Supabase

- `lib/supabase.ts` cria o client compartilhado.
- Sessão fica persistida em `deviceStorage`, com suporte a chunking por limite do `SecureStore`.
- RPCs concentram mutações críticas como criação de família, tarefas, valorização e resgates.
- O schema operacional deve ser mantido pelas migrations em `supabase/migrations/`.
- Políticas de RLS fazem parte do desenho da aplicação e não devem ser contornadas pelo app.

## Uso Do Expo Router

- As rotas são file-based e separadas por grupo de acesso.
- O projeto usa `headerShown: false` e cabeçalho próprio com `ScreenHeader`.
- `app/_layout.tsx` decide o fluxo inicial com base em sessão e perfil.
- Ao criar novas telas, preserve a separação `(auth)`, `(admin)` e `(child)`.

## Verificação Antes De Fechar Mudanças

Sempre rode:

```bash
npm run typecheck
npm test
```

Em alterações com impacto visual, valide também manualmente no tema claro e escuro.
