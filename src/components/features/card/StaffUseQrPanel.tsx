import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { buildUseSessionQrPayload } from '../../../lib/useQrSession';

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
    const [qrPx, setQrPx] = useState(120);
    const qrPayload = useMemo(() => (sessionId ? buildUseSessionQrPayload(sessionId) : ''), [sessionId]);
    const showQr = Boolean(sessionId) && !isInitializing;

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const update = () => {
            const size = Math.floor(Math.min(el.clientWidth, el.clientHeight)) - 4;
            if (size > 0) setQrPx(size);
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
            className="relative flex aspect-square w-full touch-manipulation items-center justify-center rounded-2xl bg-white p-1 shadow-xl shadow-slate-800/10 transition-all active:scale-95 disabled:opacity-60"
        >
            {isInitializing ? (
                <Loader2 className="animate-spin text-teal-500" size={40} />
            ) : showQr ? (
                <div className="relative flex items-center justify-center">
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
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/75">
                            <span className="text-sm font-bold tracking-widest text-teal-600">入力中</span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="aspect-square w-full max-w-[40px]" />
            )}
        </button>
    );
}
