import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Manually parse .env.local
const envPath = path.resolve(__dirname, '../.env.local');

console.log('Loading env from:', envPath);
let envConfig = {};

if (fs.existsSync(envPath)) {
    try {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            line = line.trim();
            if (!line || line.startsWith('#')) return;
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                // Remove quotes
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                envConfig[key] = value;
            }
        });
        console.log('Available keys:', Object.keys(envConfig));
    } catch (e) {
        console.error('Failed to read .env.local', e);
        process.exit(1);
    }
} else {
    console.error('.env.local not found');
    process.exit(1);
}

const supabaseUrl = envConfig['VITE_SUPABASE_URL'];
const supabaseKey = envConfig['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase Config');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function restoreTransaction() {
    console.log('Searching for cancelled notification...');
    
    // Debug: Check visibility
    const { count, error: countError } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });
        
    console.log('Total visible transactions:', count);
    if (countError) console.error('Count error:', countError);

    // Search for the specific transaction
    // Description contains: "会員による電話番号変更: 00000 -> 000001234"
    const searchTerm = '%電話番号%変更%';
    
    const { data: txs, error } = await supabase
        .from('transactions')
        .select('*')
        .ilike('description', searchTerm)
        .eq('is_cancelled', true);

    if (error) {
        console.error('Search error:', error);
        return;
    }

    if (!txs || txs.length === 0) {
        console.log('No matching cancelled transaction found.');
        return;
    }

    console.log(`Found ${txs.length} cancelled transaction(s).`);
    
    for (const tx of txs) {
        console.log(`Restoring TX ID: ${tx.id}`);
        console.log(`Original Description: ${tx.description}`);
        
        // Remove 【取消:...】 prefix if present
        let newDescription = tx.description.replace(/^【取消:.*?】/, '');
        
        console.log(`New Description: ${newDescription}`);
        
        const { error: updateError } = await supabase
            .from('transactions')
            .update({ 
                is_cancelled: false,
                description: newDescription
            })
            .eq('id', tx.id);
            
        if (updateError) {
            console.error('Update failed:', updateError);
        } else {
            console.log('Successfully restored!');
        }
    }
}

restoreTransaction();
