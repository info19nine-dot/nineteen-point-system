-- 安全化対策SQL

-- 1. まず、既存の「ガバガバな更新許可」を削除します
drop policy if exists "Enable update for users based on id" on profiles;

-- 2. 「管理者だけ」が自由に更新できるポリシーを新設します
-- (循環参照を防ぐため、auth.jwt() -> app_metadata ではなく、別手段か、
--  あるいは一旦単純に「一般ユーザーはUPDATE禁止」にします)
--  ※スタッフアプリも現状クライント側でUPDATEしているので、
--    スタッフ操作も本来は全てRPCにするのが理想ですが、まずは会員の不正を防ぎます。
drop policy if exists "Enable update for admins only" on profiles;

create policy "Enable update for admins only"
on profiles for update
to authenticated
using (
  -- 自分のIDのroleが'admin'であることを確認
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'admin'
  )
);

-- 3. ポイント変動を安全に行うための「窓口機能 (RPC)」を作成

-- 【安全策】引数のパターンが分からなくても、同名の関数を全て自動で探し出して削除するスクリプトに変更しました
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT ns.nspname, p.proname, oidvectortypes(p.proargtypes) as args
             FROM pg_proc p INNER JOIN pg_namespace ns ON (p.pronamespace = ns.oid)
             WHERE ns.nspname = 'public' AND p.proname = 'execute_point_transaction'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE;';
    END LOOP;
END $$;


-- 4. transactionsテーブルに served_by カラムがない場合は追加
alter table transactions add column if not exists served_by text;

-- 5. 最新版の関数を作成 (served_by対応版)
create or replace function execute_point_transaction(
  p_amount int,
  p_description text,
  p_type text,
  p_target_member_id uuid default null,
  p_qr_id uuid default null,
  p_served_by text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_member_id uuid;
  v_new_points int;
begin
  -- 重複チェック
  if p_qr_id is not null then
    if exists (select 1 from transactions where qr_scan_id = p_qr_id) then
      raise exception 'このQRコードは既に使用されています';
    end if;
  end if;

  -- 対象会員IDの特定
  if p_target_member_id is not null then
    v_member_id := p_target_member_id;
  else
    v_member_id := auth.uid();
  end if;

  -- トランザクション記録 (served_by含む)
  insert into transactions (member_id, type, amount, description, qr_scan_id, served_by)
  values (v_member_id, p_type, p_amount, p_description, p_qr_id, p_served_by);

  -- ポイント更新
  if p_type = 'EARN' then
    update profiles set points = points + p_amount where id = v_member_id returning points into v_new_points;
  elsif p_type = 'USE' then
    update profiles set points = points - p_amount where id = v_member_id returning points into v_new_points;
    if v_new_points < 0 then raise exception 'ポイント不足です'; end if;
  end if;

  return json_build_object('success', true, 'new_points', v_new_points, 'served_by', p_served_by);
end;
$$;
