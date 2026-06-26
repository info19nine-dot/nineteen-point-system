/**
 * Create staff Auth user n19@admin.com (run once).
 * If signUp requires email confirm, use Supabase Dashboard → Users → Add user instead.
 */
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from '../migrations/loadEnv.js';

const STAFF_EMAIL = 'n19@admin.com';
const STAFF_PASSWORD = '19n86888';
const STAFF_NAME = '管理者';

const env = loadEnvLocal();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { data, error } = await supabase.auth.signUp({
  email: STAFF_EMAIL,
  password: STAFF_PASSWORD,
  options: {
    data: { name: STAFF_NAME },
  },
});

if (error) {
  console.error('signUp error:', error.message);
  console.log('\nDashboard で手動作成してください:');
  console.log(`  Email: ${STAFF_EMAIL}`);
  console.log(`  Password: (設定した値)`);
  process.exit(1);
}

console.log('Auth user created or pending confirm:', data.user?.id ?? '(check email confirm settings)');
console.log('\n次: Supabase SQL Editor で db_scripts/_latest/setup_staff_n19.sql を実行');
