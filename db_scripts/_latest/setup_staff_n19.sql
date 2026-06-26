-- NINE-TEEN スタッフアカウント: n19@admin.com
-- 前提: Authentication → Users で n19@admin.com が作成済み
-- （scripts/setup-staff-n19.mjs または Dashboard → Add user）

-- 1) profiles に admin 行を用意（無ければ作成、あれば更新）
INSERT INTO public.profiles (
  id,
  email,
  name,
  member_code,
  role,
  points,
  is_blacklisted,
  is_deleted,
  rank
)
SELECT
  u.id,
  u.email,
  '管理者',
  'N19ADMIN',
  'admin',
  0,
  false,
  false,
  'regular'
FROM auth.users u
WHERE u.email = 'n19@admin.com'
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  role = 'admin',
  member_code = COALESCE(public.profiles.member_code, EXCLUDED.member_code);

-- 2) 旧スタッフ freelovepoints はログイン不可に（任意・コメント外して実行）
-- UPDATE auth.users
-- SET banned_until = '2099-01-01'::timestamptz
-- WHERE email = 'freelovepoints@admin.com';
