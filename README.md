# Trofinho

App mobile de tarefas e recompensas para famílias. React Native + Expo + Supabase.

## Stack

- React Native 0.83 / Expo SDK 55 / Expo Router
- TypeScript strict
- Supabase (auth, Postgres, storage, edge functions, realtime)
- React Query v5
- Sentry (error tracking)
- SonarCloud (code quality)

## Setup

```bash
npm install
cp .env.example .env.local   # preencha com suas credenciais
npm run db:push               # aplica migrations no Supabase
npm run db:types              # regenera tipos do banco
```

## Dev

```bash
npm start          # dev server (Metro)
npm run android    # primeira build nativa + Metro
npm run tunnel     # tunnel para dispositivo físico
```

## Qualidade

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm test              # Vitest (unit + route tests)
npm run test:coverage # Vitest com relatório de cobertura
```

## Build

```bash
npm run build    # EAS Build (preview, Android)
```

## Banco de dados

```bash
npm run db:push    # aplica migrations pendentes no Supabase remoto
npm run db:types   # regenera src/types/database.types.ts
npm run db:diff    # mostra diff entre local e remoto
npm run db:seed    # executa seed de dados de teste
```

## E2E (Emulador)

Requer emulador Android com o app no modo dev-client e Metro rodando.
Credenciais de teste em `.env.local` (veja `.env.example`).

```bash
export $(grep -v '^#' .env.local | xargs)

npm run test:e2e                     # login + logout + validações
npm run test:e2e:login               # só login
npm run test:e2e:logout              # logout (com login automático)
npm run test:e2e:create-account      # cadastro + criação de família
npm run test:e2e:login-wrong-password
npm run test:e2e:login-empty-fields
```

Veja `.maestro/README.md` para documentação completa dos flows.

## Arquitetura

```
app/           → Expo Router screens/layouts (sem lógica de negócio)
lib/           → Lógica de negócio, acesso a dados, SDKs (sem React hooks)
src/components → UI reutilizável
src/constants  → Design tokens (cores, espaçamento, tipografia)
src/hooks      → React Query hooks (queries/mutations)
src/context    → Providers (tema, impersonação, query client)
supabase/      → Migrations, edge functions, seed
test/          → Helpers e route tests
```
