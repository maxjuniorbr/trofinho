# Instrucoes De IA Do Projeto Trofinho

## Objetivo

Manter o projeto simples, consistente, tipado e alinhado ao estado real do produto.

## Arquitetura Obrigatoria

- `app/` contem telas, composicao de rotas e logica minima de interface.
- `lib/` contem acesso a dados, integracao com Supabase, validacoes e regras de negocio reutilizaveis.
- `src/components/` contem componentes visuais reutilizaveis.
- `src/constants/` contem tokens de design system e utilitarios de apresentacao.
- `src/context/` contem providers globais.
- `supabase/migrations/` e a fonte de verdade do banco.

## Idioma

- Tudo que for texto para humanos deve estar em pt-BR.
- Variaveis, funcoes, tipos, arquivos e integracoes externas devem permanecer em ingles.
- Nao introduzir README, comentarios, logs ou mensagens de erro em ingles.

## Design System

- E proibido hardcode de cor, tipografia, espacamento, radius ou sombra fora do design system.
- Use:
  - `src/constants/colors.ts`
  - `src/constants/spacing.ts`
  - `src/constants/typography.ts`
  - `src/constants/radius.ts`
  - `src/constants/shadows.ts`
- O barrel `src/constants/theme.ts` pode ser usado por compatibilidade.

## Componentes E Telas

- Nao colocar regra de negocio nova diretamente em componente de tela.
- Novas chamadas ao Supabase devem nascer em `lib/*`.
- Componentes compartilhados devem ser pequenos, focados e reutilizaveis.
- Ao repetir UI em duas ou mais telas, extrair componente.

## Comentarios

- Nao escrever comentarios obvios.
- Nao repetir o que o codigo ja mostra.
- Manter comentarios apenas para:
  - restricao tecnica
  - regra de negocio
  - decisao arquitetural nao obvia

## Hooks

- Nao criar hooks sem uso real.
- E proibido efeito colateral em render.
- `useFocusEffect` deve usar callback estavel.
- `useMemo` e `useCallback` so quando ajudam legibilidade, estabilidade ou custo real.

## Supabase

- Reutilizar sempre `lib/supabase.ts`.
- Nao duplicar cliente do Supabase sem justificativa tecnica clara.
- Preferir RPC ou regras no banco para operacoes criticas de negocio.
- Respeitar RLS e o schema existente.
- Mensagens de erro vindas do Supabase devem ser localizadas para pt-BR quando forem exibidas.

## Expo Router

- Preservar grupos `(auth)`, `(admin)` e `(child)`.
- Nao usar header nativo novo; preferir `ScreenHeader`.
- Novas rotas devem seguir naming consistente com a estrutura atual.
- Evitar ampliar o uso de casts de navegacao; se surgir recorrencia, extrair helper ou revisar tipagem.

## React Native E Expo

- Preferir `StyleSheet.create`.
- Manter compatibilidade com Expo SDK 54.
- Evitar dependencias que exijam dev build sem necessidade real.
- Validar tema claro e escuro em alteracoes visuais.

## TypeScript

- Manter `strict` sempre verde.
- Nao usar `any` sem justificativa documentada.
- Nao misturar tipo de apresentacao com camada de dados em `lib/*`.
- Extrair tipos reutilizaveis em vez de duplicar assinaturas.

## Verificacao Obrigatoria

Antes de concluir qualquer alteracao:

```bash
npm run typecheck
npm test
```

Se a mudanca afetar fluxo visual, validar manualmente as telas impactadas.
