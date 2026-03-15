---
applyTo: "**"
---

# Regras de Commit

## Formato

```
<tipo>: <descrição curta em inglês>
```

## Tipos permitidos

| Tipo | Quando usar |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento |
| `style` | Ajustes visuais/CSS, sem lógica |
| `chore` | Tarefas de manutenção (deps, configs, CI) |
| `docs` | Documentação |
| `test` | Testes |

## Regras

- **Nunca** use escopo em parênteses: use `feat:` e não `feat(scope):`
- A descrição deve ser em **inglês**, no imperativo e em letras minúsculas
- Máximo de 72 caracteres na linha do título
- Sem ponto final na descrição

## Exemplos válidos

```
feat: add avatar upload to user profile
fix: handle missing child profile in daily task renewal
refactor: extract RootNavigator from root layout
chore: add vitest dependency
style: improve button styling in screen header
```

## Exemplos inválidos

```
feat(auth): add login           ← escopo não permitido
Fix: Login bug                  ← tipo capitalizado
feat: Added login.              ← passado + ponto final
```
