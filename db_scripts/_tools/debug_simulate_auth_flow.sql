-- DEBUG SIMULATION: Test the exact logic of the Auth Trigger
-- preventing actual changes by rolling back at the end.

DO $$
DECLARE
    v_target_email text := 'freelovekobe2@gmail.com'; -- Target user email
    v_user_id uuid;
    v_old_email text;
    v_new_dummy_email text := 'test_' || floor(random() * 10000)::text || '@example.com';
BEGIN
    RAISE NOTICE '--- Starting Simulation ---';

    -- 1. Find User
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_target_email;
    SELECT email INTO v_old_email FROM public.profiles WHERE id = v_user_id;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Target user not found.';
        RETURN;
    END IF;

    RAISE NOTICE 'Found User: % (Old Profile Email: %)', v_user_id, v_old_email;

    -- 2. Simulate Profile Update (This fires 'trg_append_history_to_memo')
    RAISE NOTICE 'Step 1: Updating Profile...';
    BEGIN
        UPDATE public.profiles
        SET email = v_new_dummy_email
        WHERE id = v_user_id;
        RAISE NOTICE 'Step 1 Success: Profile Updated.';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Step 1 FAILED: %', SQLERRM;
        RETURN; -- Stop if profile update fails
    END;

    -- 3. Simulate Log Insertion (The suspected failing part)
    RAISE NOTICE 'Step 2: Inserting History Log...';
    BEGIN
        INSERT INTO public.transactions (
            member_id, type, amount, description, is_cancelled, served_by
        ) VALUES (
            v_user_id,
            'INFO',
            0,
            -- The complex string construction
            '会員によるメールアドレス変更: ' || COALESCE(v_old_email, '未登録') || ' → ' || v_new_dummy_email,
            false,
            'SYSTEM'
        );
        RAISE NOTICE 'Step 2 Success: Log Inserted.';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Step 2 FAILED: %', SQLERRM;
    END;

    RAISE NOTICE '--- Simulation Complete ---';
    
    -- ALWAYS ROLLBACK to not mess up data
    RAISE EXCEPTION 'Test Finished (Rollback)';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Test Finished (Rollback)' THEN
        RAISE NOTICE 'Test completed successfully without DB errors (Changes rolled back).';
    ELSE
        RAISE NOTICE 'Unexpected Error: %', SQLERRM;
    END IF;
END $$;
