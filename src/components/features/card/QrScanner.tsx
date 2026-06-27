import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

type QrScannerProps = {
    onScan: (text: string) => void;
    onError?: (message: string) => void;
    className?: string;
    /** Shown when showRefocusHint — e.g. staff scanning member phone QR */
    showRefocusHint?: boolean;
};

const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920, min: 640 },
    height: { ideal: 1080, min: 480 },
    // iOS Safari — continuous AF when supported
    // @ts-expect-error focusMode is valid in browsers but missing from TS lib
    focusMode: { ideal: 'continuous' },
};

async function enhanceVideoTrack(elementId: string) {
    const video = document.querySelector(`#${elementId} video`) as HTMLVideoElement | null;
    const track = video?.srcObject instanceof MediaStream
        ? video.srcObject.getVideoTracks()[0]
        : undefined;
    if (!track) return;

    try {
        const caps = track.getCapabilities?.() as MediaTrackCapabilities & {
            focusMode?: string[];
            zoom?: { min: number; max: number; step?: number };
        };

        const advanced: Record<string, unknown>[] = [];

        if (caps?.focusMode?.includes('continuous')) {
            advanced.push({ focusMode: 'continuous' });
        } else if (caps?.focusMode?.includes('single-shot')) {
            advanced.push({ focusMode: 'single-shot' });
        }

        // Wider field of view can help when scanning a phone screen up close (iPhone)
        if (caps?.zoom && typeof caps.zoom.min === 'number') {
            advanced.push({ zoom: caps.zoom.min });
        }

        if (advanced.length > 0) {
            await track.applyConstraints({ advanced } as MediaTrackConstraints);
        }
    } catch {
        // Best-effort — unsupported on some devices
    }
}

export const QrScanner = ({
    onScan,
    onError,
    className,
    showRefocusHint = false,
}: QrScannerProps) => {
    const reactId = useId().replace(/:/g, '');
    const elementId = `qr-scanner-${reactId}`;
    const onScanRef = useRef(onScan);
    const onErrorRef = useRef(onError);
    const lastScanRef = useRef<{ text: string; at: number } | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const activeRef = useRef(true);
    const [isRefocusing, setIsRefocusing] = useState(false);

    onScanRef.current = onScan;
    onErrorRef.current = onError;

    const handleScan = useCallback((decoded: string) => {
        const now = Date.now();
        const last = lastScanRef.current;
        if (last && last.text === decoded && now - last.at < 3000) return;
        lastScanRef.current = { text: decoded, at: now };
        onScanRef.current(decoded);
    }, []);

    const startScanner = useCallback(async () => {
        if (!activeRef.current) return;

        let scanner = scannerRef.current;
        if (!scanner) {
            scanner = new Html5Qrcode(elementId, { verbose: false });
            scannerRef.current = scanner;
        } else {
            try {
                await scanner.stop();
            } catch {
                /* already stopped */
            }
            scanner.clear();
        }

        await scanner.start(
            CAMERA_CONSTRAINTS,
            { fps: 15, qrbox: undefined },
            handleScan,
            () => {}
        );

        await enhanceVideoTrack(elementId);
    }, [elementId, handleScan]);

    const refocus = useCallback(async () => {
        if (isRefocusing) return;
        setIsRefocusing(true);
        try {
            await startScanner();
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'カメラを再起動できません';
            onErrorRef.current?.(message);
        } finally {
            setIsRefocusing(false);
        }
    }, [isRefocusing, startScanner]);

    useEffect(() => {
        activeRef.current = true;

        const init = async () => {
            await new Promise((r) => setTimeout(r, 300));
            if (!activeRef.current) return;
            try {
                await startScanner();
            } catch (e: unknown) {
                const message = e instanceof Error ? e.message : 'カメラを起動できません';
                onErrorRef.current?.(message);
            }
        };

        init();

        return () => {
            activeRef.current = false;
            const scanner = scannerRef.current;
            if (scanner) {
                scanner.stop().then(() => scanner.clear()).catch(() => {});
                scannerRef.current = null;
            }
        };
    }, [elementId, startScanner]);

    return (
        <div
            className={`qr-scanner-host ${className ?? ''}`}
            onClick={showRefocusHint ? refocus : undefined}
            role={showRefocusHint ? 'button' : undefined}
            aria-label={showRefocusHint ? 'タップでピントを再調整' : undefined}
        >
            <div id={elementId} className="absolute inset-0" />

            {showRefocusHint && (
                <div className="absolute bottom-4 left-0 right-0 z-20 flex flex-col items-center gap-2 pointer-events-none px-4">
                    <p className="text-xs font-bold text-white/90 bg-black/50 px-3 py-1.5 rounded-full text-center">
                        ピントが合わないときは画面をタップ
                    </p>
                    {isRefocusing && (
                        <p className="text-xs text-white/70">再調整中...</p>
                    )}
                </div>
            )}
        </div>
    );
};
