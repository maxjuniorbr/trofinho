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

Para manter o schema alinhado com o app atual, aplique os arquivos de `supabase/migrations/` em ordem.

Se você estiver usando o ambiente local do Supabase, prefira as migrations da pasta `supabase/migrations/`.

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
│   │   └── login.tsx       # Tela de Login
│   ├── (admin)/
│   │   ├── _layout.tsx
│   │   └── index.tsx       # Home Admin
│   └── (filho)/
│       ├── _layout.tsx
│       └── index.tsx       # Home Filho
├── lib/
│   └── supabase.ts         # Cliente Supabase inicializado
├── src/
│   ├── components/         # Componentes compartilhados
│   └── constants/          # Cores, tamanhos etc.
├── supabase/
│   └── schema.sql          # Schema inicial do banco
├── assets/                 # Ícones e splash screen
├── app.config.js           # Configuração do Expo (lê .env.local)
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
| `npm run typecheck` | Valida o TypeScript sem gerar build |

---

## Marcos de desenvolvimento

- [x] **Marco 1** — Fundação: projeto inicializado, navegação funcionando, Supabase configurado
- [ ] **Marco 2** — Autenticação: login/cadastro com Supabase Auth
- [ ] **Marco 3** — Tarefas: CRUD de tarefas, envio de foto, validação
- [ ] **Marco 4** — Pontos e Prêmios: saldo, cofrinho com valorização, resgate
