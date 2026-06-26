-- 1. FIX TRIGGER (Concise Single Line Log)
-- Reads 'app.working_staff_name' session variable to include signer info if available.
CREATE OR REPLACE FUNCTION append_history_to_memo()
RETURNS TRIGGER AS $$
DECLARE
    change_log text := '';
    current_date_str text;
    staff_name_ctx text;
    log_prefix text;
BEGIN
    -- Get Date
    current_date_str := to_char(now() AT TIME ZONE 'Asia/Tokyo', 'YYYY/MM/DD HH24:MI');
    
    -- Get Staff Name from Session Context (set by RPC)
    staff_name_ctx := current_setting('request.headers', true)::json->>'x-staff-name'; -- Fallback if needed, but we use custom var
    -- Better: use custom var set by RPC
    staff_name_ctx := current_setting('app.working_staff_name', true);

    -- Build Prefix: [2026/01/18 10:00] or [2026/01/18 10:00 担当:鈴木]
    log_prefix := '[' || current_date_str;
    IF staff_name_ctx IS NOT NULL AND staff_name_ctx <> '' THEN
        log_prefix := log_prefix || ' 担当:' || staff_name_ctx;
    END IF;
    log_prefix := log_prefix || '] ';

    -- 1. Phone
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN
        IF change_log <> '' THEN change_log := change_log || E'\n'; END IF;
        change_log := change_log || log_prefix || '電話番号変更: ' || COALESCE(OLD.phone, '未登録') || ' → ' || COALESCE(NEW.phone, '未登録');
    END IF;

    -- 2. Email
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        IF change_log <> '' THEN change_log := change_log || E'\n'; END IF;
        change_log := change_log || log_prefix || 'メール変更: ' || COALESCE(OLD.email, '未登録') || ' → ' || COALESCE(NEW.email, '未登録');
    END IF;

    -- 3. Rank
    IF NEW.rank IS DISTINCT FROM OLD.rank THEN
        IF change_log <> '' THEN change_log := change_log || E'\n'; END IF;
        change_log := change_log || log_prefix || 'ランク変動: ' || COALESCE(OLD.rank, '不明') || ' → ' || COALESCE(NEW.rank, '不明');
    END IF;

    -- 4. Expiry
    IF NEW.membership_expiry IS DISTINCT FROM OLD.membership_expiry THEN
        IF change_log <> '' THEN change_log := change_log || E'\n'; END IF;
        change_log := change_log || log_prefix || '有効期限更新: ' || COALESCE(to_char(OLD.membership_expiry, 'YYYY/MM/DD'), '設定なし') || ' → ' || COALESCE(to_char(NEW.membership_expiry, 'YYYY/MM/DD'), '設定なし');
    END IF;

    -- 5. Status
    IF NEW.is_blacklisted IS DISTINCT FROM OLD.is_blacklisted THEN
        IF change_log <> '' THEN change_log := change_log || E'\n'; END IF;
        IF NEW.is_blacklisted THEN
            change_log := change_log || log_prefix || 'ステータス: 利用停止';
        ELSE
            change_log := change_log || log_prefix || 'ステータス: 利用再開';
        END IF;
    END IF;

    -- Append
    IF change_log <> '' THEN
        IF OLD.staff_memo IS NULL OR OLD.staff_memo = '' THEN
            NEW.staff_memo := change_log;
        ELSE
            NEW.staff_memo := OLD.staff_memo || E'\n' || change_log;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. CREATE RPC (For Signed Actions - Using Config Var)
CREATE OR REPLACE FUNCTION execute_admin_action(
    target_member_id UUID,
    action_type TEXT,
    staff_name TEXT
)
RETURNS JSONB AS $$
BEGIN
    -- Set Session Variable for Trigger to Pick Up
    PERFORM set_config('app.working_staff_name', staff_name, true);

    -- Perform Updates (Trigger will handle logging)
    IF action_type = 'suspend' THEN
        UPDATE profiles 
        SET is_blacklisted = true, 
            updated_at = now()
        WHERE id = target_member_id;
        
    ELSIF action_type = 'resume' THEN
        UPDATE profiles 
        SET is_blacklisted = false, 
            updated_at = now()
        WHERE id = target_member_id;
        
    ELSIF action_type = 'demote' THEN
        UPDATE profiles 
        SET rank = 'regular', 
            membership_expiry = NULL, 
            membership_status = 'none',
            updated_at = now()
        WHERE id = target_member_id;
        
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid action type');
    END IF;

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 3. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION execute_admin_action(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_admin_action(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION execute_admin_action(UUID, TEXT, TEXT) TO anon;
