-- 常時表示QR用：待ち10分・入力中2分（Supabase SQL Editorで実行）
-- use_qr_sessions.sql 実行済みの環境に追加で流してください。

BEGIN;

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
  VALUES (v_id, auth.uid(), 'waiting', now() + interval '10 minutes');

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

COMMIT;
