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
            // Trim whitespace
            line = line.trim();
            // Skip comments and empty lines
            if (!line || line.startsWith('#')) return;

            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                let value = match[2].trim();
                
                // Remove quotes (' or ") if wrapping the value
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                
                envConfig[key] = value;
            }
        });
        console.log('Env loaded keys:', Object.keys(envConfig));
    } catch (e) {
        console.error('Failed to read .env.local', e);
        process.exit(1);
    }
} else {
    console.error('.env.local not found at:', envPath);
    process.exit(1);
}

const supabaseUrl = envConfig['VITE_SUPABASE_URL'];
const supabaseKey = envConfig['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase Config. Found keys:', Object.keys(envConfig));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixTransactions() {
    console.log('Fixing transactions (JS)...');
    
    // Fetch ALL zero-amount transactions
    const { data: txs, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('amount', 0);

    if (fetchError) {
        console.error('Error fetching transactions:', fetchError);
        return;
    }

    // Filter mainly in JS to catch all variations
    const keywords = ['ランク変更', '有効期限', 'メールアドレス変更', '電話番号変更'];
    
    const candidates = txs.filter(tx => {
        if (!tx.description) return false;
        // Check for specific keywords
        return keywords.some(k => tx.description.includes(k));
    });

    console.log(`Transactions checked: ${txs.length}`);
    console.log(`Candidates to update: ${candidates.length}`);

    let updatedCount = 0;

    for (const tx of candidates) {
        if (tx.type === 'INFO') {
            console.log(`[SKIP] ${tx.id} is already INFO`);
            continue;
        }

        console.log(`[UPDATE] ${tx.id} (${tx.type}) -> ${tx.description}`);
        const { error: updateError } = await supabase
            .from('transactions')
            .update({ type: 'INFO' })
            .eq('id', tx.id);
        
        if (updateError) {
            console.error(`[ERROR] Failed to update ${tx.id}:`, updateError);
        } else {
            console.log(`[SUCCESS] Updated ${tx.id} to INFO`);
            updatedCount++;
        }
    }
    console.log(`Refactor Complete. Updated: ${updatedCount}`);
}

fixTransactions();
