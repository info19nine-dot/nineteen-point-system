import { useCallback, useRef, type ComponentProps } from 'react';
import { QrReader } from 'react-qr-reader';

type QrScannerProps = {
    onScan: (text: string) => void;
    onError?: (message: string) => void;
    className?: string;
};

function isScanMissError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const name = 'name' in error ? String(error.name) : '';
    const message = 'message' in error ? String(error.message).toLowerCase() : '';
    return (
        name === 'NotFoundException' ||
        message.includes('not found') ||
        message.includes('no multiformat')
    );
}

export const QrScanner = ({ onScan, onError, className }: QrScannerProps) => {
    const onScanRef = useRef(onScan);
    const onErrorRef = useRef(onError);
    const lastScanRef = useRef<{ text: string; at: number } | null>(null);

    onScanRef.current = onScan;
    onErrorRef.current = onError;

    const handleResult = useCallback<NonNullable<ComponentProps<typeof QrReader>['onResult']>>(
        (result, error) => {
            if (error && !isScanMissError(error)) {
                const message =
                    error instanceof Error ? error.message : 'カメラエラーが発生しました';
                onErrorRef.current?.(message);
                return;
            }

            const text = result?.getText();
            if (!text) return;

            const now = Date.now();
            const last = lastScanRef.current;
            if (last && last.text === text && now - last.at < 3000) return;
            lastScanRef.current = { text, at: now };
            onScanRef.current(text);
        },
        []
    );

    return (
        <div className={`qr-scanner-host ${className ?? ''}`}>
            <QrReader
                onResult={handleResult}
                constraints={{ facingMode: { ideal: 'environment' } }}
                containerStyle={{ width: '100%', height: '100%' }}
                videoContainerStyle={{ width: '100%', height: '100%', paddingTop: 0 }}
                videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                scanDelay={300}
            />
        </div>
    );
};
