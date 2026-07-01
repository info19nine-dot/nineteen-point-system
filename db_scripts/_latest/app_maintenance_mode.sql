-- メンテナンスモード：会員の貯める・使うのみ停止（ログイン・履歴閲覧は可）
-- Supabase SQL Editor で実行してください。

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  points_paused boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id, points_paused)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read app_settings" ON public.app_settings;
CREATE POLICY "Anyone authenticated can read app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can update app_settings" ON public.app_settings;
CREATE POLICY "Admins can update app_settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.is_points_paused()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT points_paused FROM app_settings WHERE id = 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.set_points_paused(p_paused boolean)
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

  UPDATE app_settings
  SET points_paused = p_paused, updated_at = now()
  WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_points_paused(boolean) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- execute_point_transaction に停止チェックを追加
CREATE OR REPLACE FUNCTION execute_point_transaction(
  p_amount int,
  p_description text,
  p_type text,
  p_target_member_id uuid default null,
  p_qr_id uuid default null,
  p_served_by text default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_new_points int;
BEGIN
  IF is_points_paused() AND p_type IN ('EARN', 'USE') THEN
    RAISE EXCEPTION '現在ポイントの貯める・使う操作は一時停止中です';
  END IF;

  IF p_qr_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM transactions WHERE qr_scan_id = p_qr_id) THEN
      RAISE EXCEPTION 'このQRコードは既に使用されています (Reuse detected)';
    END IF;
  END IF;

  IF p_target_member_id IS NOT NULL THEN
    v_member_id := p_target_member_id;
  ELSE
    v_member_id := auth.uid();
  END IF;

  INSERT INTO transactions (member_id, type, amount, description, qr_scan_id, served_by)
  VALUES (v_member_id, p_type, p_amount, p_description, p_qr_id, p_served_by);

  SELECT points INTO v_new_points FROM profiles WHERE id = v_member_id;

  IF p_type = 'USE' AND v_new_points < 0 THEN
    RAISE EXCEPTION 'ポイント不足です';
  END IF;

  RETURN json_build_object(
    'success', true,
    'new_points', v_new_points,
    'served_by', p_served_by
  );
END;
$$;

-- ポイント使用QR：会員側の読取・確定を停止
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
  IF is_points_paused() THEN
    RAISE EXCEPTION '現在ポイントの貯める・使う操作は一時停止中です';
  END IF;

  SELECT name INTO v_name FROM profiles WHERE id = auth.uid();
  IF v_name IS NULL THEN
    RAISE EXCEPTION '会員情報が見つかりません';
  END IF;

  UPDATE use_qr_sessions
  SET
    status = 'inputting',
    member_id = auth.uid(),
    member_name = v_name,
    expires_at = now() + interval '2 minutes'
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
  IF is_points_paused() THEN
    RAISE EXCEPTION '現在ポイントの貯める・使う操作は一時停止中です';
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

COMMIT;
