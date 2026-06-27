import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useSupabase } from '../../contexts/SupabaseContext';
import { STAFF_LOGIN_PATH } from '../../lib/routes';
import { User, Lock, Mail, AlertCircle, AlertTriangle, Info, ShieldX } from 'lucide-react';

const MemberLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeModal, setActiveModal] = useState<{
        type: 'error' | 'info' | 'suspended';
        title: string;
        message: string;
        rank?: 'regular' | 'special';
    } | null>(null);

    // Check for Suspension State from Redirect
    useEffect(() => {
        if (location.state?.suspended) {
             setActiveModal({
                 type: 'suspended',
                 title: 'アカウント利用停止',
                 message: 'お客様のアカウントは現在利用停止となっております。\n詳細につきましては管理者までお問い合わせください。',
                 rank: location.state.rank || 'regular'
             });
             // Clear state so refresh doesn't show it again needlessly (optional, but good UX)
             window.history.replaceState({}, document.title);
        }
    }, [location]);

    // Show Auto-Login Notice on Mount (only if no suspension)
    useEffect(() => {
        if (location.state?.suspended) return;

        const hasSeenNotice = sessionStorage.getItem('has_seen_login_notice');
        if (!hasSeenNotice) {
            setActiveModal({
                type: 'info',
                title: '自動ログインについて',
                message: '一度ログインすると、次回は自動的にログインされます。\n別のアカウントを使う場合は\n「別のアカウントでログイン」を選んでください。'
            });
            sessionStorage.setItem('has_seen_login_notice', 'true');
        }
    }, [location.state]);

    // Redirect if already logged in as admin (e.g. old staff URL bookmark)
    const { user, loading, profile, isAdmin, logout } = useSupabase();
    useEffect(() => {
        if (!loading && user && isAdmin) {
            navigate(STAFF_LOGIN_PATH, { replace: true });
        }
    }, [user, loading, isAdmin, navigate]);

    const handleSwitchAccount = async () => {
        await logout();
        setEmail('');
        setPassword('');
        setError(null);
    };

    const handleContinueAsCurrent = () => {
        navigate('/card');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // 1. Check if user is blacklisted/deleted BEFORE trying to sign in fully?
            // Actually, we can't check profile easily without auth/public access.
            // So we sign in, check profile, then sign out if needed.
            
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) throw signInError;

            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('is_deleted, is_blacklisted, rank, role')
                    .eq('id', authUser.id)
                    .single();

                if (profileData?.role === 'admin') {
                    navigate(STAFF_LOGIN_PATH, { replace: true });
                    setIsLoading(false);
                    return;
                }

                if (profileData?.is_deleted || profileData?.is_blacklisted) {
                    await supabase.auth.signOut();
                    // Show the styled modal
                    setActiveModal({
                        type: 'suspended',
                        title: '利用停止のお知らせ',
                        message: 'このアカウントは利用停止されています。\n管理者にお問い合わせください。',
                        rank: profileData.rank || 'regular'
                    });
                    setIsLoading(false); // Stop loading manually since we don't navigate
                    return; 
                }
            }

            // Login successful
            navigate('/card');
        } catch (err: any) {
            console.error(err);
            setError('メールアドレスまたはパスワードが間違っています');
        } finally {
            if (!activeModal) setIsLoading(false); 
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

                {loading && (
                    <p className="text-center text-sm text-gray-400">読み込み中...</p>
                )}

                {!loading && user && profile && !isAdmin && (
                    <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 space-y-3">
                        <p className="text-sm text-teal-800 font-medium text-center">
                            <span className="font-bold">{profile.name || profile.email}</span>
                            {' '}としてログイン中です
                        </p>
                        <button
                            type="button"
                            onClick={handleContinueAsCurrent}
                            className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors"
                        >
                            このアカウントで続ける
                        </button>
                        <button
                            type="button"
                            onClick={handleSwitchAccount}
                            className="w-full text-sm text-teal-700 font-bold py-2 hover:underline"
                        >
                            別のアカウントでログイン
                        </button>
                    </div>
                )}

                {!loading && !(user && profile && !isAdmin) && (
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
                )}

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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
                        
                        {/* Special Rank Background Effect */}
                        {activeModal.type === 'suspended' && activeModal.rank === 'special' && (
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-300"></div>
                        )}

                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                            activeModal.type === 'error' ? 'bg-red-50 text-red-500' : 
                            activeModal.type === 'suspended' 
                                ? (activeModal.rank === 'special' ? 'bg-yellow-50 text-yellow-600 ring-4 ring-yellow-50' : 'bg-red-50 text-red-500 ring-4 ring-red-50')
                                : 'bg-blue-50 text-blue-500'
                        }`}>
                            {activeModal.type === 'error' ? <AlertTriangle size={32} /> : 
                             activeModal.type === 'suspended' ? <ShieldX size={32} /> : 
                             <Info size={32} />}
                        </div>
                        
                        <h3 className={`text-xl font-bold mb-3 ${
                            activeModal.type === 'suspended' && activeModal.rank === 'special' ? 'text-yellow-700' : 'text-slate-800'
                        }`}>
                            {activeModal.title}
                        </h3>
                        
                        <p className="text-gray-500 text-sm mb-8 leading-relaxed whitespace-pre-wrap font-medium">
                            {activeModal.message}
                        </p>
                        
                        <button 
                            onClick={() => setActiveModal(null)}
                            className={`w-full font-bold py-3.5 rounded-xl shadow-lg transition-transform active:scale-95 ${
                                activeModal.type === 'suspended' && activeModal.rank === 'special'
                                    ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-yellow-200 hover:from-yellow-600 hover:to-yellow-700'
                                    : 'bg-slate-800 text-white hover:bg-slate-700'
                            }`}
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MemberLogin;
