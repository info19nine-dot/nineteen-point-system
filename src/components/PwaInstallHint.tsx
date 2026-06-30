import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type PwaInstallHintProps = {
    variant?: 'light' | 'dark';
    storageKey: string;
    iosMessage: string;
};

function isStandalone(): boolean {
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
}

function isIos(): boolean {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstallHint({
    variant = 'light',
    storageKey,
    iosMessage,
}: PwaInstallHintProps) {
    const [visible, setVisible] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        if (isStandalone()) return;
        if (localStorage.getItem(storageKey) === 'dismissed') return;

        if (isIos()) {
            setVisible(true);
            return;
        }

        const handler = (event: Event) => {
            event.preventDefault();
            setDeferredPrompt(event as BeforeInstallPromptEvent);
            setVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, [storageKey]);

    const dismiss = () => {
        localStorage.setItem(storageKey, 'dismissed');
        setVisible(false);
    };

    const install = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        dismiss();
    };

    if (!visible) return null;

    const isDark = variant === 'dark';

    return (
        <div
            className={`mt-6 rounded-2xl border p-4 text-left ${
                isDark
                    ? 'border-teal-500/30 bg-slate-900/60 text-slate-200'
                    : 'border-teal-100 bg-teal-50/80 text-slate-700'
            }`}
        >
            <div className="mb-2 flex items-start justify-between gap-2">
                <p className={`text-sm font-bold ${isDark ? 'text-teal-300' : 'text-teal-800'}`}>
                    アプリのように使う（PWA）
                </p>
                <button
                    type="button"
                    onClick={dismiss}
                    className={`shrink-0 rounded-full p-1 ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-gray-400 hover:bg-white/60'}`}
                    aria-label="閉じる"
                >
                    <X size={16} />
                </button>
            </div>

            {isIos() ? (
                <p className="flex items-start gap-2 text-xs leading-relaxed">
                    <Share size={16} className="mt-0.5 shrink-0" />
                    <span>{iosMessage}</span>
                </p>
            ) : (
                <div className="space-y-3">
                    <p className="text-xs leading-relaxed">
                        「インストール」または Chrome 右上の ⋮ から
                        <strong className="font-bold">「アプリをインストール」</strong>
                        を選んでください。ショートカットだけだとアイコンが付きません。
                    </p>
                    {deferredPrompt ? (
                        <button
                            type="button"
                            onClick={() => void install()}
                            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white"
                        >
                            <Download size={14} />
                            インストール
                        </button>
                    ) : (
                        <p className="text-xs leading-relaxed text-slate-500">
                            ボタンが出ない場合は、一度ホーム画面の古いショートカットを削除してから、
                            このページを開き直してください。
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
