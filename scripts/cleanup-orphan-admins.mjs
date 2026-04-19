/**
 * cleanup-orphan-admins.mjs
 *
 * 1. Lists admin users whose families have NO children (filhos).
 * 2. Deletes them (familia cascade → usuarios + push_tokens, then auth user).
 * 3. Creates fresh test admin-without-children accounts for today's testing.
 *
 * Usage: node scripts/cleanup-orphan-admins.mjs [--dry-run]
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY as env vars
 * or hardcoded below (never commit with keys filled in).
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://ulyuwgzmpayezxfizkkp.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Production accounts that must NEVER be deleted.
const PROTECTED_AUTH_IDS = new Set([
  '043a3540-5600-48f3-b52b-38297d5cc21c', // maxjuniorbr@gmail.com (admin)
  '2ff73e3e-996f-4ce0-b828-a95274ab3048', // luquinhasdianin@gmail.com (filho)
]);

const DRY_RUN = process.argv.includes('--dry-run');

const today = new Date();
const dd = String(today.getDate()).padStart(2, '0');
const mm = String(today.getMonth() + 1).padStart(2, '0');
const yyyy = today.getFullYear();
const dateTag = `${dd}${mm}${yyyy}`; // e.g. 19042026

// Test accounts to create after cleanup (admin only, no children = orphan state)
const TEST_ACCOUNTS = [
  {
    email: `maxjuniorbr+teste1.${dateTag}@gmail.com`,
    nome: 'Família Teste 1',
    adminNome: 'Admin Teste 1',
  },
  {
    email: `maxjuniorbr+teste2.${dateTag}@gmail.com`,
    nome: 'Família Teste 2',
    adminNome: 'Admin Teste 2',
  },
  {
    email: `maxjuniorbr+teste3.${dateTag}@gmail.com`,
    nome: 'Família Teste 3',
    adminNome: 'Admin Teste 3',
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
if (!SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY env var is required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`\n${'─'.repeat(60)}`);
console.log(`Trofinho — orphan admin cleanup (${DRY_RUN ? 'DRY RUN' : 'LIVE'})`);
console.log(`${'─'.repeat(60)}\n`);

// ── Step 1: Find admin families with no children ───────────────────────────
console.log('Step 1: Finding admin families with no children…');

const { data: allAdmins, error: adminErr } = await supabase
  .from('usuarios')
  .select('id, familia_id, nome, created_at')
  .eq('papel', 'admin')
  .order('created_at', { ascending: true });

if (adminErr) {
  console.error('Failed to query admins:', adminErr.message);
  process.exit(1);
}

const { data: allFilhos, error: filhoErr } = await supabase
  .from('usuarios')
  .select('familia_id')
  .eq('papel', 'filho');

if (filhoErr) {
  console.error('Failed to query filhos:', filhoErr.message);
  process.exit(1);
}

const familiesWithChildren = new Set(allFilhos.map((f) => f.familia_id));

const orphanAdmins = allAdmins.filter(
  (u) => !familiesWithChildren.has(u.familia_id) && !PROTECTED_AUTH_IDS.has(u.id),
);

if (orphanAdmins.length === 0) {
  console.log('✓ No orphan admins found.\n');
} else {
  console.log(`Found ${orphanAdmins.length} orphan admin(s):\n`);
  for (const u of orphanAdmins) {
    const { data: authUser } = await supabase.auth.admin.getUserById(u.id);
    const email = authUser?.user?.email ?? '(no email)';
    console.log(
      `  • [${u.id}] ${u.nome} <${email}> — familia ${u.familia_id} — created ${u.created_at}`,
    );
  }
}

if (orphanAdmins.length > 0) {
  // ── Step 2: Delete them ──────────────────────────────────────────────────
  console.log(`\nStep 2: Deleting ${orphanAdmins.length} orphan admin(s)…`);

  for (const u of orphanAdmins) {
    if (DRY_RUN) {
      console.log(`  [DRY] Would delete familia ${u.familia_id} and auth user ${u.id}`);
      continue;
    }

    // Delete familia first — cascades to usuarios + push_tokens
    const { error: famErr } = await supabase.from('familias').delete().eq('id', u.familia_id);

    if (famErr) {
      console.warn(`  ⚠ Failed to delete familia ${u.familia_id}: ${famErr.message}`);
    }

    // Delete auth user
    const { error: authErr } = await supabase.auth.admin.deleteUser(u.id);
    if (authErr) {
      console.warn(`  ⚠ Failed to delete auth user ${u.id}: ${authErr.message}`);
    } else {
      console.log(`  ✓ Deleted: ${u.nome} (${u.id})`);
    }
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(DRY_RUN ? 'Dry run complete — no changes made.' : 'Done.');
console.log(`${'─'.repeat(60)}\n`);
