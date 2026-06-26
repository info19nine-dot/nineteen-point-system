-- Function to log profile changes (Ban, Rank, etc.)
CREATE OR REPLACE FUNCTION log_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for Blacklist status change
    IF (OLD.is_blacklisted IS DISTINCT FROM NEW.is_blacklisted) THEN
        INSERT INTO public.audit_logs (actor_id, action, target_id, details)
        VALUES (
            auth.uid(), 
            CASE WHEN NEW.is_blacklisted THEN 'ban_member' ELSE 'unban_member' END,
            NEW.id,
            jsonb_build_object('reason', 'Status changed', 'old_status', OLD.is_blacklisted, 'new_status', NEW.is_blacklisted)
        );
    END IF;

    -- Check for Rank change
    IF (OLD.rank IS DISTINCT FROM NEW.rank) THEN
        INSERT INTO public.audit_logs (actor_id, action, target_id, details)
        VALUES (
            auth.uid(),
            'update_rank',
            NEW.id,
            jsonb_build_object('old_rank', OLD.rank, 'new_rank', NEW.rank)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Profile Changes
DROP TRIGGER IF EXISTS on_profile_change ON public.profiles;
CREATE TRIGGER on_profile_change
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION log_profile_changes();

-- Function to log critical transactions (Correction, Cancellation)
CREATE OR REPLACE FUNCTION log_transaction_events()
RETURNS TRIGGER AS $$
BEGIN
    -- Log Cancellations
    IF (NEW.is_cancelled = true AND OLD.is_cancelled = false) THEN
        INSERT INTO public.audit_logs (actor_id, action, target_id, details)
        VALUES (
            auth.uid(),
            'cancel_transaction',
            NEW.member_id,
            jsonb_build_object('tx_id', NEW.id, 'metadata', NEW.metadata)
        );
    END IF;

    -- Log Corrections (Insertions with type correction)
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.metadata->>'type' = 'correction') THEN
            INSERT INTO public.audit_logs (actor_id, action, target_id, details)
            VALUES (
                auth.uid(),
                'correct_transaction',
                NEW.member_id,
                jsonb_build_object('tx_id', NEW.id, 'metadata', NEW.metadata)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Transaction Events
DROP TRIGGER IF EXISTS on_transaction_event ON public.transactions;
CREATE TRIGGER on_transaction_event
AFTER INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION log_transaction_events();
