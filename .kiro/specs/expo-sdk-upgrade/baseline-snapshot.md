# Baseline Snapshot

## Captured at
cd4020df25951313dec7b2c57131f5307445bac0, 2026-05-27T18:51:57+00:00

## Versions
- expo: 55.0.26 (declared `~55.0.19` in package.json, resolved 55.0.26 in package-lock.json)
- react-native: 0.83.6 (declared `0.83.6` in package.json, resolved 0.83.6 in package-lock.json)
- react: 19.2.6 (declared `^19.2.6` in package.json, resolved 19.2.6 in package-lock.json)
- expo-splash-screen: 55.0.21 (declared `~55.0.19` in package.json, resolved 55.0.21 in package-lock.json)

## npm audit (baseline)
- HIGH count: 0
- CRITICAL count: 0
- Advisory ids present: [GHSA-w5hq-g745-h8pq]
- Full JSON output: ./npm-audit-baseline.json (committed alongside this file)

Notes:
- All 14 reported vulnerabilities resolve to the same advisory `GHSA-w5hq-g745-h8pq` (transitive `uuid` v3/v5/v6 buffer bounds), reaching the dependency tree via `@expo/cli`, `@expo/config-plugins`, `@expo/metro-config`, `@expo/ngrok`, `@expo/prebuild-config`, `@expo/local-build-cache-provider`, `@expo/config`, `expo`, `expo-splash-screen`, `@react-native-community/datetimepicker`, `@react-native-google-signin/google-signin`, `@sentry/react-native`, and `xcode` (devDep of `@expo/cli`). All are reported at `moderate` severity. HIGH and CRITICAL counts are both 0.
- Captured by running `npm audit --json` at `git rev-parse HEAD` = `cd4020df25951313dec7b2c57131f5307445bac0` on branch `chore/expo-sdk-upgrade-pre-flight-audit`.
- This advisory is the one Req 4.1 mandates the upgrade resolve.

## SonarCloud quality gate (baseline)
- Status: Passed
- HIGH count: 4
- BLOCKER count: 0
- Issue ids present: [AZ5XvP5GqJQ-O8gWKvPi, AZ5XvP5hqJQ-O8gWKvPn, AZ5XvP7EqJQ-O8gWKvPy, AZ5XvP4vqJQ-O8gWKvPh]
- Project key: maxjuniorbr_trofinho

Notes:
- Project key resolved via `mcp_sonarqube_search_my_sonarqube_projects` (returned single match `maxjuniorbr_trofinho`).
- Quality gate status from `mcp_sonarqube_get_project_quality_gate_status` returned `OK` (mapped to `Passed` per the design.md baseline format). All 6 conditions on the New Code period passed: `new_reliability_rating=1`, `new_security_rating=1`, `new_maintainability_rating=1`, `new_coverage=92.9` (threshold 80), `new_duplicated_lines_density=0.0` (threshold 3), `new_security_hotspots_reviewed=100.0` (threshold 100).
- HIGH/BLOCKER issue ids enumerated via `mcp_sonarqube_search_sonar_issues_in_projects` with `severities=['HIGH','BLOCKER']`, `projects=['maxjuniorbr_trofinho']`, `ps=500`, `p=1`. The API returned 4 total issues in 1 page (`paging.total=4`, no truncation). All 4 surface in MQR severity HIGH (legacy `CRITICAL` shown in the `severity` response field is the older scheme; the filter used the new MQR scheme that the upgrade gates reference).
- Files affected: `app/(child)/perfil.tsx:42`, `app/(child)/tasks/[id].tsx:242`, `app/(auth)/join-child.tsx:37`, `lib/tasks.ts:957`. All 4 are `typescript:S3776` Cognitive Complexity violations pre-dating this upgrade.

## Vitest coverage (baseline)
- Test count: 1413 passed (121 test files, 0 failed, 0 skipped, 0 todo)
- Thresholds (lib/**): statements 90, lines 90, functions 90, branches 84
- Coverage values (lib/**, computed from `coverage/coverage-final.json`): statements 92.60% (1502/1622), lines 93.43% (1337/1431), functions 93.24% (262/281), branches 85.20% (1059/1243)
- Coverage values (all files, from v8 reporter summary): statements 74.6% (3746/5021), lines 75.75% (3394/4480), functions 67.3% (945/1404), branches 66.46% (2323/3495)
- Archive: `.tmp/coverage-baseline/` (lcov.info, coverage-final.json, lcov-report/, html `index.html`, per-area subtrees `lib/`, `app/`, `src/`); not committed (`.tmp/` is gitignored)

Notes:
- Captured by running `npm run test:coverage` (= `vitest run --coverage`) against `git rev-parse HEAD` = `cd4020df25951313dec7b2c57131f5307445bac0` on branch `chore/expo-sdk-upgrade-pre-flight-audit`. Vitest 4.1.7, v8 coverage provider.
- Threshold values verified in `vitest.config.ts` (`coverage.thresholds.'lib/**/*.ts'`): statements `90`, lines `90`, functions `90`, branches `84`. Matches the design.md spec value `90/90/90/84` for `lib/**`. Per Req 2.3, these thresholds must not be lowered during the upgrade.
- Per-file Vitest summary already shows headroom on the threshold-bound layer (`lib/` aggregate: statements 92.60%, branches 85.19%, functions 93.23%, lines 93.43%). Two files inside `lib/` carry partial coverage that the upgrade must preserve: `lib/google-auth.ts` (6.06% statements; integration-tested via the auth surface) and `lib/tasks.ts` (86.99% statements / 76.58% branches), both already factored into the aggregate that satisfies the 90/90/90/84 bar.
- The whole-repo coverage summary (74.6% statements, 66.46% branches, 67.3% functions, 75.75% lines) is informational only: thresholds are scoped to `lib/**` per `vitest.config.ts`, so app screens and components in the lower-coverage rows do not gate the suite.

## Sentry unresolved issues (baseline)
- Release: N/A — pending Sentry MCP capture (candidate id `com.maxjuniorbr.trofinho@1.0.1`, derived from `app.json` `android.package` + `expo.version` under `runtimeVersion.policy: appVersion`)
- Captured: N/A — Sentry MCP not available in this session (timestamp at write: 2026-05-27T19:42:49Z)
- Issue ids: N/A — Sentry MCP not available in this session

Notes:
- Sentry MCP tools (`mcp_sentry_*`, including `mcp_sentry_whoami`) are not installed in the current Kiro session, so the production release id and the unresolved issue id set could not be queried at HEAD `cd4020df25951313dec7b2c57131f5307445bac0` on branch `chore/expo-sdk-upgrade-pre-flight-audit`. Org slug per global steering: `maxjuniorbrs-organization`.
- Project slug discrepancy to resolve before relying on this section: global steering names the Sentry project `react-native`, while `app.json#expo.plugins[@sentry/react-native/expo].project` is set to `trofinho`. The slug must be confirmed via `mcp_sentry_whoami` (or the Sentry web UI) before Wave 12 (`13.5 Capture Sentry issue id delta vs Baseline_Snapshot`) and Wave 13 (`14.4` Sonar/Sentry reconciliation) reference this baseline.
- Release id derivation reference (for the follow-up capture): `runtimeVersion.policy: appVersion` in `app.json` plus `expo.version: 1.0.1` and `android.package: com.maxjuniorbr.trofinho` produce the conventional Sentry release id `com.maxjuniorbr.trofinho@1.0.1`. The `@sentry/react-native/expo` plugin attaches this release identifier automatically; the canonical value must still be read back from Sentry to handle dist/build-number suffixes.
- Follow-up to fill this section once Sentry MCP is installed (separate task or HITL prompt; does not block Wave 0 completion since this section's capture is informational baseline data — Wave 12 and Wave 13 will request a fresh capture as part of the `## Sentry evidence` append, which can backfill these fields):
  1. `mcp_sentry_whoami` to confirm authenticated org/project access and resolve the slug discrepancy noted above.
  2. List releases for the production channel (`channel: production` per `eas.json`) and pick the latest finalized release id.
  3. Enumerate `is:unresolved` issues filtered to that release id; record the full set of issue ids.
  4. Replace `N/A` placeholders above with the real release id, ISO 8601 capture timestamp, and the issue id list, in-place under this same heading (this section is the only Baseline_Snapshot block whose initial values are explicitly marked `N/A — pending`; the rest of the file remains immutable per `design.md` baseline contract).
