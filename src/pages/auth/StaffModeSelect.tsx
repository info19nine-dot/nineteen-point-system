import { useNavigate } from 'react-router-dom';
import { Store, Monitor, ChevronRight, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { STAFF_LOGIN_PATH } from '../../lib/routes';

const LoginCard = ({
    title,
    desc,
    icon: Icon,
    type,
    onSelect,
}: {
    title: string;
    desc: string;
    icon: typeof Store;
    type: 'store' | 'office';
    onSelect: (type: 'store' | 'office') => void;
}) => (
    <button
        onClick={() => onSelect(type)}
        className="group relative w-full p-1 rounded-2xl transition-all duration-300 hover:scale-[1.02] focus:outline-none"
    >
        <div
            className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${
                type === 'store' ? 'from-emerald-400 to-teal-500' : 'from-indigo-400 to-purple-500'
            } opacity-0 group-hover:opacity-100 transition-opacity blur-sm duration-300`}
        />
        <div className="relative h-full bg-slate-800 border border-slate-700 rounded-xl p-6 flex items-center justify-between gap-4 overflow-hidden group-hover:bg-slate-800/90 transition-colors">
            <div
                className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full ${
                    type === 'store' ? 'bg-emerald-500/10' : 'bg-indigo-500/10'
                } blur-xl transition-transform group-hover:scale-150 duration-500`}
            />
            <div className="flex items-center gap-5 z-10">
                <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
                        type === 'store' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'
                    }`}
                >
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

const StaffModeSelect = () => {
    const navigate = useNavigate();
    const { logout } = useSupabase();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleModeSelect = (type: 'store' | 'office') => {
        if (type === 'store') {
            navigate('/admin');
        } else {
            navigate('/admin/office');
        }
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout({ redirectTo: STAFF_LOGIN_PATH });
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F172A] p-6 font-sans relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-purple-500 to-indigo-500 opacity-50" />

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
                        onSelect={handleModeSelect}
                    />
                    <LoginCard
                        title="OFFICE MODE"
                        desc="顧客データ管理・分析設定"
                        icon={Monitor}
                        type="office"
                        onSelect={handleModeSelect}
                    />
                </div>

                <div className="text-center pt-8">
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="text-slate-500 hover:text-white text-sm flex items-center justify-center gap-2 mx-auto transition-colors disabled:opacity-50"
                    >
                        <LogOut size={16} />
                        {isLoggingOut ? 'ログアウト中...' : 'ログアウト'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StaffModeSelect;
