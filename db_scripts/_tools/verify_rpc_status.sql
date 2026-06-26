-- Check Function Existence
SELECT proname, proargnames FROM pg_proc WHERE proname = 'execute_admin_action';

-- Check Permissions
SELECT grantee, privilege_type 
FROM information_schema.role_routine_grants 
WHERE routine_name = 'execute_admin_action';
