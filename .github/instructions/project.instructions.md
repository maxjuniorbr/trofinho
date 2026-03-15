---
applyTo: "**"
---

# Instruções Para LLMs No Projeto Trofinho

Siga estas regras ao propor, editar ou revisar código neste repositório.

## Objetivo

- Mantenha o projeto simples, consistente, tipado e alinhado ao estado real do produto.
- Prefira correções na causa raiz.
- Evite mudanças cosméticas sem ganho real.

## Arquitetura

- Use `app/` apenas para telas, composição de rotas e lógica mínima de interface.
- Coloque acesso a dados, integrações com Supabase, validações e regras reutilizáveis em `lib/`.
- Coloque componentes visuais reutilizáveis em `src/components/`.
- Use `src/constants/` para tokens e utilitários de apresentação.
- Use `src/context/` para providers globais.
- Trate `supabase/migrations/` como fonte de verdade do banco.

## Idioma

- Escreva todo texto voltado a pessoas em pt-BR.
- Mantenha variáveis, funções, tipos, arquivos e integrações externas em inglês.
- Não introduza README, comentários, logs ou mensagens de erro em inglês quando forem exibidos ao usuário.

## Design System

- Não hardcode cor, tipografia, espaçamento, radius ou sombra fora do design system.
- Use `src/constants/colors.ts`, `src/constants/spacing.ts`, `src/constants/typography.ts`, `src/constants/radius.ts` e `src/constants/shadows.ts`.
- Use `src/constants/theme.ts` apenas quando o barrel ajudar compatibilidade ou clareza.

## Componentes E Telas

- Não adicione regra de negócio nova diretamente em componentes de tela.
- Faça novas chamadas ao Supabase em `lib/*`.
- Mantenha componentes compartilhados pequenos, focados e reutilizáveis.
- Extraia componente quando a mesma UI aparecer em duas ou mais telas.

## Comentários

- Não escreva comentários óbvios.
- Não repita o que o código já mostra.
- Comente apenas quando houver restrição técnica, regra de negócio ou decisão arquitetural não óbvia.

## Hooks

- Não crie hooks sem uso real.
- Não cause efeitos colaterais durante render.
- Use callback estável com `useFocusEffect`.
- Use `useMemo` e `useCallback` apenas quando houver ganho real de legibilidade, estabilidade ou custo.

## Supabase

- Reutilize sempre `lib/supabase.ts`.
- Não duplique cliente do Supabase sem justificativa técnica clara.
- Prefira RPC ou regras no banco para operações críticas.
- Respeite RLS e o schema existente.
- Localize para pt-BR mensagens de erro do Supabase quando forem exibidas.

## Expo Router

- Preserve os grupos `(auth)`, `(admin)` e `(child)`.
- Não introduza header nativo novo; prefira `ScreenHeader`.
- Mantenha naming de rotas consistente com a estrutura atual.
- Evite ampliar casts de navegação; se virar padrão, extraia helper ou revise a tipagem.

## React Native E Expo

- Prefira `StyleSheet.create`.
- Mantenha compatibilidade com Expo SDK 54.
- Evite dependências que exijam dev build sem necessidade real.
- Em mudanças visuais, valide tema claro e escuro.

## TypeScript

- Mantenha `strict` sempre verde.
- Não use `any` sem justificativa documentada.
- Não misture tipo de apresentação com camada de dados em `lib/*`.
- Extraia tipos reutilizáveis em vez de duplicar assinaturas.

## Verificação Obrigatória

- Durante o desenvolvimento e antes de concluir, verifique os apontamentos do Sonar local no editor e trate os itens novos relacionados à alteração.
- Antes de concluir, rode:

```bash
npm run typecheck
npm test
```

- Se a mudança afetar fluxo visual, valide manualmente as telas impactadas.
