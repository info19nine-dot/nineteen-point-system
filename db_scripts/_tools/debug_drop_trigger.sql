-- Drop the trigger causing potential issues during email confirmation
DROP TRIGGER IF EXISTS on_profile_change_log_transaction ON public.profiles;
