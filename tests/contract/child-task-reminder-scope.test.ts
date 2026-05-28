/**
 * Out-of-scope discipline guard for the Child_Task_Reminder feature.
 *
 * Spec: .kiro/specs/child-task-reminder/{requirements.md,design.md,tasks.md}
 *
 * Task 9.1 — Repository smoke test asserting v1 scope is preserved
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 *
 * The Child_Task_Reminder v1 scope is intentionally narrow. Requirement 9
 * explicitly forbids — for v1:
 *
 *   9.1  any streak (sequência) counter, field, column, RPC, or push event
 *   9.2  per-family / per-child Reminder_Window or Reminder_Timezone
 *        configuration (the window is hardcoded to `[18:00, 20:00)` SP)
 *   9.3  any new key in `NotificationPrefs`; `tarefasPendentes` must be
 *        reused as-is
 *   9.4  pt-BR copy variants, language column, or i18n indirection layer
 *   9.5  iOS / web push / in-app banner / email / SMS reminder support
 *   9.6  per-family/per-child reminder time configuration
 *   9.7  unrelated refactors (no streak schema, no notification cleanup)
 *
 * This file pins the items that are mechanically observable from the
 * repository state — symbol grep, exact `NotificationPrefs` shape,
 * absence of i18n libraries — so that any v2 work proposing to relax
 * those constraints must do so by editing this guard explicitly. iOS/web
 * push, in-app banners, email/SMS reminders, and per-family Reminder_
 * Window configuration are reviewed at PR time rather than guarded here
 * (no shared symbol surface exists to scan for them).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_FILE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.sql']);

/**
 * Test/spec/declaration files that are allowed to mention streak-style
 * substrings without bringing the feature into scope. Tests may discuss
 * sequences in pt-BR comments, and `.d.ts`/auto-generated DB types are not
 * production logic.
 */
const TEST_FILE_PATTERNS = [/\.test\.[tj]sx?$/, /\.spec\.[tj]sx?$/, /\.d\.ts$/];

/**
 * Walk a directory and yield every source file path under it, skipping
 * test/spec files and any nested `__tests__` directories. Tests may
 * legitimately describe sequence-style properties in their pt-BR comments
 * (e.g., `lib/admin-invite.property.test.ts`), and we only want this guard
 * to flag new production usage.
 */
function listSourceFiles(rootDir: string): string[] {
  const out: string[] = [];

  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry);
      let stats;
      try {
        stats = statSync(full);
      } catch {
        continue;
      }

      if (stats.isDirectory()) {
        if (entry === '__tests__' || entry === 'node_modules') continue;
        walk(full);
        continue;
      }

      if (!stats.isFile()) continue;
      const ext = path.extname(entry);
      if (!SOURCE_FILE_EXTS.has(ext)) continue;
      if (TEST_FILE_PATTERNS.some((re) => re.test(entry))) continue;

      out.push(full);
    }
  };

  walk(rootDir);
  return out;
}

// ---------------------------------------------------------------------------
// 9.1 — No streak / sequência counter, field, column, RPC, or push event
// ---------------------------------------------------------------------------

describe('Child_Task_Reminder scope — Requirement 9.1: no streak/sequencia symbols', () => {
  /**
   * The feature must not introduce a streak counter, streak field, streak
   * column, streak RPC, or streak push event (req 9.1). The guard scans
   * production source roots — `lib/`, `app/`, `src/`, `supabase/migrations/`,
   * and `supabase/functions/` — for the canonical streak vocabulary. Test
   * files and `.kiro/specs/**` are excluded so legitimate documentation
   * usage does not trip the guard.
   *
   * `sequência` (with cedilla) and `sequencia` (without) are both flagged
   * because Trofinho's domain layer is pt-BR; either spelling would
   * indicate a streak-style symbol entering production code.
   */
  const PRODUCTION_ROOTS = [
    path.join(REPO_ROOT, 'lib'),
    path.join(REPO_ROOT, 'app'),
    path.join(REPO_ROOT, 'src'),
    path.join(REPO_ROOT, 'supabase', 'migrations'),
    path.join(REPO_ROOT, 'supabase', 'functions'),
  ];

  const STREAK_PATTERN = /\b(streak|sequencia|sequência)\b/i;

  it('no production source file references streak/sequencia symbols', () => {
    const offenders: { file: string; line: number; text: string }[] = [];

    for (const root of PRODUCTION_ROOTS) {
      for (const file of listSourceFiles(root)) {
        const content = readFileSync(file, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (STREAK_PATTERN.test(lines[i])) {
            offenders.push({
              file: path.relative(REPO_ROOT, file),
              line: i + 1,
              text: lines[i].trim(),
            });
          }
        }
      }
    }

    // Empty-array equality emits the offending rows in the test failure
    // diff so a reviewer can see exactly which symbol was introduced.
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 9.3 — `NotificationPrefs` keys unchanged: `tarefasPendentes` reused, no
//       new key added for the reminder.
// ---------------------------------------------------------------------------

/**
 * Canonical `NotificationPrefs` key set, as documented in
 * `notifications.md` and pinned in `lib/notifications.ts`. The reminder
 * must reuse `tarefasPendentes` (req 5.2, 9.3) and must not introduce a
 * new key.
 */
const EXPECTED_PREFS_KEYS = [
  'tarefasPendentes',
  'tarefaAprovada',
  'tarefaRejeitada',
  'tarefaConcluida',
  'resgatesSolicitado',
  'resgateConfirmado',
  'resgateCancelado',
  'resgateCofrinhoSolicitado',
  'resgateCofrinhoConfirmado',
  'resgateCofrinhoCancelado',
  'penalidadeAplicada',
].sort((a, b) => a.localeCompare(b));

/**
 * Extract the keys declared in a `type X = { ... }` block. Returns the
 * sorted list of identifiers found on the left-hand side of `: type;`
 * pairs inside the first `{...}` matching the type alias.
 */
function extractTypeKeys(source: string, typeName: string): string[] {
  const re = new RegExp(
    String.raw`export\s+type\s+${typeName}\s*=\s*\{([\s\S]*?)\};`,
    'm',
  );
  const match = re.exec(source);
  if (!match) {
    throw new Error(`type ${typeName} not found in lib/notifications.ts`);
  }

  const body = match[1];
  const keys: string[] = [];
  const propRe = /^\s*([A-Za-z_]\w*)\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = propRe.exec(body)) !== null) {
    keys.push(m[1]);
  }
  return keys.sort((a, b) => a.localeCompare(b));
}

/**
 * Extract the keys declared in a `const X: T = { ... }` block. Same
 * approach as `extractTypeKeys` but tolerant of `key: value` pairs
 * separated by commas.
 */
function extractConstKeys(source: string, constName: string): string[] {
  const re = new RegExp(
    String.raw`export\s+const\s+${constName}\s*:\s*[A-Za-z_]\w*\s*=\s*\{([\s\S]*?)\};`,
    'm',
  );
  const match = re.exec(source);
  if (!match) {
    throw new Error(`const ${constName} not found in lib/notifications.ts`);
  }

  const body = match[1];
  const keys: string[] = [];
  const propRe = /^\s*([A-Za-z_]\w*)\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = propRe.exec(body)) !== null) {
    keys.push(m[1]);
  }
  return keys.sort((a, b) => a.localeCompare(b));
}

describe('Child_Task_Reminder scope — Requirement 9.3: NotificationPrefs keys are unchanged', () => {
  const NOTIFICATIONS_PATH = path.join(REPO_ROOT, 'lib', 'notifications.ts');
  const NOTIFICATIONS_SRC = readFileSync(NOTIFICATIONS_PATH, 'utf8');

  it('NotificationPrefs type declares exactly the canonical key set', () => {
    const actual = extractTypeKeys(NOTIFICATIONS_SRC, 'NotificationPrefs');
    expect(actual).toEqual(EXPECTED_PREFS_KEYS);
  });

  it('DEFAULT_NOTIFICATION_PREFS declares exactly the canonical key set', () => {
    const actual = extractConstKeys(NOTIFICATIONS_SRC, 'DEFAULT_NOTIFICATION_PREFS');
    expect(actual).toEqual(EXPECTED_PREFS_KEYS);
  });

  it('reuses the existing tarefasPendentes preference key', () => {
    // Pin the explicit reuse rather than just relying on the set above,
    // so a future rename surfaces here as well as in the type test.
    expect(EXPECTED_PREFS_KEYS).toContain('tarefasPendentes');
    expect(NOTIFICATIONS_SRC).toMatch(/\btarefasPendentes\s*:\s*boolean\b/);
  });

  it('does not introduce a reminder-specific preference key', () => {
    // A short list of names that would be obvious choices for a
    // reminder-specific preference; presence of any would violate req 9.3.
    const FORBIDDEN_KEYS = [
      'tarefaLembrete',
      'tarefasLembrete',
      'tarefasLembretes',
      'lembreteTarefas',
      'lembreteDiario',
      'lembretesDiario',
      'lembretesDiarios',
      'reminderDaily',
      'dailyReminder',
    ];

    for (const forbidden of FORBIDDEN_KEYS) {
      const re = new RegExp(String.raw`\b${forbidden}\b`);
      expect(NOTIFICATIONS_SRC).not.toMatch(re);
    }
  });
});

// ---------------------------------------------------------------------------
// 9.4 — No copy-variants table, language column, or i18n indirection layer.
// ---------------------------------------------------------------------------

describe('Child_Task_Reminder scope — Requirement 9.4: no copy variants / language column / i18n', () => {
  const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
  const PACKAGE_JSON = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const LEMBRETES_MIGRATION = path.join(
    REPO_ROOT,
    'supabase',
    'migrations',
    '20260603200000_lembretes_envios_and_cron.sql',
  );

  /**
   * Common npm i18n libraries. The reminder must keep pt-BR copy in code
   * (see `supabase/functions/send-task-reminder/copy-bank.ts`) and not
   * introduce any indirection layer that could route the copy through
   * a multi-language system (req 9.4).
   */
  const FORBIDDEN_I18N_PACKAGES = [
    'i18next',
    'react-i18next',
    'i18n-js',
    'react-intl',
    '@formatjs/intl',
    '@lingui/core',
    '@lingui/react',
    'polyglot',
    'node-polyglot',
    'expo-localization',
    'next-translate',
    'next-intl',
  ];

  it('does not declare any i18n package in dependencies', () => {
    const deps = Object.keys(PACKAGE_JSON.dependencies ?? {});
    for (const forbidden of FORBIDDEN_I18N_PACKAGES) {
      expect(deps).not.toContain(forbidden);
    }
  });

  it('does not declare any i18n package in devDependencies', () => {
    const devDeps = Object.keys(PACKAGE_JSON.devDependencies ?? {});
    for (const forbidden of FORBIDDEN_I18N_PACKAGES) {
      expect(devDeps).not.toContain(forbidden);
    }
  });

  it('does not introduce a copy-variants table or language/locale/idioma column in the lembretes migration', () => {
    const sql = readFileSync(LEMBRETES_MIGRATION, 'utf8');

    /**
     * Strip SQL comments before scanning so commentary referencing
     * "language" (e.g., `LANGUAGE plpgsql` is fine, but explanatory text
     * like "language column" in a `--` comment must not trip the guard).
     */
    const stripped = stripSqlComments(sql);

    // Hard-fail if a copy-variants table is declared.
    expect(stripped).not.toMatch(/\bcopy_variants?\b/i);
    expect(stripped).not.toMatch(
      /\bCREATE\s+TABLE\b[\s\S]*?\bcopy_variants?\b/i,
    );

    // Column-level forbids: `idioma`, `locale`, and `language` as
    // identifiers (NOT as the `LANGUAGE plpgsql` clause, which is a
    // function attribute and unrelated to multi-language copy).
    const columnDecls =
      /\b(idioma|locale)\s+(?:text|varchar|char|citext|jsonb|json|enum)\b/gi;
    expect(stripped).not.toMatch(columnDecls);

    // `language` as a *column* (not the function attribute). The function
    // attribute is matched by `LANGUAGE plpgsql` (no preceding name).
    // A column declaration would look like `language text NOT NULL`.
    const languageColumnDecl =
      /^\s*language\s+(text|varchar|char|citext|jsonb|json)\b/im;
    expect(stripped).not.toMatch(languageColumnDecl);
  });

  it('does not introduce copy_variants/idioma references in production source', () => {
    const PRODUCTION_ROOTS = [
      path.join(REPO_ROOT, 'lib'),
      path.join(REPO_ROOT, 'app'),
      path.join(REPO_ROOT, 'src'),
      path.join(REPO_ROOT, 'supabase', 'functions'),
    ];

    const FORBIDDEN_RE = /\b(copy_variants?|copyVariants?|idioma)\b/;
    const offenders: { file: string; line: number; text: string }[] = [];

    for (const root of PRODUCTION_ROOTS) {
      for (const file of listSourceFiles(root)) {
        const content = readFileSync(file, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (FORBIDDEN_RE.test(lines[i])) {
            offenders.push({
              file: path.relative(REPO_ROOT, file),
              line: i + 1,
              text: lines[i].trim(),
            });
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SQL comment stripper — shared helper.
// ---------------------------------------------------------------------------

/**
 * Strip `--` line comments and `/* ... *\/` block comments from a SQL
 * string so substring/regex assertions cannot match commentary text.
 * Mirrors the helper in `lembretes-envios-rls.test.ts`.
 */
function stripSqlComments(sql: string): string {
  let withoutBlockComments = '';
  let i = 0;
  while (i < sql.length) {
    if (sql[i] === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 2;
      continue;
    }
    withoutBlockComments += sql[i];
    i += 1;
  }

  return withoutBlockComments
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
}
