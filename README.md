# Trofinho

App mobile de tarefas e recompensas para familias. React Native + Expo + Supabase.

## Setup

```bash
npm install
cp .env.example .env.local   # preencha com suas credenciais
npm run db:push               # aplica migrations no Supabase
```

## Dev

```bash
npm start          # dev server
npm run tunnel     # tunnel para dispositivo fisico
```

## Build

```bash
npx eas-cli@latest build --profile development --platform android
```

## Testes

```bash
npm run lint && npm run typecheck && npm test
```

### E2E (Emulador)

Requer emulador Android com o app no modo dev-client e Metro rodando.  
Credenciais de teste em `.env.local` (veja `.env.example`).

```bash
export $(grep -v '^#' .env.local | xargs)

npm run test:e2e                  # login + logout
npm run test:e2e:login            # só login
npm run test:e2e:logout           # logout (com login automático)
npm run test:e2e:create-family    # cadastro + criação de família
```

Veja `.maestro/README.md` para documentação completa dos flows.
