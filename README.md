# Trofinho

App mobile de educação financeira familiar. Pais criam tarefas com recompensas em pontos, filhos concluem e acumulam pontos para resgatar prêmios ou guardar no cofrinho.

## Stack

| Camada | Tecnologia |
|---|---|
| Mobile | React Native 0.81 + Expo SDK 54 |
| Navegação | Expo Router v6 (file-based) |
| Linguagem | TypeScript (strict mode) |Melho
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) |

## Pré-requisitos

- **Node.js** >= 18
- **Expo Go** no celular ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- Celular e máquina de desenvolvimento na **mesma rede Wi-Fi** (ou usar modo tunnel)
- Conta no [Supabase](https://supabase.com) (plano gratuito atende)

## Setup

```bash
git clone <url-do-repo>
cd trofinho
npm install
cp .env.example .env.local
```

Edite `.env.local` com as credenciais do seu projeto Supabase (encontradas em **Dashboard > Settings > API**):

```
EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=SEU_ANON_KEY_AQUI
```

### Banco de dados

```bash
npm run db:start   # sobe Supabase local via Docker
npm run db:reset   # aplica migrations e seed
```

> As migrations em `supabase/migrations/` são a fonte de verdade do schema.

## Executando

```bash
npm start          # inicia o servidor Expo
```

Escaneie o QR code exibido no terminal com o **Expo Go**.

### WSL2

O WSL2 usa rede virtualizada. Use uma das opções:

- **Tunnel** (mais simples): `npm run tunnel`
- **LAN**: exporte `REACT_NATIVE_PACKAGER_HOSTNAME` com o IP do Windows (`cat /etc/resolv.conf | grep nameserver`)
- **USB** (Android): `adb reverse tcp:8081 tcp:8081 && npm start`

## Scripts

| Comando | Descrição |
|---|---|
| `npm start` | Servidor Expo |
| `npm run android` | Abre no Android |
| `npm run ios` | Abre no iOS (macOS) |
| `npm run web` | Abre no navegador |
| `npm run tunnel` | Expo em modo tunnel |
| `npm run typecheck` | Validação TypeScript |
| `npm run db:start` | Sobe Supabase local |
| `npm run db:stop` | Para Supabase local |
| `npm run db:reset` | Recria banco + migrations |
| `npm run db:status` | Status dos serviços locais |

## Funcionalidades

- **Autenticação** — login, cadastro, onboarding de família
- **Área admin** — gerenciar filhos, criar tarefas com pontos, validar conclusões, aplicar penalizações e valorizações
- **Área filho** — concluir tarefas (com evidência fotográfica), acompanhar saldo/cofrinho, resgatar prêmios
- **Prêmios e resgates** — catálogo de prêmios, solicitação e confirmação de resgates
- **Cofrinho** — transferência de pontos com valorização configurável (diária, semanal, mensal)

## Contribuindo

1. Crie uma branch a partir de `master`
2. Mantenha as convenções do projeto:
   - Código (variáveis, funções, tipos, arquivos) em **inglês**
   - Textos exibidos ao usuário em **pt-BR**
   - Design tokens centralizados em `src/constants/theme.ts`
   - Componentes reutilizáveis em `src/components/ui/`
3. Rode `npm run typecheck` antes de abrir o PR
4. Descreva o que mudou e por quê no PR
