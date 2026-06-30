-- スタッフ画面がQR読取を検知するためのパッチ（SQL Editorで実行）
-- 既に use_qr_sessions.sql を実行済みの場合、このファイルだけ追加実行してください。

BEGIN;

GRANT SELECT ON public.use_qr_sessions TO authenticated;

CREATE OR REPLACE FUNCTION public.get_use_qr_session_status(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.use_qr_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT * INTO v_row
  FROM public.use_qr_sessions
  WHERE id = p_session_id
    AND staff_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'セッションが見つかりません';
  END IF;

  RETURN json_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'member_name', v_row.member_name,
    'amount', v_row.amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_use_qr_session_status(uuid) TO authenticated;

COMMIT;
