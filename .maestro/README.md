# Testes E2E Maestro

Testes E2E para fluxos críticos do Trofinho usando [Maestro](https://maestro.dev/).

## Pré-requisitos

- Maestro CLI instalado (`maestro --version`)
- Emulador Android ou dispositivo conectado (`adb devices`)
- App rodando no emulador via `expo start` / dev-client
- Variáveis de ambiente configuradas (veja abaixo)

## Variáveis de ambiente

Os testes usam variáveis de ambiente para credenciais.  
Crie um arquivo `.maestro/.env` ou passe via CLI:

```bash
# .maestro/.env (não commitado)
MAESTRO_EMAIL=maxteste2@trofinho.dev
MAESTRO_PASSWORD=Trofinho@2024
```

Ou passe via flag:

```bash
maestro test .maestro/login.yaml -e MAESTRO_EMAIL=maxteste2@trofinho.dev -e MAESTRO_PASSWORD=Trofinho@2024
```

## Rodar todos os testes

```bash
npm run test:e2e
```

## Rodar um teste específico

```bash
maestro test .maestro/login.yaml
maestro test .maestro/logout.yaml
```

## Testes disponíveis

| Arquivo            | Fluxo                                  | Dependência    |
| ------------------ | -------------------------------------- | -------------- |
| `login.yaml`       | Login com email e senha (fluxo feliz)  | —              |
| `logout.yaml`      | Logout da conta (fluxo feliz)          | Estar logado   |
| `create-task.yaml` | Criação de uma nova tarefa             | Estar logado   |

## Boas práticas seguidas

- **Variáveis de ambiente** para credenciais (nunca hardcoded)
- **Modularização** com `runFlow` — logout é reutilizado como sub-fluxo no login
- **Seletores estáveis** via `accessibilityLabel` (mapeado para content-description no Android)
- **Assertions explícitas** — `assertVisible` após ações críticas
- **Nome descritivo** em cada fluxo via campo `name`
- **Sem delays estáticos** — usa `extendedWaitUntil` ao invés de `sleep`

## Nota sobre credenciais

Os testes usam credenciais de teste. Certifique-se de que a conta de teste existe no Supabase antes de rodar.
