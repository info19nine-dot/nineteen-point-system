import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Lock, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { STAFF_MODE_SELECT_PATH } from '../../lib/routes';
import { PwaInstallHint } from '../../components/PwaInstallHint';

const StaffLogin = () => {
    const navigate = useNavigate();
    const { session, loading, isAdmin, refreshProfile } = useSupabase();

    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rememberId, setRememberId] = useState(false);
    const [rememberPassword, setRememberPassword] = useState(false);

    useEffect(() => {
        const savedId = localStorage.getItem('staff_login_id');
        const savedPassword = localStorage.getItem('staff_password');

        if (savedId) {
            setLoginId(savedId);
            setRememberId(true);
        }
        if (savedPassword) {
            setPassword(savedPassword);
            setRememberPassword(true);
        }
    }, []);

    useEffect(() => {
        if (!loading && session && isAdmin) {
            navigate(STAFF_MODE_SELECT_PATH, { replace: true });
        }
    }, [loading, session, isAdmin, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginId || !password) {
            setError('IDとパスワードを入力してください');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const email = `${loginId}@admin.com`;

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (signInError) throw signInError;

            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', authUser.id)
                    .single();

                if (profileData?.role !== 'admin') {
                    await supabase.auth.signOut();
                    setError('IDまたはパスワードが違います');
                    return;
                }
            }

            if (rememberId) {
                localStorage.setItem('staff_login_id', loginId);
            } else {
                localStorage.removeItem('staff_login_id');
            }

            if (rememberPassword) {
                localStorage.setItem('staff_password', password);
            } else {
                localStorage.removeItem('staff_password');
            }

            await refreshProfile();
            navigate(STAFF_MODE_SELECT_PATH, { replace: true });
        } catch (err: any) {
            console.error(err);
            setError('IDまたはパスワードが違います');
        } finally {
            setIsLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
                <Loader2 className="animate-spin text-teal-500" size={48} />
            </div>
        );
    }

    if (session && isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0F172A]">
                <Loader2 className="animate-spin text-teal-500" size={48} />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-6 font-sans relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-purple-500 to-indigo-500 opacity-50" />

            <div className="w-full max-w-md space-y-8 relative z-10 animate-in fade-in zoom-in duration-300">
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-800 shadow-xl border border-slate-700 mb-2">
                        <ShieldCheck size={32} className="text-teal-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-[0.2em] uppercase">Staff Portal</h1>
                        <p className="text-slate-400 text-sm mt-2">関係者専用ログインゲートウェイ</p>
                    </div>
                </div>

                <form onSubmit={handleLogin} className="bg-slate-800/50 p-8 rounded-3xl border border-slate-700 backdrop-blur-sm space-y-6 shadow-2xl">
                    {error && (
                        <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-500/20">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block">管理者ID</label>
                            <input
                                type="text"
                                placeholder="管理者IDを入力"
                                className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-600 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors font-mono"
                                value={loginId}
                                onChange={(e) => setLoginId(e.target.value)}
                            />
                            <div className="mt-2 flex items-center">
                                <input
                                    id="remember-id"
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-900/80 text-teal-500 focus:ring-teal-500 focus:ring-offset-slate-900"
                                    checked={rememberId}
                                    onChange={(e) => setRememberId(e.target.checked)}
                                />
                                <label htmlFor="remember-id" className="ml-2 text-xs text-slate-400 cursor-pointer select-none">
                                    IDを保存する
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 ml-1 mb-1 block">パスワード</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl bg-slate-900/80 border border-slate-600 text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors font-mono"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <div className="mt-2 flex items-center">
                                <input
                                    id="remember-password"
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-900/80 text-teal-500 focus:ring-teal-500 focus:ring-offset-slate-900"
                                    checked={rememberPassword}
                                    onChange={(e) => setRememberPassword(e.target.checked)}
                                />
                                <label htmlFor="remember-password" className="ml-2 text-xs text-slate-400 cursor-pointer select-none">
                                    パスワードを保存する
                                </label>
                            </div>
                        </div>
                    </div>

                    <button
                        disabled={isLoading}
                        className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-500 transition-all disabled:opacity-50 active:scale-95"
                    >
                        {isLoading ? '認証中...' : 'ログイン'}
                    </button>
                </form>

                <div className="text-center pt-4">
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
                        <Lock size={12} />
                        <span>Secure Connection | ID-Based Auth</span>
                    </div>
                </div>

                <PwaInstallHint
                    variant="dark"
                    storageKey="pwa_hint_staff_dismissed"
                    iosMessage="Safari 下部の「共有」→「ホーム画面に追加」で、スタッフ画面をアプリのように起動できます。"
                />
            </div>
        </div>
    );
};

export default StaffLogin;
