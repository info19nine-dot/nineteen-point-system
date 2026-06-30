import { useMemo } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { buildUseSessionQrPayload } from '../../../lib/useQrSession';
import { QR_CANVAS_SIZE, QR_USE_INLINE_CANVAS_STYLE, QR_USE_INLINE_DISPLAY_PX } from '../../../lib/qrDisplay';

type StaffUseQrPanelProps = {
    sessionId: string | null;
    status: 'waiting' | 'inputting';
    isInitializing?: boolean;
    isRegenerating?: boolean;
    onRegenerate: () => void;
};

export function StaffUseQrPanel({
    sessionId,
    status,
    isInitializing = false,
    isRegenerating = false,
    onRegenerate,
}: StaffUseQrPanelProps) {
    const qrPayload = useMemo(() => (sessionId ? buildUseSessionQrPayload(sessionId) : ''), [sessionId]);
    const showQr = Boolean(sessionId) && !isInitializing;

    return (
        <div className="relative flex flex-1 touch-manipulation flex-col items-center justify-center rounded-2xl border-2 border-teal-500 bg-white py-4 shadow-xl shadow-teal-500/10 transition-all active:scale-95">
            {status === 'inputting' && (
                <span className="absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-600">
                    入力中
                </span>
            )}

            <div
                className="relative shrink-0"
                style={{ width: QR_USE_INLINE_DISPLAY_PX, height: QR_USE_INLINE_DISPLAY_PX }}
            >
                {isInitializing ? (
                    <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="animate-spin text-teal-500" size={40} />
                    </div>
                ) : showQr ? (
                    <QRCodeCanvas
                        value={qrPayload}
                        size={QR_CANVAS_SIZE}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        level="H"
                        includeMargin
                        style={{
                            ...QR_USE_INLINE_CANVAS_STYLE,
                            opacity: isRegenerating ? 0.35 : 1,
                        }}
                    />
                ) : null}

                {sessionId && (
                    <button
                        type="button"
                        onClick={onRegenerate}
                        disabled={isInitializing || isRegenerating}
                        aria-label="QRを出し直す"
                        className="absolute -right-1 -top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-teal-200 bg-white text-teal-600 shadow-sm transition-colors hover:bg-teal-50 active:scale-95 disabled:opacity-60"
                    >
                        <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
                    </button>
                )}
            </div>
        </div>
    );
}
