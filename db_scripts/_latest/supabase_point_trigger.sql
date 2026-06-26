-- 1. Create a function to recalculate points for a specific member
CREATE OR REPLACE FUNCTION recalculate_member_points(target_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_points int;
BEGIN
  -- Calculate total points from valid transactions
  -- EARN = +amount, USE = -amount
  -- Exclude cancelled transactions
  SELECT COALESCE(SUM(
    CASE 
      WHEN type = 'EARN' THEN amount
      WHEN type = 'USE' THEN -amount
      ELSE 0
    END
  ), 0)
  INTO total_points
  FROM transactions
  WHERE member_id = target_member_id
  AND (is_cancelled IS NULL OR is_cancelled = false);

  -- Update the Limit (0 if negative, though logically shouldn't be unless data issue)
  -- For safety, we allow negative temporarily or clamp? 
  -- Usually points shouldn't be negative, but let's trust the calc.
  
  UPDATE profiles
  SET points = total_points
  WHERE id = target_member_id;
END;
$$;

-- 2. Create the Trigger Function
CREATE OR REPLACE FUNCTION on_transaction_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Recalculate for the affected member
  -- Handle INSERT, UPDATE, DELETE
  IF (TG_OP = 'DELETE') THEN
    PERFORM recalculate_member_points(OLD.member_id);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- If member_id changed (unlikely but possible), update both
    PERFORM recalculate_member_points(NEW.member_id);
    IF (OLD.member_id <> NEW.member_id) THEN
      PERFORM recalculate_member_points(OLD.member_id);
    END IF;
    RETURN NEW;
  ELSE -- INSERT
    PERFORM recalculate_member_points(NEW.member_id);
    RETURN NEW;
  END IF;
END;
$$;

-- 3. Create the Trigger on transactions table
DROP TRIGGER IF EXISTS trigger_update_points ON transactions;

CREATE TRIGGER trigger_update_points
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION on_transaction_change();

-- 4. Update execute_point_transaction RPC
-- Remove manual UPDATE of profiles, rely on Trigger
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
AS $$
DECLARE
  v_member_id uuid;
  v_new_points int;
BEGIN
  -- Check Reuse
  IF p_qr_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM transactions WHERE qr_scan_id = p_qr_id) THEN
      RAISE EXCEPTION 'このQRコードは既に使用されています (Reuse detected)';
    END IF;
  END IF;

  -- Select Member
  IF p_target_member_id IS NOT NULL THEN
    v_member_id := p_target_member_id;
  ELSE
    v_member_id := auth.uid();
  END IF;

  -- Insert Transaction (Trigger will fire and update points)
  INSERT INTO transactions (member_id, type, amount, description, qr_scan_id, served_by)
  VALUES (v_member_id, p_type, p_amount, p_description, p_qr_id, p_served_by);

  -- Fetch the updated points to return (Trigger runs AFTER INSERT, so this should be current)
  -- Wait, triggers are synchronous.
  SELECT points INTO v_new_points FROM profiles WHERE id = v_member_id;
  
  -- Check for negative points (Overdraft protection for USE)
  IF p_type = 'USE' AND v_new_points < 0 THEN
    -- Rollback if insufficient points
    RAISE EXCEPTION 'ポイント不足です';
  END IF;

  RETURN json_build_object(
    'success', true,
    'new_points', v_new_points,
    'served_by', p_served_by
  );
END;
$$;
