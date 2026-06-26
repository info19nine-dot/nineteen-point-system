import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../../contexts/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { ArrowLeft, Lock, LogOut, Trash2, ChevronRight, AlertTriangle, CheckCircle2, Smartphone } from 'lucide-react';

const Settings = () => {
    const navigate = useNavigate();
    const { user, profile: contextProfile } = useSupabase();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Form States
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [updating, setUpdating] = useState(false);

    // Modal States
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [phone, setPhone] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [activeModal, setActiveModal] = useState<{
        type: 'success' | 'error' | 'delete_confirm';
        title?: string;
        message?: string;
    } | null>(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        // Optimization: Use context data if available
        if (contextProfile && user) {
             setProfile({ ...contextProfile, email: user.email });
             setLoading(false);
             return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/login');
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;
            setProfile({ ...data, email: user.email });
        } catch (error) {
            console.error('Profile fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setActiveModal({
                type: 'error',
                title: 'エラー',
                message: 'パスワードが一致しません'
            });
            return;
        }
        if (password.length < 6) {
             setActiveModal({
                type: 'error',
                title: 'エラー',
                message: 'パスワードは6文字以上で設定してください'
            });
            return;
        }
        setUpdating(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            
            setShowPasswordModal(false);
            setPassword('');
            setConfirmPassword('');
            setActiveModal({
                type: 'success',
                title: '変更完了',
                message: 'パスワードを変更しました。'
            });
        } catch (error: any) {
            setActiveModal({
                type: 'error',
                title: '変更失敗',
                message: 'パスワードの変更に失敗しました: ' + error.message
            });
        } finally {
            setUpdating(false);
        }
    };

    const handleUpdatePhone = async (e: React.FormEvent) => {
        e.preventDefault();
        setUpdating(true);
        try {
            // Simple validation
            if (phone && !/^\d+$/.test(phone.replace(/-/g, ''))) {
                 throw new Error('電話番号は数字のみで入力してください(ハイフン可)');
            }

            // 1. Update Profile
            const { error } = await supabase
                .from('profiles')
                .update({ phone: phone })
                .eq('id', profile.id);

            if (error) throw error;
            


            // Local update
            setProfile({ ...profile, phone });

            setActiveModal({
                type: 'success',
                title: '変更完了',
                message: '電話番号を更新しました。'
            });
            setShowPhoneModal(false);
        } catch (error: any) {
            setActiveModal({
                type: 'error',
                title: '更新失敗',
                message: '電話番号の更新に失敗しました: ' + error.message
            });
        } finally {
            setUpdating(false);
        }
    };

    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newEmail !== confirmEmail) {
            setActiveModal({
                type: 'error',
                title: 'エラー',
                message: 'メールアドレスが一致しません'
            });
            return;
        }
        
        setUpdating(true);
        try {
            const { error } = await supabase.auth.updateUser(
                { email: newEmail },
                { emailRedirectTo: `${window.location.origin}/auth/confirm-email` }
            );
            if (error) throw error;
            


            setShowEmailModal(false);
            setNewEmail('');
            setConfirmEmail('');
            
            setActiveModal({
                type: 'success',
                title: '確認メール送信完了',
                message: `新しいメールアドレス(${newEmail})宛に確認メールを送信しました。\n\nメール内のリンクをクリックすると変更が完了します。`
            });
        } catch (error: any) {
            setActiveModal({
                type: 'error',
                title: '変更失敗',
                message: 'メールアドレスの変更に失敗しました: ' + error.message
            });
        } finally {
            setUpdating(false);
        }
    };

    const handleWithdrawal = async () => {
        setUpdating(true);
        try {
            // Logical delete
            const { error } = await supabase
                .from('profiles')
                .update({ is_deleted: true })
                .eq('id', profile.id);

            if (error) throw error;

            setActiveModal({
                type: 'success',
                title: '退会完了',
                message: 'ご利用ありがとうございました。\nまたのご利用をお待ちしております。'
            });
        } catch (error: any) {
             setActiveModal({
                type: 'error',
                title: '退会失敗',
                message: '退会処理に失敗しました: ' + error.message
            });
            setUpdating(false);
        }
    };

    const handleFinalLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    if (!user) return <div>アクセス権限がありません</div>;
    if (loading) return <div className="min-h-screen items-center justify-center flex bg-slate-50">読み込み中...</div>;

    const isSpecial = profile?.rank === 'special';

    // Theme definitions
    const theme = {
        pageBg: isSpecial ? 'bg-[#050505]' : 'bg-slate-50',
        textMain: isSpecial ? 'text-white' : 'text-gray-800',
        textSub: isSpecial ? 'text-gray-400' : 'text-gray-500',
        headerBg: isSpecial ? 'bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5' : 'bg-white shadow-sm',
        card: isSpecial 
            ? 'bg-[#111111] border border-yellow-500/20 shadow-lg shadow-black/50' 
            : 'bg-white border border-gray-100 shadow-sm',
        hover: isSpecial ? 'hover:bg-white/5' : 'hover:bg-slate-50',
        iconContainer: isSpecial ? 'bg-yellow-500/20 text-yellow-500' : 'bg-teal-50 text-teal-500',
        borderColor: isSpecial ? 'border-white/5' : 'border-gray-100',
        backButton: isSpecial ? 'text-gray-400 hover:text-white' : 'text-gray-600',
        input: isSpecial ? 'bg-[#222] border-white/10 text-white focus:ring-yellow-500' : 'bg-gray-50 border-gray-200 focus:ring-teal-500',
        primaryBtn: isSpecial 
            ? 'bg-gradient-to-r from-yellow-600 to-yellow-800 text-white shadow-yellow-900/20' 
            : 'bg-teal-600 text-white shadow-teal-200',
        avatarBg: isSpecial 
            ? 'bg-gradient-to-br from-yellow-400 to-yellow-700 text-white ring-2 ring-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]' 
            : 'bg-slate-100 text-slate-400',
    };

    return (
        <div className={`min-h-screen ${theme.pageBg} pb-20 transition-colors duration-500`}>
            {/* Header */}
            <header className={`${theme.headerBg} sticky top-0 z-10 transition-colors duration-500`}>
                <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
                    <button onClick={() => navigate(-1)} className={`p-2 -ml-2 ${theme.backButton} transition-colors`}>
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className={`font-bold ${theme.textMain}`}>アカウント設定</h1>
                    <div className="w-10" />
                </div>
            </header>

            <main className="max-w-md mx-auto p-4 space-y-6">
                
                {/* User Info */}
                <section className={`${theme.card} rounded-2xl p-8 flex flex-col items-center text-center transition-all duration-500 relative overflow-hidden`}>
                    {/* Special Member Background Effect */}
                    {isSpecial && (
                        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent opacity-50 pointer-events-none animate-pulse-slow"></div>
                    )}

                    <div className={`w-24 h-24 ${theme.avatarBg} rounded-full flex items-center justify-center text-3xl font-bold mb-4 z-10`}>
                        {profile?.name?.[0] || '?'}
                    </div>
                    
                    <div className="z-10 relative">
                        {isSpecial && (
                             <span className="inline-block px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 text-[10px] font-bold tracking-widest uppercase mb-2 backdrop-blur-sm">
                                特別会員
                             </span>
                        )}
                        <h2 className={`font-bold text-xl ${theme.textMain} mb-1`}>{profile?.name}</h2>
                        <p className={`text-sm ${theme.textSub} font-mono mb-4`}>ID: {profile?.member_code}</p>
                        <div className={`inline-block px-4 py-1.5 rounded text-xs ${isSpecial ? 'bg-white/5 text-gray-400 border border-white/5' : 'bg-slate-50 text-gray-500'} break-all`}>
                            {profile?.email}
                        </div>
                    </div>
                </section>

                {/* Settings Menu */}
                <section className={`${theme.card} rounded-2xl overflow-hidden transition-all duration-500`}>
                    <button 
                        onClick={() => setShowEmailModal(true)}
                        className={`w-full flex items-center justify-between p-4 ${theme.hover} transition-colors border-b ${theme.borderColor}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${theme.iconContainer}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                            </div>
                            <span className={`font-bold ${theme.textMain}`}>メールアドレス変更</span>
                        </div>
                        <ChevronRight size={20} className={isSpecial ? "text-gray-600" : "text-gray-300"} />
                    </button>

                    {isSpecial && (
                        <button 
                            onClick={() => {
                                setPhone(profile?.phone || '');
                                setShowPhoneModal(true);
                            }}
                            className={`w-full flex items-center justify-between p-4 ${theme.hover} transition-colors border-b ${theme.borderColor}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${theme.iconContainer}`}>
                                    <Smartphone size={20} />
                                </div>
                                <span className={`font-bold ${theme.textMain}`}>電話番号変更</span>
                            </div>
                            <ChevronRight size={20} className={isSpecial ? "text-gray-600" : "text-gray-300"} />
                        </button>
                    )}

                    <button 
                        onClick={() => setShowPasswordModal(true)}
                        className={`w-full flex items-center justify-between p-4 ${theme.hover} transition-colors border-b ${theme.borderColor}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${theme.iconContainer}`}>
                                <Lock size={20} />
                            </div>
                            <span className={`font-bold ${theme.textMain}`}>パスワード変更</span>
                        </div>
                        <ChevronRight size={20} className={isSpecial ? "text-gray-600" : "text-gray-300"} />
                    </button>

                    <button 
                        onClick={handleLogout}
                        className={`w-full flex items-center justify-between p-4 ${theme.hover} transition-colors`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${isSpecial ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                                <LogOut size={20} />
                            </div>
                            <span className={`font-bold ${theme.textMain}`}>ログアウト</span>
                        </div>
                        <ChevronRight size={20} className={isSpecial ? "text-gray-600" : "text-gray-300"} />
                    </button>
                </section>

                {/* Danger Zone */}
                <section className="mt-8">
                    <button 
                        onClick={() => setActiveModal({
                            type: 'delete_confirm',
                            title: '本当に退会しますか？',
                            message: '退会すると、ポイント残高や会員ランクなど\nすべてのデータが利用できなくなります。\nログインもできなくなります。'
                        })}
                        className={`w-full flex items-center justify-center gap-2 p-4 font-bold text-sm rounded-xl transition-colors ${
                            isSpecial 
                            ? 'text-red-400 bg-red-900/10 hover:bg-red-900/20 border border-red-500/20' 
                            : 'text-red-500 bg-red-50 hover:bg-red-100'
                        }`}
                    >
                        <Trash2 size={16} /> 退会する (アカウント削除)
                    </button>
                </section>
            </main>

            {/* Modals */}

            {/* Email Modal */}
            {showEmailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className={`${isSpecial ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white'} rounded-2xl w-full max-w-sm p-6 shadow-xl`}>
                        <h3 className={`font-bold text-lg mb-4 text-center ${theme.textMain}`}>メールアドレス変更</h3>
                        <p className={`text-xs text-center mb-6 ${theme.textSub}`}>
                            新しいメールアドレス宛に確認メールが送信されます。<br/>メール内のリンクをクリックすると変更が完了します。
                        </p>
                        <form onSubmit={handleUpdateEmail} className="space-y-4">
                            <div>
                                <label className={`block text-xs font-bold mb-1 ${theme.textSub}`}>新しいメールアドレス</label>
                                <input 
                                    type="email" 
                                    required
                                    autoComplete="off"
                                    className={`w-full rounded-lg p-3 focus:outline-none focus:ring-2 ${theme.input} placeholder:text-gray-500`}
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-bold mb-1 ${theme.textSub}`}>確認用メールアドレス</label>
                                <input 
                                    type="email" 
                                    required
                                    autoComplete="off"
                                    className={`w-full rounded-lg p-3 focus:outline-none focus:ring-2 ${theme.input} placeholder:text-gray-500`}
                                    value={confirmEmail}
                                    onChange={(e) => setConfirmEmail(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowEmailModal(false)} className={`flex-1 py-2.5 font-bold rounded-lg ${isSpecial ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`}>キャンセル</button>
                                <button type="submit" disabled={updating} className={`flex-1 py-2.5 font-bold rounded-lg shadow-lg ${theme.primaryBtn}`}>
                                    {updating ? '送信中...' : '変更メールを送信'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Phone Modal */}
            {showPhoneModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className={`${isSpecial ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white'} rounded-2xl w-full max-w-sm p-6 shadow-xl`}>
                        <h3 className={`font-bold text-lg mb-4 text-center ${theme.textMain}`}>電話番号変更</h3>
                        <p className={`text-xs text-center mb-6 ${theme.textSub}`}>
                            連絡可能な電話番号を入力してください。
                        </p>
                        <form onSubmit={handleUpdatePhone} className="space-y-4">
                            <div>
                                <label className={`block text-xs font-bold mb-1 ${theme.textSub}`}>電話番号</label>
                                <input 
                                    type="tel" 
                                    required
                                    className={`w-full rounded-lg p-3 focus:outline-none focus:ring-2 ${theme.input} placeholder:text-gray-500`}
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="090-1234-5678"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowPhoneModal(false)} className={`flex-1 py-2.5 font-bold rounded-lg ${isSpecial ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`}>キャンセル</button>
                                <button type="submit" disabled={updating} className={`flex-1 py-2.5 font-bold rounded-lg shadow-lg ${theme.primaryBtn}`}>
                                    {updating ? '送信中...' : '変更する'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className={`${isSpecial ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white'} rounded-2xl w-full max-w-sm p-6 shadow-xl`}>
                        <h3 className={`font-bold text-lg mb-4 text-center ${theme.textMain}`}>パスワード変更</h3>
                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                            <div>
                                <label className={`block text-xs font-bold mb-1 ${theme.textSub}`}>新しいパスワード (6文字以上)</label>
                                <input 
                                    type="password" 
                                    required
                                    minLength={6}
                                    className={`w-full rounded-lg p-3 focus:outline-none focus:ring-2 ${theme.input}`}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className={`block text-xs font-bold mb-1 ${theme.textSub}`}>確認用パスワード</label>
                                <input 
                                    type="password" 
                                    required
                                    minLength={6}
                                    className={`w-full rounded-lg p-3 focus:outline-none focus:ring-2 ${theme.input}`}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowPasswordModal(false)} className={`flex-1 py-2.5 font-bold rounded-lg ${isSpecial ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`}>キャンセル</button>
                                <button type="submit" disabled={updating} className={`flex-1 py-2.5 font-bold rounded-lg shadow-lg ${theme.primaryBtn}`}>
                                    {updating ? '更新中...' : '変更する'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Unified Active Modal */}
            {activeModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className={`${isSpecial ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white'} rounded-2xl w-full max-w-sm p-6 shadow-xl`}>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                            activeModal.type === 'error' || activeModal.type === 'delete_confirm' 
                                ? 'bg-red-50 text-red-500' // Error or Delete = Red
                                : (isSpecial ? 'bg-green-500/20 text-green-500' : 'bg-teal-100 text-teal-600') // Success = Teal/Green
                        }`}>
                            {activeModal.type === 'error' || activeModal.type === 'delete_confirm' 
                                ? <AlertTriangle size={32} /> 
                                : <CheckCircle2 size={32} />
                            }
                        </div>
                        <h3 className={`font-bold text-xl mb-2 text-center ${
                            activeModal.type === 'error' || activeModal.type === 'delete_confirm' 
                                ? 'text-red-600' : theme.textMain
                        }`}>
                            {activeModal.title}
                        </h3>
                        <p className={`text-sm mb-6 text-center leading-relaxed whitespace-pre-wrap ${theme.textSub}`}>
                            {activeModal.message}
                        </p>
                        
                        {activeModal.type === 'delete_confirm' ? (
                            <div className="flex gap-3">
                                <button onClick={() => setActiveModal(null)} className={`flex-1 py-3 font-bold rounded-xl ${isSpecial ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`}>キャンセル</button>
                                <button onClick={handleWithdrawal} disabled={updating} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200">
                                    {updating ? '処理中...' : '退会する'}
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => {
                                    if (activeModal.type === 'success' && activeModal.title === '退会完了') {
                                        handleFinalLogout();
                                    } else {
                                        setActiveModal(null);
                                    }
                                }}
                                className={`w-full py-3 font-bold rounded-xl shadow-lg transition-colors ${
                                    activeModal.type === 'error' 
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : (isSpecial ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-800 text-white hover:bg-slate-700')
                                }`}
                            >
                                OK
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
