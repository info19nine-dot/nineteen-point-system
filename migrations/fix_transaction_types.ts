import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load env vars
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY; // Using Anon key might be limited by RLS, but system logs might be readable. 
// Ideally we need SERVICE_ROLE_KEY to bypass RLS for updates, but user might not have it in .env.local.
// However, the user is likely authenticated in the app.
// In a script, we are anonymous. Updates might fail if RLS prevents anon updates to 'transactions'.
// Hopefully transactions allows updates for own rows? But we are updating ALL rows.
// We probably need SERVICE_ROLE_KEY. Let's see if it's in .env.local or if we can use what we have.
// If RLS blocks, we might need to ask user to run SQL.
// BUT, the user's previous "Hasn't changed" implies they MIGHT have run it or expected me to.
// Let's TRY with anon key. If it fails, we fall back to user intervention.
// WAIT: The "Service Role Key" is usually SUPABASE_SERVICE_ROLE_KEY.
// Let's check if VITE_SUPABASE_SERVICE_ROLE_KEY exists or similar.

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixTransactions() {
    console.log('Fixing transactions...');

    // We can't use generic UPDATE with WHERE via client library easily for "LIKE" + "amount=0" across all users if RLS is on.
    // If RLS is enabled on 'transactions', we can only update rows we own (which is none as anon script).
    // UNLESS we have a backend function (RPC) to do it.
    // OR we use the service role key.
    
    // Let's try to find records first.
    const { data: txs, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('amount', 0)
        .or('description.ilike.%ランク変更%,description.ilike.%有効期限%,description.ilike.%メールアドレス変更%,description.ilike.%電話番号変更%');

    if (fetchError) {
        console.error('Error fetching transactions:', fetchError);
        return;
    }

    console.log(`Found ${txs?.length || 0} candidate transactions.`);

    if (!txs || txs.length === 0) return;

    // Update locally then push? No, update one by one or batch if possible.
    // If RLS allows, we iterate.
    for (const tx of txs) {
        console.log(`Updating tx ${tx.id}: ${tx.description}`);
        const { error: updateError } = await supabase
            .from('transactions')
            .update({ type: 'INFO' })
            .eq('id', tx.id);
        
        if (updateError) {
            console.error(`Failed to update ${tx.id}:`, updateError);
        } else {
            console.log(`Updated ${tx.id} to INFO`);
        }
    }
}

fixTransactions();
