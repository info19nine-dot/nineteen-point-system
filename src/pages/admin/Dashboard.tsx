import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Search, QrCode, X, Check, History, PenTool, Plus, Settings as SettingsIcon, CheckCircle2, ShieldCheck, AlertCircle, HelpCircle } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { FullScreenScanOverlay, type ScanOverlayPhase } from '../../components/features/card/FullScreenScanOverlay';
import { StaffUseQrPanel } from '../../components/features/card/StaffUseQrPanel';
import { STAFF_MODE_SELECT_PATH } from '../../lib/routes';
import { QR_CANVAS_SIZE, QR_EARN_CANVAS_STYLE } from '../../lib/qrDisplay';




type TransactionWithMember = {
    id: string;
    amount: number;
    type: 'EARN' | 'USE' | 'INFO';
    created_at: string;
    member_id: string;
    description?: string;
    is_cancelled: boolean;
    profiles: {
        name: string;
        member_code: string;
        rank?: string;
    } | null;
    served_by?: string;
};

const Dashboard = () => {
    const navigate = useNavigate();
    
    // State
    const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
    const [showQrModal, setShowQrModal] = useState(false);

    const [qrId, setQrId] = useState<string>(crypto.randomUUID());
    const [servedBy, setServedBy] = useState('');

    const [activeUseSessionId, setActiveUseSessionId] = useState<string | null>(null);
    const [useSessionStatus, setUseSessionStatus] = useState<'waiting' | 'inputting'>('waiting');
    const [isUseSessionLoading, setIsUseSessionLoading] = useState(false);
    const useCompleteHandledRef = useRef(false);
    const completedSessionHandledRef = useRef<string | null>(null);
    const useSessionOpInFlightRef = useRef(false);
    const [showApplyScanModal, setShowApplyScanModal] = useState(false);
    const [scanOverlayPhase, setScanOverlayPhase] = useState<ScanOverlayPhase>('scanning');
    // const [showHistory, setShowHistory] = useState(false); // Removed
    const [historyLimit, setHistoryLimit] = useState(5);
    

    const [showEarnQrSuccess, setShowEarnQrSuccess] = useState(false);
    const [scanResultData, setScanResultData] = useState<any>(null);
    const [searchValue, setSearchValue] = useState('');

    // Manual Input State
    const [isManualMode, setIsManualMode] = useState(false);
    const [manualPoints, setManualPoints] = useState('');
    const [staffName, setStaffName] = useState('');
    const [isConfirmed, setIsConfirmed] = useState(false);

    // Special Member Approval State
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [approvalData, setApprovalData] = useState<any>(null);

    // Common Modals State
    const [errorModal, setErrorModal] = useState<{show: boolean, message: string}>({show: false, message: ''});
    const [confirmModal, setConfirmModal] = useState<{show: boolean, message: string, onConfirm: () => void}>({show: false, message: '', onConfirm: () => {}});
    
    // Data State
    const [recentTransactions, setRecentTransactions] = useState<TransactionWithMember[]>([]);
    const [courses, setCourses] = useState<any[]>([]); // Dynamic courses
    const [isLoading, setIsLoading] = useState(true);
    const isScanProcessing = useRef(false);

    const createFreshUseSession = useCallback(async (cancelCurrent: boolean) => {
        if (useSessionOpInFlightRef.current) return;
        useSessionOpInFlightRef.current = true;
        setIsUseSessionLoading(true);

        try {
            if (cancelCurrent && activeUseSessionId) {
                await supabase.rpc('cancel_use_qr_session', { p_session_id: activeUseSessionId });
            }

            const { data, error } = await supabase.rpc('create_use_qr_session');
            if (error) {
                setErrorModal({ show: true, message: error.message });
                return;
            }

            useCompleteHandledRef.current = false;
            completedSessionHandledRef.current = null;
            setActiveUseSessionId(data as string);
            setUseSessionStatus('waiting');
        } finally {
            setIsUseSessionLoading(false);
            useSessionOpInFlightRef.current = false;
        }
    }, [activeUseSessionId]);

    const finishUseQrFlow = useCallback(() => {
        if (useCompleteHandledRef.current) return;
        useCompleteHandledRef.current = true;

        void fetchData();
        void createFreshUseSession(false).finally(() => {
            useCompleteHandledRef.current = false;
        });
    }, [createFreshUseSession]);

    const handleRegenerateUseSession = () => {
        void createFreshUseSession(true);
    };

    // ダッシュボード表示時に使用QRを常時用意
    useEffect(() => {
        if (activeUseSessionId) return;
        void createFreshUseSession(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Initial Data Fetch
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [historyLimit]);

    // ポイント使用QR：状態監視・完了時に新QRへ（Realtime + ポーリング）
    useEffect(() => {
        if (!activeUseSessionId) return;

        const sessionId = activeUseSessionId;

        const syncSession = async () => {
            const { data: row, error } = await supabase
                .from('use_qr_sessions')
                .select('status, amount, expires_at')
                .eq('id', sessionId)
                .maybeSingle();

            if (error || !row) return;

            if (row.status === 'inputting') {
                setUseSessionStatus('inputting');
            } else if (row.status === 'waiting') {
                setUseSessionStatus('waiting');
            }

            if (row.status === 'completed' && row.amount != null) {
                if (completedSessionHandledRef.current !== sessionId) {
                    completedSessionHandledRef.current = sessionId;
                    finishUseQrFlow();
                }
                return;
            }

            const expired = row.expires_at && new Date(row.expires_at).getTime() <= Date.now();
            if (expired && (row.status === 'waiting' || row.status === 'inputting') && !useSessionOpInFlightRef.current) {
                void createFreshUseSession(true);
            }
        };

        const txChannel = supabase
            .channel(`use-qr-tx:${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'transactions',
                    filter: `qr_scan_id=eq.${sessionId}`,
                },
                (payload: { new: { type?: string; amount?: number } }) => {
                    const tx = payload.new;
                    if (tx.type !== 'USE' || tx.amount == null) return;
                    finishUseQrFlow();
                }
            )
            .subscribe();

        const sessionChannel = supabase
            .channel(`use-qr-session:${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'use_qr_sessions',
                    filter: `id=eq.${sessionId}`,
                },
                (payload: { new: { status?: string; amount?: number | null } }) => {
                    const row = payload.new;
                    if (row.status === 'inputting') {
                        setUseSessionStatus('inputting');
                    }
                    if (row.status === 'waiting') {
                        setUseSessionStatus('waiting');
                    }
                    if (row.status === 'completed' && row.amount != null) {
                        if (completedSessionHandledRef.current !== sessionId) {
                            completedSessionHandledRef.current = sessionId;
                            finishUseQrFlow();
                        }
                    }
                }
            )
            .subscribe();

        void syncSession();
        const interval = window.setInterval(() => {
            void syncSession();
        }, 1000);

        return () => {
            window.clearInterval(interval);
            void supabase.removeChannel(txChannel);
            void supabase.removeChannel(sessionChannel);
        };
    }, [activeUseSessionId, finishUseQrFlow, createFreshUseSession]);

    const fetchData = async () => {
        setIsLoading(true);
        
        // 1. Fetch Transactions
        const { data: txData, error: txError } = await supabase
            .from('transactions')
            .select(`
                id,
                amount,
                type,
                created_at,
                member_id,
                description,
                member_id,
                description,
                is_cancelled,
                profiles (
                    name,
                    member_code,
                    rank
                ),
                served_by
            `)
            .neq('type', 'INFO') // Exclude System Logs
            .order('created_at', { ascending: false })
            .limit(historyLimit);

        if (txError) {
            console.error('Error fetching transactions:', txError);
        } else {
            setRecentTransactions(txData as any || []);
        }

        // 2. Fetch Courses
        const { data: courseData, error: courseError } = await supabase
            .from('courses')
            .select('*')
            .order('points', { ascending: true });

        if (courseError) {
            console.error('Error fetching courses:', courseError);
        } else {
            setCourses(courseData || []);
        }

        setIsLoading(false);
    };

    // const handleLogout = async () => {
    //     await logout();
    //     navigate('/admin/login');
    // };

    const handleSearch = () => {
        if (searchValue.trim()) {
            navigate(`/admin/search?q=${searchValue}`);
        }
    };

    const closeApplyScanOverlay = () => {
        setShowApplyScanModal(false);
        setScanOverlayPhase('scanning');
        setScanResultData(null);
    };

    // ------------------------------------------------------------------
    // 特別会員申請QRのみスタッフが読み取る
    // ------------------------------------------------------------------
    const handleApplyScanResult = async (text: string) => {
        if (scanOverlayPhase !== 'scanning' || isScanProcessing.current) return;
        if (!text) return;

        try {
            isScanProcessing.current = true;
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                return;
            }

            if (data.type !== 'APPLY') return;

            const memberId = data.memberId || data.userId;
            if (!memberId) return;

            closeApplyScanOverlay();

            const { data: profile, error: pError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', memberId)
                .single();

            if (pError || !profile) {
                setErrorModal({ show: true, message: '会員情報の取得に失敗しました' });
                return;
            }

            setApprovalData(profile);
            setShowApprovalModal(true);
        } catch (err) {
            console.error('Apply Scan Error:', err);
            const errorMsg = (err as Error).message || '不明なエラー';
            setErrorModal({ show: true, message: `処理に失敗しました。\n詳細: ${errorMsg}` });
            closeApplyScanOverlay();
        } finally {
            isScanProcessing.current = false;
        }
    };



    // Generate new QR ID when opening modal or user clicks regenerate
    useEffect(() => {
        if (showQrModal) {
            setQrId(crypto.randomUUID());
            setServedBy(''); // Reset staff name on new open
        }
    }, [showQrModal]);

    // Derived State
    const activeCourse = useMemo(() => {
        if (isManualMode && isConfirmed && manualPoints) {
            return {
                id: 'manual',
                label: '手動入力',
                points: parseInt(manualPoints),
                description: 'Staff: ' + staffName
            } as any; // Cast as ANY to bypass strict Course type checks for temp object
        }
        return courses.find(c => c.id === selectedCourse) || null;
    }, [selectedCourse, isManualMode, isConfirmed, manualPoints, staffName, courses]);

    const earnQrPayload = useMemo(() => {
        if (!activeCourse) return '';
        return JSON.stringify({
            type: 'EARN',
            amount: activeCourse.points,
            courseId: activeCourse.id,
            courseName: activeCourse.label,
            servedBy: servedBy || 'なし',
            staffName: staffName,
            qrId: qrId,
            timestamp: Date.now()
        });
    }, [activeCourse, qrId, servedBy, staffName]);


    
    // Auto-regenerate QR when a transaction is completed using the current QR ID
    useEffect(() => {
        if (!qrId || !showQrModal) return;

        const channel = supabase
            .channel('schema-db-changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'transactions',
                    filter: `qr_scan_id=eq.${qrId}`
                },
                (payload: any) => {
                    const tx = payload.new;
                    // Close QR Modal (Return to Top)
                    setShowQrModal(false);
                    
                    // Show Success Popup
                    setScanResultData({ amount: tx.amount }); 
                    setShowEarnQrSuccess(true);
                    
                    // Reset QR state under the hood
                    setQrId(crypto.randomUUID());
                    setServedBy(''); 
                    
                    fetchData(); // Refresh history immediately
                    
                    setTimeout(() => {
                        setShowEarnQrSuccess(false);
                        setScanResultData(null);
                    }, 3000);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [qrId, showQrModal]);


    // Approval Handlers
    const handleApprove = async () => {
        if (!approvalData) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    rank: 'special',
                    membership_status: 'approved',
                })
                .eq('id', approvalData.id);

            if (error) throw error;

            // Log History
            // Log History covered by DB Trigger
            // await supabase.from('transactions').insert({
            //     member_id: approvalData.id,
            //     type: 'EARN',
            //     amount: 0,
            //     description: '【システム】ランク変更: 通常会員 → 特別会員',
            //     is_cancelled: false
            // });
            
            if (error) throw error;
            
            setShowApprovalModal(false);
            setApprovalData(null);
            fetchData(); 
        } catch (err: any) {
            console.error(err);
            setErrorModal({show: true, message: "承認に失敗しました: " + err.message});
        }
    };

    const handleReject = async () => {
        if (!approvalData) return;
        
        setConfirmModal({
            show: true, 
            message: "本当に却下しますか？", 
            onConfirm: async () => {
                try {
                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            membership_status: 'rejected'
                        })
                        .eq('id', approvalData.id);

                    if (error) throw error;
                    
                    setShowApprovalModal(false);
                    setApprovalData(null);
                } catch (err: any) {
                    console.error(err);
                    setErrorModal({show: true, message: "処理に失敗しました: " + err.message});
                }
            }
        });
    };

    const handleCloseQrModal = () => {
        setIsManualMode(false);
        setManualPoints('');
        setStaffName('');
        setServedBy('');
        setSelectedCourse(null);
        setIsConfirmed(false);
        setShowQrModal(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
      
        {/* Admin Header (Matches Member Appeal) */}
        <div className="bg-[#2b9b96] pt-8 pb-20 rounded-b-[40px] shadow-lg relative overflow-hidden text-center z-10">
            <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 px-6">
                <div className="flex justify-between items-center mb-4 px-2 relative z-50">
                    <div className="w-8"></div> {/* Spacer */}
                    <h1 className="text-white font-black text-2xl tracking-widest uppercase drop-shadow-sm">スタッフ管理画面</h1>
                    <button onClick={() => navigate('/admin/settings')} className="text-white/80 hover:text-white bg-white/10 p-2 rounded-full backdrop-blur-sm transition-colors cursor-pointer">
                        <SettingsIcon size={20} />
                    </button>
                </div>
                
                {/* Search Bar */}
                <div className="max-w-xs mx-auto flex gap-2">
                    <div className="flex-grow bg-white rounded-full shadow-lg flex items-center overflow-hidden p-1 gap-2 relative z-50">
                        <input 
                            type="text" 
                            placeholder="名前 / 会員ID / メールアドレス" 
                            className="flex-grow py-2 px-4 text-sm outline-none text-slate-700 placeholder-gray-300 font-medium bg-transparent min-w-0"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSearch();
                                }
                            }}
                        />
                        <button 
                            onClick={handleSearch}
                            disabled={!searchValue.trim()}
                            className="bg-teal-500 text-white p-2 rounded-full shadow-md hover:bg-teal-600 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none shrink-0"
                        >
                            <Search size={18} />
                        </button>
                    </div>
                    
                    {/* Member List Button */}
                    <button 
                        onClick={() => navigate('/admin/search')}
                        className="bg-white text-teal-600 px-4 rounded-full shadow-lg hover:bg-teal-50 active:scale-95 transition-all flex items-center justify-center font-bold text-xs whitespace-nowrap z-50"
                    >
                        会員一覧
                    </button>
                </div>
            </div>
        </div>

        <main className="max-w-md mx-auto px-6 -mt-12 relative z-20 space-y-3">

            {/* Point Grant Card */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                <div className="mb-4 flex gap-4">
                    <button 
                        onClick={() => {
                            setShowQrModal(true);
                        }}
                        className="flex-1 bg-slate-800 text-white font-black text-lg py-4 rounded-2xl shadow-xl shadow-slate-800/30 transition-all active:scale-95 touch-manipulation flex flex-col items-center justify-center gap-2"
                    >
                        <div className="bg-white/10 p-2 rounded-full">
                            <QrCode size={24} />
                        </div>
                        <div className="font-bold text-center leading-tight">
                            <span className="block text-sm opacity-80 mb-0.5">ポイント</span>
                            <span className="text-lg">発行</span>
                        </div>
                    </button>
                    <StaffUseQrPanel
                        sessionId={activeUseSessionId}
                        status={useSessionStatus}
                        isInitializing={isUseSessionLoading && !activeUseSessionId}
                        isRegenerating={isUseSessionLoading && Boolean(activeUseSessionId)}
                        onRegenerate={handleRegenerateUseSession}
                    />
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setScanOverlayPhase('scanning');
                        setShowApplyScanModal(true);
                    }}
                    className="mt-3 w-full text-center text-xs font-bold text-slate-400 underline-offset-2 hover:text-teal-600 hover:underline"
                >
                    特別会員申請QRを読み取る
                </button>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                     <History size={18} className="text-gray-400" />
                     <h2 className="font-bold text-gray-600">直近の履歴</h2>
                     <h2 className="font-bold text-gray-600">直近の履歴</h2>
                     {/* "See All" Link Removed */}
                </div>
                
                <div className="space-y-4">
                    {/* Real History from Supabase */}
                    {isLoading && recentTransactions.length === 0 ? (
                         <div className="text-center py-4">
                             <div className="animate-spin h-6 w-6 border-2 border-teal-500 border-t-transparent rounded-full mx-auto"></div>
                         </div>
                    ) : recentTransactions.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-4">履歴はありません</div>
                    ) : (
                        recentTransactions.map((tx) => {
                            if (!tx.profiles) return null; // Skip orphans
                            
                            const displayDate = new Date(tx.created_at).toLocaleString();
                            const isSystem = tx.amount === 0 && tx.description?.includes('【システム】');
                            
                            // Refactored Right Content Logic (INFO hidden amount, etc.)
                            let rightContent;
                            if (tx.type === 'INFO') {
                                 // Extract simple title only (e.g. "メールアドレス変更")
                                 const simpleTitle = (tx.description || '').replace('【システム】', '').replace('会員による', '').split(':')[0].trim() || '通知';

                                 rightContent = (
                                     <>
                                         <div className="font-normal text-xs text-slate-500 text-right leading-tight max-w-[140px]">
                                             {simpleTitle}
                                         </div>
                                         <div className="text-[10px] text-gray-300 mt-0.5 text-right">{displayDate}</div>
                                     </>
                                 );
                            } else if (isSystem) {
                                 const parts = (tx.description || '').replace('【システム】', '').split(':');
                                 const title = parts[0];
                                 const detail = parts[1] || '';
                                 
                                 rightContent = (
                                     <>
                                         <div className="font-bold text-sm text-slate-500 text-right">{title}</div>
                                         <div className="text-[10px] text-gray-400 truncate max-w-[120px] text-right">{detail}</div>
                                         <div className="text-[10px] text-gray-400 text-right">{displayDate}</div>
                                     </>
                                 );
                            } else {
                                 let courseName = tx.description?.replace('【利用】', '') || '';
                                if (courseName.includes('Point usage via QR scan') || courseName === 'QRコード利用') {
                                    courseName = 'ポイント利用';
                                }
                                if (tx.description?.includes('Course QR:')) {
                                    courseName = 'コース利用';
                                }
                                courseName = courseName.replace('コース', '');

                                 rightContent = (
                                     <>
                                         <div className={`font-black text-lg text-right ${tx.is_cancelled ? 'text-gray-300 line-through' : (tx.type === 'EARN' ? ((tx.profiles as any).rank === 'special' ? 'text-yellow-600 drop-shadow-sm' : 'text-teal-600') : 'text-slate-700')}`}>
                                             {tx.type === 'EARN' ? '+' : '-'}{tx.amount.toLocaleString()} <span className="text-xs font-normal opacity-50">pt</span>
                                         </div>
                                         {(courseName || tx.served_by) && (
                                            <div className="text-xs text-slate-500 font-bold truncate max-w-[140px] text-right">
                                                {courseName} {tx.served_by && <span className="font-normal text-slate-400 ml-1">({tx.served_by})</span>}
                                            </div>
                                         )}
                                         {tx.is_cancelled && <div className="text-[10px] text-red-500 font-bold leading-tight text-right">取消済</div>}
                                         <div className="text-[10px] text-gray-400 text-right">{displayDate}</div>
                                     </>
                                 );
                            }
                            
                            return (
                                <div 
                                    key={tx.id} 
                                    onClick={() => navigate(`/admin/members/${(tx as any).member_id}`)}
                                    className={`flex justify-between items-center p-2 rounded-lg transition-colors cursor-pointer active:scale-95 ${tx.is_cancelled ? 'bg-gray-50 opacity-70' : 'hover:bg-gray-50'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold relative ${tx.is_cancelled ? 'bg-gray-200 text-gray-400' : ((tx.profiles as any).rank === 'special' ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 text-white shadow-sm ring-2 ring-yellow-100' : 'bg-slate-100 text-slate-600')}`}>
                                            {tx.profiles.name ? tx.profiles.name[0] : '?'}
                                            {(tx.profiles as any).rank === 'special' && (
                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 border-2 border-white rounded-full"></div>
                                            )}
                                        </div>
                                        <div>
                                            <p className={`font-bold text-sm flex items-center gap-1 ${tx.is_cancelled ? 'text-gray-500' : 'text-slate-800'}`}>
                                                {tx.profiles.name || '不明'}
                                                {!tx.is_cancelled && (tx.profiles as any).rank === 'special' && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1 rounded border border-yellow-200">特別会員</span>}
                                            </p>
                                            <p className="text-[10px] text-gray-400">ID: {tx.profiles.member_code}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {rightContent}
                                    </div>
                                </div>
                            );
                        })
                    )}

                </div>
                
                {/* Load More Button */}
                {recentTransactions.length >= historyLimit && (
                    <div className="mt-4 text-center">
                        <button 
                            onClick={() => setHistoryLimit(prev => prev + 5)}
                            className="text-sm font-bold text-teal-600 bg-teal-50 hover:bg-teal-100 px-6 py-2 rounded-full transition-colors active:scale-95"
                        >
                            さらに読み込む
                        </button>
                    </div>
                )}
            </div>

        </main>
      
        {/* Footer Actions */}
        <div className="text-center mt-8 pb-8">
            <button onClick={() => navigate(STAFF_MODE_SELECT_PATH)} className="flex items-center justify-center gap-2 mx-auto text-slate-400 hover:text-teal-600 text-sm font-medium transition-colors">
                <div className="p-2 bg-white rounded-full shadow-sm">
                    <Check size={16} className="text-slate-400" />
                </div>
                モード選択へ戻る
            </button>
        </div>

        {/* QR Code Modal (EARN Points) - Real Implementation */}
        {showQrModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-[2rem] w-full max-w-sm max-h-[92vh] overflow-y-auto p-6 pb-8 relative shadow-2xl text-center">
                    <button onClick={handleCloseQrModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
                        <X size={24} />
                    </button>
                     
                    {/* 1. Course Selection (Horizontal Scroll) */}
                    <div className="mb-1 mt-6">
                        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-6 px-6 justify-center">
                            {courses.map((course) => {
                                const isSelected = selectedCourse === course.id;
                                return (
                                    <button 
                                        key={course.id}
                                        onClick={() => {
                                            if (isSelected) {
                                                setSelectedCourse(null);
                                            } else {
                                                setSelectedCourse(course.id);
                                                setIsManualMode(false);
                                                setManualPoints('');
                                                setStaffName('');
                                                setServedBy(''); // Reset Cast Name on new selection
                                                setIsConfirmed(false);
                                            }
                                        }}
                                        className={`
                                            relative py-6 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center touch-manipulation snap-center shrink-0 w-[45%] max-w-[200px] select-none
                                            ${isSelected 
                                                ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-xl' 
                                                : 'border-slate-200 bg-white text-slate-500 hover:border-teal-200 active:bg-gray-50'}
                                        `}
                                    >
                                        {isSelected && (
                                            <div className="absolute top-3 right-3 bg-teal-500 text-white rounded-full p-1 animate-in fade-in zoom-in">
                                                <Check size={16} />
                                            </div>
                                        )}
                                        <span className={`text-3xl font-black mb-2 whitespace-nowrap ${isSelected ? 'text-teal-700' : 'text-slate-700'}`}>{course.label}</span>
                                        <span className="text-sm font-bold bg-gray-100 px-3 py-1 rounded-full text-gray-600 whitespace-nowrap">{course.points.toLocaleString()} pt</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* MAIN CONTENT AREA */}
                    <div className="flex flex-col">
                        
                        {/* MODE A: Manual Input Form (Takes full height key to replace CastName+QR) */}
                        {isManualMode && !isConfirmed ? (
                             <div className="flex-1 flex items-start justify-center pt-2 animate-in fade-in">
                                 <div className="w-full max-w-[320px] bg-white p-6 rounded-xl border-2 border-slate-100 shadow-sm">
                                     <div className="space-y-4">
                                         <div>
                                             <label className="text-xs font-bold text-gray-400 block mb-1 text-left">付与ポイント</label>
                                             <input 
                                                 type="number"
                                                 inputMode="numeric"
                                                 className="w-full p-3 bg-slate-50 rounded-lg outline-none text-center font-black text-2xl text-slate-700 focus:ring-2 focus:ring-teal-500 transition-all"
                                                 placeholder="0"
                                                 value={manualPoints}
                                                 onChange={(e) => setManualPoints(e.target.value)}
                                             />
                                         </div>

                                         <div className="text-left">
                                             <label className="text-xs font-bold text-gray-400 block mb-1">キャスト名 (任意)</label>
                                             <input 
                                                 type="text" 
                                                 className="w-full p-3 bg-slate-50 rounded-lg outline-none text-center font-bold text-base text-slate-700 focus:ring-2 focus:ring-teal-500 placeholder:text-gray-300 transition-all"
                                                 placeholder="キャスト名"
                                                 value={servedBy}
                                                 onChange={(e) => setServedBy(e.target.value)}
                                             />
                                         </div>

                                         <div className="text-left">
                                             <label className="text-xs font-bold text-gray-400 block mb-1 flex items-center gap-1">
                                                 <PenTool size={12} /> 担当者署名 <span className="text-red-500 text-[10px] bg-red-50 px-1 rounded">必須</span>
                                             </label>
                                             <input 
                                                 type="text"
                                                 className="w-full p-3 bg-slate-50 rounded-lg outline-none text-center font-bold text-base text-slate-700 focus:ring-2 focus:ring-teal-500 placeholder:text-gray-300 transition-all"
                                                 placeholder="サイン"
                                                 value={staffName}
                                                 onChange={(e) => setStaffName(e.target.value)}
                                             />
                                         </div>
                                         <button 
                                             onClick={() => {
                                                 if(manualPoints && staffName) {
                                                     setIsConfirmed(true);
                                                 }
                                             }}
                                             disabled={!manualPoints || !staffName}
                                             className="w-full py-4 bg-slate-800 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm hover:bg-slate-700 hover:shadow-lg transition-all"
                                         >
                                             QRを作成
                                         </button>
                                     </div>
                                 </div>
                             </div>
                        ) : (
                            /* MODE B: Cast Name + QR Code (Normal Flow) */
                            <>
                                {/* Cast Name Input */}
                                <div className="mb-4 px-2 animate-in fade-in slide-in-from-top-1">
                                     <input 
                                        type="text" 
                                        className="w-full py-4 bg-slate-50 rounded-xl border-2 border-slate-200 focus:border-teal-500 focus:bg-white outline-none text-center font-medium text-slate-600 placeholder:text-gray-400 transition-all"
                                        placeholder="キャスト名 (任意)"
                                        value={servedBy}
                                        onChange={(e) => setServedBy(e.target.value)}
                                    />
                                </div>

                                {/* Manual Input Toggle (Button OR Confirmation Display) - Moved Here */}
                                <div className="mb-4 px-2">
                                    {!isConfirmed ? (
                                        <button 
                                            onClick={() => {
                                                setIsManualMode(!isManualMode);
                                                if (!isManualMode) {
                                                    setSelectedCourse(null);
                                                    setIsConfirmed(false);
                                                }
                                            }}
                                            className={`w-full py-5 px-4 rounded-xl border border-dashed flex items-center justify-center gap-2 transition-all font-bold text-sm ${isManualMode ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-slate-50 border-slate-300 text-slate-400 hover:bg-slate-100'}`}
                                        >
                                            <div className={`transition-transform duration-200 ${isManualMode ? 'rotate-45' : ''}`}>
                                                <Plus size={16} />
                                            </div>
                                            <span>{isManualMode ? '手動入力を閉じる' : 'ポイントを手動で入力する'}</span>
                                        </button>
                                    ) : (
                                        <div 
                                            onClick={() => setIsConfirmed(false)}
                                            className="w-full py-4 px-4 rounded-xl border-2 border-teal-500 bg-teal-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-teal-100 transition-all animate-in fade-in zoom-in"
                                        >
                                            <div className="text-3xl font-black text-teal-600 tracking-tight leading-none">
                                                {Number(manualPoints).toLocaleString()}<span className="text-sm ml-1">pt</span>
                                            </div>
                                            <div className="text-xs text-teal-600 font-bold flex items-center gap-1">
                                                <PenTool size={12} /> 担当: {staffName} <span className="text-[10px] opacity-70">(タップで修正)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Bottom Section Wrapper (Relative for Overlay) */}
                                <div className="relative w-full flex-1 flex flex-col justify-between">
                                    {/* QR Code Area + Footer (Blurred Group) */}
                                    <div className={`transition-all duration-500 flex flex-col items-center flex-1 pt-2 ${activeCourse || (isManualMode && isConfirmed) ? 'filter-none opacity-100' : 'blur-sm opacity-40 grayscale pointer-events-none'}`}>
                                        
                                        <div className="text-[10px] text-red-500 font-bold text-center leading-relaxed pb-2">
                                            ※このQRコードは1回のみ有効です。<br/>スクショ対策済み
                                        </div>

                                        <div className="bg-white p-3 rounded-xl inline-block shadow-lg relative group transition-all duration-300">
                                            <QRCodeCanvas 
                                                value={earnQrPayload || 'NOT_SELECTED'} 
                                                size={QR_CANVAS_SIZE}
                                                bgColor="#ffffff"
                                                fgColor="#000000"
                                                level={"H"}
                                                includeMargin={true}
                                                style={QR_EARN_CANVAS_STYLE}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        
                    </div>
                </div>
            </div>
        )}

        {showApplyScanModal && (
            <FullScreenScanOverlay
                title="特別会員申請"
                hint="会員の申請QRを枠のあたりに映してください"
                phase={scanOverlayPhase}
                onClose={closeApplyScanOverlay}
                onScan={handleApplyScanResult}
            />
        )}

        {/* Full History Overlay */}

        {showEarnQrSuccess && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-3xl p-8 max-w-sm w-[90%] text-center shadow-2xl transform transition-all scale-100">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-teal-100 text-teal-600">
                        <CheckCircle2 size={48} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">付与完了！</h3>
                    <p className="text-gray-500 mb-6">ポイントを付与しました。</p>
                    
                    {scanResultData && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-gray-100 mb-4">
                             <div className="text-xs text-gray-400 mb-1">付与ポイント</div>
                             <div className="text-3xl font-black text-teal-600">
                                 +{Number(scanResultData.amount).toLocaleString()} <span className="text-base font-normal text-gray-400">pt</span>
                             </div>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Approval Modal */}
        {showApprovalModal && approvalData && (
             <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                 <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-2 bg-yellow-500"></div>
                     
                     <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600 shadow-inner">
                         <ShieldCheck size={40} />
                     </div>
                     
                     <h2 className="text-xl font-black text-slate-800 mb-1">特別会員 申請承認</h2>
                     <p className="text-xs text-gray-400 mb-6">以下の申請内容を確認してください</p>

                     <div className="bg-slate-50 rounded-xl p-4 text-left space-y-3 mb-8 border border-gray-100">
                         <div>
                             <p className="text-[10px] text-gray-400 font-bold">お名前</p>
                             <p className="font-bold text-slate-700 text-lg">{approvalData.name}</p>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                 <p className="text-[10px] text-gray-400 font-bold">電話番号</p>
                                 <p className="font-bold text-slate-700">{approvalData.phone || '未登録'}</p>
                             </div>
                             <div>
                                 <p className="text-[10px] text-gray-400 font-bold">生年月日</p>
                                 <p className="font-bold text-slate-700">{approvalData.birthdate || '未登録'}</p>
                             </div>
                         </div>
                         <div className="pt-2 border-t border-gray-200 mt-2">
                             <p className="text-[10px] text-gray-400 font-bold">現在のステータス</p>
                             <p className="font-mono text-xs text-slate-500">
                                 Rank: {approvalData.rank} / Status: {approvalData.membership_status}
                             </p>
                         </div>
                     </div>

                     <div className="space-y-3">
                         <button 
                             onClick={handleApprove}
                             className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                         >
                             <CheckCircle2 size={20} className="text-yellow-400" />
                             承認してランクアップ
                         </button>
                         <button 
                             onClick={handleReject}
                             className="w-full bg-white text-red-500 font-bold py-3 rounded-xl border border-red-100 hover:bg-red-50 active:scale-95 transition-all"
                         >
                             却下する
                         </button>
                         <button 
                             onClick={() => {
                                 setShowApprovalModal(false);
                                 setApprovalData(null);
                             }}
                             className="text-gray-400 text-sm font-bold mt-2"
                         >
                             キャンセル
                         </button>
                     </div>
                 </div>
             </div>
        )}

        {/* --- COMMON MODALS --- */}

        {/* Error Modal */}
        {errorModal.show && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center shadow-2xl">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 text-red-500">
                        <AlertCircle size={24} />
                    </div>
                    <h3 className="font-bold text-slate-800 mb-2">エラー</h3>
                    <p className="text-gray-500 text-sm mb-6">{errorModal.message}</p>
                    <button 
                        onClick={() => setErrorModal({...errorModal, show: false})}
                        className="w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        )}

        {/* Confirm Modal */}
        {confirmModal.show && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center shadow-2xl">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 text-orange-500">
                        <HelpCircle size={24} />
                    </div>
                    <h3 className="font-bold text-slate-800 mb-2">確認</h3>
                    <p className="text-gray-500 text-sm mb-6">{confirmModal.message}</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => setConfirmModal({...confirmModal, show: false})}
                            className="w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200"
                        >
                            キャンセル
                        </button>
                        <button 
                            onClick={() => {
                                confirmModal.onConfirm();
                                setConfirmModal({...confirmModal, show: false});
                            }}
                            className="w-full bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600 shadow-md"
                        >
                            実行
                        </button>
                    </div>
                </div>
            </div>
        )}

        </div>
    );
};

export default Dashboard;
