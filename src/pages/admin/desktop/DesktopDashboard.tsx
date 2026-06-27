import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { STAFF_MODE_SELECT_PATH } from '../../../lib/routes';
import { AlertTriangle, ChevronRight, Filter, ChevronDown, ChevronUp, FileText, ArrowLeft, ArrowRight, Calendar, X, User, FileSpreadsheet, Download, Loader2, ShieldCheck, Clock, Ban, CheckCircle2, Database, Info, Home, Search, Menu, LayoutGrid } from 'lucide-react';
import { Skeleton } from '../../../components/ui/skeleton';

type SortKey = 'points' | 'lastVisit' | 'name' | 'email';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'HISTORY' | 'MEMBERS';

// Define Transaction Type for History View
type Transaction = {
    id: string;
    created_at: string;
    type: 'EARN' | 'USE' | 'INFO';
    amount: number;
    description?: string;
    is_cancelled: boolean;
    served_by?: string;
    member_id: string;
    member?: {
        name: string;
        member_code: string;
        rank?: 'regular' | 'special';
        is_deleted?: boolean;
    };
};

// ...

// Define Member based on Supabase 'profiles' + 'transactions'
type Member = {
    id: string;
    email: string;
    name: string;
    memberCode: string;
    is_deleted?: boolean;
    role: string;
    points: number;
    staffMemo?: string;
    blacklist?: boolean;
    rank?: 'regular' | 'special';
    membership_expiry?: string;
    transactions?: { date: string }[]; // Simplified for display
};

// Helper to check for recent memo updates (24 hours)
const hasRecentMemoUpdate = (memo: string | null): boolean => {
    if (!memo) return false;
    
    // Match timestamps: [自動記録 YYYY/MM/DD HH:mm] or [自動記録 YYYY/MM/DD]
    // We try to match the most detailed format first
    const regex = /\[自動記録 (\d{4}\/\d{2}\/\d{2})(?: (\d{2}:\d{2}))?\]/g;
    const matches = [...memo.matchAll(regex)];
    
    if (matches.length === 0) return false;

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Check if any timestamp is newer than 24 hours ago
    return matches.some(match => {
        const dateStr = match[1];
        const timeStr = match[2] || '00:00'; // Default to start of day if no time
        const updateTime = new Date(`${dateStr} ${timeStr}`);
        return updateTime > twentyFourHoursAgo;
    });
};

const DesktopDashboard = () => {
    // const { user: currentUser } = useSupabase(); // Get logged-in admin user (Unused)
    const navigate = useNavigate();
    
    const [searchParams, setSearchParams] = useSearchParams();
    
    // View Mode State (Synced with URL)
    const viewMode: ViewMode = (searchParams.get('tab') as ViewMode) || 'HISTORY';

    const setViewMode = (mode: ViewMode) => {
        setSearchParams(prev => {
            prev.set('tab', mode);
            return prev;
        });
    };

    // Data State
    const [allMembers, setAllMembers] = useState<Member[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false); // New: For Load More spinner
    const [txLimit, setTxLimit] = useState(50); // Current display Count (init 50)

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'deleted'>('all');
    const [hasMemoOnly, setHasMemoOnly] = useState(false);
    const [isSpecialOnly, setIsSpecialOnly] = useState(false);
    
    // Date Filter State
    const [filterType, setFilterType] = useState<'period' | 'custom'>('period'); 
    // UX REFINEMENT: Default to 'all' instead of current year
    const [selectedYear, setSelectedYear] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // Menu & Admin Modal State
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showAdminModal, setShowAdminModal] = useState(false);
    
    // Admin Promotion State
    const [promotionEmail, setPromotionEmail] = useState('');
    const [isPromoting, setIsPromoting] = useState(false);
    const [promotionMessage, setPromotionMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

    const [sortKey, setSortKey] = useState<SortKey>('lastVisit');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    // Modal State
    type ActiveModal = {
        type: 'success' | 'cancel_confirm' | 'error' | 'info' | 'confirm';
        title?: string;
        message?: string;
        onConfirm?: () => Promise<void> | void;
    };
    const [activeModal, setActiveModal] = useState<ActiveModal | null>(null);





    // Helper: Date parsing
    const parseDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    };

    // Fast-forward to Modal Handlers
    
    // ... (fetchMembers, fetchRecentTransactions, useEffect) ...

    // Modal Handlers


    // Fetch Data from Supabase
    const fetchMembers = async () => {
        // 1. Fetch Profiles (Members only)
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'member');

        if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
            return;
        }

        // 2. Fetch Transactions (for lastVisit calculation)
        const { data: transactions, error: txError } = await supabase
            .from('transactions')
            .select('member_id, created_at')
            .order('created_at', { ascending: false });

        if (txError) {
            console.error('Error fetching transactions:', txError);
        }

        // 3. Merge Data
        const mergedData: Member[] = (profiles || []).map((p: any) => {
            const userTxs = (transactions || [])
                .filter((tx: any) => tx.member_id === p.id)
                .map((tx: any) => ({ date: tx.created_at }));

            return {
                id: p.id,
                email: p.email,
                name: p.name || '名称未設定',
                memberCode: p.member_code,
                is_deleted: p.is_deleted,
                role: p.role,
                points: p.points,
                staffMemo: p.staff_memo,
                blacklist: p.is_blacklisted,
                rank: p.rank,
                membership_expiry: p.membership_expiry,
                transactions: userTxs
            };
        });

        setAllMembers(mergedData);
    };

    const fetchRecentTransactions = async (isLoadMore = false) => {
        // Fetch next batch based on current length if loading more, or 0 to limit if initial
        const currentLength = isLoadMore ? recentTransactions.length : 0;
        const fetchLimit = isLoadMore ? 50 : txLimit; // Fetch 50 more
        const rangeFrom = currentLength;
        const rangeTo = currentLength + fetchLimit - 1;

        if (isLoadMore) setIsLoadingMore(true);

        const { data, error } = await supabase
            .from('transactions')
            .select(`
                *,
                member:profiles!member_id ( name, member_code, rank, is_deleted )
            `)
            .order('created_at', { ascending: false })
            .range(rangeFrom, rangeTo);

        if (error) {
            console.error('Error fetching recent transactions:', error);
        } else {
            if (isLoadMore) {
                setRecentTransactions(prev => [...prev, ...(data || [])]);
                setTxLimit(prev => prev + (data?.length || 0));
            } else {
                setRecentTransactions(data || []);
            }
        }
        
        if (isLoadMore) setIsLoadingMore(false);
    };

    const handleLoadMore = () => {
        fetchRecentTransactions(true);
    };

    useEffect(() => {
        const initData = async () => {
            setIsLoading(true);
            await Promise.all([
                fetchMembers(),
                fetchRecentTransactions(false)
            ]);
            setIsLoading(false);
        };
        initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only initial load. Load more is manual.

    // Modal Handlers








    // State for CSV/JSON Export
    const [isMemberExporting, setIsMemberExporting] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);

    const handleDownloadMemberCSV = () => {
        setIsMemberExporting(true);
        try {
            // Generate CSV from processedMembers (currently filtered view)
            if (processedMembers.length === 0) {
                setActiveModal({
                    type: 'info',
                    title: '通知',
                    message: '出力対象の会員がいません。'
                });
                setIsMemberExporting(false);
                return;
            }

            const header = ['会員ID', '会員コード', '氏名', 'メールアドレス', 'ポイント', 'ランク', '有効期限', 'ステータス', 'スタッフメモ'];
            
            const rows = processedMembers.map(m => {
                const id = m.id;
                const code = m.memberCode || '';
                const name = m.name || '';
                const email = m.email || '';
                const points = m.points || 0;
                const rank = m.rank === 'special' ? '特別会員' : '通常会員';
                const expiry = m.membership_expiry ? new Date(m.membership_expiry).toLocaleDateString('ja-JP') : (m.rank === 'special' ? '無期限' : '-');
                const status = m.is_deleted ? '削除済み' : (m.blacklist ? '利用停止中' : '有効');
                const memo = m.staffMemo || '';

                return [id, code, name, email, points, rank, expiry, status, memo]
                    .map(field => `"${String(field).replace(/"/g, '""')}"`)
                    .join(',');
            });

            const csvContent = [header.join(','), ...rows].join('\n');
            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
            const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
            
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            const dateStr = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `会員一覧_${dateStr}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setShowExportModal(false); // Close modal on success

        } catch (e: any) {
            console.error('Member export failed:', e);
            setActiveModal({
                type: 'error',
                title: 'エクスポート失敗',
                message: 'エクスポートに失敗しました: ' + e.message
            });
        } finally {
            setIsMemberExporting(false);
        }
    };

    const handleDownloadMemberJSON = () => {
        setIsMemberExporting(true);
        try {
            if (processedMembers.length === 0) {
                setActiveModal({
                    type: 'info',
                    title: '通知',
                    message: '出力対象の会員がいません。'
                });
                setIsMemberExporting(false);
                return;
            }

            const jsonData = JSON.stringify(processedMembers, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            const dateStr = new Date().toISOString().split('T')[0];
            link.setAttribute('download', `会員一覧_${dateStr}.json`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setShowExportModal(false); // Close modal on success

        } catch (e: any) {
            console.error('Member JSON export failed:', e);
            setActiveModal({
                type: 'error',
                title: 'エクスポート失敗',
                message: 'エクスポートに失敗しました。詳細: ' + (e.message || '不明なエラー')
            });
        } finally {
            setIsMemberExporting(false);
        }
    };
    
    // Member Filtering (Existing)
    const processedMembers = useMemo(() => {
        let result = [...allMembers];

        // 1. Search
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(m => 
                (m.name && m.name.toLowerCase().includes(lowerTerm)) || 
                (m.memberCode && m.memberCode.includes(lowerTerm)) ||
                (m.email && m.email.toLowerCase().includes(lowerTerm))
            );
        }

        // 2. Status Filter
        if (statusFilter === 'deleted') {
            result = result.filter(m => m.is_deleted);
        } else {
            // For all, active, suspended -> Exclude deleted members
            result = result.filter(m => !m.is_deleted);

            if (statusFilter === 'suspended') {
                result = result.filter(m => m.blacklist);
            } else if (statusFilter === 'active') {
                result = result.filter(m => !m.blacklist);
            }
        }

        // 3. Memo Filter
        if (hasMemoOnly) {
            result = result.filter(m => m.staffMemo && m.staffMemo.length > 0);
        }

        // 3.5. Special Member Filter
        if (isSpecialOnly) {
            result = result.filter(m => m.rank === 'special');
        }

        // 4. Date Filter
        let filterStart: Date | null = null;
        let filterEnd: Date | null = null;

        if (filterType === 'period') {
            if (selectedYear !== 'all') {
                const year = parseInt(selectedYear);
                if (selectedMonth === 'all') {
                    filterStart = new Date(year, 0, 1);
                    filterEnd = new Date(year, 11, 31, 23, 59, 59);
                } else {
                    const month = parseInt(selectedMonth) - 1;
                    filterStart = new Date(year, month, 1);
                    filterEnd = new Date(year, month + 1, 0, 23, 59, 59);
                }
            }
        } else if (filterType === 'custom') {
            if (customStartDate) {
                filterStart = new Date(customStartDate);
                if (customEndDate) {
                    filterEnd = new Date(customEndDate);
                    filterEnd.setHours(23, 59, 59);
                }
            }
        }

        if (filterStart) {
            result = result.filter(m => {
                const lastTx = m.transactions && m.transactions.length > 0 ? m.transactions[0] : null;
                if (!lastTx) return false; 
                
                const visitDate = parseDate(lastTx.date);
                if (!visitDate) return false;

                if (filterEnd) {
                    return visitDate >= filterStart! && visitDate <= filterEnd;
                } else {
                    return visitDate >= filterStart!;
                }
            });
        }

        // 5. Sorting
        result.sort((a, b) => {
            let valA: any = '';
            let valB: any = '';

            switch (sortKey) {
                case 'points':
                    valA = a.points || 0;
                    valB = b.points || 0;
                    break;
                case 'name':
                    valA = a.name || '';
                    valB = b.name || '';
                    break;
                case 'lastVisit':
                    valA = a.transactions?.[0]?.date || '';
                    valB = b.transactions?.[0]?.date || '';
                    break;
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [allMembers, searchTerm, statusFilter, hasMemoOnly, isSpecialOnly, sortKey, sortOrder, filterType, selectedYear, selectedMonth, customStartDate, customEndDate]);

    // Pagination Logic
    const totalPages = Math.ceil(processedMembers.length / ITEMS_PER_PAGE);
    const paginatedMembers = processedMembers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    // Reset page when filter changes
    useMemo(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, hasMemoOnly, isSpecialOnly, filterType, selectedYear, selectedMonth, customStartDate, customEndDate]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortOrder('desc'); 
        }
    };

    const SortIcon = ({ active }: { active: boolean }) => {
        if (!active) return <div className="w-4 h-4 ml-1 inline-block opacity-20"><Filter size={12} /></div>;
        return sortOrder === 'asc' 
            ? <ChevronUp size={14} className="ml-1 inline-block text-teal-500" />
            : <ChevronDown size={14} className="ml-1 inline-block text-teal-500" />;
    };

    // Helper: Render History View
    const renderHistory = () => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-140px)] animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50 flex-shrink-0">
                <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                    <Clock className="text-teal-500" size={20} />
                    直近の取引履歴
                </h2>
                <div className="text-xs text-gray-500 font-medium">
                   最新 {recentTransactions.length} 件を表示中
                </div>
            </div>
            
            <div className="overflow-y-auto flex-grow">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                        <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                            <th className="px-6 py-4 font-bold w-40">日時</th>
                            <th className="px-6 py-4 font-bold">会員名</th>
                            <th className="px-6 py-4 font-bold w-24 text-center">種別</th>
                            <th className="px-6 py-4 font-bold">取引内容</th>
                            <th className="px-6 py-4 font-bold text-center w-24">残高</th>
                            <th className="px-6 py-4 font-bold text-right w-24">ポイント</th>
                            <th className="px-6 py-4 font-bold text-center w-36 whitespace-nowrap">ステータス</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {recentTransactions.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-20 text-center text-gray-400">
                                    <Clock size={48} className="opacity-20 mx-auto mb-4" />
                                    <p>取引履歴はありません</p>
                                </td>
                            </tr>
                        ) : (
                            recentTransactions.map((tx) => {
                                const isMemberDeleted = tx.member?.is_deleted;
                                return (
                                    <tr key={tx.id} className={`transition-colors group ${
                                        isMemberDeleted ? 'bg-gray-100/50 grayscale opacity-70 hover:bg-gray-100' : 
                                        'hover:bg-slate-50'
                                    }`}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {new Date(tx.created_at).toLocaleString('ja-JP', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            {isMemberDeleted ? (
                                                <span className={`font-bold ${
                                                    tx.member?.rank === 'special' 
                                                        ? 'text-yellow-600' 
                                                        : 'text-slate-700'
                                                }`}>
                                                    {tx.member?.name || '不明な会員'}
                                                </span>
                                            ) : (
                                                <button 
                                                    onClick={() => navigate(`/admin/office/members/${tx.member_id}`)}
                                                    className={`font-bold hover:underline text-left transition-colors flex items-center gap-1 ${
                                                        tx.member?.rank === 'special' 
                                                        ? 'text-yellow-600 hover:text-yellow-700' 
                                                        : 'text-slate-700 hover:text-teal-600'
                                                    }`}
                                                >
                                                    {tx.member?.name || '不明な会員'}
                                                </button>
                                            )}
                                            
                                            <div className="text-xs text-gray-400 font-mono tracking-wider">
                                                {tx.member?.member_code || '---'}
                                            </div>

                                            {tx.member?.rank === 'special' && (
                                                <ShieldCheck size={14} className="fill-yellow-600 text-white" />
                                            )}
                                            {isMemberDeleted && (
                                                <span className="text-xs text-red-500 font-bold border border-red-200 bg-red-50 px-1.5 py-0.5 rounded">
                                                    (削除済)
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                            tx.is_cancelled 
                                                ? 'bg-gray-100 text-gray-500 border border-gray-200'
                                                : (tx.description?.includes('【修正') || tx.description?.includes('【調整'))
                                                    ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                                                    : tx.type === 'EARN' 
                                                        ? (tx.member?.rank === 'special' ? 'bg-yellow-100 text-yellow-700' : 'bg-teal-100 text-teal-700') 
                                                        : (tx.type === 'USE' ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600') 
                                        }`}>
                                            {tx.is_cancelled ? '取消' : (tx.description?.includes('【修正') || tx.description?.includes('【調整')) ? '修正' : (tx.type === 'EARN' ? '獲得' : (tx.type === 'USE' ? '利用' : '通知'))}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`text-sm flex items-center gap-2 flex-wrap ${tx.is_cancelled ? 'line-through text-gray-400 decoration-gray-400' : ''}`}>
                                            <span className="text-slate-800">
                                                {(() => {
                                                    // New: Extract simple title for INFO
                                                    if (tx.type === 'INFO') {
                                                        return (tx.description || '').replace('【システム】', '').replace('会員による', '').split(':')[0].trim();
                                                    }

                                                    const desc = (tx.description || '')
                                                        .replace(/【修正:.*?】/, '') // Remove Correction prefix tag
                                                        .replace(/【調整:.*?】/, '') // Remove Adjustment prefix tag
                                                        .replace(/\(元: \d+pt\)/, '')
                                                        .replace('【利用】', '')
                                                        .replace('【システム】', '')
                                                        .trim();
                                                    
                                                    if (desc.includes('Course QR:')) return desc.replace('Course QR:', '').trim();
                                                    if (desc === 'Point usage via QR scan' || desc === 'QRコード利用') return 'ポイント利用';
                                                    return desc.replace('Point usage via QR scan', 'ポイント利用') || (tx.type === 'EARN' ? 'ポイント獲得' : (tx.type === 'USE' ? 'ポイント利用' : '通知'));
                                                })()}
                                            </span>
                                            {tx.served_by && 
                                             !tx.served_by.includes('System') && 
                                             !tx.served_by.includes('SYSTEM') && 
                                             !tx.served_by.includes('システム') && (
                                                <span className="text-xs text-slate-500">
                                                    ({tx.served_by})
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        <span className="font-bold text-lg text-slate-600">
                                            {tx.type !== 'INFO' && (tx as any).balance_snapshot !== null && (tx as any).balance_snapshot !== undefined
                                                ? `${(tx as any).balance_snapshot.toLocaleString()} pt` 
                                                : '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`font-bold text-lg ${
                                            tx.is_cancelled ? 'line-through text-gray-400 decoration-gray-400' :
                                            tx.type === 'INFO' ? 'text-gray-400' : 
                                            (tx.member?.rank === 'special' ? 'text-yellow-600' : 'text-slate-700')
                                        }`}>
                                            {tx.type === 'INFO' ? '-' : tx.amount.toLocaleString()}
                                        </span>
                                        <span className={`text-xs text-gray-400 ml-1 ${tx.is_cancelled ? 'line-through decoration-gray-400' : ''}`}>pt</span>
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        {tx.is_cancelled ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-50 text-red-500 text-xs font-bold">
                                                <Ban size={12} /> 取消済み
                                            </span>
                                        ) : (
                                            /* Correction Button Removed */
                                            (!isMemberDeleted && tx.type !== 'INFO') ? (
                                                <span className="text-gray-300 text-xs">-</span>
                                            ) : (
                                                <span className="text-gray-300 text-xs">-</span>
                                            )
                                        )}
                                    </td>

                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
            
            {/* Load More Button (Optional) */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
                 <button 
                    onClick={handleLoadMore}
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
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="h-screen bg-slate-100 font-sans flex flex-col overflow-hidden">
                {/* Skeleton Header */}
                <div className="bg-slate-800 h-16 shadow-md z-10 sticky top-0 flex-shrink-0">
                    <div className="max-w-5xl mx-auto px-8 h-full flex items-center justify-between">
                         <div className="flex gap-4 items-center">
                             <Skeleton className="w-8 h-8 rounded bg-slate-700" />
                             <Skeleton className="w-40 h-6 bg-slate-700" />
                         </div>
                         <div className="flex gap-4">
                             <Skeleton className="w-32 h-8 rounded-md bg-slate-700" />
                             <Skeleton className="w-32 h-8 rounded-md bg-slate-700" />
                         </div>
                    </div>
                </div>

                <main className="flex-grow p-8 max-w-7xl mx-auto w-full flex flex-col overflow-hidden">
                    {/* Skeleton Filter Area */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 flex-shrink-0 space-y-4">
                        <div className="flex justify-between gap-6">
                            <Skeleton className="h-12 flex-grow max-w-lg rounded-lg" />
                            <div className="flex gap-4">
                                <Skeleton className="w-64 h-10 rounded-lg" />
                                <Skeleton className="w-32 h-10 rounded-lg" />
                            </div>
                        </div>
                        <div className="h-px bg-gray-100 w-full"></div>
                        <div className="flex gap-4">
                            <Skeleton className="w-40 h-8 rounded" />
                            <Skeleton className="w-40 h-8 rounded" />
                        </div>
                    </div>

                    {/* Skeleton Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-grow overflow-hidden max-w-5xl mx-auto w-full">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between">
                            <Skeleton className="w-40 h-6" />
                            <Skeleton className="w-20 h-4" />
                        </div>
                        <div className="p-4 space-y-4">
                             {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                 <div key={i} className="flex gap-4 items-center border-b border-gray-50 pb-4 last:border-0">
                                     <Skeleton className="w-24 h-4" />
                                     <Skeleton className="w-48 h-6 rounded" />
                                     <Skeleton className="w-16 h-6 rounded px-2" />
                                     <Skeleton className="w-full h-4" />
                                     <Skeleton className="w-20 h-6 rounded" />
                                 </div>
                             ))}
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="h-screen bg-slate-100 font-sans text-slate-800 flex flex-col overflow-hidden">
            
            {/* Desktop Header */}
            <header className="bg-slate-800 text-white shadow-md z-30 sticky top-0 flex-shrink-0">
                <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-4">
                            <div className="bg-teal-500 w-8 h-8 rounded flex items-center justify-center font-bold text-lg">
                                A
                            </div>
                            <h1 className="font-bold text-lg tracking-wide">店舗管理画面 (Office)</h1>
                        </div>
                        
                        {/* View Mode Toggle */}
                        <div className="bg-slate-700 p-1 rounded-lg flex items-center border border-slate-600">
                            <button 
                                onClick={() => setViewMode('HISTORY')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                                    viewMode === 'HISTORY' 
                                    ? 'bg-teal-500 text-white shadow-md' 
                                    : 'text-slate-300 hover:text-white hover:bg-slate-600'
                                }`}
                            >
                                <Clock size={16} />
                                取引履歴
                            </button>
                            <button 
                                onClick={() => setViewMode('MEMBERS')}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${
                                    viewMode === 'MEMBERS' 
                                    ? 'bg-teal-500 text-white shadow-md' 
                                    : 'text-slate-300 hover:text-white hover:bg-slate-600'
                                }`}
                            >
                                <User size={16} />
                                会員名簿
                            </button>
                            {/* Reverted Settings Button */}
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        <div className="text-sm text-slate-300 bg-slate-700/50 px-3 py-1 rounded-full border border-slate-600 flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                             <span className="font-medium">ログイン中</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => navigate('/admin/office')} 
                                className="w-10 h-10 flex items-center justify-center text-slate-300 hover:bg-slate-700 hover:text-white rounded-full transition-all"
                                title="ダッシュボード"
                            >
                                <Home size={20} />
                            </button>

                            <div className="relative z-50">
                                <button 
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                                        isMenuOpen 
                                        ? 'bg-slate-700 text-white shadow-inner' 
                                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                                    }`}
                                    title="メニュー"
                                >
                                    {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
                                </button>

                                {isMenuOpen && (
                                    <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                        <div className="px-4 py-3 border-b border-gray-100 mb-1">
                                            <p className="text-xs text-gray-400 font-medium">メニュー</p>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                navigate(STAFF_MODE_SELECT_PATH);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-teal-600 flex items-center gap-3 transition-colors"
                                        >
                                            <div className="p-1.5 bg-slate-100 rounded text-slate-500">
                                                <LayoutGrid size={16} />
                                            </div>
                                            モード選択
                                        </button>
                                        
                                        <button 
                                            onClick={() => {
                                                setIsMenuOpen(false);
                                                setShowAdminModal(true);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-teal-600 flex items-center gap-3 transition-colors"
                                        >
                                            <div className="p-1.5 bg-slate-100 rounded text-slate-500">
                                                <ShieldCheck size={16} />
                                            </div>
                                            管理者昇格
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-grow p-8 max-w-7xl mx-auto w-full flex flex-col overflow-hidden">
                
                {viewMode === 'HISTORY' ? renderHistory() : (
                    <div className="flex flex-col h-full overflow-hidden w-full max-w-5xl mx-auto">
                        {/* Advanced Filter Toolbar */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 space-y-6 flex-shrink-0">
                    
                    {/* Top Row: Basic Filters */}
                    <div className="flex justify-between items-start gap-6">
                        {/* 1. Search (Main) */}
                        <div className="relative flex-grow max-w-lg">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input 
                                type="text" 
                                placeholder="名前 / 会員ID / メールアドレスで検索..." 
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm bg-gray-50/50"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-4 items-center">
                            {/* 2. Status Filter Buttons */}
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button 
                                    onClick={() => setStatusFilter('all')}
                                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${statusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    すべて
                                </button>
                                <button 
                                    onClick={() => setStatusFilter('active')}
                                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${statusFilter === 'active' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    有効のみ
                                </button>
                                <button 
                                    onClick={() => setStatusFilter('suspended')}
                                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${statusFilter === 'suspended' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    停止中
                                </button>
                                <button 
                                    onClick={() => setStatusFilter('deleted')}
                                    className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
                                        statusFilter === 'deleted' 
                                            ? 'bg-white text-slate-800 shadow-sm' 
                                            : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    削除済み
                                </button>
                            </div>

                            {/* 3. Memo Toggle */}
                            <button 
                                onClick={() => setHasMemoOnly(!hasMemoOnly)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-bold transition-colors ${
                                    hasMemoOnly 
                                    ? 'bg-yellow-50 border-yellow-300 text-yellow-700' 
                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                                <FileText size={16} className={hasMemoOnly ? 'fill-yellow-700' : ''} />
                                要確認
                            </button>

                            {/* 4. Special Member Toggle */}
                             <button 
                                onClick={() => setIsSpecialOnly(!isSpecialOnly)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-bold transition-colors ${
                                    isSpecialOnly 
                                    ? 'bg-yellow-500 border-yellow-400 text-white shadow-md' 
                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                                <ShieldCheck size={16} className={isSpecialOnly ? 'fill-white' : ''} />
                                特別会員
                            </button>
                        </div>
                    </div>

                    {/* Middle Row: Date Filters & CSV Export */}
                    <div className="flex items-center gap-4 border-t border-gray-100 pt-4">
                         <div className="flex items-center gap-2 text-gray-500 font-bold text-sm">
                             <Calendar size={18} />
                             対象期間:
                         </div>
                         
                         {/* Filter Mode Switch */}
                         <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold">
                             <button
                                onClick={() => setFilterType('period')}
                                className={`px-3 py-1.5 rounded transition-all ${filterType === 'period' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'}`}
                             >
                                 年月指定
                             </button>
                             <button
                                onClick={() => setFilterType('custom')}
                                className={`px-3 py-1.5 rounded transition-all ${filterType === 'custom' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'}`}
                             >
                                 期間指定
                             </button>
                         </div>
                         
                         {filterType === 'period' && (
                             <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                 <select 
                                    className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                 >
                                     <option value="all">全期間 (年)</option>
                                     <option value="2026">2026年</option>
                                     <option value="2025">2025年</option>
                                     <option value="2024">2024年</option>
                                     <option value="2023">2023年</option>
                                 </select>
                                 
                                 <select 
                                    className="bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 font-bold disabled:opacity-50"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    disabled={selectedYear === 'all'}
                                 >
                                     <option value="all">すべての月</option>
                                     {[...Array(12)].map((_, i) => (
                                         <option key={i + 1} value={String(i + 1)}>{i + 1}月</option>
                                     ))}
                                 </select>
                             </div>
                         )}

                         {filterType === 'custom' && (
                             <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                 <input 
                                     type="date" 
                                     className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                     value={customStartDate}
                                     onChange={(e) => setCustomStartDate(e.target.value)}
                                 />
                                 <span className="text-gray-400">～</span>
                                 <input 
                                     type="date" 
                                     className="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                     value={customEndDate}
                                     onChange={(e) => setCustomEndDate(e.target.value)}
                                 />
                             </div>
                         )}

                        {/* CSV Export Button (Moved Here) */}
                        <div className="ml-auto flex items-center gap-3">
                             {(selectedYear !== 'all' || selectedMonth !== 'all' || customStartDate || searchTerm || statusFilter !== 'all' || hasMemoOnly) && (
                                <button 
                                    onClick={() => {
                                        setSearchTerm('');
                                        setStatusFilter('all');
                                        setHasMemoOnly(false);
                                        setIsSpecialOnly(false);
                                        setFilterType('period');
                                        setSelectedYear('all');
                                        setSelectedMonth('all');
                                        setCustomStartDate('');
                                        setCustomEndDate('');
                                    }}
                                    className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 font-bold"
                                >
                                    <X size={14} /> 条件クリア
                                </button>
                             )}

                            <div className="h-6 w-px bg-gray-200 mx-2"></div>
                            
                            {/* Hit Count & Info */}
                            <div className="text-xs text-slate-500 font-medium whitespace-nowrap mr-2">
                                <span className={sortKey !== 'lastVisit' ? 'text-teal-600 font-bold' : ''}>
                                    {sortKey === 'lastVisit' && '最終来店日順'}
                                    {sortKey === 'points' && 'ポイント順'}
                                    {sortKey === 'name' && '名前順'}
                                </span>
                                <span className="mx-2 text-slate-300">|</span>
                                ヒット: <span className="font-bold text-slate-700">{processedMembers.length}</span> 件
                            </div>

                            <button 
                                onClick={() => setShowExportModal(true)}
                                disabled={isMemberExporting}
                                className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-1.5 px-4 rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                                title="現在表示中の会員リストを出力します"
                            >
                                {isMemberExporting ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : (
                                    <Download size={14} />
                                )}
                                データ出力
                            </button>
                        </div>
                    </div>

                    {/* Data Export Modal */}
                    {showExportModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-100">
                                    <div className="font-bold text-slate-800 flex items-center gap-2">
                                        <Download size={18} className="text-teal-500" />
                                        会員データのエクスポート
                                    </div>
                                    <button 
                                        onClick={() => setShowExportModal(false)}
                                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                                
                                <div className="p-6 space-y-4">
                                    <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-4 border border-blue-100">
                                        現在表示中の会員 <strong>{processedMembers.length}名</strong> を出力します。
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        <button
                                            onClick={handleDownloadMemberCSV}
                                            className="flex items-center justify-between p-4 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-green-100 text-green-700 rounded-lg group-hover:bg-green-200 transition-colors">
                                                    <FileSpreadsheet size={24} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800">CSV 形式</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">Excel・スプレッドシート用</div>
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-500" />
                                        </button>

                                        <button
                                            onClick={handleDownloadMemberJSON}
                                            className="flex items-center justify-between p-4 border-2 border-slate-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-yellow-100 text-yellow-700 rounded-lg group-hover:bg-yellow-200 transition-colors">
                                                    <Database size={24} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800">JSON 形式</div>
                                                    <div className="text-xs text-gray-500 mt-0.5">システム連携・バックアップ用</div>
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="text-gray-300 group-hover:text-purple-500" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                                    <button
                                        onClick={() => setShowExportModal(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                                    >
                                        キャンセル
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden">
                    <div className="overflow-y-auto flex-grow">
                        <table className="w-full text-left border-collapse table-fixed">
                            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                                <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="px-2 py-2 font-bold text-left cursor-pointer hover:bg-slate-100 transition-colors w-[180px] pl-4" onClick={() => handleSort('name')}>
                                        氏名 <SortIcon active={sortKey === 'name'} />
                                    </th>
                                    <th className="px-2 py-2 font-bold text-left w-[110px]">
                                        会員ID
                                    </th>
                                    <th className="px-2 py-2 font-bold text-right cursor-pointer hover:bg-slate-100 transition-colors w-[140px] pr-4" onClick={() => handleSort('points')}>
                                        保有ポイント <SortIcon active={sortKey === 'points'} />
                                    </th>
                                    <th className="px-2 py-2 font-bold text-center cursor-pointer hover:bg-slate-100 transition-colors w-[120px]" onClick={() => handleSort('lastVisit')}>
                                        最終利用日 <SortIcon active={sortKey === 'lastVisit'} />
                                    </th>
                                    <th className="px-2 py-2 font-bold text-center w-[120px]">ステータス</th>
                                    <th className="px-2 py-2 font-bold text-left cursor-pointer hover:bg-slate-100 transition-colors w-[220px]" onClick={() => handleSort('email')}>
                                        メールアドレス <SortIcon active={sortKey === 'email'} />
                                    </th>
                                    <th className="px-2 py-2 font-bold text-center w-[100px]">詳細</th>
                                    <th className="w-auto"></th> {/* Spacer column to pack others left */}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedMembers.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-20 text-center text-gray-400 flex flex-col items-center justify-center gap-4">
                                            <Search size={48} className="opacity-20" />
                                            <p>条件に一致する会員は見つかりませんでした</p>
                                            <button onClick={() => {
                                                setSearchTerm('');
                                                setStatusFilter('all');
                                                setHasMemoOnly(false);
                                                setIsSpecialOnly(false);
                                            }} className="text-teal-600 hover:underline">
                                                条件をリセット
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedMembers.map((member) => {
                                        const lastTx = member.transactions?.[0] ?? null;

                                        let statusConfig = { text: '有効', className: 'bg-emerald-100 text-emerald-600 border-emerald-200' };
                                        if (member.is_deleted) {
                                            statusConfig = { text: '無効', className: 'bg-red-100 text-red-600 border-red-200' };
                                        } else if (member.blacklist) {
                                            statusConfig = { text: '停止中', className: 'bg-red-100 text-red-600 border-red-200' };
                                        } else if (member.rank === 'special') {
                                            statusConfig = { text: '特別会員', className: 'bg-yellow-100 text-yellow-700 border-yellow-300 shadow-sm' };
                                        }

                                        return (
                                            <tr key={member.id} className={`hover:bg-teal-50/30 transition-colors group ${member.blacklist ? 'bg-red-50/10' : ''}`}>
                                                <td className="px-2 py-2 pl-4">
                                                    <div className="flex items-center justify-start gap-3">
                                                        <div className={`
                                                            w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm flex-shrink-0
                                                            ${member.blacklist ? 'bg-red-100 text-red-600' : 'bg-white border border-gray-200 text-slate-600'}
                                                        `}>
                                                            {member.name.slice(0, 1)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-700 text-base flex items-center gap-2">
                                                                <span className="truncate max-w-[140px]">{member.name}</span>
                                                                {member.rank === 'special' && (
                                                                    <span className="inline-block w-3 h-3 bg-yellow-400 rounded-sm transform rotate-45 shadow-sm" title="特別会員" />
                                                                )}
                                                                {hasRecentMemoUpdate(member.staffMemo || null) && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-600 border border-blue-200 animate-pulse whitespace-nowrap ml-1">
                                                                        <Info size={12} strokeWidth={2.5} />
                                                                        更新
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2 font-mono text-base text-slate-500 text-left">
                                                    {member.memberCode}
                                                </td>
                                                <td className={`px-2 py-2 text-right font-bold text-lg pr-4 ${member.rank === 'special' ? 'text-yellow-600' : 'text-teal-600'}`}>
                                                    {(member.points || 0).toLocaleString()} <span className="text-sm text-gray-400 font-normal">pt</span>
                                                </td>
                                                <td className="px-2 py-2 text-base text-gray-500 text-center">
                                                    {lastTx ? (
                                                        <div>
                                                            <p className="font-medium text-slate-700">{new Date(lastTx.date).toLocaleDateString()}</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 text-center">
                                                    {member.blacklist ? (
                                                        <span className="inline-flex items-center gap-1 w-20 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold border border-red-200 pl-2">
                                                            <AlertTriangle size={10} /> 停止中
                                                        </span>
                                                    ) : member.rank === 'special' ? (
                                                        <span className="inline-flex items-center gap-1 w-24 py-1.5 rounded-full bg-yellow-50 text-yellow-700 text-xs font-bold border border-yellow-200 shadow-sm pl-2">
                                                            <ShieldCheck size={10} className="fill-yellow-700 text-yellow-100" /> 特別会員
                                                        </span>
                                                    ) : (
                                                        <span className={`inline-block w-20 py-1 rounded-full text-xs font-bold border text-center ${statusConfig.className}`}>
                                                            {statusConfig.text}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 text-sm text-slate-600 truncate max-w-[220px] text-left" title={member.email}>
                                                    {member.email}
                                                </td>
                                                <td className="py-2 px-2 text-center">
                                                    <button 
                                                        onClick={() => navigate(`/admin/office/members/${member.id}`)}
                                                        className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm whitespace-nowrap"
                                                    >
                                                        会員詳細
                                                    </button>
                                                </td>
                                                <td></td>
                                            </tr>
                                        );
                                    })
                                
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="mt-auto border-t border-gray-200 p-4 bg-gray-50 flex items-center justify-between flex-shrink-0 z-20 relative">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded disabled:opacity-30 transition-all"
                            >
                                <ArrowLeft size={16} /> 前へ
                            </button>
                            
                            <span className="text-sm font-medium text-slate-500">
                                <span className="text-slate-900 font-bold">{currentPage}</span> / {totalPages} ページ
                            </span>
                            
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="flex items-center gap-1 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded disabled:opacity-30 transition-all"
                            >
                                次へ <ArrowRight size={16} />
                            </button>
                        </div>
                    )}
                </div>

                </div>
            )}
        </main>

                        {/* Modals */}
            {activeModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl transform transition-all scale-100 relative">
                        {/* Close Button */}
                        <button 
                            onClick={() => setActiveModal(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X size={24} />
                        </button>

                        {/* Title */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                activeModal.type === 'cancel_confirm' ? 'bg-orange-100 text-orange-600' :
                                activeModal.type === 'error' ? 'bg-red-100 text-red-600' :
                                activeModal.type === 'success' || activeModal.type === 'info' ? 'bg-teal-100 text-teal-600' :
                                'bg-slate-100 text-slate-600'
                            }`}>
                                {activeModal.type === 'cancel_confirm' || activeModal.type === 'error' ? <AlertTriangle size={24} /> :
                                 activeModal.type === 'success' || activeModal.type === 'info' ? <CheckCircle2 size={24} /> :
                                 <FileText size={24} />}
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">
                                {activeModal.title || (

                                    activeModal.type === 'error' ? 'エラー' :
                                    activeModal.type === 'info' ? '通知' :
                                    '確認'
                                )}
                            </h3>
                        </div>

                        {/* Content */}
                        <p className="text-gray-500 text-sm mb-6 leading-relaxed whitespace-pre-wrap">
                            {activeModal.message}
                        </p>
                        
                        {/* Footer Buttons */}
                        <div className="flex gap-3 mt-6">
                            <button 
                                onClick={() => setActiveModal(null)}
                                className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 shadow-lg transition-colors"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin Promotion Modal */}
            {showAdminModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-800 px-6 py-4 flex justify-between items-center text-white">
                            <h3 className="font-bold flex items-center gap-2">
                                <ShieldCheck size={20} className="text-teal-400" />
                                管理者権限の付与
                            </h3>
                            <button 
                                onClick={() => setShowAdminModal(false)}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                                一般スタッフのアカウントを管理者に昇格させます。<br/>
                                管理者になると、PC管理画面および設定へのアクセスが可能になります。
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-1">対象スタッフの会員番号</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 bg-gray-50 rounded-lg text-sm outline-none border border-gray-200 focus:border-teal-500 focus:bg-white transition-all font-mono"
                                        placeholder="123456"
                                        value={promotionEmail}
                                        onChange={(e) => setPromotionEmail(e.target.value)}
                                    />
                                </div>

                                {promotionMessage && (
                                    <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${promotionMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        {promotionMessage.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
                                        {promotionMessage.text}
                                    </div>
                                )}

                                <button 
                                    onClick={async () => {
                                        if (!promotionEmail) return;
                                        setIsPromoting(true);
                                        setPromotionMessage(null);
                                        
                                        // Mock implementation for UI only as requested
                                        // In real app, this would call Supabase Edge Function or RPC
                                        setTimeout(() => {
                                            setIsPromoting(false);
                                            setPromotionMessage({
                                                type: 'success',
                                                text: `${promotionEmail} に管理者権限を付与しました。(モック)`
                                            });
                                            setPromotionEmail('');
                                        }, 1000);
                                    }}
                                    disabled={!promotionEmail || isPromoting}
                                    className="w-full py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isPromoting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                                    管理者にする
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DesktopDashboard;
