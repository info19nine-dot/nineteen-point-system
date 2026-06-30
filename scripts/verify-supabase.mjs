/**
 * Smoke test: new Supabase connection, tables, and RPC functions.
 * Usage: node scripts/verify-supabase.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from '../migrations/loadEnv.js';

const env = loadEnvLocal();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url?.includes('safwaqsrvvwgnmsazrjm')) {
  console.error('FAIL: VITE_SUPABASE_URL should point to safwaqsrvvwgnmsazrjm');
  process.exit(1);
}
if (!key || key.includes('your-anon-key')) {
  console.error('FAIL: Set VITE_SUPABASE_ANON_KEY in .env.local (Supabase Dashboard → API Keys → anon public)');
  process.exit(1);
}

const supabase = createClient(url, key);
let failed = false;

function ok(msg) {
  console.log('OK:', msg);
}
function fail(msg, err) {
  failed = true;
  console.error('FAIL:', msg, err?.message ?? err ?? '');
}

async function checkTable(name, select = 'id') {
  const { data, error, count } = await supabase
    .from(name)
    .select(select, { count: 'exact', head: false })
    .limit(1);
  if (error) {
    fail(`table ${name}`, error);
    return;
  }
  ok(`table ${name} reachable (sample rows: ${data?.length ?? 0}, total ~${count ?? '?'})`);
}

async function checkRpc(name) {
  const { error } = await supabase.rpc(name, {});
  if (!error) {
    ok(`rpc ${name} exists (callable without args)`);
    return;
  }
  const msg = error.message ?? '';
  if (
    msg.includes('Could not find the function') ||
    msg.includes('function') && msg.includes('does not exist')
  ) {
    fail(`rpc ${name} missing`, error);
    return;
  }
  ok(`rpc ${name} exists (${msg.slice(0, 80)}...)`);
}

console.log('Supabase verify:', url);
await checkTable('profiles', 'id, email, current_points');
await checkTable('transactions', 'id, type, amount');
await checkTable('courses', 'id, title, points');
await checkTable('audit_logs', 'id');
await checkTable('use_qr_sessions', 'id, status');
await checkRpc('execute_point_transaction');
await checkRpc('execute_admin_action');
await checkRpc('create_use_qr_session');
await checkRpc('claim_use_qr_session');
await checkRpc('complete_use_qr_session');
await checkRpc('cancel_use_qr_session');

if (failed) {
  console.error('\nSome checks failed. If RPCs are missing, run db_scripts/_latest/*.sql in Supabase SQL Editor.');
  process.exit(1);
}
console.log('\nAll connection checks passed.');
