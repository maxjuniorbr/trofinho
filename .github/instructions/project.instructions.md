---
applyTo: "app/**/*.ts,app/**/*.tsx,lib/**/*.ts,lib/**/*.tsx,src/**/*.ts,src/**/*.tsx"
---

# Code & Component Instructions

## UI & Design System

- **Strict Tokens:** Use `src/constants/` (colors, spacing, typography, radius). No hardcoded UI values.
- **Role Accents:** Admins and children share `colors.accent.admin/filho` (`#FAC114`). Rely on `SegmentedBar` and `ScreenHeader` role props instead of inlining role color logic manually.
- **Safe Area:** Wrap screens with `<SafeScreenFrame>`. Do not duplicate `topInset` if using `ScreenHeader`, nor `bottomInset` if using `StickyFooterScreen`.
- **Over-scroll:** Add `overScrollMode="never"` to unmanaged `<ScrollView>`s on Android to disable glow.
- **Buttons:** Use `<Button variant="primary">` from `src/components/ui/button.tsx` exclusively for primary actions.
- **Lists:** Prefer `@shopify/flash-list` over `FlatList`.

## Best Practices

- **Security:** Never commit API keys, tokens, passwords, or any secret/credential. Secrets belong in `.env.local` or EAS environment variables — never in source code.
- **Hooks:** Avoid `useMemo`/`useCallback` unless rendering costs justify it. Avoid side effects during render. Include stable callbacks in `useFocusEffect`.
- **Images:** Add `transition={200}` when using `expo-image` for remote URIs.
- **Styles:** Use static `StyleSheet.create`. For theme styles, define `const makeStyles = (colors: ThemeColors) => StyleSheet.create(...)` at the bottom and memoize inside the component: `useMemo(() => makeStyles(colors), [colors])`.

## Data Fetching (Supabase & React Query)

- **Queries/Mutations:** Use `@tanstack/react-query` hooks located in `src/hooks/queries/`.
- **Data Pattern:** `lib/` functions should return `{ data, error }`. Localize UI-facing Supabase errors via `localizeRpcError()` or `localizeSupabaseError()`.
- **RPCs:** Utilize Supabase RPCs heavily for reliable backend logic.

## Routing (Expo Router)

- Preserve route group separation: `(auth)`, `(admin)`, `(child)`.
- Use custom `<ScreenHeader>` over native headers (`headerShown: false`).

## Notifications

- Local push: `lib/notifications.ts`
- Remote push: `lib/push.ts` (Fire-and-forget; do not `await` dispatch).
- Respect DB preference keys: `tarefasPendentes`, `tarefaAprovada`, `tarefaRejeitada`, `tarefaConcluida`, `resgatesSolicitado`, `resgateConfirmado`, `resgateCancelado`.
- Add tests to `lib/notifications.test.ts` for any new notification type.

## Instrumentation (Sentry)

- `Sentry.setUser({ id })` and `setTag('papel', 'familia_id')` are set on profile change in `app/_layout.tsx`. Cleared on sign-out.
- Auth lifecycle emits breadcrumbs (`category: 'auth'`) via `lib/auth-state.ts`: `signed_out`, `signed_in`, `token_refreshed`, `user_switch_detected`, `profile_load_failed`.
- Route-level `ErrorBoundary` (`src/components/ui/route-error-fallback.tsx`) calls `Sentry.captureException`.
- Push registration failures emit breadcrumbs (`category: 'push'`) in `app/_layout.tsx`: `token_null`, `registration_error`, `persist_failed`.
- Edge function logs mask push tokens to first 12 chars.
- Use `Sentry.addBreadcrumb` for lifecycle events, `Sentry.captureException` for unhandled errors. Never log PII to Sentry extras.

## Testing

### Patterns by layer

**`lib/` unit tests** — test pure functions directly. Mock only external I/O (supabase, expo SDKs).

**Hook wiring tests** (`src/hooks/queries/__tests__/`) — use `createReactQueryMock` from
`test/helpers/query-test-utils.ts`. Override `@tanstack/react-query` per-file (not the global stub).
Verify: `queryFn` delegates to the correct `lib/` function, `queryKey`, `staleTime`, and
`onSuccess` invalidation. Do **not** test real QueryClient cache behaviour here — that belongs in
integration tests if ever needed.

**Live sync hook tests** — use `test-renderer-compat` + `vi.hoisted` mocks for supabase channel.
Follow `use-tasks-live-sync.test.tsx` as the canonical pattern. Cover: subscribe with `familiaId`,
unsubscribe on unmount (channel removed), invalidation callback, skip when `familiaId` is undefined.

**Route/screen tests** (`test/routes/`) — focus on UI: rendered text, button states, user interactions.
Do **not** add authorization assertions here; those belong in `test/routes/root-navigator.test.tsx`.

**RootNavigator tests** (`test/routes/root-navigator.test.tsx`) — test routing logic driven by
`profile` state: `undefined` (no nav), `null` (→ login), missing `familia_id` (→ onboarding),
role mismatch redirect, and sign-out cache clear. Mock `expo-router`, `@lib/auth`, `@/context/query-client`.

### Coverage exclusion policy

Only exclude files that have **no testable logic**:

- `lib/supabase.ts` — client initialization only
- `src/constants/theme.ts`, `src/constants/assets.ts` — static data
- `src/context/theme-context.tsx` — thin context wrapper
- `src/hooks/queries/index.ts` — barrel re-export
- `app/**/_layout.tsx` for group layouts with no logic (e.g. `(auth)/_layout.tsx`)

Do **not** exclude tested modules from coverage just because they use native SDKs (e.g. `lib/notifications.ts`).
Thresholds: statements ≥ 90%, lines ≥ 90%, functions ≥ 90%, branches ≥ 85%.

### Post-step quality validation

After every implementation step (file edit, new function, refactor), run `analyze_code_snippet` via SonarQube MCP on each changed file to detect issues before they accumulate. After every `git commit`, validate the cloud quality gate with `get_project_quality_gate_status` (project key `maxjuniorbr_trofinho`). If it turns red or new HIGH/BLOCKER issues surface, stop and fix before proceeding. Use `search_sonar_issues_in_projects` with `issueStatuses: ['OPEN'], severities: ['HIGH','BLOCKER']` for a zero-critical-issue confirmation.

### What NOT to test here

- **RLS / SQL policies** — cloud-only project, no local Docker. Out of scope until `supabase start` is available.
- **Edge Function coverage** — Deno runtime ≠ Vitest/V8; impossible to combine in one report.
- **Platform fidelity** (SecureStore, AppState, Android vs iOS) — use Maestro/Detox E2E (separate layer).
