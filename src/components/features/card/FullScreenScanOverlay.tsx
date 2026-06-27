import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { QrScanner } from './QrScanner';

type FullScreenScanOverlayProps = {
    title: string;
    hint: string;
    onClose: () => void;
    onScan: (text: string) => void;
    onError?: (message: string) => void;
};

/** Full-screen scan UI portaled to body — same layout for member earn & staff use */
export function FullScreenScanOverlay({
    title,
    hint,
    onClose,
    onScan,
    onError,
}: FullScreenScanOverlayProps) {
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex h-[100dvh] flex-col bg-black text-white">
            <div className="absolute top-0 z-10 flex w-full items-center justify-between bg-black/50 p-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full bg-white/20 p-2 transition-colors hover:bg-white/30"
                >
                    <X size={20} />
                </button>
                <span className="font-bold drop-shadow-md">{title}</span>
                <div className="w-9" />
            </div>
            <div className="relative min-h-0 flex-1">
                <QrScanner
                    onScan={onScan}
                    onError={onError}
                    className="absolute inset-0"
                    showRefocusHint
                />
                <p className="pointer-events-none absolute bottom-10 left-0 right-0 z-10 px-4 text-center text-sm font-bold text-white drop-shadow-md">
                    {hint}
                </p>
            </div>
        </div>,
        document.body
    );
}
