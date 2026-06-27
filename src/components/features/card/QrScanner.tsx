import { useEffect, useId, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

type QrScannerProps = {
    onScan: (text: string) => void;
    onError?: (message: string) => void;
    className?: string;
};

export const QrScanner = ({ onScan, onError, className }: QrScannerProps) => {
    const reactId = useId().replace(/:/g, '');
    const elementId = `qr-scanner-${reactId}`;
    const onScanRef = useRef(onScan);
    const onErrorRef = useRef(onError);
    const lastScanRef = useRef<{ text: string; at: number } | null>(null);
    onScanRef.current = onScan;
    onErrorRef.current = onError;

    useEffect(() => {
        const scanner = new Html5Qrcode(elementId, { verbose: false });
        let active = true;

        const handleScan = (decoded: string) => {
            const now = Date.now();
            const last = lastScanRef.current;
            if (last && last.text === decoded && now - last.at < 3000) return;
            lastScanRef.current = { text: decoded, at: now };
            onScanRef.current(decoded);
        };

        const start = async () => {
            await new Promise((r) => setTimeout(r, 300));
            if (!active) return;

            try {
                await scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        // Full viewfinder scan — avoids double box with custom overlays
                        qrbox: undefined,
                    },
                    handleScan,
                    () => {}
                );
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : 'カメラを起動できません';
                onErrorRef.current?.(message);
            }
        };

        start();

        return () => {
            active = false;
            scanner.stop().then(() => scanner.clear()).catch(() => {});
        };
    }, [elementId]);

    return (
        <div
            id={elementId}
            className={`qr-scanner-host ${className ?? ''}`}
        />
    );
};
