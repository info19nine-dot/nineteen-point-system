import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useSupabase } from '../../contexts/SupabaseContext';
import { ChevronLeft, Save, Ban, History, RefreshCw, AlertTriangle, CheckCircle2, AlertCircle, Star, StarOff, ChevronDown } from 'lucide-react';

type Transaction = {
    id: string; // UUID
    type: 'EARN' | 'USE' | 'INFO';
    amount: number;
    description: string;
    created_at: string;
    is_cancelled: boolean;
    served_by?: string; // NEW: Stylist Name
};

type MemberDetailData = {
    id: string;
    name: string;
    member_code: string;
    email: string;
    points: number;
    role: string;
    staff_memo: string | null;
    is_blacklisted: boolean;
    rank?: 'regular' | 'special';
    phone?: string;
    birthdate?: string;
    transactions: Transaction[];
};

type ActiveModal = {
    type: 'success' | 'error' | 'confirm' | 'cancel_confirm' | 'blacklist_action' | 'rank_action';
    title: string;
    message: string;
    onConfirm?: () => void;
    data?: any;
};

const INITIAL_VISIBLE_COUNT = 5;


const MemberDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { session } = useSupabase();
    
    const [member, setMember] = useState<MemberDetailData | null>(null);
    const [memo, setMemo] = useState('');
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Pagination State
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
    const [totalTxCount, setTotalTxCount] = useState(0);

    // Point Adjustment State
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [adjustReason, setAdjustReason] = useState('');

    const [adjustAmount, setAdjustAmount] = useState<string>('');
    const [adjustType, setAdjustType] = useState<'EARN' | 'USE'>('EARN');
    const [staffName, setStaffName] = useState(''); // Operator (Required)
    const [servedBy, setServedBy] = useState('');   // Stylist (Optional)

    // Cancellation State
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancellingTx, setCancellingTx] = useState<Transaction | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const executeAdjustment = async (force: boolean = false) => {
        if (!id || !member || !adjustAmount) return;
        const amount = parseInt(adjustAmount);
        if (isNaN(amount) || amount <= 0) {
            setActiveModal({ type: 'error', title: '入力エラー', message: '正しい金額を入力してください' });
            return;
        }

        // --- UPDATE MODE (Red-Black Correction) ---
        if (editingTx) {
            const isPointChanged = amount !== editingTx.amount;
            
            // Validation for UPDATE
            if (!staffName.trim() || !adjustReason.trim()) {
                setActiveModal({ type: 'error', title: '入力エラー', message: '修正時は、担当者名と修正理由が必須です' });
                return;
            }

            // Calculate Net Change for Validation
            let adjustedBalance = member.points;
            // Revert original effect
            if (editingTx.type === 'EARN') adjustedBalance -= editingTx.amount;
            else adjustedBalance += editingTx.amount;
            
            // Apply new effect (Use editingTx.type)
            const newType = editingTx.type; 
            if (newType === 'EARN') adjustedBalance += amount;
            else adjustedBalance -= amount;

            // Check for negative balance
            if (adjustedBalance < 0 && !force) {
                setActiveModal({
                    type: 'confirm',
                    title: '残高マイナス確認',
                    message: `修正によりポイント残高がマイナスになります（${adjustedBalance}pt）。\n続行しますか？`,
                    onConfirm: () => executeAdjustment(true)
                });
                return;
            }

            // Determine Original Course Name
            let originalCourse = '';
            const currentDesc = editingTx.description || '';
            const courseMatch = currentDesc.match(/\(元コース: ([^)]+)\)/);
            if (courseMatch) {
                originalCourse = courseMatch[1];
            } else {
                let cleaned = currentDesc.replace(/\(元: \d+pt\)/, '').trim();
                // Clean up previous correction markers if any
                cleaned = cleaned.replace(/^【修正:[^】]+】/, '').trim();
                
                if (cleaned.includes('【利用】')) {
                     // Keep core description
                     cleaned = cleaned.replace('【利用】', '').trim();
                }
                
                if (cleaned.includes('Course QR:')) {
                    originalCourse = 'コース利用';
                } else if (!cleaned.startsWith('【調整')) {
                    originalCourse = cleaned;
                }
            }

            // 1. Cancel Original Transaction
            const { error: cancelError } = await supabase
                .from('transactions')
                .update({ is_cancelled: true })
                .eq('id', editingTx.id);

            if (cancelError) {
                setActiveModal({ type: 'error', title: 'エラー', message: '元の取引の取消に失敗しました' });
                return;
            }

            // 2. Insert New Transaction
            const newDescription = `【修正:${staffName}】${adjustReason} ${isPointChanged ? `(元: ${editingTx.amount}pt)` : ''}${originalCourse ? ` (元コース: ${originalCourse})` : ''}`;
            
            const { error: insertError } = await supabase
                .from('transactions')
                .insert({
                    member_id: id,
                    type: newType,
                    amount: amount,
                    description: newDescription,
                    served_by: servedBy || null,
                    is_cancelled: false
                });

            if (insertError) {
                setActiveModal({ type: 'error', title: 'エラー', message: '修正取引の記録に失敗しました（元取引は取消済）' });
                return;
            }

            setEditingTx(null);
            setShowAdjustModal(false);
            setActiveModal({ type: 'success', title: '修正完了', message: '取引を修正（赤黒訂正）しました。' });
        } 
        // --- INSERT MODE ---
        else {
            if (!staffName.trim() || !adjustReason.trim()) {
                setActiveModal({ type: 'error', title: '入力エラー', message: '担当者名と修正理由は必須です' });
                return;
            }

            if (adjustType === 'USE' && member.points < amount && !force) {
                 setActiveModal({
                    type: 'confirm',
                    title: '残高マイナス確認',
                    message: `ポイントが不足しています（残高: ${member.points}pt）。\nマイナスになりますが続行しますか？`,
                    onConfirm: () => executeAdjustment(true)
                });
                return;
            }

            const description = `【調整:${staffName}】${adjustReason}`;

            const { error: txError } = await supabase.from('transactions').insert({
                member_id: id,
                type: adjustType, // Use the selected type directly
                amount: amount,
                description: description,
                is_cancelled: false,
                served_by: servedBy || null
            });

            if (txError) {
                setActiveModal({ type: 'error', title: 'エラー', message: '取引の記録に失敗しました' });
                return;
            }

            // Remove manual profile update (Trigger handles it)
            setShowAdjustModal(false);
            setActiveModal({ type: 'success', title: '完了', message: 'ポイント補正が完了しました' });
        }
        
        // Cleanup
        setAdjustAmount('');
        setAdjustReason('');
        setStaffName('');
        setServedBy('');
        // Delay fetch to allow trigger to settle? Usually fast enough.
        setTimeout(fetchMemberData, 500); 
    };





    const fetchMemberData = async () => {
        if (!id) return;
        setIsLoading(true);
        
        const profileQuery = supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        const txQuery = supabase
            .from('transactions')
            .select('*', { count: 'exact' })
            .eq('member_id', id)
            .order('created_at', { ascending: false })
            .range(0, 99); // Fetch up to 100 initially for smooth UX

        const [
            { data: profile, error: profileError },
            { data: transactions, error: txError, count: txCount }
        ] = await Promise.all([profileQuery, txQuery]);
            
        if (profileError || !profile) {
            console.error('Error fetching member:', profileError);
            setIsLoading(false);
            return;
        }

        if (txError) {
             console.error('Error fetching transactions:', txError);
        } else {
             setTotalTxCount(txCount || 0);
        }

        // Add 'role' and other missing properties from profile to satisfy MemberDetailData if needed, 
        // or ensure profile matches. For now assuming profile has everything except transactions.
        setMember({ ...profile, transactions: transactions || [] });
        setMemo(profile.staff_memo || '');
        setIsLoading(false);
    };

    // Initial Load & Realtime Subscription
    useEffect(() => {
        fetchMemberData();

        if (!id) return;

        const channel = supabase
            .channel(`member_detail_${id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'transactions',
                    filter: `member_id=eq.${id}`
                },
                () => {
                    fetchMemberData();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${id}`
                },
                () => {
                    fetchMemberData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id]);

    if (!session) return <div>アクセス権限がありません</div>;
    if (isLoading) return <div className="p-8 text-center"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto" /></div>;
    if (!member) return <div className="p-8 text-center text-gray-500">会員が見つかりません</div>;

    const handleSaveMemo = async () => {
        if (!id) return;
        const { error } = await supabase
            .from('profiles')
            .update({ staff_memo: memo })
            .eq('id', id);

        if (error) {
            setActiveModal({
                type: 'error',
                title: '保存失敗',
                message: 'メモの保存に失敗しました'
            });
        } else {
            setIsDirty(false);
            setActiveModal({
                type: 'success',
                title: '保存完了',
                message: 'スタッフ用メモを保存しました'
            });
            fetchMemberData(); // Refresh
        }
    };



    const executeCancelTransaction = async () => {
        if (!id || !member || !cancellingTx) return;
        
        if (!staffName.trim()) {
            setActiveModal({ type: 'error', title: '入力エラー', message: '担当者名(操作者)は必須です' });
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Calculate new point balance
            let newPoints = member.points;
            if (cancellingTx.type === 'EARN') {
                newPoints -= cancellingTx.amount; // Remove earned points
            } else {
                newPoints += cancellingTx.amount; // Refund used points
            }

            if (newPoints < 0) {
                setIsSubmitting(false);
                setShowCancelModal(false);
                setActiveModal({
                    type: 'error',
                    title: '取消不可',
                    message: 'ポイント残高がマイナスになるため取り消せません'
                });
                return;
            }

            // 2. Add 'is_cancelled' column update AND update description with staff name
            const currentDesc = cancellingTx.description || 'なし';
            const newDescription = `【取消:${staffName}】${currentDesc}`;

            const { error: txUpdateError } = await supabase
                .from('transactions')
                .update({ 
                    is_cancelled: true,
                    description: newDescription
                })
                .eq('id', cancellingTx.id);

            if (txUpdateError) {
                throw txUpdateError;
            }

            // 3. Update Profile Points
            // Note: Trigger might handle this, but specific cancellation logic often safe to keep consistent
            // Update: Since we restored triggers, we should let trigger handle it or do re-fetch.
            // But 'is_cancelled' logic in trigger (on_transaction_change) recalculates points.
            // So manual profile update is technically redundant if triggers are active.
            // However, to be extra safe and ensure immediate UI consistency:
            // logic: Trigger runs on UPDATE transactions. 
            // So just updating 'transactions' is enough for DB consistency.
            // But we might want to manually update purely for UI speed or legacy safety.
            // I will comment out manual profile update to rely on trigger/refetch for cleaner architecture,
            // OR keep it for redundancy. Given the previous code kept it, I will keep it but wrap in try.
            
            // Actually, triggers are robust. Let's try relying on trigger + refetch.
            // But if trigger fails... manual update keeps app working. 
            // I'll keep the profile update for now, it doesn't hurt (idempotent-ish).
             const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update({ points: newPoints })
                .eq('id', id);

             if (profileUpdateError) throw profileUpdateError;

            // Success
            setIsSubmitting(false);
            setShowCancelModal(false);
            setCancellingTx(null);
            setStaffName('');
            
            setActiveModal({
                type: 'success',
                title: '取消完了',
                message: '取引を取り消しました'
            });
            fetchMemberData();

        } catch (error) {
            console.error('Cancel error:', error);
            setIsSubmitting(false);
            setShowCancelModal(false);
            setActiveModal({
                type: 'error',
                title: 'エラー',
                message: '取引の取り消しに失敗しました'
            });
        }
    };

    const logSystemTransaction = async (title: string, detail: string) => {
        if (!id) return;
        // Use a 0-point transaction to log system events
        await supabase.from('transactions').insert({
            member_id: id,
            type: 'EARN', // Dummy type
            amount: 0,
            description: `【システム】${title}: ${detail}`,
            is_cancelled: false
        });
        // Refresh Transactions if needed, or rely on fetchMemberData
    };

    const handleBlacklistAction = (action: 'suspend' | 'resume') => {
        if (!id || !member) return;
        setStaffName(''); // Reset staff name
        setActiveModal({
             type: 'blacklist_action',
             title: action === 'suspend' ? '会員の利用停止' : '会員の利用再開',
             message: action === 'suspend' 
                ? 'この会員を利用停止にしますか？\n停止中はアプリへログインできなくなります。' 
                : 'この会員の利用停止を解除しますか？\nアプリへのログインが可能になります。',
             data: { action }
         });
    };

    const executeBlacklistAction = async () => {
        if (!id || !member || !activeModal || activeModal.type !== 'blacklist_action') return;
        
        // Validation for Staff Name
        if (!staffName.trim()) {
             setActiveModal({
                 type: 'error',
                 title: '入力エラー',
                 message: '担当者名(操作者)は必須です'
             });
            return;
        }

        const action = activeModal.data.action;
        const isBlacklisting = action === 'suspend'; // true = suspend, false = resume

        // Update Profile
        const { error } = await supabase.from('profiles').update({ is_blacklisted: isBlacklisting }).eq('id', id);

        if (error) {
            setActiveModal({
                type: 'error',
                title: '更新失敗',
                message: 'ステータスの更新に失敗しました'
            });
        } else {
             // Log History
             logSystemTransaction(
                 isBlacklisting ? '利用停止' : '利用再開', 
                 `担当: ${staffName}`
             );

            setMember(prev => prev ? { ...prev, is_blacklisted: isBlacklisting } : null);
            setActiveModal({
                type: 'success', 
                title: '完了', 
                message: isBlacklisting ? '会員を利用停止にしました' : '会員の利用を再開しました'
            });
            setStaffName('');
        }
    };

    const handleRankAction = (action: 'promote' | 'demote') => {
        if (!id || !member) return;
        setStaffName('');
        setActiveModal({
             type: 'rank_action',
             title: action === 'promote' ? '特別会員への昇格' : '特別会員の解除',
             message: action === 'promote' 
                ? 'この会員を「特別会員」に昇格させますか？\n特別会員向けの特典が付与されます。' 
                : 'この会員を「通常会員」に戻しますか？\n特別会員としての特典はすべて失われます。',
             data: { action }
         });
    };

    const executeRankAction = async () => {
        if (!id || !member || !activeModal || activeModal.type !== 'rank_action') return;
        
        if (!staffName.trim()) {
             setActiveModal({
                 type: 'error',
                 title: '入力エラー',
                 message: '担当者名(操作者)は必須です'
             });
            return;
        }

        const action = activeModal.data.action;
        const newRank = action === 'promote' ? 'special' : 'regular';

        const { error } = await supabase.from('profiles').update({ rank: newRank }).eq('id', id);

        if (error) {
            setActiveModal({
                type: 'error',
                title: '更新失敗',
                message: 'ランクの更新に失敗しました'
            });
        } else {
             logSystemTransaction(
                 'ランク変更', 
                 `${action === 'promote' ? '通常→特別' : '特別→通常'} (担当: ${staffName})`
             );

            setMember(prev => prev ? { ...prev, rank: newRank } : null);
            setActiveModal({
                type: 'success', 
                title: '完了', 
                message: action === 'promote' ? '特別会員へ昇格しました' : '通常会員へ戻しました'
            });
            setStaffName('');
        }
    };

    const handleCancelTransaction = (tx: Transaction) => {
        setCancellingTx(tx);
        setStaffName(''); // Clear previous input
        setShowCancelModal(true);
    };



    const isSpecial = member.rank === 'special';

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
             <div className={`p-6 pb-12 rounded-b-[40px] shadow-lg text-white mb-6 transition-colors duration-300 ${
                 member.is_blacklisted 
                    ? 'bg-slate-600' 
                    : (isSpecial ? 'bg-gradient-to-r from-yellow-600 to-yellow-800' : 'bg-[#2b9b96]')
             }`}>
                <div className="flex items-center gap-4 mb-4 opacity-90">
                    <button onClick={() => navigate(-1)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold tracking-wider">会員詳細設定</h1>
                </div>
            </div>

            <main className="max-w-md mx-auto px-6 -mt-10 relative z-10 space-y-6">
                
                {/* User Profile Card */}
                <div className={`bg-white p-4 rounded-2xl shadow-md border ${isSpecial ? 'border-yellow-400/50 ring-4 ring-yellow-50' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-4 mb-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl shadow-inner ${
                            member.is_blacklisted 
                                ? 'bg-slate-500 text-white' 
                                : (isSpecial ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 text-white ring-2 ring-yellow-100' : 'bg-slate-100 text-slate-500')
                        }`}>
                            {member.name ? member.name[0] : '?'}
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h2 className="text-xl font-bold text-slate-800">
                                    {member.name || '名称未設定'}
                                </h2>
                                {member.is_blacklisted && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 font-bold">停止中</span>}
                                {isSpecial && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200 font-bold uppercase tracking-wider">特別会員</span>}
                            </div>
                            <p className="text-sm text-gray-500 font-mono">ID: {member.member_code}</p>
                            
                            {/* Points Display with Adjustment Button */}
                            {/* Points Display with Adjustment Button */}
                            <div className="flex items-end gap-2">
                                <p className={`font-black text-2xl mt-1 tracking-tight ${isSpecial ? 'text-yellow-600' : 'text-teal-600'}`}>
                                    {member.points?.toLocaleString() || 0}<span className="text-sm ml-1 opacity-70">pt</span>
                                </p>
                                <button 
                                    onClick={fetchMemberData}
                                    className={`mb-1 p-1 transition-colors rounded-full ${isSpecial ? 'text-yellow-400 hover:text-yellow-600 hover:bg-yellow-50' : 'text-teal-500 hover:text-teal-700 hover:bg-teal-50'}`}
                                    title="情報を更新"
                                >
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                        </div>
                        </div>
                        <div className={`p-4 rounded-xl w-full mt-4 ${isSpecial ? 'bg-yellow-50/50 border border-yellow-100' : 'bg-gray-50 border border-gray-100'}`}>
                            {isSpecial ? (
                                <div className="space-y-3 text-sm">
                                    <div className="flex flex-col gap-1 border-b border-yellow-200/50 pb-2">
                                        <span className="text-[10px] uppercase font-bold text-yellow-700 tracking-wider">電話番号</span>
                                        <span className="font-medium text-base text-slate-700 font-mono tracking-wide">{member.phone || 'ー'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 border-b border-yellow-200/50 pb-2">
                                        <span className="text-[10px] uppercase font-bold text-yellow-700 tracking-wider">生年月日</span>
                                        <span className="font-medium text-base text-slate-700 font-mono tracking-wide">{member.birthdate ? new Date(member.birthdate).toLocaleDateString('ja-JP') : 'ー'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] uppercase font-bold text-yellow-700 tracking-wider">メールアドレス</span>
                                        <span className="font-medium text-base text-slate-700 font-mono break-all tracking-tight">{member.email || '未登録'}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-1 text-sm">
                                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">メールアドレス</span>
                                        <span className="font-mono font-medium text-base text-gray-600 break-all tracking-tight">{member.email || '未登録'}</span>
                                    </div>
                                </div>
                            )}

                            {/* Account & Rank Actions (Side by Side) */}
                            <div className={`mt-2 grid grid-cols-2 gap-2`}>
                                {/* Account Status */}
                                    {member.is_blacklisted ? (
                                         <button 
                                            onClick={() => handleBlacklistAction('resume')}
                                            className="w-full py-2.5 text-sm font-bold text-teal-600 hover:text-teal-700 bg-white border border-teal-200 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                                        >
                                            <CheckCircle2 size={16} />
                                            利用を再開する
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleBlacklistAction('suspend')}
                                            className="w-full py-2.5 text-sm font-bold text-red-500 hover:text-red-700 bg-white border border-red-200 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                                        >
                                            <Ban size={16} />
                                            利用を停止する
                                        </button>
                                    )}
                                {/* Rank Management */}


                                    {isSpecial ? (
                                        <button 
                                            onClick={() => handleRankAction('demote')}
                                            className="w-full py-2.5 text-sm font-bold text-orange-600 hover:text-orange-700 bg-white border border-orange-200 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                                        >
                                            <StarOff size={16} />
                                            通常会員に戻す
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleRankAction('promote')}
                                            className="w-full py-2.5 text-sm font-bold text-yellow-600 hover:text-yellow-700 bg-white border border-yellow-200 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                                        >
                                            <Star size={16} fill="currentColor" className="text-yellow-400" />
                                            特別会員にする
                                        </button>
                                    )}
                            </div>
                        </div>
                    </div>



                {/* Staff Memo */}
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
                    <h3 className="font-bold text-gray-600 mb-2 flex items-center gap-2">
                        スタッフ用メモ
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">会員には表示されません</span>
                    </h3>
                    <textarea 
                        className="w-full h-32 p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
                        placeholder="注意点や特記事項を入力..."
                        value={memo}
                        onChange={(e) => {
                            setMemo(e.target.value);
                            setIsDirty(true);
                        }}
                    />
                    <button 
                        onClick={handleSaveMemo}
                        className={`mt-3 w-full font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all ${
                            isDirty 
                                ? 'bg-slate-800 text-white active:scale-95' 
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                        disabled={!isDirty}
                    >
                        <Save size={18} />
                        {isDirty ? 'メモを保存する' : '変更はありません'}
                    </button>
                </div>

                {/* Transaction History & Cancellation */}
                <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <History size={18} className="text-gray-400" />
                            <h3 className="font-bold text-gray-600">取引履歴</h3>
                        </div>
                        {member.transactions && totalTxCount > INITIAL_VISIBLE_COUNT && (
                            <button 
                                onClick={() => setVisibleCount(prev => prev > INITIAL_VISIBLE_COUNT ? INITIAL_VISIBLE_COUNT : totalTxCount)}
                                className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors"
                            >
                                {visibleCount > INITIAL_VISIBLE_COUNT ? '閉じる' : 'すべて見る'} 
                                <ChevronDown size={14} className={`transform transition-transform ${visibleCount > INITIAL_VISIBLE_COUNT ? 'rotate-180' : ''}`} />
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {(member.transactions?.length || 0) === 0 ? (
                            <p className="text-gray-400 text-sm text-center py-4">履歴はありません</p>
                        ) : (
                            member.transactions?.slice(0, visibleCount).map(tx => (
                                <div key={tx.id} className={`p-3 rounded-lg border ${tx.is_cancelled ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-100'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                (tx.description?.includes('【修正') || tx.description?.includes('【調整'))
                                                ? 'bg-orange-100 text-orange-700 border border-orange-200' // Correction
                                                : tx.is_cancelled ? 'bg-gray-100 text-gray-500 border border-gray-200' :
                                                tx.type === 'EARN' 
                                                    ? (isSpecial ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-teal-100 text-teal-700') 
                                                    : tx.type === 'USE' ? 'bg-red-100 text-red-600 border border-red-200'
                                                    : 'bg-blue-50 text-blue-600 border-blue-100' // INFO
                                            }`}>
                                                {(tx.description?.includes('【修正') || tx.description?.includes('【調整')) ? '修正' : 
                                                 (tx.is_cancelled ? '取消済' : 
                                                 tx.type === 'EARN' ? '獲得' : 
                                                 tx.type === 'USE' ? '利用' : '通知')}
                                            </span>
                                            <div className="text-sm font-bold text-gray-600">
                                                {new Date(tx.created_at).toLocaleDateString('ja-JP', {year: '2-digit', month: '2-digit', day: '2-digit'})}
                                                <span className="text-xs opacity-70 font-normal ml-2">
                                                    {new Date(tx.created_at).toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'})}
                                                </span>
                                                {(tx as any).balance_snapshot !== null && (tx as any).balance_snapshot !== undefined && (
                                                    <div className="font-mono text-[10px] text-gray-400 font-normal mt-0.5">
                                                        残高: {(tx as any).balance_snapshot.toLocaleString()} pt
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`font-bold ${
                                            tx.is_cancelled 
                                                ? 'text-gray-400 line-through' 
                                                : (tx.type === 'INFO' ? 'text-gray-400' : (isSpecial ? 'text-slate-800' : 'text-slate-800')) 
                                        }`}>
                                            {(() => {
                                                if (tx.type === 'INFO') return ''; // No points for info
                                                
                                                const match = tx.description?.match(/\(元: (\d+)pt\)/);
                                                const originalAmount = match ? parseInt(match[1]) : null;
                                                
                                                if (originalAmount !== null && !tx.is_cancelled) {
                                                    return (
                                                        <span className="flex items-center gap-2">
                                                            <span className="text-xs text-gray-400 line-through">{originalAmount.toLocaleString()}</span>
                                                            <span>{tx.amount.toLocaleString()} pt</span>
                                                        </span>
                                                    );
                                                }
                                                return `${tx.amount.toLocaleString()} pt`;
                                            })()}
                                        </span>
                                    </div>

                                    <div className="flex items-end justify-between gap-2 mt-1">
                                        {/* Description (Formatted) */}
                                        <div className="pl-1 text-sm text-gray-700 w-full">
                                            <div className="flex items-center gap-2 flex-wrap"> 
                                                <span>
                                                    {(() => {
                                                        const desc = (tx.description || '')
                                                        .replace(/【修正:.*?】/, '') 
                                                        .replace(/【調整:.*?】/, '') 
                                                        .replace(/\(元: \d+pt\)/, '')
                                                        .replace('【利用】', '')
                                                        .replace('Point usage via QR scan', 'ポイント利用') // Add replacement
                                                        .replace('【システム】', '')
                                                        .trim();
                                                    
                                                    if (desc.includes('Course QR:')) return desc.replace('Course QR:', '').trim();
                                                    if (desc === 'Point usage via QR scan' || desc === 'QRコード利用') return 'ポイント利用';
                                                    return desc || (tx.type === 'EARN' ? 'ポイント獲得' : (tx.type === 'USE' ? 'ポイント利用' : '通知'));
                                                })()}</span>
                                                {tx.served_by && tx.served_by !== 'SYSTEM' && <span className="text-xs text-slate-500">{tx.served_by}</span>}
                                            </div>
                                        </div>
                                        
                                        <div className="flex shrink-0 gap-2 mb-0.5">
                                            {tx.is_cancelled ? (
                                                <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded flex items-center gap-1">
                                                    <Ban size={10} /> 取消済み
                                                </span>
                                            ) : (
                                                tx.type !== 'INFO' && (
                                                    <>
                                                        {/* Correction Button Removed as per user request */}
                                                        {/* <button 
                                                            onClick={() => handleOpenEdit(tx)}
                                                            className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 px-3 py-1.5 rounded hover:bg-slate-200 transition-colors"
                                                        >
                                                            修正
                                                        </button> */}
                                                        <button 
                                                            onClick={() => handleCancelTransaction(tx)}
                                                            className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded hover:bg-red-100 transition-colors"
                                                        >
                                                            取り消し
                                                        </button>
                                                    </>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Load More Button Removed (Moved to Header) */}
                </div>

                {/* Adjustment / Edit Modal */}
                {showAdjustModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                            <h3 className="font-bold text-lg text-slate-700 mb-4 text-center">
                                {editingTx ? '取引内容の修正' : 'ポイント手動調整'}
                            </h3>
                            
                            {editingTx ? (
                                <div className={`w-full py-2 text-center font-bold rounded-md ${
                                    editingTx.type === 'EARN' ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'
                                }`}>
                                    {editingTx.type === 'EARN' ? '獲得 (EARN) の修正' : '利用 (USE) の修正'}
                                </div>
                            ) : (
                                <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                                    <button 
                                        onClick={() => setAdjustType('EARN')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${adjustType === 'EARN' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-400'}`}
                                    >
                                        獲得 (EARN)
                                    </button>
                                    <button 
                                        onClick={() => setAdjustType('USE')}
                                        className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${adjustType === 'USE' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-400'}`}
                                    >
                                        利用 (USE)
                                    </button>
                                </div>
                            )}

                            <div className="space-y-4">
                                {/* Amount Input */}
                                {editingTx ? (
                                    <>
                                        <div className="bg-gray-50 p-4 rounded-lg space-y-2 mb-4">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">修正前:</span>
                                                <span className="font-mono">{editingTx.amount.toLocaleString()} pt ({editingTx.type === 'EARN' ? '獲得' : '利用'})</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
                                                <span className="text-gray-700">残高への影響:</span>
                                                <span className={`${
                                                    (() => {
                                                        const oldVal = editingTx.type === 'EARN' ? editingTx.amount : -editingTx.amount;
                                                        const newVal = editingTx.type === 'EARN' ? parseInt(adjustAmount || '0') : -parseInt(adjustAmount || '0');
                                                        const diff = newVal - oldVal;
                                                        return diff >= 0 ? 'text-teal-600' : 'text-red-600';
                                                    })()
                                                }`}>
                                                    {(() => {
                                                        const oldVal = editingTx.type === 'EARN' ? editingTx.amount : -editingTx.amount;
                                                        const newVal = editingTx.type === 'EARN' ? parseInt(adjustAmount || '0') : -parseInt(adjustAmount || '0');
                                                        const diff = newVal - oldVal;
                                                        return diff > 0 ? `+${diff.toLocaleString()} pt` : `${diff.toLocaleString()} pt`;
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <label className="block text-sm font-bold text-gray-700">修正後の金額 (pt)</label>
                                            <input 
                                                type="number" 
                                                inputMode="numeric"
                                                pattern="\d*"
                                                className="w-full text-center text-2xl font-bold py-3 border-b-2 border-slate-200 focus:border-slate-800 outline-none bg-transparent transition-colors"
                                                placeholder="0"
                                                value={adjustAmount}
                                                onChange={(e) => setAdjustAmount(e.target.value)}
                                            />
                                        </div>


                                    </>
                                ) : ( // New transaction mode
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 block mb-1">金額 (pt)</label>
                                            <input 
                                                type="number" 
                                                className="w-full text-2xl font-bold p-2 border-b-2 border-slate-200 focus:border-teal-500 outline-none text-center"
                                                placeholder="0"
                                                value={adjustAmount}
                                                onChange={(e) => setAdjustAmount(e.target.value)}
                                                readOnly={false}
                                            />
                                        </div>
                                    </div>
                                )}
                                
                                {/* Operator (Required only if point changed) */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">担当者名 (操作者) <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 bg-gray-50 rounded-lg text-sm outline-none border focus:border-teal-500"
                                        placeholder="あなたの名前"
                                        value={staffName}
                                        onChange={(e) => setStaffName(e.target.value)}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">※操作記録用です</p>
                                </div>

                                {/* Cast Name (Always Visible) */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">キャスト名 (任意)</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 bg-gray-50 rounded-lg text-sm outline-none border focus:border-teal-500"
                                        placeholder="キャスト名"
                                        value={servedBy}
                                        onChange={(e) => setServedBy(e.target.value)}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">※変更する場合のみ入力</p>
                                </div>

                                {/* Reason (Required only if point changed) */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">理由 <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 bg-gray-50 rounded-lg text-sm outline-none border focus:border-teal-500"
                                        placeholder="例: システムエラー対応"
                                        value={adjustReason}
                                        onChange={(e) => setAdjustReason(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button 
                                    onClick={() => {
                                        setShowAdjustModal(false);
                                        setEditingTx(null);
                                    }}
                                    className="flex-1 py-3 text-sm font-bold text-gray-400 bg-gray-100 rounded-xl hover:bg-gray-200"
                                >
                                    キャンセル
                                </button>
                                <button 
                                    onClick={() => executeAdjustment()}
                                    disabled={!adjustAmount || !adjustReason || !staffName || parseInt(adjustAmount) <= 0}
                                    className={`flex-1 py-3 text-sm font-bold text-white rounded-xl shadow-lg transition-all active:scale-95 ${
                                        !adjustAmount || !adjustReason || !staffName 
                                            ? 'bg-slate-300 shadow-none' 
                                            : ((editingTx ? editingTx.type : adjustType) === 'EARN' ? 'bg-teal-500' : 'bg-red-500')
                                    }`}
                                >
                                    実行
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Unified Active Modal */}
                {activeModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl transform transition-all scale-100">
                             <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                                activeModal.type === 'error' || activeModal.type === 'cancel_confirm' 
                                    ? 'bg-red-50 text-red-500' 
                                    : (activeModal.type === 'confirm' ? 'bg-orange-50 text-orange-500' : 'bg-teal-100 text-teal-600')
                            }`}>
                                {activeModal.type === 'error' || activeModal.type === 'cancel_confirm' ? <AlertTriangle size={32} /> : 
                                 (activeModal.type === 'confirm' ? <AlertCircle size={32} /> : <CheckCircle2 size={32} />)}
                            </div>
                            <h3 className={`font-bold text-xl mb-2 text-center ${
                                activeModal.type === 'error' || activeModal.type === 'cancel_confirm' ? 'text-red-600' : 'text-slate-800'
                            }`}>
                                {activeModal.title}
                            </h3>
                            <p className="text-gray-600 mb-6 text-center whitespace-pre-wrap text-sm leading-relaxed">
                                {activeModal.message}
                            </p>

                            {activeModal.type === 'blacklist_action' && (
                                <div className="mb-6 text-left">
                                    <label className="text-xs font-bold text-gray-500 block mb-1">担当者名 (操作者) <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 bg-gray-50 rounded-lg text-sm outline-none border focus:border-teal-500"
                                        placeholder="あなたの名前"
                                        value={staffName}
                                        onChange={(e) => setStaffName(e.target.value)}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">※操作記録用です</p>
                                </div>
                            )}
                            
                            {activeModal.type === 'rank_action' && (
                                <div className="mb-6 text-left">
                                    <label className="text-xs font-bold text-gray-500 block mb-1">担当者名 (操作者) <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 bg-gray-50 rounded-lg text-sm outline-none border focus:border-teal-500"
                                        placeholder="あなたの名前"
                                        value={staffName}
                                        onChange={(e) => setStaffName(e.target.value)}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">※操作記録用です</p>
                                </div>
                            )}

                            {(activeModal.type === 'confirm' || activeModal.type === 'cancel_confirm' || activeModal.type === 'blacklist_action' || activeModal.type === 'rank_action') && (activeModal.onConfirm || activeModal.data) ? (
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setActiveModal(null)}
                                        className="flex-1 py-3 text-gray-500 font-bold bg-gray-100 rounded-xl hover:bg-gray-200"
                                    >
                                        キャンセル
                                    </button>
                                    <button 
                                        onClick={() => {
                                        if (activeModal.onConfirm) {
                                                activeModal.onConfirm();
                                                setActiveModal(null);
                                            } else {
                                                if (activeModal.type === 'blacklist_action') executeBlacklistAction();
                                                if (activeModal.type === 'rank_action') executeRankAction();
                                            }
                                        }}
                                        className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform ${
                                            activeModal.type === 'cancel_confirm' || (activeModal.type === 'blacklist_action' && activeModal.data?.action === 'suspend') || (activeModal.type === 'rank_action' && activeModal.data?.action === 'demote') ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'
                                        }`}
                                    >
                                        実行
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setActiveModal(null)}
                                    className={`w-full py-3 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 ${
                                        activeModal.type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-teal-500 hover:bg-teal-600'
                                    }`}
                                >
                                    OK
                                </button>
                            )}
                        </div>
                    </div>
                )}


                {/* Cancellation Modal */}
                {showCancelModal && cancellingTx && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 text-red-500">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="font-bold text-lg text-slate-700 mb-2 text-center">
                                取引の取り消し
                            </h3>
                            <p className="text-sm text-gray-500 text-center mb-6">
                                この取引を取り消します。<br/>
                                ポイント残高も元に戻ります。
                            </p>

                            <div className="bg-gray-50 p-3 rounded-lg mb-4 text-sm border border-gray-100">
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-500">日時:</span>
                                    <span className="font-mono text-slate-700">{new Date(cancellingTx.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-gray-500">種別:</span>
                                    <span className={`font-bold ${cancellingTx.type === 'EARN' ? 'text-teal-600' : 'text-red-500'}`}>
                                        {cancellingTx.type === 'EARN' ? '獲得' : '利用'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">金額:</span>
                                    <span className="font-bold text-slate-700">{cancellingTx.amount.toLocaleString()} pt</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">担当者名 (操作者) <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 bg-gray-50 rounded-lg text-sm outline-none border focus:border-teal-500"
                                        placeholder="あなたの名前"
                                        value={staffName}
                                        onChange={(e) => setStaffName(e.target.value)}
                                        disabled={isSubmitting}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">※操作記録用です</p>
                                </div>

                                <div className="flex gap-3 mt-2">
                                    <button 
                                        onClick={() => {
                                            setShowCancelModal(false);
                                            setCancellingTx(null);
                                            setStaffName('');
                                        }}
                                        disabled={isSubmitting}
                                        className="flex-1 py-3 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50"
                                    >
                                        キャンセル
                                    </button>
                                    <button 
                                        onClick={executeCancelTransaction}
                                        disabled={!staffName.trim() || isSubmitting}
                                        className="flex-1 py-3 text-sm font-bold text-white bg-red-500 rounded-xl shadow-lg hover:bg-red-600 active:scale-95 transition-all disabled:bg-slate-300 disabled:shadow-none"
                                    >
                                        {isSubmitting ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                処理中...
                                            </span>
                                        ) : '取り消し実行'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default MemberDetail;
