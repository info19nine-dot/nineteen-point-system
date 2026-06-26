-- 1. FIX THE EXISTING LOGIC FIRST
-- Redefine 'on_transaction_change' to ONLY update profiles, NOT transactions.
-- This breaks the infinite loop where updating a transaction triggered this function which updated the transaction again.
CREATE OR REPLACE FUNCTION public.on_transaction_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We ONLY care about updating the Member's Profile Total Points here.
  -- The Snapshot logic is now moved to 'maintain_balance_consistency'.
  
  IF (TG_OP = 'DELETE') THEN
    PERFORM recalculate_member_points(OLD.member_id);
    RETURN OLD;
  ELSE
    -- INSERT or UPDATE
    PERFORM recalculate_member_points(NEW.member_id);
    RETURN NEW;
  END IF;
END;
$$;

-- 2. Drop intersecting triggers just in case (Clean slate for snapshots)
DROP TRIGGER IF EXISTS trigger_update_balance_snapshot ON public.transactions;
DROP TRIGGER IF EXISTS trigger_z_update_balance_snapshot ON public.transactions;
DROP TRIGGER IF EXISTS trg_maintain_balance_consistency ON public.transactions;

-- 3. Define the Recalculation Function (Same as before)
CREATE OR REPLACE FUNCTION public.recalculate_balance_history(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    running_balance bigint := 0;
BEGIN
    FOR r IN 
        SELECT id, type, amount, is_cancelled 
        FROM public.transactions 
        WHERE member_id = p_member_id 
        ORDER BY created_at ASC 
    LOOP
        IF NOT r.is_cancelled THEN
            IF r.type = 'EARN' THEN
                running_balance := running_balance + r.amount;
            ELSIF r.type = 'USE' THEN
                running_balance := running_balance - r.amount;
            END IF;
        END IF;

        UPDATE public.transactions
        SET balance_snapshot = running_balance
        WHERE id = r.id;
    END LOOP;
END;
$$;

-- 4. Execute the Fix (Now safe!)
-- We iterate manually to ensure we cover everyone
DO $$
DECLARE
    m RECORD;
BEGIN
    FOR m IN SELECT id FROM public.profiles LOOP
        PERFORM public.recalculate_balance_history(m.id);
    END LOOP;
END $$;

-- 5. Define the NEW Isolated Snapshot Trigger
CREATE OR REPLACE FUNCTION public.maintain_balance_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Recursion Guard: If we are only updating balance_snapshot, DO NOTHING.
    -- (Although strictly not needed if we separated logic, good for safety)
    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.amount = NEW.amount) AND 
           (OLD.type = NEW.type) AND 
           (OLD.is_cancelled = NEW.is_cancelled) AND 
           (OLD.member_id = NEW.member_id) AND 
           (OLD.created_at = NEW.created_at) THEN
            RETURN NEW;
        END IF;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        PERFORM public.recalculate_balance_history(OLD.member_id);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') AND (OLD.member_id IS DISTINCT FROM NEW.member_id) THEN
        PERFORM public.recalculate_balance_history(OLD.member_id);
        PERFORM public.recalculate_balance_history(NEW.member_id);
        RETURN NEW;
    ELSE
        PERFORM public.recalculate_balance_history(NEW.member_id);
        RETURN NEW;
    END IF;
END;
$$;

-- 6. Attach the New Trigger
CREATE TRIGGER trg_maintain_balance_consistency
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.maintain_balance_consistency();
