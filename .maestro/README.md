# Testes E2E Maestro

Testes E2E para fluxos críticos do Trofinho usando [Maestro](https://maestro.dev/).

## Pré-requisitos

- Maestro CLI instalado (`maestro --version`)
- Emulador Android rodando com o app no modo dev-client (`npm run android`)
- Metro em execução (`npm start`)
- Variáveis de ambiente configuradas em `.env.local` (veja abaixo)

## Variáveis de ambiente

As credenciais são lidas de `.env.local` (nunca hardcoded nos flows).  
Adicione as entradas abaixo se ainda não existirem:

```bash
# .env.local
MAESTRO_EMAIL=maxteste@trofinho.dev         # conta de teste existente no Supabase
MAESTRO_PASSWORD=<senha-da-conta-de-teste>
MAESTRO_REGISTER_PASSWORD=<senha-para-novos-cadastros>  # usado em create-family (cadastro + família)
```

Para passar os valores manualmente via CLI:

```bash
export $(grep -v '^#' .env.local | xargs)
maestro test -e MAESTRO_EMAIL=$MAESTRO_EMAIL -e MAESTRO_PASSWORD=$MAESTRO_PASSWORD .maestro/login.yaml
```

## Rodar via npm scripts

```bash
npm run test:e2e                        # todos os flows em sequência
npm run test:e2e:login                  # só login (fluxo feliz)
npm run test:e2e:logout                 # logout (inclui login como setup)
npm run test:e2e:login-wrong-password   # login com senha errada
npm run test:e2e:login-empty-fields     # login sem preencher campos
npm run test:e2e:create-family          # cadastro de conta + criação de família
```

## Rodar um flow diretamente

```bash
export $(grep -v '^#' .env.local | xargs)
maestro test -e MAESTRO_EMAIL=$MAESTRO_EMAIL -e MAESTRO_PASSWORD=$MAESTRO_PASSWORD .maestro/login.yaml
```

## Flows disponíveis

| Arquivo                        | Fluxo                                                | Setup automático           |
| ------------------------------ | ---------------------------------------------------- | -------------------------- |
| `login.yaml`                   | Login com e-mail e senha (fluxo feliz)               | Mata e limpa o app         |
| `logout.yaml`                  | Logout da conta (fluxo feliz)                        | Login completo via subcall |
| `login-wrong-password.yaml`    | Login com senha incorreta — valida mensagem de erro  | Mata e limpa o app         |
| `login-empty-fields.yaml`      | Login sem preencher campos — valida validação client | Mata e limpa o app         |
| `create-task.yaml`             | Criação de uma nova tarefa                           | Login completo via subcall |
| `create-family.yaml`           | Cadastro de conta + criação de família (fluxo feliz) | Mata e limpa o app         |
| `_logout-steps.yaml`           | Passos de logout sem setup — helper interno          | Não executar diretamente   |

## Boas práticas seguidas

- **Variáveis de ambiente** para credenciais — nunca hardcoded
- **Auto-contidos**: cada flow executa `launchApp: stopApp/clearState` ou chama `login.yaml` como setup — nenhum flow depende de estado externo
- **`_logout-steps.yaml`** é o helper reutilizável de logout; `logout.yaml` e futuros flows o chamam após o login
- **`clearState: true`** garante início sempre desautenticado (limpa AsyncStorage/sessão Supabase)
- **Seletores via `accessibilityLabel`** — mapeia para `content-description` no Android
- **Assertions explícitas** — `assertVisible` após cada ação crítica
- **`extendedWaitUntil`** em vez de `sleep` — aguarda condições reais
- **Expo dev-client tratado** — 3 casos condicionais (`runFlow when:`) lidam com a tela de seleção de servidor, botão "Continue" e drawer "Reload"

## Limitações conhecidas

- **`inputText` é ASCII-only**: Maestro não suporta Unicode. Use nomes sem acentos em todos os campos de texto dos flows (ex.: `Familia Maestro` em vez de `Família Maestro`).
- **Contas acumulam**: `create-family.yaml` gera um e-mail único (`maestro.<timestamp>@trofinho.dev`) por execução. Limpe periodicamente via script de manutenção em `/temp/`.
