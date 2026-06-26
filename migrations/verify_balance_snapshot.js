
import { createClient } from '@supabase/supabase-js';
import { createSupabaseClientFromEnv } from './loadEnv.js';

const supabase = createSupabaseClientFromEnv(createClient);

async function verify() {
  console.log('Verifying balance_snapshot column...');
  
  // 1. Check if column exists by selecting it
  const { data: txs, error } = await supabase
    .from('transactions')
    .select('id, amount, type, balance_snapshot, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error selecting transactions:', error.message);
    if (error.message.includes('column "balance_snapshot" does not exist')) {
        console.log('CONCLUSION: Column balance_snapshot MISSING.');
    } else {
        console.log('CONCLUSION: Unknown Error.');
    }
    return;
  }

  console.log('Latest 5 Transactions:', txs);

  const hasData = txs.some(tx => tx.balance_snapshot !== null);
  const allNull = txs.every(tx => tx.balance_snapshot === null);

  if (allNull) {
      console.log('CONCLUSION: Column exists but ALL values are NULL. (Trigger not working or no new transactions since migration)');
  } else if (!hasData) {
      console.log('CONCLUSION: Mixed results? No, wait, checks logic above.');
  } else {
      console.log('CONCLUSION: Data is being populated! (Maybe older rows are null, but new ones have data)');
  }
}

verify();
