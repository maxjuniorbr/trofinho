---
applyTo: "**"
---

# Instruções De IA Do Projeto Trofinho

## Objetivo

Manter o projeto simples, consistente, tipado e alinhado ao estado real do produto.

## Arquitetura Obrigatória

- `app/` contém telas, composição de rotas e lógica mínima de interface.
- `lib/` contém acesso a dados, integração com Supabase, validações e regras de negócio reutilizáveis.
- `src/components/` contém componentes visuais reutilizáveis.
- `src/constants/` contém tokens de design system e utilitários de apresentação.
- `src/context/` contém providers globais.
- `supabase/migrations/` é a fonte de verdade do banco.

## Idioma

- Tudo que for texto para humanos deve estar em pt-BR.
- Variáveis, funções, tipos, arquivos e integrações externas devem permanecer em inglês.
- Não introduzir README, comentários, logs ou mensagens de erro em inglês.

## Design System

- É proibido hardcode de cor, tipografia, espaçamento, radius ou sombra fora do design system.
- Use:
  - `src/constants/colors.ts`
  - `src/constants/spacing.ts`
  - `src/constants/typography.ts`
  - `src/constants/radius.ts`
  - `src/constants/shadows.ts`
- O barrel `src/constants/theme.ts` pode ser usado por compatibilidade.

## Componentes E Telas

- Não colocar regra de negócio nova diretamente em componente de tela.
- Novas chamadas ao Supabase devem nascer em `lib/*`.
- Componentes compartilhados devem ser pequenos, focados e reutilizáveis.
- Ao repetir UI em duas ou mais telas, extrair componente.

## Comentários

- Não escrever comentários óbvios.
- Não repetir o que o código já mostra.
- Manter comentários apenas para:
  - restrição técnica
  - regra de negócio
  - decisão arquitetural não óbvia

## Hooks

- Não criar hooks sem uso real.
- É proibido efeito colateral em render.
- `useFocusEffect` deve usar callback estável.
- `useMemo` e `useCallback` só quando ajudam legibilidade, estabilidade ou custo real.

## Supabase

- Reutilizar sempre `lib/supabase.ts`.
- Não duplicar cliente do Supabase sem justificativa técnica clara.
- Preferir RPC ou regras no banco para operações críticas de negócio.
- Respeitar RLS e o schema existente.
- Mensagens de erro vindas do Supabase devem ser localizadas para pt-BR quando forem exibidas.

## Expo Router

- Preservar grupos `(auth)`, `(admin)` e `(child)`.
- Não usar header nativo novo; preferir `ScreenHeader`.
- Novas rotas devem seguir naming consistente com a estrutura atual.
- Evitar ampliar o uso de casts de navegação; se surgir recorrência, extrair helper ou revisar tipagem.

## React Native E Expo

- Preferir `StyleSheet.create`.
- Manter compatibilidade com Expo SDK 54.
- Evitar dependências que exijam dev build sem necessidade real.
- Validar tema claro e escuro em alterações visuais.

## TypeScript

- Manter `strict` sempre verde.
- Não usar `any` sem justificativa documentada.
- Não misturar tipo de apresentação com camada de dados em `lib/*`.
- Extrair tipos reutilizáveis em vez de duplicar assinaturas.

## Verificação Obrigatória

Antes de concluir qualquer alteração:

- Durante o desenvolvimento e antes de concluir, verificar os apontamentos do Sonar local no editor e tratar os itens novos relacionados à alteração.

```bash
npm run typecheck
npm test
```

Se a mudança afetar fluxo visual, validar manualmente as telas impactadas.
