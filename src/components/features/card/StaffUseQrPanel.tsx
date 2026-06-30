import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { buildUseSessionQrPayload } from '../../../lib/useQrSession';
import { QR_CANVAS_SIZE, QR_USE_INLINE_CANVAS_STYLE } from '../../../lib/qrDisplay';

type StaffUseQrPanelProps = {
    sessionId: string | null;
    status: 'loading' | 'waiting' | 'inputting';
    isRegenerating?: boolean;
    onRegenerate: () => void;
};

export function StaffUseQrPanel({
    sessionId,
    status,
    isRegenerating = false,
    onRegenerate,
}: StaffUseQrPanelProps) {
    const qrPayload = useMemo(() => (sessionId ? buildUseSessionQrPayload(sessionId) : ''), [sessionId]);
    const isLoading = status === 'loading' || !sessionId || isRegenerating;

    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-teal-500 bg-white px-2 py-3 shadow-xl shadow-teal-500/10">
            <div className="text-center font-bold leading-tight">
                <span className="mb-0.5 block text-xs text-slate-500">ポイント</span>
                <span className="text-lg text-teal-600">使用</span>
            </div>

            {status === 'inputting' && (
                <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-600">
                    入力中
                </span>
            )}

            <div className="flex min-h-[88px] items-center justify-center">
                {isLoading ? (
                    <Loader2 className="animate-spin text-teal-500" size={32} />
                ) : (
                    <div className="rounded-lg bg-white p-1 shadow-sm">
                        <QRCodeCanvas
                            value={qrPayload}
                            size={QR_CANVAS_SIZE}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            level="H"
                            includeMargin
                            style={QR_USE_INLINE_CANVAS_STYLE}
                        />
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={onRegenerate}
                disabled={isLoading}
                className="text-[11px] font-bold text-slate-400 underline-offset-2 hover:text-teal-600 hover:underline disabled:opacity-40"
            >
                出し直す
            </button>
        </div>
    );
}
