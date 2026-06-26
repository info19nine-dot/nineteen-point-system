import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const ConfirmEmail = () => {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        // Supabase handles the token verification automatically via hash fragment.
        // We just need to check if the session is active and the user is verified.
        
        const checkSession = async () => {
            // Give Supabase client a moment to process the hash
            setTimeout(async () => {
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error) {
                    console.error('Session error:', error);
                    setStatus('error');
                    setErrorMessage(error.message);
                    return;
                }

                if (session) {
                    // Success (Logging is handled by backend trigger on profile/memo update)
                    setStatus('success');
                } else {
                    // If no session found, it might be an expired link or direct access
                    setStatus('error');
                    setErrorMessage('有効なセッションが見つかりません。リンクが期限切れの可能性があります。');
                }
            }, 1000);
        };

        checkSession();
    }, []);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center space-y-6">
                    <Loader2 className="mx-auto text-teal-500 animate-spin" size={48} />
                    <h2 className="text-xl font-bold text-slate-800">確認中...</h2>
                    <p className="text-slate-500">
                        メールアドレスの変更を確認しています。
                    </p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center space-y-6">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">エラーが発生しました</h2>
                    <p className="text-slate-500">
                        {errorMessage || '不明なエラーが発生しました'}
                    </p>
                    <Link 
                        to="/member/settings" 
                        className="block w-full bg-gray-600 text-white py-3 rounded-xl font-bold hover:bg-gray-700 transition-colors"
                    >
                        設定画面へ戻る
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center space-y-6">
                <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={32} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">変更完了</h2>
                <p className="text-slate-500">
                    メールアドレスの変更が完了しました。<br/>
                    新しいメールアドレスでご利用いただけます。
                </p>
                <Link 
                    to="/member/settings" 
                    className="block w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors"
                >
                    設定画面へ戻る
                </Link>
                <Link 
                    to="/member" 
                    className="block w-full text-teal-600 font-bold hover:underline"
                >
                    マイページへ
                </Link>
            </div>
        </div>
    );
};

export default ConfirmEmail;
