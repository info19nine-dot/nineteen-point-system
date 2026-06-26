-- DIAGNOSTIC: Check Constraints and Trigger Loop Risk

-- 1. Check if the ID actually exists in profiles
SELECT id, email, created_at FROM public.profiles WHERE id = 'c9e1ba5b-6276-4133-99df-751269ab4f85';

-- 2. Check the Foreign Key on transactions.member_id
SELECT
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'transactions';

-- 3. Check the content of the suspicious OTHER trigger
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'append_history_to_memo';
