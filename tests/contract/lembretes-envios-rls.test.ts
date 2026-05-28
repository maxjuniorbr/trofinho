/**
 * Contract smoke test for `public.lembretes_envios` RLS policies and the
 * grants on the two child-task-reminder RPCs.
 *
 * Per `testing.md`, RLS/SQL execution against a real database requires cloud
 * Supabase, so this smoke test audits the migration SQL — which is the
 * source of truth for `pg_policies` and the grant DCL — and pins the
 * authored state to what `design.md` §"New table: public.lembretes_envios"
 * and §"RPC and edge function signatures" specify.
 *
 * Validates:
 *   - Requirement 4.4 — receipts table has RLS with `familia_id`-scoped
 *     policies and no client-writable policy.
 *   - Requirement 5.3 — neither RPC is exposed to `authenticated`/`anon`.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  '20260603200000_lembretes_envios_and_cron.sql',
);

const RAW_SQL = readFileSync(MIGRATION_PATH, 'utf8');

/**
 * Remove SQL comments so substring/regex assertions cannot match against
 * commentary text (e.g. design notes that mention the policy names).
 *
 * Handles `--` line comments and `/* ... *\/` block comments. The migration
 * does not currently use block comments but we strip them defensively.
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

const SQL = stripSqlComments(RAW_SQL);

/**
 * Extract every `CREATE POLICY <name> ON <target> FOR <command> ...`
 * statement so we can assert the set of policies declared on the receipts
 * table.
 */
type PolicyDecl = {
  name: string;
  target: string;
  command: string; // ALL | SELECT | INSERT | UPDATE | DELETE
};

function parseCreatePolicies(sql: string): PolicyDecl[] {
  const re =
    /CREATE\s+POLICY\s+([A-Za-z_][A-Za-z0-9_]*)\s+ON\s+([A-Za-z_][A-Za-z0-9_.]*)\s+(?:AS\s+(?:PERMISSIVE|RESTRICTIVE)\s+)?FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/gi;

  const matches: PolicyDecl[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    matches.push({
      name: m[1],
      target: m[2],
      command: m[3].toUpperCase(),
    });
  }
  return matches;
}

const POLICIES = parseCreatePolicies(SQL).filter(
  (p) => p.target === 'public.lembretes_envios' || p.target === 'lembretes_envios',
);

describe('lembretes_envios — RLS policies and grants smoke test', () => {
  describe('table-level RLS', () => {
    it('enables row level security on the receipts table', () => {
      expect(SQL).toMatch(
        /ALTER\s+TABLE\s+public\.lembretes_envios\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i,
      );
    });

    it('declares the lembretes_envios_select_admin policy on SELECT', () => {
      const adminPolicy = POLICIES.find((p) => p.name === 'lembretes_envios_select_admin');
      expect(adminPolicy).toBeDefined();
      expect(adminPolicy?.command).toBe('SELECT');

      // The policy must be familia_id-scoped via the canonical helpers used
      // across the codebase (see other migrations under supabase/migrations/).
      expect(SQL).toMatch(
        /CREATE\s+POLICY\s+lembretes_envios_select_admin\s+ON\s+public\.lembretes_envios\s+FOR\s+SELECT[\s\S]*?USING\s*\([\s\S]*?usuario_e_admin\(\)[\s\S]*?familia_id\s*=\s*public\.minha_familia_id\(\)[\s\S]*?\)/i,
      );
    });

    it('declares the lembretes_envios_select_filho policy on SELECT', () => {
      const filhoPolicy = POLICIES.find((p) => p.name === 'lembretes_envios_select_filho');
      expect(filhoPolicy).toBeDefined();
      expect(filhoPolicy?.command).toBe('SELECT');

      expect(SQL).toMatch(
        /CREATE\s+POLICY\s+lembretes_envios_select_filho\s+ON\s+public\.lembretes_envios\s+FOR\s+SELECT[\s\S]*?USING\s*\([\s\S]*?filho_id\s*=\s*public\.meu_filho_id\(\)[\s\S]*?familia_id\s*=\s*public\.minha_familia_id\(\)[\s\S]*?\)/i,
      );
    });

    it('declares exactly two policies on lembretes_envios, both for SELECT', () => {
      expect(POLICIES).toHaveLength(2);
      expect(POLICIES.every((p) => p.command === 'SELECT')).toBe(true);

      const names = POLICIES.map((p) => p.name).sort();
      expect(names).toEqual([
        'lembretes_envios_select_admin',
        'lembretes_envios_select_filho',
      ]);
    });

    it('declares no INSERT/UPDATE/DELETE policies on lembretes_envios', () => {
      const writePolicies = POLICIES.filter(
        (p) => p.command === 'INSERT' || p.command === 'UPDATE' || p.command === 'DELETE',
      );
      expect(writePolicies).toEqual([]);
    });

    it('declares no permissive ALL policy on lembretes_envios', () => {
      // An `ALL` command policy would implicitly cover INSERT/UPDATE/DELETE
      // and defeat the receipts-are-server-written-only invariant.
      const allPolicies = POLICIES.filter((p) => p.command === 'ALL');
      expect(allPolicies).toEqual([]);
    });

    it('revokes table-level INSERT/UPDATE/DELETE from authenticated and anon', () => {
      // The migration grants only SELECT to authenticated and grants nothing
      // to anon. We assert both halves explicitly so a future loosening
      // (e.g. GRANT INSERT … TO authenticated) trips this test.
      expect(SQL).toMatch(
        /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.lembretes_envios\s+FROM\s+authenticated\b/i,
      );
      expect(SQL).toMatch(
        /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.lembretes_envios\s+FROM\s+anon\b/i,
      );

      // Authenticated must receive read-only access; anon must receive nothing.
      expect(SQL).toMatch(
        /GRANT\s+SELECT\s+ON\s+TABLE\s+public\.lembretes_envios\s+TO\s+authenticated\b/i,
      );

      const grantToAnon =
        /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|ALL|REFERENCES|TRIGGER|TRUNCATE)[^;]*\bON\s+TABLE\s+public\.lembretes_envios\b[^;]*\bTO\s+anon\b/i;
      expect(SQL).not.toMatch(grantToAnon);

      const writeGrantToAuthenticated =
        /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL|REFERENCES|TRIGGER|TRUNCATE)[^;]*\bON\s+TABLE\s+public\.lembretes_envios\b[^;]*\bTO\s+authenticated\b/i;
      expect(SQL).not.toMatch(writeGrantToAuthenticated);
    });
  });

  describe('RPC grants — selecionar_lembretes_pendentes(date)', () => {
    it('revokes EXECUTE from anon and authenticated', () => {
      // REVOKE ALL implies REVOKE EXECUTE; we accept either form so a future
      // tightening to the explicit verb still passes.
      const fnSig = String.raw`public\.selecionar_lembretes_pendentes\s*\(\s*date\s*\)`;

      expect(SQL).toMatch(
        new RegExp(
          `REVOKE\\s+(?:ALL|EXECUTE)\\b[^;]*\\bON\\s+FUNCTION\\s+${fnSig}[^;]*\\bFROM\\s+(?:[^;]*\\b)?anon\\b`,
          'i',
        ),
      );
      expect(SQL).toMatch(
        new RegExp(
          `REVOKE\\s+(?:ALL|EXECUTE)\\b[^;]*\\bON\\s+FUNCTION\\s+${fnSig}[^;]*\\bFROM\\s+(?:[^;]*\\b)?authenticated\\b`,
          'i',
        ),
      );
    });

    it('does not GRANT EXECUTE to anon or authenticated', () => {
      const fnSig = String.raw`public\.selecionar_lembretes_pendentes\s*\(\s*date\s*\)`;

      const grantToAnon = new RegExp(
        `GRANT\\s+(?:EXECUTE|ALL)\\b[^;]*\\bON\\s+FUNCTION\\s+${fnSig}[^;]*\\bTO\\s+(?:[^;]*\\b)?anon\\b`,
        'i',
      );
      const grantToAuthenticated = new RegExp(
        `GRANT\\s+(?:EXECUTE|ALL)\\b[^;]*\\bON\\s+FUNCTION\\s+${fnSig}[^;]*\\bTO\\s+(?:[^;]*\\b)?authenticated\\b`,
        'i',
      );

      expect(SQL).not.toMatch(grantToAnon);
      expect(SQL).not.toMatch(grantToAuthenticated);
    });
  });

  describe('RPC grants — executar_lembretes_pendentes()', () => {
    it('revokes EXECUTE from anon and authenticated', () => {
      const fnSig = String.raw`public\.executar_lembretes_pendentes\s*\(\s*\)`;

      expect(SQL).toMatch(
        new RegExp(
          `REVOKE\\s+(?:ALL|EXECUTE)\\b[^;]*\\bON\\s+FUNCTION\\s+${fnSig}[^;]*\\bFROM\\s+(?:[^;]*\\b)?anon\\b`,
          'i',
        ),
      );
      expect(SQL).toMatch(
        new RegExp(
          `REVOKE\\s+(?:ALL|EXECUTE)\\b[^;]*\\bON\\s+FUNCTION\\s+${fnSig}[^;]*\\bFROM\\s+(?:[^;]*\\b)?authenticated\\b`,
          'i',
        ),
      );
    });

    it('does not GRANT EXECUTE to anon or authenticated', () => {
      const fnSig = String.raw`public\.executar_lembretes_pendentes\s*\(\s*\)`;

      const grantToAnon = new RegExp(
        `GRANT\\s+(?:EXECUTE|ALL)\\b[^;]*\\bON\\s+FUNCTION\\s+${fnSig}[^;]*\\bTO\\s+(?:[^;]*\\b)?anon\\b`,
        'i',
      );
      const grantToAuthenticated = new RegExp(
        `GRANT\\s+(?:EXECUTE|ALL)\\b[^;]*\\bON\\s+FUNCTION\\s+${fnSig}[^;]*\\bTO\\s+(?:[^;]*\\b)?authenticated\\b`,
        'i',
      );

      expect(SQL).not.toMatch(grantToAnon);
      expect(SQL).not.toMatch(grantToAuthenticated);
    });
  });
});
