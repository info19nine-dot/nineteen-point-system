import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { buildUseSessionQrPayload } from '../../../lib/useQrSession';

const QR_INSET_PX = 8;

type StaffUseQrPanelProps = {
    sessionId: string | null;
    status: 'waiting' | 'inputting';
    isInitializing?: boolean;
    isRegenerating?: boolean;
    onTap: () => void;
};

export function StaffUseQrPanel({
    sessionId,
    status,
    isInitializing = false,
    isRegenerating = false,
    onTap,
}: StaffUseQrPanelProps) {
    const containerRef = useRef<HTMLButtonElement>(null);
    const [qrPx, setQrPx] = useState(0);
    const qrPayload = useMemo(() => (sessionId ? buildUseSessionQrPayload(sessionId) : ''), [sessionId]);
    const showQr = Boolean(sessionId) && !isInitializing && qrPx > 0;

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const update = () => {
            const inner = Math.floor(Math.min(el.clientWidth, el.clientHeight)) - QR_INSET_PX * 2;
            setQrPx(Math.max(inner, 0));
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <button
            ref={containerRef}
            type="button"
            onClick={onTap}
            disabled={isInitializing || isRegenerating || !sessionId}
            aria-label="ポイント使用QR。タップで出し直し"
            className="relative flex aspect-square w-full touch-manipulation items-center justify-center rounded-2xl bg-white p-2 shadow-xl shadow-slate-800/10 transition-transform active:scale-95 disabled:opacity-60"
        >
            {isInitializing ? (
                <Loader2 className="animate-spin text-teal-500" size={40} />
            ) : showQr ? (
                <div className="relative shrink-0" style={{ width: qrPx, height: qrPx }}>
                    <QRCodeCanvas
                        value={qrPayload}
                        size={qrPx}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        level="H"
                        includeMargin={false}
                        style={{
                            width: qrPx,
                            height: qrPx,
                            display: 'block',
                            opacity: isRegenerating ? 0.35 : 1,
                        }}
                    />
                    {status === 'inputting' && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/75">
                            <span className="text-sm font-bold tracking-widest text-teal-600">入力中</span>
                        </span>
                    )}
                </div>
            ) : null}
        </button>
    );
}
