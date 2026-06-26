-- Test if the transactions table accepts INFO type and SYSTEM served_by
-- This should fail if constraints are still blocking it.

DO $$
DECLARE
    v_member_id uuid;
BEGIN
    -- Get a random member ID (just for testing)
    SELECT id INTO v_member_id FROM public.profiles LIMIT 1;

    IF v_member_id IS NOT NULL THEN
        INSERT INTO public.transactions (
            member_id,
            type,
            amount,
            description,
            is_cancelled,
            served_by
        ) VALUES (
            v_member_id,
            'INFO',       -- This was the problematic value
            0,
            'TEST: Manual INFO Log',
            false,
            'SYSTEM'      -- Checking this too
        );
        RAISE NOTICE 'Manual INSERT successful!';
    ELSE
        RAISE NOTICE 'No members found to test with.';
    END IF;
END $$;
