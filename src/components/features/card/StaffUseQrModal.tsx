import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Loader2, QrCode, X } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import {
    USE_QR_SESSION_TTL_MS,
    buildUseSessionQrPayload,
    isUseSessionExpired,
    type UseQrSessionRow,
} from '../../../lib/useQrSession';
import { QR_CANVAS_SIZE, QR_EARN_CANVAS_STYLE } from '../../../lib/qrDisplay';

type StaffUseQrModalProps = {
    onClose: () => void;
    onScanned?: (session: UseQrSessionRow) => void;
};

export function StaffUseQrModal({ onClose, onScanned }: StaffUseQrModalProps) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [session, setSession] = useState<UseQrSessionRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const scannedHandledRef = useRef(false);
    const onCloseRef = useRef(onClose);
    const onScannedRef = useRef(onScanned);

    onCloseRef.current = onClose;
    onScannedRef.current = onScanned;

    const handleMemberScanned = useCallback((row: UseQrSessionRow) => {
        if (scannedHandledRef.current) return;
        scannedHandledRef.current = true;
        onScannedRef.current?.(row);
        onCloseRef.current();
    }, []);

    const createSession = useCallback(async () => {
        setLoading(true);
        setError(null);
        scannedHandledRef.current = false;

        const { data, error: rpcError } = await supabase.rpc('create_use_qr_session');
        if (rpcError) {
            setError(rpcError.message);
            setLoading(false);
            return;
        }

        setSessionId(data as string);
        setSession({
            id: data as string,
            staff_id: '',
            status: 'waiting',
            member_id: null,
            member_name: null,
            amount: null,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + USE_QR_SESSION_TTL_MS).toISOString(),
            completed_at: null,
        });
        setLoading(false);
    }, []);

    useEffect(() => {
        void createSession();
    }, [createSession]);

    useEffect(() => {
        if (!sessionId) return;

        const channel = supabase
            .channel(`use-qr-session:${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'use_qr_sessions',
                    filter: `id=eq.${sessionId}`,
                },
                (payload: { new: UseQrSessionRow }) => {
                    const row = payload.new;
                    setSession(row);

                    if (row.status === 'inputting') {
                        handleMemberScanned(row);
                    }
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [sessionId, handleMemberScanned]);

    // Realtime が届かない環境向けにポーリングでも検知
    useEffect(() => {
        if (!sessionId || loading) return;
        if (session?.status !== 'waiting') return;

        const poll = async () => {
            const { data } = await supabase
                .from('use_qr_sessions')
                .select('*')
                .eq('id', sessionId)
                .maybeSingle();

            if (data?.status === 'inputting') {
                handleMemberScanned(data as UseQrSessionRow);
            }
        };

        void poll();
        const interval = window.setInterval(() => {
            void poll();
        }, 1000);

        return () => window.clearInterval(interval);
    }, [sessionId, loading, session?.status, handleMemberScanned]);

    useEffect(() => {
        if (!session?.expires_at || session.status === 'completed' || session.status === 'cancelled') {
            return;
        }

        const ms = new Date(session.expires_at).getTime() - Date.now();
        if (ms <= 0) {
            setError('QRの有効期限が切れました。新しいQRを発行してください。');
            return;
        }

        const timer = window.setTimeout(() => {
            setError('QRの有効期限が切れました。新しいQRを発行してください。');
            setSession((prev) => (prev ? { ...prev, status: 'expired' } : prev));
        }, ms);

        return () => window.clearTimeout(timer);
    }, [session?.expires_at, session?.status]);

    const qrPayload = useMemo(() => {
        if (!sessionId) return '';
        return buildUseSessionQrPayload(sessionId);
    }, [sessionId]);

    const handleCancel = async () => {
        if (!sessionId) {
            onClose();
            return;
        }
        await supabase.rpc('cancel_use_qr_session', { p_session_id: sessionId });
        onClose();
    };

    const handleRegenerate = () => {
        void createSession();
    };

    const isExpired =
        session?.status === 'expired' ||
        (session?.expires_at != null && isUseSessionExpired(session.expires_at));
    const isWaiting = session?.status === 'waiting' && !isExpired;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="relative w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-[2rem] bg-white p-6 pb-8 text-center shadow-2xl">
                <button
                    type="button"
                    onClick={() => void handleCancel()}
                    className="absolute right-4 top-4 z-10 text-gray-400 hover:text-gray-600"
                    aria-label="閉じる"
                >
                    <X size={24} />
                </button>

                <div className="mb-4 mt-4 flex flex-col items-center gap-2">
                    <div className="rounded-full bg-teal-50 p-3 text-teal-600">
                        <QrCode size={28} />
                    </div>
                    <h2 className="text-xl font-black text-slate-800">ポイント使用</h2>
                    <p className="text-xs text-gray-500">お客様に読み取ってもらうQRです</p>
                </div>

                {loading && (
                    <div className="flex flex-col items-center gap-3 py-12">
                        <Loader2 className="animate-spin text-teal-500" size={40} />
                        <p className="text-sm text-gray-500">QRを準備中...</p>
                    </div>
                )}

                {!loading && error && (
                    <div className="space-y-4 py-6">
                        <p className="text-sm font-bold text-red-600">{error}</p>
                        <button
                            type="button"
                            onClick={handleRegenerate}
                            className="w-full rounded-xl bg-slate-800 py-3 text-sm font-bold text-white"
                        >
                            新しいQRを発行
                        </button>
                    </div>
                )}

                {!loading && !error && session && (
                    <div className="space-y-4">
                        <div
                            className={`rounded-2xl border-2 px-4 py-3 text-sm font-bold ${
                                isWaiting
                                    ? 'border-slate-200 bg-slate-50 text-slate-600'
                                    : 'border-gray-200 bg-gray-50 text-gray-500'
                            }`}
                        >
                            {isWaiting && 'お客様の読取待ち'}
                            {isExpired && '期限切れ'}
                        </div>

                        <div className="text-[10px] font-bold leading-relaxed text-red-500">
                            ※このQRコードは1回のみ有効です。
                            <br />
                            有効期限: 5分
                        </div>

                        <div
                            className={`inline-block rounded-xl bg-white p-3 shadow-lg transition-all ${
                                isExpired ? 'opacity-30 grayscale' : ''
                            }`}
                        >
                            <QRCodeCanvas
                                value={qrPayload}
                                size={QR_CANVAS_SIZE}
                                bgColor="#ffffff"
                                fgColor="#000000"
                                level="H"
                                includeMargin
                                style={QR_EARN_CANVAS_STYLE}
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => void handleCancel()}
                                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-600"
                            >
                                キャンセル
                            </button>
                            <button
                                type="button"
                                onClick={handleRegenerate}
                                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700"
                            >
                                QRを出し直す
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
