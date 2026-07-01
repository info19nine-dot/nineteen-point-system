import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, PauseCircle, PlayCircle, ShieldAlert } from 'lucide-react';
import { fetchPointsPaused, setPointsPaused } from '../../../lib/appSettings';

export default function DesktopMaintenance() {
    const navigate = useNavigate();
    const [pointsPaused, setPointsPausedState] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showConfirmStart, setShowConfirmStart] = useState(false);

    useEffect(() => {
        fetchPointsPaused()
            .then(setPointsPausedState)
            .finally(() => setLoading(false));
    }, []);

    const applyPaused = async (paused: boolean) => {
        setToggling(true);
        setError(null);
        const message = await setPointsPaused(paused);
        setToggling(false);
        if (message) {
            setError('メンテナンス設定の更新に失敗しました');
            return;
        }
        setPointsPausedState(paused);
        setShowConfirmStart(false);
    };

    const handleStart = () => {
        setShowConfirmStart(true);
    };

    const handleEnd = () => {
        void applyPaused(false);
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            <header className="bg-slate-800 text-white shadow-md sticky top-0 z-30">
                <div className="max-w-3xl mx-auto px-6 h-16 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/admin/office')}
                        className="p-2 -ml-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                        aria-label="戻る"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <h1 className="text-lg font-bold">メンテナンスモード</h1>
                </div>
            </header>

            <main className="flex-grow max-w-3xl mx-auto w-full px-6 py-8 space-y-6">
                <div
                    className={`rounded-xl border px-5 py-4 flex items-center gap-3 ${
                        pointsPaused
                            ? 'bg-orange-50 border-orange-200 text-orange-900'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                >
                    {pointsPaused ? (
                        <PauseCircle size={22} className="shrink-0 text-orange-600" />
                    ) : (
                        <PlayCircle size={22} className="shrink-0 text-emerald-600" />
                    )}
                    <div>
                        <p className="text-xs font-medium opacity-80">現在の状態</p>
                        <p className="font-bold">
                            {loading ? '読み込み中…' : pointsPaused ? 'メンテナンス中' : '通常運用'}
                        </p>
                    </div>
                </div>

                <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <ShieldAlert size={22} className="text-slate-500 shrink-0 mt-0.5" />
                        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
                            <p className="font-bold text-slate-800 text-base">
                                会員の「貯める」「使う」だけを一時停止します
                            </p>
                            <ul className="list-disc pl-5 space-y-1.5">
                                <li>会員はログイン・残高確認・履歴閲覧はできます</li>
                                <li>店舗でのポイント付与・読取など、スタッフ操作は通常どおりです</li>
                                <li>システム障害や不具合時など、緊急時のみご利用ください</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                        <AlertTriangle size={18} />
                        {error}
                    </div>
                )}

                <div className="pt-2">
                    {pointsPaused ? (
                        <button
                            type="button"
                            onClick={handleEnd}
                            disabled={loading || toggling}
                            className="w-full py-4 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <PlayCircle size={20} />
                            {toggling ? '更新中…' : 'メンテナンスを解除'}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleStart}
                            disabled={loading || toggling}
                            className="w-full py-4 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <PauseCircle size={20} />
                            メンテナンスを開始
                        </button>
                    )}
                </div>
            </main>

            {showConfirmStart && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
                        <h2 className="text-lg font-bold text-slate-800">メンテナンスを開始しますか？</h2>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            会員の「貯める」「使う」が停止されます。ログインと履歴閲覧は引き続き利用できます。
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowConfirmStart(false)}
                                disabled={toggling}
                                className="flex-1 py-3 rounded-xl font-bold border border-gray-200 text-slate-600 hover:bg-gray-50 disabled:opacity-50"
                            >
                                キャンセル
                            </button>
                            <button
                                type="button"
                                onClick={() => void applyPaused(true)}
                                disabled={toggling}
                                className="flex-1 py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
                            >
                                {toggling ? '開始中…' : '開始する'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
