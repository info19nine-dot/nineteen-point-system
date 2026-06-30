export const USE_QR_SESSION_TTL_MS = 5 * 60 * 1000;

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
