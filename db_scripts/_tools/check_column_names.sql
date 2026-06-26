-- CHECK: List ALL columns in profiles to find the correct Expiry column name
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles';
