import { CheckCircle2, Loader2, X } from 'lucide-react';
import { QrScanner } from './QrScanner';
import { ScanFrameOverlay } from './ScanFrameOverlay';

export type ScanOverlayPhase = 'scanning' | 'processing' | 'success';

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

/** Full-screen scan UI — keeps one fixed layer through processing/success (iOS Safari) */
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
    const canClose = isScanning;

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black text-white">
            <div className="absolute top-0 z-30 flex w-full items-center justify-between bg-black/50 p-4">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={!canClose}
                    className="rounded-full bg-white/20 p-2 transition-colors hover:bg-white/30 disabled:opacity-30"
                >
                    <X size={20} />
                </button>
                <span className="font-bold drop-shadow-md">
                    {isSuccess
                        ? successType === 'EARN'
                            ? '付与完了'
                            : '受付完了'
                        : title}
                </span>
                <div className="w-9" />
            </div>

            <div className="relative min-h-0 flex-1">
                {isScanning && (
                    <>
                        <QrScanner onScan={onScan} className="absolute inset-0" />
                        <ScanFrameOverlay accent={accent} />
                        <p className="pointer-events-none absolute bottom-10 left-0 right-0 z-30 px-4 text-center text-sm font-bold text-white drop-shadow-md">
                            {hint}
                        </p>
                    </>
                )}

                {isProcessing && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black">
                        <Loader2 className="animate-spin text-teal-400" size={48} />
                        <p className="text-sm font-bold text-white/90">処理中...</p>
                    </div>
                )}

                {isSuccess && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 p-6">
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

/** Let iOS Safari finish releasing the camera before swapping UI */
export const IOS_CAMERA_TEARDOWN_MS = 350;
