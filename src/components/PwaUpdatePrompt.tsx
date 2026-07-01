import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { applyPwaUpdate, onPwaNeedRefresh } from '../lib/pwaUpdate';

export function PwaUpdatePrompt() {
    const [visible, setVisible] = useState(false);

    useEffect(() => onPwaNeedRefresh(() => setVisible(true)), []);

    if (!visible) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-[99999] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-teal-200 bg-white p-4 shadow-2xl">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="text-sm font-bold text-slate-800">新しい版があります</p>
                    <p className="text-xs text-gray-500">再読み込みすると最新の機能が使えます</p>
                </div>
                <button
                    type="button"
                    onClick={() => applyPwaUpdate()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white active:scale-95"
                >
                    <RefreshCw size={16} />
                    再読み込み
                </button>
            </div>
        </div>
    );
}
