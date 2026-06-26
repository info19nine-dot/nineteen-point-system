
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const MEMBER_ID = 'c9e1ba5b-6276-4f33-99df-751269ab4f85';

async function fetchHistory() {
  console.log('Fetching history for:', MEMBER_ID);
  
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('member_id', MEMBER_ID)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('--- Transactions ---');
  transactions.forEach(tx => {
    console.log(`[${tx.id}] ${tx.created_at} | ${tx.type} ${tx.amount}pt | Cancelled: ${tx.is_cancelled} | Desc: ${tx.description}`);
  });
}

fetchHistory();
