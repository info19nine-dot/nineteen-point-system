import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useSupabase } from '../../contexts/SupabaseContext';
import { ArrowLeft, Loader2, QrCode, ShieldCheck, UserCheck, CheckCircle2, XCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

const SpecialMembership = () => {
    const { profile, loading: authLoading } = useSupabase(); // Assume profile is auto-updated by Context
    const navigate = useNavigate();

    // Local state for form
    const [phone, setPhone] = useState('');
    const [birthdate, setBirthdate] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [submitting, setSubmitting] = useState(false);
    const [activeModal, setActiveModal] = useState<{
        type: 'success' | 'error' | 'cancel_confirm';
        title?: string;
        message?: string;
    } | null>(null);
    
    // Derived state
    const isLoading = authLoading || !profile;
    const membershipStatus = profile?.membership_status || 'none';
    const rank = profile?.rank || 'regular';

    // Back handler
    const handleBack = () => navigate('/member');

    // Timer for clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Submit Application
    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;
        setSubmitting(true);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    phone,
                    birthdate,
                    membership_status: 'pending',
                    application_date: new Date().toISOString()
                })
                .eq('id', profile.id);

            if (error) throw error;
            
            // Note: Realtime subscription in Context should update 'profile' automatically.
            // But we can force a reload or just wait.
            // For smoother UX, we might want to manually update purely for display if Realtime lags.
            setActiveModal({
                type: 'success',
                title: '申請完了！',
                message: '申請を受け付けました。\n次回ご来店時にスタッフへお声がけください。'
            });
        } catch (err: any) {
            console.error(err);
            setActiveModal({
                type: 'error',
                title: '申請失敗',
                message: '申請に失敗しました: ' + err.message
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Cancel Application Logic
    const executeCancel = async () => {
        setActiveModal(null);
        if (!profile) return;
        setSubmitting(true);
        try {
             const { error } = await supabase
                .from('profiles')
                .update({
                    membership_status: 'none',
                    application_date: null
                })
                .eq('id', profile.id);
             if (error) throw error;

             // Reset States on Cancel
             setPhone('');
             setBirthdate('');
             setActiveModal({
                 type: 'success',
                 title: '取り消し完了',
                 message: '申請を取り消しました。'
             });
             
        } catch (err: any) {
            console.error(err);
            setActiveModal({
                type: 'error',
                title: '取り消し失敗',
                message: '取り消しに失敗しました: ' + err.message
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        setActiveModal({
            type: 'cancel_confirm',
            title: '申請を取り消しますか？',
            message: '申請を取り消すと、入力した情報はリセットされます。\nよろしいですか？'
        });
    };

    // Application QR Payload
    // Unique prefix 'APPLY:' to distinguish from Point Calculation QR
    const applicationQrData = profile ? JSON.stringify({
        type: 'APPLY', // Dedicated type
        memberId: profile.id,
        timestamp: Date.now()
    }) : '';


    // --- RENDER ---

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-teal-600" size={32} />
            </div>
        );
    }

    // STATE 3: APPROVED (SPECIAL MEMBER) -> Digital Certificate
    if (rank === 'special') {
        return (
            <div className="min-h-screen bg-[#020202] text-white relative overflow-hidden flex flex-col items-center justify-center p-6">
                {/* Ambient Light Effects - Stronger for separation */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-yellow-600/20 blur-[100px] rounded-full pointer-events-none z-0"></div>
                <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-gradient-to-br from-yellow-900/10 via-transparent to-transparent blur-[120px] rounded-full pointer-events-none"></div>

                {/* Certificate Card - Premium Black Card Style with Thicker Border & Subtle Gradient */}
                <div className="relative z-10 w-full max-w-sm aspect-[1/1.5] bg-gradient-to-b from-[#1c1c1c] to-[#0d0d0d] rounded-[24px] p-8 text-center shadow-[0_0_60px_-10px_rgba(234,179,8,0.25)] border-[3px] border-yellow-600/80 overflow-hidden group transition-all hover:scale-[1.01] duration-500">
                    
                    {/* Metallic Shine on Border (Inner Ring) */}
                    <div className="absolute inset-0 rounded-[21px] border border-yellow-400/20 pointer-events-none"></div>

                    {/* Subtle Texture/Noise Overlay */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
                    
                    {/* Header */}
                    <div className="relative w-full mt-6">
                        {/* Emblem */}
                        <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-b from-yellow-200 to-yellow-600 p-[2px] shadow-[0_0_25px_rgba(234,179,8,0.5)] mb-6 animate-pulse-slow">
                             <div className="w-full h-full rounded-full bg-black flex items-center justify-center relative overflow-hidden">
                                  <div className="absolute inset-0 bg-gradient-to-tr from-yellow-900/40 to-transparent"></div>
                                  <ShieldCheck size={40} className="text-yellow-400 relative z-10 drop-shadow-md" />
                             </div>
                        </div>

                        <h1 className="text-2xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-300 to-yellow-600 tracking-[0.15em] uppercase mb-1 drop-shadow-sm">
                            Premium
                        </h1>
                        <h2 className="text-lg font-serif font-bold text-yellow-500 tracking-[0.2em] mb-6 text-shadow-gold">
                            特別会員
                        </h2>
                        
                        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-800/50 to-transparent shadow-[0_1px_0_rgba(255,255,255,0.1)]"></div>
                    </div>

                    {/* Member Details */}
                    <div className="relative w-full py-4">
                        <p className="text-xs text-yellow-700 uppercase tracking-widest mb-2 font-medium">氏名</p>
                        <p className="text-3xl font-serif font-bold text-white tracking-wide drop-shadow-md mb-6">{profile.name}</p>
                        
                        <div className="flex justify-between items-end px-4">
                             <div className="text-left">
                                 <p className="text-[10px] text-yellow-700 uppercase tracking-widest mb-1 font-bold">会員No</p>
                                 <p className="text-2xl font-serif text-yellow-500 font-bold tracking-widest tabular-nums">{profile.member_code}</p>
                             </div>
                             <div className="text-right flex items-end">
                                  {profile.membership_expiry ? (
                                      <div>
                                          <p className="text-[10px] text-yellow-700 uppercase tracking-widest mb-1 font-bold">有効期限</p>
                                          <p className="text-sm font-serif font-bold text-yellow-100/80 tracking-widest">
                                              {new Date(profile.membership_expiry).toLocaleDateString('ja-JP', {year: 'numeric', month: '2-digit', day: '2-digit'})}
                                          </p>
                                      </div>
                                  ) : (
                                      <QrCode size={42} className="text-yellow-900/40" />
                                  )}
                             </div>
                        </div>
                    </div>

                    {/* Live Status (Bottom Area) */}
                    {/* Live Status (Bottom Area) - Anti-Screenshot */}
                    <div className="relative w-full mt-4">
                         <div className="w-full bg-[#0a0a0a]/90 border border-green-900/30 rounded-xl p-2 backdrop-blur-sm shadow-inner overflow-hidden relative group">
                             <div className="flex flex-col items-center justify-center my-1 relative z-10 w-full">
                                 {/* Status Indicator (Pulse Only) */}
                                 <div className="flex items-center gap-2 mb-1">
                                     <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></div>
                                     <div className="w-1.5 h-1.5 bg-green-500 rounded-full absolute"></div>
                                 </div>
                                 
                                 {/* Clock Only */}
                                 <div className="text-3xl font-serif font-bold text-white tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] tabular-nums leading-none mb-1">
                                     {currentTime.toLocaleTimeString('ja-JP', { hour12: false })}
                                 </div>
                                 {/* Date Restored */}
                                 <div className="text-[10px] text-green-500/80 font-mono tracking-widest uppercase">
                                     {currentTime.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')}
                                 </div>
                             </div>
                             {/* Scanline Effect */}
                             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent animate-scan pointer-events-none"></div>
                         </div>
                    </div>

                    {/* Glossy Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none rounded-[24px]"></div>
                </div>

                <button onClick={handleBack} className="mt-8 text-white/50 hover:text-white px-6 py-2 rounded-full border border-white/10 hover:bg-white/10 transition-all text-sm z-10">
                    ← 戻る
                </button>
            </div>
        );
    }

    // STATE 2: PENDING (APPLICATION SUBMITTED) -> Show QR
    if (membershipStatus === 'pending') {
        return (
            <div className="min-h-screen bg-slate-50 relative pb-20">
                {/* Header */}
                <div className="bg-teal-600 pt-12 pb-24 rounded-b-[40px] shadow-lg relative overflow-hidden">
                    <div className="absolute top-4 left-4 z-20">
                         <button onClick={handleBack} className="text-white/80 hover:text-white p-2 bg-black/10 rounded-full backdrop-blur transition-colors">
                            <ArrowLeft size={24} />
                        </button>
                    </div>
                    <div className="text-center relative z-10 text-white px-6">
                         <h1 className="text-2xl font-bold mb-2">申請受け付け中</h1>
                         <p className="text-teal-100 text-sm opacity-90">以下のQRコードをスタッフにご提示ください</p>
                    </div>
                </div>

                <div className="max-w-sm mx-auto px-6 -mt-16 relative z-20">
                    <div className="bg-white rounded-3xl p-8 shadow-xl text-center space-y-6">
                         <div className="bg-teal-50 p-6 rounded-2xl inline-block">
                             <QRCodeCanvas 
                                value={applicationQrData}
                                size={200}
                                level={"H"}
                                bgColor={"#f0fdfa"}
                                fgColor={"#0d9488"}
                            />
                         </div>
                         
                         <div>
                             <h3 className="font-bold text-slate-800 text-lg mb-2">承認待ちです</h3>
                             <p className="text-sm text-gray-500 leading-relaxed">
                                 このQRコードを来店時にスタッフに見せてください。<br/>
                                 承認されると特別会員証が有効になります。
                             </p>
                         </div>

                         <div className="pt-4 border-t border-gray-100 space-y-4">
                             <div className="flex items-center justify-center gap-2 text-gray-400 text-xs">
                                 <UserCheck size={14} />
                                 <span>スタッフ確認後にランクアップします</span>
                             </div>

                             <button 
                                onClick={handleCancel}
                                disabled={submitting}
                                className="text-red-400 text-xs font-bold flex items-center justify-center gap-1 mx-auto hover:text-red-500 transition-colors disabled:opacity-50"
                             >
                                <XCircle size={14} />
                                申請を取り消す
                             </button>
                         </div>
                    </div>
                </div>

                {/* Unified Modal (Cancel Only in this view) */}
                {activeModal && activeModal.type === 'cancel_confirm' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in p-4">
                        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl transform transition-all scale-100">
                            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-500">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-2">{activeModal.title}</h3>
                            <p className="text-gray-500 text-sm mb-8 leading-relaxed whitespace-pre-wrap">
                                {activeModal.message}
                            </p>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setActiveModal(null)}
                                    className="w-full py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button 
                                    onClick={executeCancel} 
                                    className="w-full bg-red-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-200 active:scale-95 transition-transform"
                                >
                                    取り消す
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // STATE 1: REGULAR (NOT APPLIED) -> Application Form
    return (
        <div className="min-h-screen bg-slate-50 relative pb-20 font-sans">
             {/* Header */}
             <div className="bg-slate-900 pt-12 pb-24 rounded-b-[40px] shadow-lg relative overflow-hidden text-center text-white">
                 <div className="absolute top-4 left-4 z-20">
                     <button onClick={handleBack} className="text-white/80 hover:text-white p-2 bg-white/10 rounded-full backdrop-blur transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                </div>
                 <h1 className="text-2xl font-bold mb-2 tracking-wider">特別会員証</h1>
                 <p className="text-white/60 text-sm">特別会員アップグレード申請</p>
             </div>

             <div className="max-w-sm mx-auto px-6 -mt-16 relative z-20">
                 <form onSubmit={handleApply} className="bg-white rounded-3xl p-8 shadow-xl space-y-6">
                     <div className="text-center">
                         <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600">
                             <ShieldCheck size={32} />
                         </div>
                         <h2 className="font-bold text-slate-800">申請情報を入力</h2>
                         <p className="text-xs text-gray-400 mt-1">正確な情報をご入力ください</p>
                     </div>

                     <div className="space-y-4">
                         <div>
                             <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">お名前 (登録済み)</label>
                             <input 
                                type="text" 
                                value={profile.name} 
                                disabled 
                                className="w-full bg-gray-100 text-gray-500 rounded-xl px-4 py-3 text-sm font-bold border border-transparent"
                             />
                         </div>

                         <div>
                             <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">電話番号 <span className="text-red-500">*</span></label>
                             <input 
                                type="tel" 
                                required
                                placeholder="090-1234-5678"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 outline-none transition-all"
                             />
                         </div>

                         <div>
                             <label className="block text-xs font-bold text-slate-700 mb-1 ml-1">生年月日 <span className="text-red-500">*</span></label>
                             <input 
                                type="date" 
                                required
                                value={birthdate}
                                onChange={(e) => setBirthdate(e.target.value)}
                                className="w-full bg-slate-50 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold border border-slate-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 outline-none transition-all"
                             />
                         </div>
                     </div>

                     <button 
                        type="submit" 
                        disabled={submitting}
                        className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                     >
                         {submitting ? <Loader2 className="animate-spin" size={20} /> : '申し込む'}
                     </button>
                     
                     <p className="text-center text-[10px] text-gray-400">
                         申請後、来店時にスタッフによる承認が必要です。
                     </p>
                 </form>
             </div>

             {/* Unified Modal (Success / Error / Cancel) */}
             {activeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl transform transition-all scale-100">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                            activeModal.type === 'error' ? 'bg-red-50 text-red-500' : 
                            (activeModal.type === 'cancel_confirm' ? 'bg-orange-50 text-orange-500' : 'bg-teal-50 text-teal-600')
                        }`}>
                            {activeModal.type === 'error' ? <AlertTriangle size={40} /> : 
                             (activeModal.type === 'cancel_confirm' ? <AlertCircle size={40} /> : <CheckCircle2 size={40} />)}
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">{activeModal.title}</h3>
                        <p className="text-gray-500 text-sm mb-8 leading-relaxed whitespace-pre-wrap">
                            {activeModal.message}
                        </p>
                        
                        {activeModal.type === 'cancel_confirm' ? (
                             <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setActiveModal(null)}
                                    className="w-full py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button 
                                    onClick={executeCancel} 
                                    className="w-full bg-red-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-200 active:scale-95 transition-transform"
                                >
                                    取り消す
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={() => setActiveModal(null)} 
                                className={`w-full text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-transform ${
                                    activeModal.type === 'error' ? 'bg-slate-800 shadow-slate-200' : 'bg-teal-600 shadow-teal-200'
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

export default SpecialMembership;
