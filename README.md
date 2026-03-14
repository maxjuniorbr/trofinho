# Trofinho 🏆

App familiar de educação financeira: pais criam tarefas com recompensas em pontos, filhos concluem e acumulam pontos para resgatar prêmios ou guardar no cofrinho.

## Stack

| Camada | Tecnologia |
|---|---|
| Mobile | React Native + Expo SDK 54 |
| Navegação | Expo Router v6 |
| Linguagem | TypeScript (strict) |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |

---

## Pré-requisitos

- **Node.js** ≥ 18 instalado no WSL2
- **Expo Go** instalado no celular ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- Celular e WSL2 na **mesma rede Wi-Fi**
- Conta no [Supabase](https://supabase.com) (plano gratuito atende)

---

## Configuração inicial

### 1. Clonar e instalar dependências

```bash
git clone <url-do-repo>
cd trofinho
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` com as credenciais do seu projeto Supabase:

```
EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=SEU_ANON_KEY_AQUI
```

> Onde encontrar: **Supabase Dashboard → Settings → API → Project URL / anon public key**

### 3. Preparar o banco

Para manter o schema alinhado com o app atual, suba o ambiente local do Supabase e aplique as migrations:

```bash
npm run db:start
npm run db:reset
```

Comandos úteis:

```bash
npm run db:status
npm run db:studio
```

> `supabase/schema.sql` cobre apenas o marco inicial e não representa sozinho o estado atual do projeto.

---

## Rodando no celular via Expo Go

### No WSL2 — problema de rede

O WSL2 usa uma interface de rede virtualizada. Para o Expo Go no celular conseguir se conectar, rode em modo **tunnel** (recomendado) ou configure o IP manualmente.

#### Opção A — Tunnel (mais simples, requer internet)

```bash
npx expo start --tunnel
```

Isso usa o serviço `ngrok` da Expo. Escaneie o QR code com o Expo Go.

#### Opção B — LAN (sem internet, mais rápido)

Descubra o IP do Windows no WSL2:

```bash
cat /etc/resolv.conf | grep nameserver | awk '{print $2}'
```

Configure o `REACT_NATIVE_PACKAGER_HOSTNAME` e rode:

```bash
export REACT_NATIVE_PACKAGER_HOSTNAME=<IP_ACIMA>
npx expo start
```

Ou edite `app.config.js` e adicione `hostUri: "<IP>:8081"` em `extra`.

#### Opção C — USB (Android, sem Wi-Fi)

```bash
# Habilitar ADB no Android e conectar via USB
adb reverse tcp:8081 tcp:8081
npx expo start
```

### Iniciar o servidor de desenvolvimento

```bash
npm start
# ou
npx expo start
```

Escaneie o QR code exibido no terminal com o app **Expo Go**.

---

## Estrutura do projeto

```
trofinho/
├── app/                    # Rotas (Expo Router)
│   ├── _layout.tsx         # Layout raiz
│   ├── index.tsx           # Redirect para login
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── onboarding.tsx
│   │   └── register.tsx
│   ├── (admin)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── filhos/
│   │   ├── tarefas/
│   │   └── saldos/
│   └── (filho)/
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── saldo.tsx
│       └── tarefas/
├── lib/
│   ├── auth.ts
│   ├── filhos.ts
│   ├── saldos.ts
│   ├── supabase.ts
│   ├── tarefas.ts
│   └── validation.ts
├── src/
│   └── components/         # Componentes compartilhados
├── supabase/
│   ├── migrations/         # Fonte de verdade do banco
│   ├── seed.sql
│   └── schema.sql          # Snapshot inicial
├── assets/                 # Ícones e splash screen
├── app.config.js           # Configuração do Expo (lê .env.local)
├── .sonarcloud.properties  # Ajustes do SonarCloud autoscan
├── .env.example            # Variáveis necessárias (sem valores)
└── .env.local              # ⚠️ NÃO commitar — credenciais reais
```

---

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm start` | Inicia o servidor Expo |
| `npm run android` | Abre no Android (emulador ou dispositivo) |
| `npm run ios` | Abre no iOS (somente macOS) |
| `npm run web` | Abre no navegador |
| `npm run tunnel` | Inicia o Expo em modo tunnel |
| `npm run typecheck` | Valida o TypeScript sem gerar build |
| `npm run db:start` | Sobe o Supabase local |
| `npm run db:stop` | Para o Supabase local |
| `npm run db:reset` | Recria o banco local e reaplica as migrations |
| `npm run db:status` | Mostra o status dos serviços locais |
| `npm run db:studio` | Exibe a URL do Supabase Studio local |

---

## Funcionalidades atuais

- Autenticação com login, cadastro e onboarding de família
- Área admin para gerenciar filhos, tarefas e saldos
- Área filho para concluir tarefas e acompanhar saldo/cofrinho
- Fluxos de evidência, aprovação, penalização e valorização via Supabase
