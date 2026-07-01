/** 【取消:○○】【調整:○○】【修正:○○】から担当者名を抜き出す */
export function extractStaffSignature(description?: string | null): string | null {
    if (!description) return null;
    const match = description.match(/【(?:取消|調整|修正):([^】]+)】/);
    const name = match?.[1]?.trim();
    return name || null;
}

/** 取引内容列の1行目用テキスト（担当者タグは除去） */
export function formatTransactionDisplayText(
    description?: string | null,
    type?: 'EARN' | 'USE' | 'INFO'
): string {
    if (type === 'INFO') {
        return (description || '').replace('【システム】', '').replace('会員による', '').split(':')[0].trim();
    }

    const desc = (description || '')
        .replace(/【(?:取消|修正|調整):.*?】/g, '')
        .replace(/\(元: \d+pt\)/, '')
        .replace('【利用】', '')
        .replace('【システム】', '')
        .trim();

    if (desc.includes('Course QR:')) return desc.replace('Course QR:', '').trim();
    if (desc === 'Point usage via QR scan' || desc === 'QRコード利用') return 'ポイント利用';

    const result = desc.replace('Point usage via QR scan', 'ポイント利用');
    if (result) return result;
    if (type === 'EARN') return 'ポイント獲得';
    if (type === 'USE') return 'ポイント利用';
    return '通知';
}
