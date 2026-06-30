import { supabase } from './supabaseClient';

/** 読取待ち（誰も読んでいない） */
export const USE_QR_WAITING_TTL_MS = 10 * 60 * 1000;
/** 入力中（会員が読み取ったあと） */
export const USE_QR_INPUTTING_TTL_MS = 2 * 60 * 1000;
/** @deprecated USE_QR_WAITING_TTL_MS を使用 */
export const USE_QR_SESSION_TTL_MS = USE_QR_WAITING_TTL_MS;

export type UseQrSessionStatus =
    | 'waiting'
    | 'inputting'
    | 'completed'
    | 'cancelled'
    | 'expired';

export type UseQrSessionRow = {
    id: string;
    staff_id: string;
    status: UseQrSessionStatus;
    member_id: string | null;
    member_name: string | null;
    amount: number | null;
    created_at: string;
    expires_at: string;
    completed_at: string | null;
};

export function buildUseSessionQrPayload(sessionId: string): string {
    return JSON.stringify({
        type: 'USE_SESSION',
        sessionId,
        timestamp: Date.now(),
    });
}

export function parseUseSessionQr(text: string): string | null {
    try {
        const data = JSON.parse(text) as { type?: string; sessionId?: string };
        if (data.type !== 'USE_SESSION' || !data.sessionId) return null;
        return data.sessionId;
    } catch {
        return null;
    }
}

export function isUseSessionExpired(expiresAt: string): boolean {
    return new Date(expiresAt).getTime() <= Date.now();
}

export type UseQrSessionStatusResponse = {
    id: string;
    status: UseQrSessionStatus;
    member_name: string | null;
    amount: number | null;
};

export async function fetchUseQrSessionStatus(sessionId: string) {
    const { data, error } = await supabase.rpc('get_use_qr_session_status', {
        p_session_id: sessionId,
    });
    if (error) throw error;
    return data as UseQrSessionStatusResponse;
}
