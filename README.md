# Trofinho

Aplicativo mobile de educação financeira familiar. Um adulto administra a família, cadastra filhos, cria tarefas com pontuação, acompanha saldos e gerencia prêmios. A criança conclui tarefas, envia evidência quando necessário, transfere pontos para o cofrinho e solicita resgates.

## Stack

| Camada | Tecnologia |
| --- | --- |
| App mobile | React Native 0.83, Expo SDK 55, Expo Router v6 |
| Linguagem | TypeScript em `strict` |
| Estado/Cache | React Query (TanStack Query v5) |
| Backend | Supabase (Auth, Postgres, Storage, Edge Functions, Realtime, RLS) |
| Push Notifications | Expo Push API + Firebase Cloud Messaging (FCM V1) |
| Testes | Vitest |

## Ferramentas e serviços

| Ferramenta | Papel no projeto |
| --- | --- |
| Supabase | Banco Postgres, autenticação, storage e RLS |
| Sentry | Monitoramento de erros e performance em produção |
| SonarCloud | Qualidade de codigo: cobertura, divida tecnica e inspecao estatica |
| EAS Build | Builds Android via Expo Application Services |
| Firebase (FCM V1) | Transporte de push notifications Android via Expo Push API |
| Notion | Roadmap e planejamento |

## Instalacao

```bash
git clone <url-do-repositorio>
cd trofinho
npm install
cp .env.example .env.local
```

Preencha o `.env.local` com as credenciais do seu projeto Supabase e, opcionalmente, Sentry. Consulte o `.env.example` para referencia.

### Banco de dados (Supabase)

Crie um projeto no [Supabase](https://supabase.com), configure as variaveis no `.env.local` e aplique as migrations:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npm run db:push
```

> **Dica:** Sem SMTP configurado, desative "Confirm email" em **Authentication > Providers > Email** no Studio Web.

### Para forks

1. Apague `"owner"` e `"projectId"` (em `extra.eas`) do `app.json`.
2. Rode `npx eas init` para vincular a sua conta Expo.
3. Ajuste ou remova a config do Sentry em `plugins` se necessario.

## Desenvolvimento

```bash
npm start          # dev server
npm run tunnel     # dev server com tunnel (dispositivo fisico)
```

O projeto usa development build (`expo-dev-client`). Gere o APK com o perfil `development` do EAS e instale no celular antes de conectar via tunnel.

## Build

```bash
# Development build (EAS cloud)
npx eas-cli@latest build --profile development --platform android

# Development build (local, requer Android SDK)
npx expo run:android

# Distribuicao interna (preview)
npm run build
```

## Testes

```bash
npm run typecheck
npm test
```
