import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Store, Monitor, Lock, ShieldCheck, ChevronRight, AlertCircle, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';

const StaffLogin = () => {
    const navigate = useNavigate();
    const { session, logout } = useSupabase();
    
    // UI State
    const [step, setStep] = useState<'login' | 'select'>('login');
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

    // If already logged in as admin, skip to selection
    useEffect(() => {
        if (session?.user?.user_metadata?.role === 'admin' || session?.user?.email?.includes('admin')) {
             setStep('select');
        }
    }, [session]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginId || !password) {
            setError('IDとパスワードを入力してください');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // "ID" only login: Append dummy domain to make it an email
            // Example: ID "store_master" -> "store_master@admin.com"
            const email = `${loginId}@admin.com`;

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (signInError) throw signInError;

            // Save or clear granular
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

            // Login Success -> Move to Selection
            setStep('select');

        } catch (err: any) {
            console.error(err);
            setError('IDまたはパスワードが違います');
        } finally {
            setIsLoading(false);
        }
    };

    const handleModeSelect = (type: 'store' | 'office') => {
        if (type === 'store') {
            navigate('/admin');
        } else {
            navigate('/admin/office');
        }
    };

    const handleLogout = async () => {
        await logout();
        setStep('login');
        
        // Restore if saved
        const savedId = localStorage.getItem('staff_login_id');
        const savedPassword = localStorage.getItem('staff_password');
        
        if (savedId) setLoginId(savedId);
        else setLoginId('');
        
        if (savedPassword) setPassword(savedPassword);
        else setPassword('');
    };

    // ----------------------------------------------------------------
    // Render Components
    // ----------------------------------------------------------------

    const LoginCard = ({ title, desc, icon: Icon, type }: { title: string, desc: string, icon: any, type: 'store' | 'office' }) => (
        <button 
            onClick={() => handleModeSelect(type)}
            className="group relative w-full p-1 rounded-2xl transition-all duration-300 hover:scale-[1.02] focus:outline-none"
        >
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${type === 'store' ? 'from-emerald-400 to-teal-500' : 'from-indigo-400 to-purple-500'} opacity-0 group-hover:opacity-100 transition-opacity blur-sm duration-300`} />
            <div className="relative h-full bg-slate-800 border border-slate-700 rounded-xl p-6 flex items-center justify-between gap-4 overflow-hidden group-hover:bg-slate-800/90 transition-colors">
                <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full ${type === 'store' ? 'bg-emerald-500/10' : 'bg-indigo-500/10'} blur-xl transition-transform group-hover:scale-150 duration-500`} />
                <div className="flex items-center gap-5 z-10">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${type === 'store' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                        <Icon size={28} strokeWidth={1.5} />
                    </div>
                    <div className="text-left">
                        <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>
                        <p className="text-slate-400 text-sm">{desc}</p>
                    </div>
                </div>
                <div className="z-10 text-slate-500 group-hover:text-white transition-colors">
                    <ChevronRight size={24} />
                </div>
            </div>
        </button>
    );

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-6 font-sans relative overflow-hidden">
             {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-purple-500 to-indigo-500 opacity-50" />
            
            {/* Step 1: Login Form */}
            {step === 'login' && (
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
                                    placeholder="Enter Admin ID" 
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
                </div>
            )}

            {/* Step 2: Mode Selection */}
            {step === 'select' && (
                <div className="w-full max-w-md space-y-10 relative z-10 animate-in fade-in slide-in-from-right-10 duration-500">
                    <div className="text-center">
                        <h2 className="text-white text-xl font-bold mb-1">Select Access Mode</h2>
                        <p className="text-slate-400 text-sm">アクセスする機能を選択してください</p>
                    </div>

                    <div className="space-y-4">
                        <LoginCard 
                            title="STORE MODE" 
                            desc="店頭でのポイント付与・読取"
                            icon={Store}
                            type="store"
                        />
                        <LoginCard 
                            title="OFFICE MODE" 
                            desc="顧客データ管理・分析設定"
                            icon={Monitor}
                            type="office"
                        />
                    </div>

                    <div className="text-center pt-8">
                        <button onClick={handleLogout} className="text-slate-500 hover:text-white text-sm flex items-center justify-center gap-2 mx-auto transition-colors">
                            <LogOut size={16} />
                            ログアウト
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffLogin;
