import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Loader2 } from 'lucide-react';

type QrScannerProps = {
    onScan: (text: string) => void;
    onError?: (message: string) => void;
    className?: string;
    showRefocusHint?: boolean;
};

type CameraStartConfig = string | MediaTrackConstraints | { facingMode: string };

function waitForHostLayout(host: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
        const ready = () => {
            const { width, height } = host.getBoundingClientRect();
            return width >= 200 && height >= 200;
        };

        if (ready()) {
            resolve();
            return;
        }

        const observer = new ResizeObserver(() => {
            if (ready()) {
                observer.disconnect();
                resolve();
            }
        });
        observer.observe(host);
        window.setTimeout(() => {
            observer.disconnect();
            resolve();
        }, 1500);
    });
}

async function pickCameraConfigs(): Promise<CameraStartConfig[]> {
    const configs: CameraStartConfig[] = [{ facingMode: 'environment' }];

    try {
        const cameras = await Html5Qrcode.getCameras();
        const back = cameras.find((c) =>
            /back|rear|environment|後|アウト|out/i.test(c.label)
        );
        if (back) {
            configs.unshift(back.id);
        } else if (cameras.length > 0) {
            configs.unshift(cameras[cameras.length - 1].id);
        }
    } catch {
        /* getCameras unsupported or denied before start */
    }

    configs.push({
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
    });
    configs.push({ facingMode: 'user' });

    return configs;
}

async function enhanceVideoTrack(elementId: string) {
    const video = document.querySelector(`#${elementId} video`) as HTMLVideoElement | null;
    const track =
        video?.srcObject instanceof MediaStream
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

        if (caps?.zoom && typeof caps.zoom.min === 'number') {
            advanced.push({ zoom: caps.zoom.min });
        }

        if (advanced.length > 0) {
            await track.applyConstraints({ advanced } as MediaTrackConstraints);
        }
    } catch {
        /* best-effort */
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
    const hostRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef(true);
    const [isRefocusing, setIsRefocusing] = useState(false);
    const [isStarting, setIsStarting] = useState(true);
    const [startError, setStartError] = useState<string | null>(null);

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

        const configs = await pickCameraConfigs();
        let lastError: unknown;

        for (const cameraConfig of configs) {
            if (!activeRef.current) return;
            try {
                await scanner.start(
                    cameraConfig,
                    { fps: 15, qrbox: undefined },
                    handleScan,
                    () => {}
                );
                await enhanceVideoTrack(elementId);
                return;
            } catch (e) {
                lastError = e;
                try {
                    await scanner.stop();
                } catch {
                    /* ignore */
                }
                scanner.clear();
            }
        }

        throw lastError instanceof Error
            ? lastError
            : new Error('カメラを起動できません。ブラウザのカメラ許可を確認してください。');
    }, [elementId, handleScan]);

    const runStart = useCallback(async () => {
        setStartError(null);
        setIsStarting(true);
        if (hostRef.current) {
            await waitForHostLayout(hostRef.current);
        }
        await new Promise((r) => window.setTimeout(r, 200));
        if (!activeRef.current) return;
        try {
            await startScanner();
            if (!activeRef.current) return;
            setIsStarting(false);
        } catch (e: unknown) {
            if (!activeRef.current) return;
            setIsStarting(false);
            const message = e instanceof Error ? e.message : 'カメラを起動できません';
            setStartError(message);
            onErrorRef.current?.(message);
        }
    }, [startScanner]);

    const refocus = useCallback(async () => {
        if (isRefocusing) return;
        setIsRefocusing(true);
        try {
            await runStart();
        } finally {
            setIsRefocusing(false);
        }
    }, [isRefocusing, runStart]);

    useEffect(() => {
        activeRef.current = true;
        runStart();

        return () => {
            activeRef.current = false;
            const scanner = scannerRef.current;
            if (scanner) {
                scanner
                    .stop()
                    .then(() => scanner.clear())
                    .catch(() => {});
                scannerRef.current = null;
            }
        };
    }, [elementId, runStart]);

    return (
        <div
            ref={hostRef}
            className={`qr-scanner-host ${className ?? ''}`}
            onClick={showRefocusHint && !startError ? refocus : undefined}
            role={showRefocusHint && !startError ? 'button' : undefined}
            aria-label={showRefocusHint && !startError ? 'タップでピントを再調整' : undefined}
        >
            <div id={elementId} className="absolute inset-0" />

            {(isStarting || isRefocusing) && !startError && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 pointer-events-none">
                    <Loader2 className="animate-spin text-teal-400" size={40} />
                    <p className="text-sm font-bold text-white/90">カメラを起動中...</p>
                </div>
            )}

            {startError && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/90 px-6 text-center">
                    <p className="text-sm font-bold text-red-300">カメラを起動できません</p>
                    <p className="text-xs text-white/70 whitespace-pre-wrap">{startError}</p>
                    <button
                        type="button"
                        onClick={() => void refocus()}
                        className="rounded-full bg-teal-500 px-5 py-2 text-sm font-bold text-white"
                    >
                        再試行
                    </button>
                </div>
            )}

            {showRefocusHint && !isStarting && !startError && (
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
