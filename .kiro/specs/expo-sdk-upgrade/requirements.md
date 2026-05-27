# Requirements Document

## Introduction

Trofinho currently runs on React Native 0.83 and Expo SDK 55, Android-only, on EAS Build. Three concurrent Dependabot inputs are blocked on the SDK 55 baseline: a `react-native@0.85.x` PR, an `expo-splash-screen@56.x` PR, and the security advisory `GHSA-w5hq-g745-h8pq` (transitive `uuid` exposure via `xcode` and `@expo/ngrok`). None of these can land safely while the app is on Expo SDK 55.

The Expo_SDK_Upgrade is the work needed to move the project to the lowest Expo SDK that simultaneously offers `react-native@0.85.x` and `expo-splash-screen@56.x`. The upgrade is purely a platform bump: it is not a refactor, not a feature, and not a UI change. Its value is unlocking those three blocked inputs while keeping every existing behavior, invariant, and quality gate intact.

This document defines the verifiable outcomes the upgrade must deliver. It deliberately does not prescribe execution mechanics (wave order, branch names, package lists, phase sequencing) — those belong to the design phase. The exact target SDK number is also a design-phase decision, constrained by the criteria stated here.

## Glossary

- **Expo_SDK_Upgrade**: The end-to-end change that moves the Trofinho app from the current Expo SDK / React Native baseline to the chosen Target_SDK and its aligned native/JS dependencies.
- **Target_SDK**: The Expo SDK version selected for the upgrade. It is the lowest Expo SDK that simultaneously ships compatible `react-native@0.85.x` and `expo-splash-screen@56.x` releases.
- **Baseline_Snapshot**: A pre-upgrade record of the current state, persisted on the upgrade branch, used as the comparison baseline. Includes the current Expo SDK, `react-native` version, `npm audit` output, the SonarCloud quality gate status with its issue counts by severity, the current Vitest coverage report with its pass/fail count, and the current set of unresolved Sentry issue identifiers for the production release.
- **Validation_Gate**: The mandatory local validation pipeline made up of `npm run lint`, `npm run typecheck`, and `npm test`, run in that order with each command exiting with status code 0.
- **Maestro_Smoke_Flows**: The two runnable Maestro flows in `.maestro/`: `create-task.yaml` and `logout.yaml`. Files prefixed with `_` are fragments and are not directly runnable.
- **Smoke_Device**: A real Android device or running Android emulator used to install the upgraded build and exercise the Maestro_Smoke_Flows end-to-end.
- **Tenant_Boundary**: The `familia_id`-scoped isolation rule. Every Supabase query and RPC call filters by the authenticated user's `familia_id`, in addition to RLS policies.
- **Frozen_Auth_Surface**: The current authentication surface. Google OAuth via `@react-native-google-signin/google-signin` + `supabase.auth.signInWithIdToken()` is the only auth flow for new or changed work, and the existing email/password screens are kept working but receive no new features.
- **Definition_of_Done**: The aggregate set of pass conditions that must all hold simultaneously, from the upgrade branch alone, for the upgrade to be considered shippable.

## Requirements

### Requirement 1: Target SDK selection

**User Story:** As a maintainer, I want the upgrade to land on a clearly justified Target_SDK, so that the three blocked inputs (`react-native@0.85.x`, `expo-splash-screen@56.x`, advisory `GHSA-w5hq-g745-h8pq`) can move forward without over-shooting the SDK ladder.

#### Acceptance Criteria

1. THE Expo_SDK_Upgrade SHALL select a Target_SDK whose official Expo release notes or compatibility matrix list `react-native@0.85.x` and `expo-splash-screen@56.x` as supported versions.
2. IF more than one Expo SDK satisfies criterion 1, THEN THE Expo_SDK_Upgrade SHALL select the SDK with the lowest major version number among those candidates as the Target_SDK.
3. IF no Expo SDK currently satisfies criterion 1, THEN THE Expo_SDK_Upgrade SHALL halt before any package version is changed, identify which of the three blocked inputs cannot be unblocked, and request human direction on how to proceed.
4. WHEN the Target_SDK is selected, THE Expo_SDK_Upgrade SHALL record in the design document the chosen Target_SDK version, the supported `react-native` version it ships, the supported `expo-splash-screen` version it ships, and the resolution path for advisory `GHSA-w5hq-g745-h8pq` under that SDK, with source links for each fact, before any package version is changed.
5. THE Expo_SDK_Upgrade SHALL keep the Android-only target unchanged, with no `ios` platform added to `app.json` or `eas.json`, no `ios/` directory introduced, and no iOS build attempted.

### Requirement 2: Behavior preservation via existing checks

**User Story:** As a maintainer, I want the existing automated checks to continue passing without being weakened, so that the upgrade is proven not to regress current behavior.

#### Acceptance Criteria

1. THE Validation_Gate SHALL pass on the upgraded codebase, with `npm run lint`, `npm run typecheck`, and `npm test` each exiting with status code 0 and reporting zero failed checks.
2. THE Expo_SDK_Upgrade SHALL keep every test present in the Baseline_Snapshot's Vitest run, with the upgraded Vitest run reporting a test count greater than or equal to the Baseline_Snapshot's count, and with no test deleted, renamed away, or marked as `skip`, `skipIf`, `todo`, or `.only` to make the suite pass.
3. THE Expo_SDK_Upgrade SHALL keep the Vitest coverage thresholds in `vitest.config.*` greater than or equal to the values recorded in the Baseline_Snapshot, with no threshold lowered to accommodate the upgrade.
4. WHEN the Maestro_Smoke_Flows are run against an upgraded build on a Smoke_Device, THE Maestro_Smoke_Flows SHALL each exit with status code 0 with every assertion passing within the flow's configured timeout.
5. IF a check that passed in the Baseline_Snapshot fails on the upgraded codebase, THEN THE Expo_SDK_Upgrade SHALL restore the failing check to passing by changing production code or upgrade-related configuration, and SHALL not disable, skip, remove, rename, or relax the check, its assertions, or its thresholds.

### Requirement 3: EAS build and real-device smoke

**User Story:** As a maintainer, I want the upgraded app to build on EAS and start cleanly on a real Android device, so that the upgrade is validated beyond static checks.

#### Acceptance Criteria

1. THE Expo_SDK_Upgrade SHALL produce an EAS Android build for the `development` profile that completes with a `finished` status and yields a downloadable installable artifact.
2. THE Expo_SDK_Upgrade SHALL produce an EAS Android build for the `preview` profile that completes with a `finished` status and yields a downloadable installable artifact.
3. WHEN the `preview` build is installed on a Smoke_Device and launched, THE upgraded app SHALL complete Google OAuth sign-in via the Frozen_Auth_Surface and render the role-appropriate authenticated home screen (`app/(admin)/` for an `admin` user, `app/(child)/` for a `filho` user) without process termination or fatal error overlay.
4. WHILE the smoke session on the Smoke_Device exercises Google OAuth sign-in, navigation to the role-appropriate home screen, and the Maestro_Smoke_Flows end-to-end, THE upgraded app SHALL not emit any unhandled JavaScript or native crash whose Sentry issue identifier is absent from the Baseline_Snapshot.
5. THE Expo_SDK_Upgrade SHALL not run, submit, or promote any build, OTA update, or release to the EAS `production` profile or production channel as part of this work.

### Requirement 4: Security and quality posture

**User Story:** As a maintainer, I want the upgrade to clear the advisory that motivated it without worsening overall dependency or code-quality posture, so that the security and quality gates stay trustworthy.

#### Acceptance Criteria

1. THE Expo_SDK_Upgrade SHALL resolve advisory `GHSA-w5hq-g745-h8pq` such that it does not appear in the output of `npm audit` executed against the post-upgrade lockfile on the upgrade branch.
2. THE Expo_SDK_Upgrade SHALL keep the count of HIGH advisories and the count of CRITICAL advisories reported by `npm audit` on the upgrade branch each less than or equal to the corresponding counts in the Baseline_Snapshot, and SHALL introduce no advisory identifier at HIGH or CRITICAL severity that is not already present in the Baseline_Snapshot.
3. THE Expo_SDK_Upgrade SHALL keep the SonarCloud quality gate status equal to `Passed` on the latest analysis of the upgrade branch, and SHALL introduce no SonarCloud issue at HIGH or BLOCKER severity that is not already present in the Baseline_Snapshot.
4. THE Expo_SDK_Upgrade SHALL declare every newly added or modified dependency entry in `package.json` using an exact version string with no open-range operators (no `^`, `~`, `>`, `>=`, `<`, `<=`, `*`, or `x` ranges).
5. IF an advisory at HIGH or CRITICAL severity that is absent from the Baseline_Snapshot is reported by `npm audit` during the upgrade, THEN THE Expo_SDK_Upgrade SHALL record the advisory identifier, severity, and affected package on the upgrade branch, and SHALL either resolve the advisory before merge or halt the merge and request explicit human approval before continuing.

### Requirement 5: Non-negotiable invariants

**User Story:** As a maintainer, I want the upgrade to leave the project's hard architectural invariants untouched, so that no security, multi-tenant, or auth boundary is silently changed under the cover of a platform bump.

#### Acceptance Criteria

1. THE Expo_SDK_Upgrade SHALL keep the Tenant_Boundary intact, with every Supabase query or RPC call touched by the upgrade preserving its `familia_id` filter against the authenticated user, and with no query or RPC call changed to omit, weaken, or replace that filter.
2. THE Expo_SDK_Upgrade SHALL keep Sentry PII rules intact, with `Sentry.setUser` continuing to use `id` only and no email, name, push token, task title, task description, task status, redemption content, or message body added to any `Sentry.setUser`, `Sentry.setTag`, `Sentry.setExtra`, `Sentry.addBreadcrumb`, `Sentry.captureException`, or `Sentry.captureMessage` call introduced by the upgrade.
3. THE Expo_SDK_Upgrade SHALL keep the Frozen_Auth_Surface intact, with no new email/password screen added under `app/(auth)/`, no new input field, validation rule, button, link, or navigation flow added to existing email/password screens, and no new auth method introduced beyond Google OAuth via `signInWithIdToken()`.
4. THE Expo_SDK_Upgrade SHALL leave `supabase/migrations/` and `supabase/functions/` unchanged on the upgrade branch (`git diff` against the merge base reports zero changes in those paths), and SHALL not alter any RPC name, signature, or return shape used by `lib/`.
5. WHERE a code change in `app/`, `lib/`, `src/`, or configuration is required to keep the upgraded app compiling, type-checking, linting, or running on Android, THE Expo_SDK_Upgrade SHALL limit that change to import path updates, replacement of removed APIs with their official successors, type-signature adjustments, and configuration updates required by the Target_SDK, and SHALL not rename, restructure, or refactor surrounding code that the upgrade does not strictly require to touch.

### Requirement 6: Out-of-scope discipline

**User Story:** As a maintainer, I want the upgrade scope to be narrow and explicit, so that the change set stays reviewable and unrelated work does not piggyback on the upgrade.

#### Acceptance Criteria

1. THE Expo_SDK_Upgrade SHALL not add iOS support, with no `ios/` directory introduced, no `Podfile` introduced, no `ios` key added to `app.json` or `eas.json`, and no `Platform.OS === 'ios'` or iOS-only `Platform.select` branch added to `app/`, `lib/`, or `src/`.
2. THE Expo_SDK_Upgrade SHALL not change user-facing copy, design tokens in `src/constants/`, accessibility labels, or visual styling in `app/` or `src/components/`, except where a change is the minimum required to resolve an upgrade-caused compile, type, lint, or runtime error and the change is documented in the upgrade commit or pull request.
3. THE Expo_SDK_Upgrade SHALL not add Supabase migrations, change RLS policies, change RPC bodies, change edge function bodies, modify existing files under `supabase/migrations/` or `supabase/functions/`, or regenerate `src/types/database.types.ts` against a different schema.
4. THE Expo_SDK_Upgrade SHALL not modify the `test:e2e:*` scripts in `package.json` that reference Maestro flow files which are not present under `.maestro/` at the start of the upgrade.
5. THE Expo_SDK_Upgrade SHALL restrict EAS activity to the `development` and `preview` profiles, with no run, submission, or promotion to the `production` profile or production channel and no OTA update to the production runtime.
6. IF a refactor, cleanup, or improvement unrelated to compiling, running, or aligning the project to the Target_SDK is identified during the upgrade, THEN THE Expo_SDK_Upgrade SHALL exclude it from the upgrade change set and SHALL record the deferred item on the upgrade branch with the affected file or area and a one-line description.

### Requirement 7: Definition of done

**User Story:** As a maintainer, I want a single explicit shippability gate, so that the upgrade is only considered complete when every other requirement is independently satisfied.

#### Acceptance Criteria

1. THE Expo_SDK_Upgrade SHALL record the Baseline_Snapshot on the upgrade branch before any version change is made, capturing the current Expo SDK version, the current `react-native` version, the full `npm audit` output, the SonarCloud quality gate status with its HIGH and BLOCKER issue counts, the Vitest coverage report with its test count and threshold values, and the set of unresolved Sentry issue identifiers for the production release at that point in time.
2. IF the Validation_Gate is green AND the Maestro_Smoke_Flows pass on a Smoke_Device AND the EAS `development` and `preview` Android builds succeed AND the post-login smoke on the Smoke_Device passes AND advisory `GHSA-w5hq-g745-h8pq` is resolved AND `npm audit` introduces no HIGH or CRITICAL advisory absent from the Baseline_Snapshot AND the SonarCloud quality gate status is `Passed` with no new HIGH or BLOCKER issue absent from the Baseline_Snapshot, THEN THE Expo_SDK_Upgrade SHALL be considered done.
3. IF any condition in criterion 2 is not met, THEN THE Expo_SDK_Upgrade SHALL not be merged, AND THE Expo_SDK_Upgrade SHALL record on the upgrade branch which specific condition failed and the reason for the failure before any subsequent verification attempt is performed.
4. THE Expo_SDK_Upgrade SHALL keep the Definition_of_Done verifiable from the upgrade branch alone, with each Definition_of_Done condition backed by a corresponding evidence artifact reachable from the upgrade branch's current HEAD commit, and with no condition deferred to post-merge cleanup.
