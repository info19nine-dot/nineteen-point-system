import { useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, X } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { buildUseSessionQrPayload } from '../../../lib/useQrSession';
import { QR_CANVAS_SIZE, QR_EARN_CANVAS_STYLE } from '../../../lib/qrDisplay';

type StaffUseQrModalProps = {
    sessionId: string;
    onClose: () => void;
    onRegenerate: () => void;
};

export function StaffUseQrModal({ sessionId, onClose, onRegenerate }: StaffUseQrModalProps) {
    const qrPayload = useMemo(() => buildUseSessionQrPayload(sessionId), [sessionId]);

    const handleCancel = async () => {
        await supabase.rpc('cancel_use_qr_session', { p_session_id: sessionId });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="relative w-full max-w-sm max-h-[92vh] overflow-y-auto rounded-[2rem] bg-white p-6 pb-8 text-center shadow-2xl">
                <button
                    type="button"
                    onClick={() => void handleCancel()}
                    className="absolute right-4 top-4 z-10 text-gray-400 hover:text-gray-600"
                    aria-label="閉じる"
                >
                    <X size={24} />
                </button>

                <div className="mb-4 mt-4 flex flex-col items-center gap-2">
                    <div className="rounded-full bg-teal-50 p-3 text-teal-600">
                        <QrCode size={28} />
                    </div>
                    <h2 className="text-xl font-black text-slate-800">ポイント使用</h2>
                    <p className="text-xs text-gray-500">お客様に読み取ってもらうQRです</p>
                </div>

                <div className="space-y-4">
                    <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
                        お客様の読取待ち
                    </div>

                    <div className="text-[10px] font-bold leading-relaxed text-red-500">
                        ※このQRコードは1回のみ有効です。
                        <br />
                        有効期限: 5分
                    </div>

                    <div className="inline-block rounded-xl bg-white p-3 shadow-lg">
                        <QRCodeCanvas
                            value={qrPayload}
                            size={QR_CANVAS_SIZE}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            level="H"
                            includeMargin
                            style={QR_EARN_CANVAS_STYLE}
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void handleCancel()}
                            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-600"
                        >
                            キャンセル
                        </button>
                        <button
                            type="button"
                            onClick={onRegenerate}
                            className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700"
                        >
                            QRを出し直す
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
