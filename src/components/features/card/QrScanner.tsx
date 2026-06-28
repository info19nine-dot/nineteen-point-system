import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { QrReader } from 'react-qr-reader';

type QrScannerProps = {
    onScan: (text: string) => void;
    className?: string;
    /** Stop decode callbacks but keep the camera stream alive (iOS success transition) */
    paused?: boolean;
};

function getVideoTrack(host: HTMLElement | null): MediaStreamTrack | undefined {
    const video = host?.querySelector('video');
    return video?.srcObject instanceof MediaStream
        ? video.srcObject.getVideoTracks()[0]
        : undefined;
}

async function applyContinuousFocus(track: MediaStreamTrack) {
    try {
        const caps = track.getCapabilities?.() as MediaTrackCapabilities & {
            focusMode?: string[];
        };
        if (caps?.focusMode?.includes('continuous')) {
            await track.applyConstraints({
                advanced: [{ focusMode: 'continuous' }],
            } as unknown as MediaTrackConstraints);
        }
    } catch {
        /* iOS Safari often ignores focusMode */
    }
}

async function triggerTapFocus(track: MediaStreamTrack) {
    try {
        const caps = track.getCapabilities?.() as MediaTrackCapabilities & {
            focusMode?: string[];
        };
        if (caps?.focusMode?.includes('single-shot')) {
            await track.applyConstraints({
                advanced: [{ focusMode: 'single-shot' }],
            } as unknown as MediaTrackConstraints);
        }
    } catch {
        /* best-effort */
    }
}

function captureVideoFrame(host: HTMLElement | null): string | null {
    const video = host?.querySelector('video');
    if (!video || video.videoWidth === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.92);
}

export const QrScanner = ({ onScan, className, paused = false }: QrScannerProps) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const onScanRef = useRef(onScan);
    const lastScanRef = useRef<{ text: string; at: number } | null>(null);
    const focusTimerRef = useRef<number | null>(null);
    const [frozenFrame, setFrozenFrame] = useState<string | null>(null);

    onScanRef.current = onScan;

    useEffect(() => {
        const interval = window.setInterval(() => {
            const track = getVideoTrack(hostRef.current);
            if (!track) return;
            window.clearInterval(interval);
            window.setTimeout(() => void applyContinuousFocus(track), 600);
        }, 200);

        return () => {
            window.clearInterval(interval);
            if (focusTimerRef.current !== null) {
                window.clearTimeout(focusTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!paused) {
            setFrozenFrame(null);
            return;
        }

        const frame = captureVideoFrame(hostRef.current);
        if (frame) setFrozenFrame(frame);
    }, [paused]);

    const handleTapFocus = useCallback(() => {
        if (paused) return;

        const track = getVideoTrack(hostRef.current);
        if (!track) return;

        void triggerTapFocus(track);
        if (focusTimerRef.current !== null) {
            window.clearTimeout(focusTimerRef.current);
        }
        focusTimerRef.current = window.setTimeout(() => {
            void applyContinuousFocus(track);
            focusTimerRef.current = null;
        }, 900);
    }, [paused]);

    const handleResult = useCallback<NonNullable<ComponentProps<typeof QrReader>['onResult']>>(
        (result) => {
            if (paused) return;

            const text = result?.getText();
            if (!text) return;

            const now = Date.now();
            const last = lastScanRef.current;
            if (last && last.text === text && now - last.at < 3000) return;
            lastScanRef.current = { text, at: now };
            onScanRef.current(text);
        },
        [paused]
    );

    const cameraConstraints = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        focusMode: { ideal: 'continuous' },
    } as MediaTrackConstraints;

    return (
        <div
            ref={hostRef}
            className={`qr-scanner-host ${className ?? ''}`}
            onClick={handleTapFocus}
            role="button"
            aria-label="タップでピントを合わせる"
        >
            <QrReader
                onResult={handleResult}
                constraints={cameraConstraints}
                containerStyle={{ width: '100%', height: '100%' }}
                videoContainerStyle={{ width: '100%', height: '100%', paddingTop: 0 }}
                videoStyle={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: paused && frozenFrame ? 0 : 1,
                }}
                scanDelay={300}
            />
            {paused && frozenFrame && (
                <img
                    src={frozenFrame}
                    alt=""
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
            )}
        </div>
    );
};
