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
