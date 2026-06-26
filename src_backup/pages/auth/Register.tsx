import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Link } from 'react-router-dom';
import { Mail, Lock, User, AlertCircle, CheckCircle, Phone, Calendar } from 'lucide-react';

const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    // Special Membership State
    const [isSpecial, setIsSpecial] = useState(false);
    const [phone, setPhone] = useState('');
    const [birthdate, setBirthdate] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Prepared Metadata
            const metadata: any = {
                name: name,
            };

            if (isSpecial) {
                metadata.phone = phone;
                metadata.birthdate = birthdate;
                metadata.membership_status = 'pending';
                metadata.application_date = new Date().toISOString();
                // We keep rank as 'regular' initially. Staff approves it.
            }

            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: metadata,
                },
            });

            if (signUpError) throw signUpError;

            setSuccess(true);
        } catch (err: any) {
            console.error(err);
            setError(err.message || '登録中にエラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
                    <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">確認メールを送信しました</h2>
                    <p className="text-slate-600 mb-8">
                        ご入力いただいたメールアドレスに確認用リンクを送信しました。<br/>
                        メール内のリンクをクリックして登録を完了してください。
                    </p>
                    <Link to="/login" className="block w-full bg-teal-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-teal-700 transition-colors">
                        ログイン画面へ戻る
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-slate-800 tracking-wider">NEW ACCOUNT</h1>
                    <p className="text-slate-400 text-sm font-bold">新規会員登録</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 flex items-center gap-2 text-sm font-bold border border-red-100">
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-5">
                    <div className="space-y-4">
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input 
                                type="text"
                                placeholder="お名前 (表示名)" 
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 font-medium"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

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
                        
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input 
                                type="password" 
                                placeholder="パスワード (6文字以上)" 
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50 font-medium"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                minLength={6}
                                required
                            />
                        </div>
                    </div>

                    {/* Special Membership Application */}
                    <div className="bg-white border border-yellow-200 rounded-xl p-4 shadow-sm transition-all hover:shadow-md hover:border-yellow-300">
                        <div className="flex items-center gap-3 mb-2">
                             <input
                                id="apply-special"
                                type="checkbox"
                                className="w-5 h-5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400 cursor-pointer"
                                checked={isSpecial}
                                onChange={(e) => setIsSpecial(e.target.checked)}
                             />
                             <label htmlFor="apply-special" className="font-bold text-slate-700 cursor-pointer select-none flex-1">
                                 特別会員として申し込む
                                 <span className="block text-xs text-yellow-600 font-normal mt-0.5">※追加情報の入力が必要です</span>
                             </label>
                        </div>

                        {/* Conditional Fields */}
                        <div className={`space-y-4 overflow-hidden transition-all duration-300 ${isSpecial ? 'max-h-60 mt-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-500" size={20} />
                                <input 
                                    type="tel"
                                    placeholder="電話番号" 
                                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-yellow-50/30 text-sm"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required={isSpecial}
                                />
                            </div>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-500" size={20} />
                                <input 
                                    type="date"
                                    placeholder="生年月日" 
                                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-yellow-50/30 text-sm text-gray-600"
                                    value={birthdate}
                                    onChange={(e) => setBirthdate(e.target.value)}
                                    required={isSpecial}
                                />
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-center text-gray-400 leading-relaxed">
                        アカウントを作成することで、利用規約と<br/>プライバシーポリシーに同意したものとみなされます。
                    </p>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold shadow-lg shadow-slate-800/20 hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? '処理中...' : '登録する'}
                    </button>
                </form>
                
                <div className="mt-8 text-center">
                    <Link to="/login" className="text-teal-600 font-bold hover:underline text-sm">
                        すでにアカウントをお持ちの方はこちら
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
