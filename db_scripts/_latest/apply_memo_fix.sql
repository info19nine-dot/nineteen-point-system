-- FIX: Remove explicit newlines AND Labels from memo logs
-- Format: "[Date] Old -> New"

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
    
    -- Get Staff Name from Session Context
    staff_name_ctx := current_setting('app.working_staff_name', true);

    -- Build Prefix: [2026/01/18 10:00] or [2026/01/18 10:00 担当:鈴木]
    log_prefix := '[' || current_date_str;
    IF staff_name_ctx IS NOT NULL AND staff_name_ctx <> '' THEN
        log_prefix := log_prefix || ' 担当:' || staff_name_ctx;
    END IF;
    log_prefix := log_prefix || '] ';

    -- 1. Phone (No Label)
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN
        IF change_log <> '' THEN change_log := change_log || E'\n'; END IF;
        change_log := change_log || log_prefix || COALESCE(OLD.phone, '未登録') || ' → ' || COALESCE(NEW.phone, '未登録');
    END IF;

    -- 2. Email (No Label)
    IF NEW.email IS DISTINCT FROM OLD.email THEN
        IF change_log <> '' THEN change_log := change_log || E'\n'; END IF;
        change_log := change_log || log_prefix || COALESCE(OLD.email, '未登録') || ' → ' || COALESCE(NEW.email, '未登録');
    END IF;

    -- 3. Rank (No Label)
    IF NEW.rank IS DISTINCT FROM OLD.rank THEN
        IF change_log <> '' THEN change_log := change_log || E'\n'; END IF;
        change_log := change_log || log_prefix || COALESCE(OLD.rank, '不明') || ' → ' || COALESCE(NEW.rank, '不明');
    END IF;

    -- 4. Expiry (No Label)
    IF NEW.membership_expiry IS DISTINCT FROM OLD.membership_expiry THEN
        IF change_log <> '' THEN change_log := change_log || E'\n'; END IF;
        change_log := change_log || log_prefix || COALESCE(to_char(OLD.membership_expiry, 'YYYY/MM/DD'), '設定なし') || ' → ' || COALESCE(to_char(NEW.membership_expiry, 'YYYY/MM/DD'), '設定なし');
    END IF;

    -- 5. Status (No Label)
    IF NEW.is_blacklisted IS DISTINCT FROM OLD.is_blacklisted THEN
        IF change_log <> '' THEN change_log := change_log || E'\n'; END IF;
        IF NEW.is_blacklisted THEN
            change_log := change_log || log_prefix || '利用停止';
        ELSE
            change_log := change_log || log_prefix || '利用再開';
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
