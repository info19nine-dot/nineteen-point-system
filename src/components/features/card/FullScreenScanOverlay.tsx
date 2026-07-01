import { CheckCircle2, Loader2, X } from 'lucide-react';
import { QrScanner } from './QrScanner';
import { ScanFrameOverlay } from './ScanFrameOverlay';

export type ScanOverlayPhase = 'scanning' | 'processing' | 'success';

export const SCAN_DISTANCE_HINT = '15〜25cm離して、枠のあたりに映してください（寄りすぎ注意）';

type FullScreenScanOverlayProps = {
    title: string;
    hint: string;
    onClose: () => void;
    onScan: (text: string) => void;
    accent?: 'teal' | 'gold';
    phase?: ScanOverlayPhase;
    successType?: 'EARN' | 'USE';
    successAmount?: number;
};

/** Full-screen scan — camera stays alive through processing/success (iOS Safari) */
export function FullScreenScanOverlay({
    title,
    hint,
    onClose,
    onScan,
    accent = 'teal',
    phase = 'scanning',
    successType = 'USE',
    successAmount,
}: FullScreenScanOverlayProps) {
    const isScanning = phase === 'scanning';
    const isProcessing = phase === 'processing';
    const isSuccess = phase === 'success';
    const cameraPaused = !isScanning;

    const handleClose = () => {
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-black text-white">
            {/* flex配置にしてvideoと重ねない（iOSで戻るが効かない原因） */}
            <div
                className="relative z-50 flex shrink-0 items-center justify-between bg-black/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
                style={{ WebkitTransform: 'translateZ(0)' }}
            >
                <button
                    type="button"
                    onClick={handleClose}
                    className="touch-manipulation flex h-11 w-11 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30 active:bg-white/40"
                    aria-label="戻る"
                >
                    <X size={22} />
                </button>
                <span className="font-bold drop-shadow-md">
                    {isSuccess
                        ? successType === 'EARN'
                            ? '付与完了'
                            : '受付完了'
                        : title}
                </span>
                <div className="w-11" />
            </div>

            <div className="relative min-h-0 flex-1">
                <QrScanner
                    onScan={onScan}
                    paused={cameraPaused}
                    className="absolute inset-0"
                />

                {isScanning && (
                    <>
                        <ScanFrameOverlay accent={accent} />
                        <div className="pointer-events-none absolute bottom-8 left-0 right-0 z-30 space-y-1 px-4 text-center">
                            <p className="text-sm font-bold text-white drop-shadow-md">{hint}</p>
                            <p className="text-xs font-medium text-white/80 drop-shadow-md">
                                {SCAN_DISTANCE_HINT}
                            </p>
                        </div>
                    </>
                )}

                {isProcessing && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/55 backdrop-blur-[2px]">
                        <Loader2 className="animate-spin text-teal-400" size={48} />
                        <p className="text-sm font-bold text-white/90">処理中...</p>
                    </div>
                )}

                {isSuccess && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-6 backdrop-blur-[2px]">
                        <div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center text-slate-800 shadow-2xl">
                            <div
                                className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${
                                    successType === 'EARN'
                                        ? 'bg-teal-100 text-teal-600'
                                        : 'bg-orange-100 text-orange-600'
                                }`}
                            >
                                <CheckCircle2 size={48} />
                            </div>
                            <h3 className="mb-2 text-2xl font-black">
                                {successType === 'EARN' ? '付与完了！' : '受付完了！'}
                            </h3>
                            <p className="mb-6 text-gray-500">
                                {successType === 'EARN'
                                    ? 'ポイントを付与しました。'
                                    : 'ポイント利用を受け付けました。'}
                            </p>
                            {successAmount != null && (
                                <div className="mb-4 rounded-xl border border-gray-100 bg-slate-50 p-4">
                                    <div className="mb-1 text-xs text-gray-400">
                                        {successType === 'EARN' ? '付与ポイント' : '利用ポイント'}
                                    </div>
                                    <div
                                        className={`text-3xl font-black ${
                                            successType === 'EARN' ? 'text-teal-600' : 'text-slate-800'
                                        }`}
                                    >
                                        {successType === 'EARN' ? '+' : '-'}
                                        {Number(successAmount).toLocaleString()}
                                        <span className="ml-1 text-base font-normal text-gray-400">pt</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
