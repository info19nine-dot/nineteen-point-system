-- ポイント使用QRセッション（スタッフ発行 → 会員が読取 → 金額入力 → 確定）
-- Supabase SQL Editor で実行してください

BEGIN;

CREATE TABLE IF NOT EXISTS public.use_qr_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'inputting', 'completed', 'cancelled', 'expired')),
  member_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  member_name text,
  amount int,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS use_qr_sessions_staff_id_idx ON public.use_qr_sessions (staff_id);
CREATE INDEX IF NOT EXISTS use_qr_sessions_status_idx ON public.use_qr_sessions (status);

ALTER TABLE public.use_qr_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read own use qr sessions" ON public.use_qr_sessions;
CREATE POLICY "Staff read own use qr sessions"
  ON public.use_qr_sessions FOR SELECT
  TO authenticated
  USING (staff_id = auth.uid());

DROP POLICY IF EXISTS "Member read own claimed use qr sessions" ON public.use_qr_sessions;
CREATE POLICY "Member read own claimed use qr sessions"
  ON public.use_qr_sessions FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

-- Realtime（スタッフ画面の状態同期）
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.use_qr_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.create_use_qr_session()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'スタッフ権限が必要です';
  END IF;

  v_id := gen_random_uuid();
  INSERT INTO use_qr_sessions (id, staff_id, status, expires_at)
  VALUES (v_id, auth.uid(), 'waiting', now() + interval '5 minutes');

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_use_qr_session(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_row use_qr_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT name INTO v_name FROM profiles WHERE id = auth.uid();
  IF v_name IS NULL THEN
    RAISE EXCEPTION '会員情報が見つかりません';
  END IF;

  UPDATE use_qr_sessions
  SET
    status = 'inputting',
    member_id = auth.uid(),
    member_name = v_name
  WHERE id = p_session_id
    AND status = 'waiting'
    AND expires_at > now()
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'このQRコードは無効です（期限切れ・使用中・使用済み）';
  END IF;

  RETURN json_build_object(
    'session_id', v_row.id,
    'member_name', v_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_use_qr_session(
  p_session_id uuid,
  p_amount int
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row use_qr_sessions%ROWTYPE;
  v_points int;
  v_result json;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION '利用ポイントを入力してください';
  END IF;

  SELECT points INTO v_points FROM profiles WHERE id = auth.uid();
  IF v_points IS NULL THEN
    RAISE EXCEPTION '会員情報が見つかりません';
  END IF;
  IF v_points < p_amount THEN
    RAISE EXCEPTION 'ポイント不足です';
  END IF;

  SELECT * INTO v_row
  FROM use_qr_sessions
  WHERE id = p_session_id
    AND member_id = auth.uid()
    AND status = 'inputting'
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'セッションが無効です。もう一度店舗のQRを読み取ってください';
  END IF;

  v_result := execute_point_transaction(
    p_amount,
    'ポイント利用',
    'USE',
    NULL,
    p_session_id,
    NULL
  );

  UPDATE use_qr_sessions
  SET status = 'completed', amount = p_amount, completed_at = now()
  WHERE id = p_session_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_use_qr_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;
  IF NOT is_admin_user() THEN
    RAISE EXCEPTION 'スタッフ権限が必要です';
  END IF;

  UPDATE use_qr_sessions
  SET status = 'cancelled'
  WHERE id = p_session_id
    AND staff_id = auth.uid()
    AND status IN ('waiting', 'inputting');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'キャンセルできません';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_use_qr_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_use_qr_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_use_qr_session(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_use_qr_session(uuid) TO authenticated;

COMMIT;
