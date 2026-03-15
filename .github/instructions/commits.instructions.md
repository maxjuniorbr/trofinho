---
applyTo: "**"
---

# Instruções Para LLMs Sobre Commits

Quando criar mensagem de commit neste repositório, siga exatamente estas regras.

## Formato Obrigatório

```text
<type>: <short description in english>
```

## Tipos Permitidos

- `feat`: nova funcionalidade
- `fix`: correção de bug
- `refactor`: refatoração sem mudança de comportamento
- `style`: ajuste visual ou de CSS sem lógica
- `chore`: manutenção, dependências, configuração ou CI
- `docs`: documentação
- `test`: testes

## Regras Obrigatórias

- Nunca use escopo em parênteses.
- Use `feat:` e não `feat(scope):`.
- Escreva a descrição em inglês.
- Escreva a descrição no imperativo.
- Use apenas minúsculas na descrição.
- Limite a linha do título a 72 caracteres.
- Não termine a descrição com ponto final.

## Exemplos Válidos

```text
feat: add avatar upload to user profile
fix: handle missing child profile in daily task renewal
refactor: extract root navigator from root layout
chore: add vitest dependency
style: improve button styling in screen header
```

## Exemplos Inválidos

```text
feat(auth): add login
Fix: Login bug
feat: Added login.
```
