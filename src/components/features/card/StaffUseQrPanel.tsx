import { useMemo } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
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
        <div className="relative flex flex-1 touch-manipulation flex-col items-center justify-center rounded-2xl border-2 border-teal-500 bg-white py-4 shadow-xl shadow-teal-500/10 transition-all active:scale-95">
            {status === 'inputting' && (
                <span className="absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-600">
                    入力中
                </span>
            )}

            <div className="relative">
                {isLoading ? (
                    <Loader2 className="animate-spin text-teal-500" size={40} />
                ) : (
                    <QRCodeCanvas
                        value={qrPayload}
                        size={QR_CANVAS_SIZE}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        level="H"
                        includeMargin
                        style={QR_USE_INLINE_CANVAS_STYLE}
                    />
                )}

                <button
                    type="button"
                    onClick={onRegenerate}
                    disabled={isLoading}
                    aria-label="QRを出し直す"
                    className="absolute -right-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-teal-200 bg-white text-teal-600 shadow-sm transition-colors hover:bg-teal-50 active:scale-95 disabled:opacity-40"
                >
                    <RefreshCw size={14} />
                </button>
            </div>
        </div>
    );
}
