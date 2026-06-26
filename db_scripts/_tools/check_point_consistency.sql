-- check_point_consistency.sql
-- ユーザーの「現在のポイント(profiles.points)」と「取引履歴の合計(transactions sum)」の不整合をチェックするスクリプト

WITH transaction_sums AS (
    SELECT 
        member_id,
        SUM(
            CASE 
                WHEN type = 'EARN' AND is_cancelled = false THEN amount
                WHEN type = 'USE' AND is_cancelled = false THEN -amount
                ELSE 0 
            END
        ) as calculated_total
    FROM public.transactions
    GROUP BY member_id
)
SELECT 
    p.id as member_id,
    p.name,
    p.member_code,
    p.points as current_profile_points,
    COALESCE(ts.calculated_total, 0) as actual_transaction_sum,
    (p.points - COALESCE(ts.calculated_total, 0)) as discrepancy
FROM public.profiles p
LEFT JOIN transaction_sums ts ON p.id = ts.member_id
WHERE (p.points - COALESCE(ts.calculated_total, 0)) <> 0
ORDER BY discrepancy DESC;

-- 使用方法:
-- 1. Supabaseの左側メニューから「SQL Editor」を開きます。
-- 2. 「New Query」をクリックします。
-- 3. このスクリプトの内容を貼り付けて「Run」を押します。
-- 4. 結果が表示されない場合、データは正常（不整合なし）です。
-- 5. 結果が表示された場合、その会員のポイントデータにズレが生じています。
