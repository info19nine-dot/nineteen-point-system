-- FIX: Enable Realtime Replication for Transactions Table
-- If this table is not in the 'supabase_realtime' publication, the frontend 'subscribe()' will never receive events.

BEGIN;
  -- Add transactions table to the realtime publication
  -- (Using drop/create or add approach depending on support, usually alter publication is sufficient)
  ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  
  -- Also ensure profiles is there just in case (for balance updates)
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
COMMIT;
