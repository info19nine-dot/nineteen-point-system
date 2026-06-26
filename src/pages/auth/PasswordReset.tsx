import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

const PasswordReset = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/update-password`,
            });

            if (error) throw error;

            setSuccess(true);
        } catch (err: any) {
            console.error(err);
            setError('メールの送信に失敗しました。時間をおいて再度お試しください。');
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
                    <h2 className="text-2xl font-bold text-slate-800">メールを送信しました</h2>
                    <p className="text-slate-500">
                        {email} 宛にパスワード再設定用のリンクを送信しました。<br/>
                        メールを確認して手続きを進めてください。
                    </p>
                    <Link 
                        to="/login" 
                        className="block w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors"
                    >
                        ログイン画面に戻る
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-6">
                <div className="relative">
                    <Link to="/login" className="absolute -left-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-xl font-bold text-center text-slate-800">パスワードの再発行</h1>
                </div>

                <p className="text-sm text-slate-500 text-center">
                    ご登録のメールアドレスを入力してください。<br/>
                    再設定用リンクをお送りします。
                </p>

                <form onSubmit={handleReset} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}

                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input 
                            type="email" 
                            placeholder="メールアドレス" 
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 font-medium"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <button 
                        disabled={isLoading}
                        className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-teal-200 hover:bg-teal-700 transition-all disabled:opacity-50"
                    >
                        {isLoading ? '送信する' : '再設定メールを送信'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PasswordReset;
