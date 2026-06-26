import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useSupabase } from '../../contexts/SupabaseContext';
import { User, Lock, Mail, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const MemberLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeModal, setActiveModal] = useState<{
        type: 'error' | 'info';
        title: string;
        message: string;
    } | null>(null);

    // Show Auto-Login Notice on Mount
    useEffect(() => {
        // Check if we are already logged in handled by Supabase, 
        // but if we are here, we show the explanation
        const hasSeenNotice = sessionStorage.getItem('has_seen_login_notice');
        if (!hasSeenNotice) {
            setActiveModal({
                type: 'info',
                title: '自動ログインについて',
                message: '一度ログインすると、次回からは\n自動的にログインされます。\n（毎回入力する必要はありません）'
            });
            sessionStorage.setItem('has_seen_login_notice', 'true');
        }
    }, []);

    // Redirect if already logged in
    const { user, loading } = useSupabase();
    useEffect(() => {
        if (!loading && user) {
            navigate('/card');
        }
    }, [user, loading, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Check if user is deleted logic
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('is_deleted')
                    .eq('id', user.id)
                    .single();

                if (profile?.is_deleted) {
                    await supabase.auth.signOut();
                    throw new Error('このアカウントは削除されています');
                }
            }

            // Login successful
            navigate('/card');
        } catch (err: any) {
            console.error(err);
            setError(err.message === 'このアカウントは削除されています' ? err.message : 'メールアドレスまたはパスワードが間違っています');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-8">
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-100 text-teal-600 mb-4">
                        <User size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">会員ログイン</h1>
                    <p className="text-slate-500 text-sm">貯まったポイントを確認・利用しましょう</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}
                    
                    <div className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input 
                                type="email" 
                                placeholder="メールアドレス" 
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 font-medium"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input 
                                type="password" 
                                placeholder="パスワード" 
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center justify-end mt-2 ml-1">
                            <Link to="/forgot-password" className="text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline">
                                パスワードをお忘れですか？
                            </Link>
                        </div>
                    </div>

                    <button 
                        disabled={isLoading}
                        className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-teal-200 hover:bg-teal-700 transition-all disabled:opacity-50"
                    >
                        {isLoading ? 'ログイン中...' : 'ログインする'}
                    </button>
                </form>

                <div className="text-center pt-2">
                     <p className="text-sm text-gray-500">
                        アカウントをお持ちでない方は{' '}
                        <Link to="/register" className="text-teal-600 font-bold hover:underline">
                            新規会員登録
                        </Link>
                    </p>
                </div>
            </div>

            {/* Active Modal */}
            {activeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-xl">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                            activeModal.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'
                        }`}>
                            {activeModal.type === 'error' ? <AlertTriangle size={32} /> : <Info size={32} />}
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">{activeModal.title}</h3>
                        <p className="text-gray-500 text-sm mb-6 leading-relaxed whitespace-pre-wrap">
                            {activeModal.message}
                        </p>
                        <button 
                            onClick={() => setActiveModal(null)}
                            className="w-full bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-slate-700 transition-transform active:scale-95"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MemberLogin;
