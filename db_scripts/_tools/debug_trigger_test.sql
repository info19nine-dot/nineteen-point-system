-- Test if the TRIGGER actually fires and logs correctly on update
DO $$
DECLARE
    v_member_id uuid;
    v_old_email text;
    v_new_email text := 'trigger_test_' || floor(random() * 1000)::text || '@example.com';
BEGIN
    -- Get a random member ID
    SELECT id, email INTO v_member_id, v_old_email FROM public.profiles LIMIT 1;

    IF v_member_id IS NOT NULL THEN
        RAISE NOTICE 'Testing Trigger on Member ID: % (Old Email: %)', v_member_id, v_old_email;

        -- Perform UPDATE to fire the trigger
        UPDATE public.profiles
        SET email = v_new_email
        WHERE id = v_member_id;

        -- Check if log exists
        IF EXISTS (
            SELECT 1 FROM public.transactions 
            WHERE member_id = v_member_id 
              AND type = 'INFO' 
              AND description LIKE '%trigger_test_%'
        ) THEN
            RAISE NOTICE 'SUCCESS: Trigger fired and log was created.';
            
            -- Rollback changes to clean up (optional but good for testing)
            UPDATE public.profiles SET email = v_old_email WHERE id = v_member_id;
        ELSE
            RAISE NOTICE 'FAILURE: Profile updated but NO log found.';
        END IF;

    ELSE
        RAISE NOTICE 'No members found to test with.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in Test Script: %', SQLERRM;
END $$;
