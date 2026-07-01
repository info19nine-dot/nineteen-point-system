
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { extractStaffSignature, formatTransactionDisplayText } from '../../../lib/transactionDisplay';
import { ArrowLeft, Loader2, FileText, CheckCircle2, AlertTriangle, Ban, Home, AlertCircle } from 'lucide-react';
import { Skeleton } from '../../../components/ui/skeleton';

type Transaction = {
    id: string;
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
    is_deleted?: boolean;
    rank?: 'regular' | 'special';
    membership_expiry?: string;
    phone?: string;
    birthdate?: string;
    transactions: Transaction[];
};

const DesktopMemberDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [member, setMember] = useState<MemberDetailData | null>(null);
    const [memo, setMemo] = useState('');
    // const [isDirty, setIsDirty] = useState(false); // Unused in Desktop for now (direct save)
    const [isLoading, setIsLoading] = useState(true);
    const [cancelTx, setCancelTx] = useState<Transaction | null>(null);
    // const [actionError, setActionError] = useState<{title: string, message: string} | null>(null); // Unused, using Alert/Modal
    
    // Unified Modal State
    type ActiveModal = {
        type: 'recalc_confirm' | 'recalc_result' | 'delete_confirm' | 'suspend_confirm' | 'blacklist_action' | 'success' | 'cancel_confirm' | 'error' | 'info' | 'confirm';
        title?: string;
        message?: string;
        data?: any;
        onConfirm?: () => void;
    };
    const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);

    // State for Expiration Edit
    const [isEditingExpiry, setIsEditingExpiry] = useState(false);
    const [expiryDate, setExpiryDate] = useState<string>('');

    // Pagination State
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 20;

    // Adjustment State
    const [staffName, setStaffName] = useState('');

    // Cancellation State
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchProfile = async () => {
        if (!id) return;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error('Error fetching member:', error);
            return;
        }

        // We can keep member.transactions empty in the member state as we use separate state
        setMember({ ...data, transactions: [] });
        setMemo(data.staff_memo || '');
    };

    const fetchTransactions = async (isLoadMore = false) => {
        if (!id) return;
        
        if (isLoadMore) setIsLoadingMore(true);
        else setIsLoading(true); // Initial load for tx

        try {
            const currentLength = isLoadMore ? transactions.length : 0;
            const from = currentLength;
            const to = currentLength + PAGE_SIZE - 1;

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('member_id', id)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            if (isLoadMore) {
                setTransactions(prev => [...prev, ...(data || [])]);
            } else {
                setTransactions(data || []);
            }
            
            // If we got fewer items than requested, we reached the end
            if ((data || []).length < PAGE_SIZE) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }

        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };
    
    // Wrapper to fetch all initial data
    const initData = async () => {
        if (!id) return;
        setIsLoading(true);
        await Promise.all([fetchProfile(), fetchTransactions(false)]);
        setIsLoading(false);
    };

    // Initial Load & Realtime Subscription
    useEffect(() => {
        initData();

        if (!id) return;

        const channel = supabase
            .channel(`desktop_member_detail_${id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'transactions',
                    filter: `member_id=eq.${id}`
                },
                () => {
                    // Refresh styles
                    fetchProfile(); // Update points/rank
                    fetchTransactions(false); // Reload list (simplest to ensure consistency)
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
                    fetchProfile();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

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
                message: '保存に失敗しました'
            });
        } else {
            // setIsDirty(false);
            setActiveModal({type: 'success', title: '保存完了', message: 'スタッフメモを保存しました'});
            fetchProfile();
        }
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
            // Keep modal open, show alert via internal state? 
            // Better to show error modal on top? Or js alert? 
            // For now, let's just not proceed.
            // Actually, we should close and verify? No.
            // Let's implement inline error or separate alert.
            // Using a separate alert replaces the current modal which is annoying.
            // I'll add a check inside the modal render to disable button if empty?
            // But user wants explicit "Required" validation.
            // For simplicity in this structure: Close and Show Error.
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
        // Update Profile via RPC for Signed Logging
        try {
            const { data, error } = await supabase.rpc('execute_admin_action', {
                target_member_id: id,
                action_type: isBlacklisting ? 'suspend' : 'resume',
                staff_name: staffName
            });

            if (error || (data && !data.success)) {
                throw error || new Error(data?.error || 'Unknown error');
            }

            // Success
            setMember(prev => prev ? { ...prev, is_blacklisted: isBlacklisting } : null);
            setActiveModal({
                type: 'success', 
                title: '完了', 
                message: isBlacklisting ? '会員を利用停止にしました' : '会員の利用を再開しました'
            });
            setStaffName('');

        } catch (error) {
            console.error('Blacklist Error:', error);
            setActiveModal({
                type: 'error',
                title: '更新失敗',
                message: 'ステータスの更新に失敗しました'
            });
        }
    };

    const handleRecalculatePoints = () => {
        setActiveModal({ type: 'recalc_confirm' });
    };

    const executeRecalculatePoints = async () => {
        if (!id || !member) return;
        setIsLoading(true);

        const { data: transactions, error: txError } = await supabase
            .from('transactions')
            .select('*')
            .eq('member_id', id);

        if (txError || !transactions) {
            setActiveModal({
                type: 'error',
                title: '取得失敗',
                message: '履歴の取得に失敗しました'
            });
            setIsLoading(false);
            return;
        }

        let total = 0;
        transactions.forEach((tx: Transaction) => {
            if (tx.is_cancelled) return;
            if (tx.type === 'EARN') total += tx.amount;
            if (tx.type === 'USE') total -= tx.amount;
        });

        if (total < 0) total = 0;

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ points: total })
            .eq('id', id);

        setIsLoading(false);

        if (updateError) {
             setActiveModal({
                 type: 'error',
                 title: '修正失敗',
                 message: 'ポイント修正に失敗しました'
             });
        } else {
            setActiveModal({ type: 'recalc_result', data: { current: member.points, new: total } });
            initData();
        }
    };

    const handleCancelTransaction = (tx: Transaction) => {
        setCancelTx(tx);
        setStaffName(''); // Reset staff name
        setShowCancelModal(true);
    };

    const executeCancelTransaction = async () => {
        if (!id || !member || !cancelTx) return;

        // Validation for Staff Name
        if (!staffName.trim()) {
            setActiveModal({
                type: 'error',
                title: '入力エラー',
                message: '担当者名(操作者)は必須です'
            });
            return;
        }

        // Check Status
        if (member.is_blacklisted) {
            setShowCancelModal(false);
            setCancelTx(null);
            setActiveModal({
                type: 'error',
                title: '操作不可',
                message: '利用停止中のため、取引を取り消せません'
            });
            return;
        }
        if (member.is_deleted) {
             setShowCancelModal(false);
             setCancelTx(null);
            setActiveModal({
                type: 'error',
                title: '操作不可',
                message: '削除済みのため、取引を取り消せません'
            });
            return;
        }

        setIsSubmitting(true);

        try {
            let newPoints = member.points;
            if (cancelTx.type === 'EARN') {
                newPoints -= cancelTx.amount;
            } else {
                newPoints += cancelTx.amount;
            }

            if (newPoints < 0) {
                setIsSubmitting(false);
                setShowCancelModal(false);
                setCancelTx(null);
                setActiveModal({
                    type: 'error',
                    title: 'ポイント不足',
                    message: 'ポイント不足のため取り消せません'
                });
                return;
            }

            // Update Transaction with Description
            const currentDesc = cancelTx.description || 'なし';
            const newDescription = `【取消:${staffName}】${currentDesc}`;

            const { error: txUpdateError } = await supabase
                .from('transactions')
                .update({ 
                    is_cancelled: true,
                    description: newDescription
                })
                .eq('id', cancelTx.id);

            if (txUpdateError) {
                 throw txUpdateError;
            }

            // Update Profile
            /* 
            // Trigger handles point recalc usually, but retaining manual for consistency with legacy code
            // if triggers are active, this is redundant but idempotent enough
            */
             const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update({ points: newPoints })
                .eq('id', id);

             if (profileUpdateError) {
                 // Even if profile update fails, transaction is cancelled. 
                 // We show specific error but don't rollback (complex).
                 // User can recalculate points manually.
                 throw new Error('Profile update failed');
             }

             // Success
             setIsSubmitting(false);
             setShowCancelModal(false);
             setCancelTx(null);
             setStaffName('');
             
             setActiveModal({type: 'success', title: '完了', message: '取引を取り消しました'});
             initData();

        } catch (error) {
             setIsSubmitting(false);
             setShowCancelModal(false);
             setCancelTx(null);
             console.error('Cancel Error:', error);
             setActiveModal({
                 type: 'error',
                 title: '取り消し失敗',
                 message: '取引の取り消しに失敗しました'
             });
        }
    };

    const handleUpdateExpiry = async () => {
        if (!id || !member) return;
        
        // Convert empty string to null for database
        const expiryValue = expiryDate ? expiryDate : null;
        const updates: any = { membership_expiry: expiryValue };
        const { error } = await supabase.from('profiles').update(updates).eq('id', id);

        if (error) {
             setActiveModal({
                 type: 'error',
                 title: '更新失敗',
                 message: '有効期限の更新に失敗しました'
             });
        } else {
             setMember(prev => prev ? { ...prev, membership_expiry: expiryDate } : null);
             setIsEditingExpiry(false);
             setActiveModal({type: 'success', title: '更新完了', message: '有効期限を更新しました'});
             
             // Log History
             // Log History handled by trigger
             // logSystemTransaction('有効期限変更', expiryValue ? `～${expiryValue}` : '無期限');
        }
    };

    const handleDemoteMember = () => {
         if (!id || !member) return;
         setActiveModal({
             type: 'suspend_confirm', // Reusing confirm modal with different text
             title: '特別会員の解除',
             message: 'この会員を「通常会員」に戻しますか？\n特別会員としての特典はすべて失われます。',
             data: { action: 'demote' }
         });
    };

    const executeDemoteMember = async () => {
         if (!id || !member) return;

         // Validation for Staff Name
         if (!staffName.trim()) {
             setActiveModal({
                 type: 'error',
                 title: '入力エラー',
                 message: '担当者名(操作者)は必須です'
             });
             return;
         }
         
         try {
             const { data, error } = await supabase.rpc('execute_admin_action', {
                 target_member_id: id,
                 action_type: 'demote',
                 staff_name: staffName
             });
 
             if (error || (data && !data.success)) {
                 throw error || new Error(data?.error || 'Unknown error');
             }
 
             setMember(prev => prev ? { ...prev, rank: 'regular', membership_expiry: undefined } : null);
             setActiveModal({type: 'success', title: '完了', message: '通常会員に変更しました'});
             setStaffName('');
 
         } catch (error) {
             console.error('Demote Error:', error);
             setActiveModal({
                 type: 'error',
                 title: '更新失敗',
                 message: '更新に失敗しました'
             });
         }
    };



    const handleBack = () => {
        navigate(-1); // Go back to previous page (maintaining tab state)
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 font-sans">
                 {/* Skeleton Header */}
                 <div className="bg-slate-800 text-white shadow-md h-16 flex items-center justify-between px-8">
                     <div className="flex gap-4 items-center">
                         <Skeleton className="w-8 h-8 rounded bg-slate-700" />
                         <Skeleton className="w-32 h-6 bg-slate-700" />
                     </div>
                 </div>

                 <div className="max-w-6xl mx-auto p-8">
                     <div className="grid grid-cols-5 gap-8">
                         {/* Left Col Skeleton (Profile) */}
                         <div className="col-span-2 space-y-6">
                             <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 flex flex-col items-center">
                                 <Skeleton className="w-32 h-32 rounded-full mb-4" />
                                 <Skeleton className="h-4 w-20 mb-2" />
                                 <Skeleton className="h-8 w-40 mb-6" />
                                 <div className="w-full space-y-4">
                                     <Skeleton className="h-12 w-full rounded-xl" />
                                     <Skeleton className="h-12 w-full rounded-xl" />
                                 </div>
                             </div>
                         </div>

                         {/* Right Col Skeleton (History) */}
                         <div className="col-span-3 space-y-6">
                             <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-[600px] p-6">
                                 <div className="flex justify-between mb-6">
                                     <Skeleton className="w-32 h-6" />
                                     <Skeleton className="w-20 h-4" />
                                 </div>
                                 <div className="space-y-4">
                                     {[1, 2, 3, 4, 5, 6].map((i) => (
                                         <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-4">
                                             <div className="flex gap-4">
                                                 <Skeleton className="w-10 h-10 rounded-full" />
                                                 <div className="space-y-2">
                                                     <Skeleton className="w-32 h-4" />
                                                     <Skeleton className="w-20 h-3" />
                                                 </div>
                                             </div>
                                             <Skeleton className="w-16 h-6" />
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>
            </div>
        );
    }
    if (!member) return <div className="p-20 text-center text-red-500 font-bold">Error: Member Not Found.</div>;

    const isSpecial = member.rank === 'special';

    return (
        <div className="h-screen bg-slate-100 font-sans text-slate-800 flex flex-col overflow-hidden">
            
            {/* Header */}
            <header className="bg-slate-800 text-white shadow-md z-10 sticky top-0 flex-shrink-0">
                <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleBack} 
                            className="w-10 h-10 flex items-center justify-center rounded-full text-slate-300 hover:bg-slate-700 hover:text-white transition-colors -ml-2"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <h1 className="text-xl font-bold tracking-tight">会員詳細</h1>
                    </div>
                    <div className="flex items-center gap-6 pr-12">
                         <div className="text-sm text-slate-300 bg-slate-700/50 px-3 py-1 rounded-full border border-slate-600 flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                             <span className="font-medium">ログイン中</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => navigate('/admin/office')} 
                                className="w-10 h-10 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white rounded-full transition-all"
                                title="ダッシュボードへ戻る"
                            >
                                <Home size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-grow p-4 max-w-[1700px] mx-auto w-full grid grid-cols-12 gap-4 h-full overflow-hidden">
                
                {/* Column 1: Profile (3 cols) */}
                <div className="col-span-3 h-full overflow-hidden flex flex-col">
                    {/* Profile Card */}
                    <div className={`relative rounded-xl shadow-sm border p-4 text-center transition-all duration-500 h-full flex flex-col overflow-y-auto no-scrollbar ${
                        member.is_deleted 
                            ? 'bg-slate-50 border-slate-300 grayscale-[0.8] opacity-90' 
                            : (isSpecial ? 'bg-white border-yellow-400 ring-4 ring-yellow-50 shadow-yellow-100' : 'bg-white border-teal-400 ring-4 ring-teal-50 shadow-teal-50')
                    }`}>
                        
                        <div className="relative inline-block mx-auto mb-3 mt-1 flex-shrink-0">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold border-[4px] shadow-inner transition-all duration-500 ${
                                member.is_deleted ? 'bg-gray-200 text-gray-400 border-gray-300' :
                                (isSpecial ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 text-white border-yellow-100 shadow-yellow-200' : 'bg-teal-50 text-teal-600 border-transparent')
                            }`}>
                                {(member.name || '?')[0]}
                            </div>
                            
                            {/* Status Badge Overlay */}
                            {(member.is_deleted || member.is_blacklisted) && (
                                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 rounded-full text-xs font-black text-white whitespace-nowrap shadow-sm tracking-wider border-2 border-white ${member.is_deleted ? 'bg-gray-600' : 'bg-red-500'}`}>
                                    {member.is_deleted ? '削除済' : '利用停止中'}
                                </div>
                            )}
                        </div>
                    
                        <div className="flex flex-col items-center mb-4 flex-shrink-0">
                             {isSpecial && <span className="mb-2 text-[10px] bg-yellow-100 text-yellow-700 px-3 py-0.5 rounded-full border border-yellow-300 font-bold uppercase tracking-wider shadow-sm">特別会員</span>}
                             <h2 className={`text-xl font-bold ${member.is_deleted ? 'text-gray-400 line-through' : 'text-slate-800'}`}>{member.name || '名称未設定'}</h2>
                             <p className="text-sm text-gray-400 font-mono mt-1 mb-3">ID: {member.member_code}</p>

                             {/* Points */}
                            <div className="flex items-center gap-2 mb-2">
                                <p className={`text-3xl font-bold tabular-nums tracking-tight ${isSpecial ? 'text-yellow-600' : 'text-slate-800'}`}>
                                    {(member.points || 0).toLocaleString()} <span className="text-sm font-normal opacity-70">pt</span>
                                </p>
                                <button onClick={handleRecalculatePoints} className={`${isSpecial ? 'text-yellow-400 hover:text-yellow-600' : 'text-gray-300 hover:text-teal-600'} transition-colors`} title="再計算">
                                    <Loader2 size={16} />
                                </button>
                            </div>
                        </div>

                        {isSpecial ? (
                            /* Special Member Layout: Detailed Info */
                            <div className="space-y-4 text-left bg-yellow-50/50 p-4 rounded-xl border border-yellow-100">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <p className="text-xs text-yellow-700 font-bold mb-1">電話番号</p>
                                        <p className="text-base font-medium text-slate-900 font-mono tracking-wide">{member.phone || 'ー'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-yellow-700 font-bold mb-1">生年月日</p>
                                        <p className="text-base font-medium text-slate-900 font-mono tracking-wide">{member.birthdate ? new Date(member.birthdate).toLocaleDateString('ja-JP') : 'ー'}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-yellow-700 font-bold mb-1">メールアドレス</p>
                                    <p className="text-base font-medium text-slate-900 font-mono tracking-tight break-all">{member.email || '未登録'}</p>
                                </div>
                                
                                {/* Expiry Settings */}
                                <div className="pt-3 border-t border-yellow-200/50">
                                    <p className="text-[10px] text-yellow-700 font-bold mb-1">有効期限</p>
                                    {isEditingExpiry ? (
                                        <div className="bg-white border border-yellow-200 rounded p-2 animate-in fade-in slide-in-from-top-1">
                                            <input 
                                                type="date" 
                                                className="w-full text-sm p-1 border border-gray-200 rounded mb-2 focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 outline-none"
                                                value={expiryDate}
                                                onChange={(e) => setExpiryDate(e.target.value)}
                                            />
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => setIsEditingExpiry(false)}
                                                    className="flex-1 text-xs py-1 bg-gray-50 border border-gray-200 rounded text-gray-600 hover:bg-gray-100"
                                                >
                                                    中止
                                                </button>
                                                <button 
                                                    onClick={handleUpdateExpiry}
                                                    className="flex-1 text-xs py-1 bg-yellow-500 text-white rounded font-bold hover:bg-yellow-600 shadow-sm"
                                                >
                                                    保存
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center group">
                                            <p className="text-base font-medium text-slate-900 font-mono tracking-wide">
                                                {member.membership_expiry 
                                                    ? new Date(member.membership_expiry).toLocaleDateString('ja-JP') 
                                                    : '無期限'}
                                            </p>
                                            <button 
                                                onClick={() => {
                                                    setIsEditingExpiry(true);
                                                    setExpiryDate(member.membership_expiry || '');
                                                }}
                                                className="text-xs text-yellow-600 border border-yellow-200 bg-white px-3 py-1 rounded hover:bg-yellow-50 transition-colors"
                                            >
                                                変更
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Account Status & Controls */}
                                <div className="pt-3 border-t border-yellow-200/50 space-y-4">
                                    {/* Account Actions (Suspend/Resume) */}
                                    <div>
                                        <p className="text-xs text-yellow-700 font-bold mb-2">アカウント状態管理</p>
                                        {member.is_blacklisted ? (
                                             <button 
                                                onClick={() => handleBlacklistAction('resume')}
                                                className="w-full py-2 text-sm font-bold text-teal-600 hover:text-teal-700 bg-white border border-teal-200 hover:bg-teal-50 rounded transition-colors flex items-center justify-center gap-1 shadow-sm"
                                            >
                                                <CheckCircle2 size={16} />
                                                利用を再開する（停止解除）
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleBlacklistAction('suspend')}
                                                className="w-full py-2 text-sm font-bold text-red-500 hover:text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded transition-colors flex items-center justify-center gap-1 shadow-sm"
                                            >
                                                <Ban size={16} />
                                                利用を停止する
                                            </button>
                                        )}
                                        <p className="text-[10px] text-gray-400 mt-2 leading-tight">
                                            ※利用停止にすると、会員はアプリにログインできなくなります。
                                        </p>
                                    </div>

                                    {/* Demote Button */}
                                    <button 
                                        onClick={handleDemoteMember}
                                        className="w-full py-2 text-sm font-bold text-red-500 hover:text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded transition-colors flex items-center justify-center gap-1 shadow-sm"
                                    >
                                        通常会員へ戻す（ランク剥奪）
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Regular Member Layout */
                            <div className="space-y-6">
                                <p className="text-sm text-gray-400 font-mono">{member.email || 'メール未登録'}</p>
                                
                                {/* Account Actions (Suspend/Resume) - Regular */}
                                <div className="pt-4 border-t border-gray-100 px-2">
                                     <p className="text-xs font-bold text-gray-500 mb-2">アカウント状態管理</p>
                                     {member.is_blacklisted ? (
                                         <button 
                                            onClick={() => handleBlacklistAction('resume')}
                                            className="w-full py-2 text-sm font-bold text-teal-600 hover:text-teal-700 bg-white border border-teal-200 hover:bg-teal-50 rounded transition-colors flex items-center justify-center gap-1 shadow-sm"
                                        >
                                            <CheckCircle2 size={16} />
                                            利用を再開する（停止解除）
                                        </button>
                                     ) : (
                                        <button 
                                            onClick={() => handleBlacklistAction('suspend')}
                                            className="w-full py-2 text-sm font-bold text-red-500 hover:text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded transition-colors flex items-center justify-center gap-1 shadow-sm"
                                        >
                                            <Ban size={16} />
                                            利用を停止する
                                        </button>
                                     )}
                                     <p className="text-[10px] text-gray-400 mt-2 leading-tight">
                                        ※利用停止にすると、会員はアプリにログインできなくなります。
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 2: Transaction History (6 cols) */}
                <div className="col-span-6 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                            <FileText size={20} className="text-gray-400" /> 取引履歴
                        </h3>
                        {/* Adjustment Button Moved Here */}
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400">表示中の履歴: {transactions.length} 件</span>
                        </div>
                    </div>
                    
                    <div className="overflow-y-auto flex-grow p-0">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                                <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="px-6 py-4 font-bold w-40">日時</th>
                                    <th className="px-6 py-4 font-bold w-24 text-center">種別</th>
                                    <th className="px-6 py-4 font-bold">取引内容</th>
                                    <th className="px-6 py-4 font-bold text-right w-24">ポイント</th>
                                    <th className="px-6 py-4 font-bold text-center w-24">残高</th>
                                    <th className="px-4 py-4 font-bold text-center w-32">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center text-gray-400">
                                            <FileText size={48} className="opacity-20 mx-auto mb-4" />
                                            <p>取引履歴はありません</p>
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((tx) => {
                                        // Auto-detect system logs vs actual transactions
                                        const isSystem = tx.description?.includes('【システム】');
                                        
                                        return (
                                            <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                                    {new Date(tx.created_at).toLocaleString('ja-JP', {
                                                        year: 'numeric',
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                                        (tx.description?.includes('【修正') || tx.description?.includes('【調整'))
                                                        ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                                                        : tx.is_cancelled ? 'bg-gray-100 text-gray-400 border border-gray-200' :
                                                        tx.type === 'EARN' ? (isSpecial ? 'bg-yellow-100 text-yellow-700' : 'bg-teal-100 text-teal-700') :
                                                        tx.type === 'USE' ? 'bg-red-100 text-red-600' :
                                                        'bg-blue-50 text-blue-600' // INFO
                                                    }`}>
                                                        {(tx.description?.includes('【修正') || tx.description?.includes('【調整')) ? '修正' : 
                                                         (tx.is_cancelled ? '取消' : 
                                                         tx.type === 'EARN' ? '獲得' : 
                                                         tx.type === 'USE' ? '利用' : '通知')}
                                                    </span>
                                                </td>
                                                {/* Status Column Removed */}
                                                <td className="px-6 py-4">
                                                    {(() => {
                                                        const staffSignature = extractStaffSignature(tx.description);
                                                        return (
                                                            <div className="flex flex-col gap-0.5">
                                                                <div className="text-sm">
                                                                    <span className={tx.is_cancelled ? 'text-gray-400 line-through' : 'text-slate-800'}>
                                                                        {formatTransactionDisplayText(tx.description, tx.type)}
                                                                    </span>
                                                                    {tx.served_by && tx.served_by !== 'SYSTEM' && !tx.served_by.includes('システム') && (
                                                                        <span className="text-xs text-slate-500 ml-1">
                                                                            ({tx.served_by})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {staffSignature && (
                                                                    <div className="text-xs text-slate-500">
                                                                        {staffSignature}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <span className={`font-bold text-lg ${
                                                        tx.is_cancelled ? 'text-gray-400 line-through' :
                                                        tx.type === 'EARN' ? (isSpecial ? 'text-yellow-600' : 'text-slate-700') :
                                                        tx.type === 'USE' ? 'text-red-500' :
                                                        'text-gray-400' // INFO
                                                    }`}>
                                                        {tx.type === 'INFO' ? '-' : (tx.type === 'USE' ? '-' : '') + tx.amount.toLocaleString()}
                                                    </span>
                                                    <span className="text-xs text-gray-400 ml-1">pt</span>
                                                </td>
                                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                                    <span className="font-bold text-lg text-slate-600">
                                                        {tx.type !== 'INFO' && (tx as any).balance_snapshot !== null && (tx as any).balance_snapshot !== undefined
                                                            ? `${(tx as any).balance_snapshot.toLocaleString()} pt` 
                                                            : '-'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center text-sm">
                                                    <div className="flex flex-col items-center gap-1">
                                                        {tx.is_cancelled ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-500 text-xs font-bold">
                                                                <Ban size={12} /> 取消済み
                                                            </span>
                                                        ) : (
                                                            (!isSystem && tx.type !== 'INFO') && (
                                                                <div className="flex justify-center gap-2">
                                                                    {/* Correction Button Removed */}
                                                                    {/* <button 
                                                                        onClick={() => handleOpenEdit(tx)}
                                                                        className="text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded transition-colors whitespace-nowrap shadow-sm"
                                                                    >
                                                                        修正
                                                                    </button> */}
                                                                    <button 
                                                                        onClick={() => handleCancelTransaction(tx)}
                                                                        className="text-xs bg-white border border-red-100 hover:bg-red-50 text-red-500 px-3 py-1.5 rounded transition-colors whitespace-nowrap shadow-sm"
                                                                    >
                                                                        取消
                                                                    </button>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    
                        {/* Load More Button */}
                        {hasMore && (
                            <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
                                <button 
                                    onClick={() => fetchTransactions(true)}
                                    disabled={isLoadingMore}
                                    className="text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-white px-4 py-2 rounded-full border border-transparent hover:border-gray-200 transition-all flex items-center gap-2 mx-auto"
                                >
                                    {isLoadingMore ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            読み込み中...
                                        </>
                                    ) : (
                                        <>さらに読み込む</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 3: Memo (3 cols) */}
                <div className="col-span-3 flex flex-col h-full overflow-hidden">
                    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <h3 className="font-bold text-gray-600 mb-2 flex items-center gap-2 flex-shrink-0">
                             スタッフ用メモ
                             <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded">非公開</span>
                         </h3>
                         <textarea 
                             className="w-full flex-grow p-3 bg-yellow-50/50 rounded-lg border border-yellow-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300 resize-none whitespace-pre-wrap break-all"
                             placeholder="注意点や特記事項を入力..."
                             value={memo}
                             onChange={(e) => setMemo(e.target.value)}
                         />
                         <button 
                             onClick={handleSaveMemo}
                             className="mt-3 w-full bg-slate-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform flex-shrink-0"
                         >
                             メモを保存する
                         </button>
                    </div>
                </div>
            </main>

            {/* Combined Modal for Adjustment / Confirmations */}
            {activeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl transform transition-all scale-100">
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
                            {activeModal.title || '確認'}
                        </h3>
                        <p className="text-gray-600 mb-6 text-center whitespace-pre-wrap text-sm leading-relaxed">
                             {activeModal.message || (activeModal.type === 'recalc_confirm' && (
                                <>全取引履歴を集計し、現在の保有ポイントを正しい値に修正します。<br/><span className="text-xs text-slate-400 mt-2 block">※取り消された取引は除外されます</span></>
                            ))}
                        </p>

                        {/* Show Input for Blacklist AND Suspend(Demote) */}
                        {(activeModal.type === 'blacklist_action' || activeModal.type === 'suspend_confirm') && (
                            <div className="mb-6">
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
                        
                        <div className="flex gap-3">
                            {['recalc_confirm', 'delete_confirm', 'suspend_confirm', 'cancel_confirm', 'blacklist_action', 'confirm'].includes(activeModal.type) ? (
                                <>
                                    <button 
                                        onClick={() => {
                                            setActiveModal(null);
                                            setCancelTx(null);
                                        }}
                                        className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                                    >
                                        キャンセル
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (activeModal.onConfirm) {
                                                activeModal.onConfirm();
                                            } else {
                                                if (activeModal.type === 'recalc_confirm') executeRecalculatePoints();
                                                if (activeModal.type === 'cancel_confirm') executeCancelTransaction();
                                                if (activeModal.type === 'blacklist_action') executeBlacklistAction();
                                                if (activeModal.type === 'suspend_confirm') {
                                                    if (activeModal.data?.action === 'demote') {
                                                        executeDemoteMember();
                                                    }
                                                }
                                            }
                                        }}
                                         className={`flex-1 py-3 text-white font-bold rounded-xl shadow-lg transition-colors ${
                                            activeModal.type === 'delete_confirm' || activeModal.type === 'cancel_confirm' || activeModal.type === 'confirm' ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-800 hover:bg-slate-700'
                                        }`}
                                    >
                                        実行
                                    </button>
                                </>
                            ) : (
                                <button 
                                    onClick={() => setActiveModal(null)}
                                    className={`w-full py-3 text-white font-bold rounded-xl shadow-lg transition-colors ${
                                        activeModal.type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-teal-500 hover:bg-teal-600'
                                    }`}
                                >
                                    OK
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Notification Modal (Success / Error / Info) */}
            {activeModal && (activeModal.type === 'success' || activeModal.type === 'error' || activeModal.type === 'info') && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl transform transition-all scale-100 text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                            activeModal.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-teal-50 text-teal-500'
                        }`}>
                            {activeModal.type === 'error' ? <AlertTriangle size={32} /> : <CheckCircle2 size={32} />}
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">{activeModal.title || (
                            activeModal.type === 'error' ? 'エラー' : '完了'
                        )}</h3>
                        <p className="text-gray-500 text-sm mb-6 whitespace-pre-wrap leading-relaxed">
                            {activeModal.message}
                        </p>
                        <button 
                            onClick={() => setActiveModal(null)}
                            className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 shadow-lg transition-colors"
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            )}

            {/* Cancellation Modal (Custom) */}
            {showCancelModal && cancelTx && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
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
                                <span className="font-mono text-slate-700">{new Date(cancelTx.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between mb-1">
                                <span className="text-gray-500">種別:</span>
                                <span className={`font-bold ${cancelTx.type === 'EARN' ? 'text-teal-600' : 'text-red-500'}`}>
                                    {cancelTx.type === 'EARN' ? '獲得' : '利用'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">金額:</span>
                                <span className="font-bold text-slate-700">{cancelTx.amount.toLocaleString()} pt</span>
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
                                        setCancelTx(null);
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
        </div>
    );
};

export default DesktopMemberDetail;
