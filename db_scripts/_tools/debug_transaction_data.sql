-- ランク変更を含む取引の実際のデータを表示して確認する
SELECT 
    id, 
    type, 
    amount, 
    description,
    created_at
FROM transactions
WHERE description LIKE '%ランク変更%';
