-- 会員が入力をやめたときセッションを読取待ちに戻す（Supabase SQL Editorで実行）

BEGIN;

CREATE OR REPLACE FUNCTION public.release_use_qr_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  UPDATE use_qr_sessions
  SET
    status = 'waiting',
    member_id = NULL,
    member_name = NULL,
    expires_at = now() + interval '10 minutes'
  WHERE id = p_session_id
    AND member_id = auth.uid()
    AND status = 'inputting';
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_use_qr_session(uuid) TO authenticated;

COMMIT;
