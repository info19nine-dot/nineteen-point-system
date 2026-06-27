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
    onScanRef.current = onScan;
    onErrorRef.current = onError;

    useEffect(() => {
        const scanner = new Html5Qrcode(elementId);
        let active = true;

        const start = async () => {
            await new Promise((r) => setTimeout(r, 400));
            if (!active) return;

            try {
                await scanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
                    (decoded) => onScanRef.current(decoded),
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
            scanner.stop().catch(() => {});
        };
    }, [elementId]);

    return (
        <div
            id={elementId}
            className={className ?? 'w-full h-full'}
            style={{ minHeight: '100%' }}
        />
    );
};
