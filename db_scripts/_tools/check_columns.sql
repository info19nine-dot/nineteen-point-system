-- CHECK: Confirm 'is_blacklisted' vs 'is_deleted'
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name LIKE 'is_%';
