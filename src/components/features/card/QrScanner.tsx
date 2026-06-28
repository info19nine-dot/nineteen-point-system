import { useCallback, useEffect, useRef, type ComponentProps } from 'react';
import { QrReader } from 'react-qr-reader';

type QrScannerProps = {
    onScan: (text: string) => void;
    className?: string;
};

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
        /* iOS Safari often ignores focusMode — harmless */
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
        if (caps?.focusMode?.includes('continuous')) {
            await track.applyConstraints({
                advanced: [{ focusMode: 'continuous' }],
            } as unknown as MediaTrackConstraints);
        }
    } catch {
        /* best-effort */
    }
}

export const QrScanner = ({ onScan, className }: QrScannerProps) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const onScanRef = useRef(onScan);
    const lastScanRef = useRef<{ text: string; at: number } | null>(null);
    const focusAppliedRef = useRef(false);

    onScanRef.current = onScan;

    useEffect(() => {
        focusAppliedRef.current = false;
        const timer = window.setInterval(() => {
            const video = hostRef.current?.querySelector('video');
            const track =
                video?.srcObject instanceof MediaStream
                    ? video.srcObject.getVideoTracks()[0]
                    : undefined;
            if (!track || focusAppliedRef.current) return;
            focusAppliedRef.current = true;
            void applyContinuousFocus(track);
            window.clearInterval(timer);
        }, 200);

        return () => window.clearInterval(timer);
    }, []);

    const handleTapFocus = useCallback(() => {
        const video = hostRef.current?.querySelector('video');
        const track =
            video?.srcObject instanceof MediaStream
                ? video.srcObject.getVideoTracks()[0]
                : undefined;
        if (track) void triggerTapFocus(track);
    }, []);

    const handleResult = useCallback<NonNullable<ComponentProps<typeof QrReader>['onResult']>>(
        (result) => {
            // Decode errors while hunting for a QR are normal — never show UI errors for them
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

    const cameraConstraints = {
        facingMode: { ideal: 'environment' },
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
                videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
                scanDelay={300}
            />
            <p className="pointer-events-none absolute bottom-4 left-0 right-0 z-10 px-4 text-center text-xs font-bold text-white/90">
                ピントが合わないときは画面をタップ
            </p>
        </div>
    );
};
