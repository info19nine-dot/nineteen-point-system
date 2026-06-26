import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';

const UpdatePassword = () => {

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Initial check to ensure session exists (Supabase handles the hash fragment automatically)
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If accessed directly without a valid link/session, redirect to login
                // However, wait a bit as the client might be processing the hash
                setTimeout(async () => {
                    const { data: { session: delayedSession } } = await supabase.auth.getSession();
                    if (!delayedSession) {
                        setError('有効なセッションが見つかりません。パスワードリセットメールのリンクから再度アクセスしてください。');
                    }
                }, 1000);
            }
        };
        checkSession();
    }, []);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < 6) {
            setError('パスワードは6文字以上で入力してください');
            return;
        }

        if (password !== confirmPassword) {
            setError('パスワードが一致しません');
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({ 
                password: password 
            });

            if (error) throw error;

            setSuccess(true);
            
            // Log outcome (optional, but good for tracking)
            console.log('Password updated successfully');

        } catch (err: any) {
            console.error('Password update error:', err);
            setError(err.message || 'パスワードの更新に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center space-y-6">
                    <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">変更完了</h2>
                    <p className="text-slate-500">
                        パスワードの再設定が完了しました。<br/>
                        新しいパスワードでログインしてください。
                    </p>
                    <Link 
                        to="/login" 
                        className="block w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors"
                    >
                        ログインページへ移動
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-6">
                <div className="text-center">
                    <h1 className="text-xl font-bold text-slate-800">新しいパスワードの設定</h1>
                    <p className="text-sm text-slate-500 mt-2">
                        新しいパスワードを入力してください。
                    </p>
                </div>

                <form onSubmit={handleUpdate} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input 
                                type={showPassword ? "text" : "password"}
                                placeholder="新しいパスワード (6文字以上)"
                                className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 font-medium"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input 
                                type={showPassword ? "text" : "password"}
                                placeholder="パスワードの確認"
                                className="w-full pl-10 pr-12 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 font-medium"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </div>
                    </div>

                    <button 
                        disabled={isLoading}
                        className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-teal-200 hover:bg-teal-700 transition-all disabled:opacity-50"
                    >
                        {isLoading ? '更新中...' : 'パスワードを変更'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default UpdatePassword;
