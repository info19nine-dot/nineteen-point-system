
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase credentials not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDebugData() {
  console.log('Starting cleanup of debug transactions...');

  // 1. Find transactions to delete (for logging)
  const { data: toDelete, error: fetchError } = await supabase
    .from('transactions')
    .select('id, description, type, amount')
    .or('description.ilike.%DEBUG%,description.ilike.%Course QR:%');

  if (fetchError) {
    console.error('Error fetching data:', fetchError);
    return;
  }

  if (!toDelete || toDelete.length === 0) {
    console.log('No debug transactions found to delete.');
    return;
  }

  console.log(`Found ${toDelete.length} debug transactions to delete.`);
  toDelete.forEach(tx => {
    console.log(`- [${tx.type}] ${tx.description} (${tx.amount}pt)`);
  });

  // 2. Delete transactions
  const { error: deleteError } = await supabase
    .from('transactions')
    .delete()
    .or('description.ilike.%DEBUG%,description.ilike.%Course QR:%');

  if (deleteError) {
    console.error('Error deleting data:', deleteError);
  } else {
    console.log('Successfully deleted transactions.');
  }

  // Optional: We could reset profiles.points here if we wanted to be strict,
  // but for now we only delete the history as requested.
}

cleanupDebugData();
