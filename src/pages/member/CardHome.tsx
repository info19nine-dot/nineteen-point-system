import { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { Scan, QrCode, ChevronLeft, X, History as HistoryIcon, CheckCircle2, Settings, AlertTriangle, User, ShieldCheck } from 'lucide-react'; 
import { QRCodeCanvas } from 'qrcode.react';
import { FullScreenScanOverlay } from '../../components/features/card/FullScreenScanOverlay';
import { QR_CANVAS_SIZE, QR_CANVAS_STYLE } from '../../lib/qrDisplay';
import { Skeleton } from '../../components/ui/skeleton';

// 取引履歴の型定義
type Transaction = {
    id: string;
    type: 'EARN' | 'USE' | 'INFO';
    amount: number;
    description?: string;
    created_at: string;
    is_cancelled?: boolean;
    served_by?: string;
    balance_snapshot?: number;
};

type ActiveModal = {
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
};

const CardHome = () => {
  const { user, profile, loading: authLoading } = useSupabase();
  const navigate = useNavigate();
  const [spendAmount, setSpendAmount] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'home' | 'scan' | 'code' | 'history'>('home');
  
  const isSpecial = profile?.rank === 'special'; // Helper const
  
  const [successMode, setSuccessMode] = useState<'none' | 'earn' | 'pay'>('none');
  const [earnedAmount, setEarnedAmount] = useState(0);
  const [isQrConfirmed, setIsQrConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMode, setErrorMode] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal | null>(null); // Replaces generalError
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  
  // Real Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Filtered & Formatted Transactions Logic
  const visibleTransactions = transactions.filter(tx => {
      // 1. Hide legacy system logs (System Account Changes)
      if (tx.amount === 0 && tx.description?.includes('【システム】') && tx.description.includes('アカウント')) return false;

      // 2. Handle INFO type filtering
      if (tx.type === 'INFO') {
          // Allow Rank Changes to be visible
          if (tx.description?.includes('ランク変更')) return true;
          // Hide other INFO types (Email/Phone changes, etc.)
          return false;
      }

      // 3. Show EARN and USE types
      return true;
  });

  const getTxDisplay = (tx: Transaction) => {
      let title = tx.type === 'EARN' ? 'ポイント獲得' : (tx.type === 'USE' ? 'ポイント利用' : '通知');
      let subTitle = ''; 
      let icon = tx.type === 'EARN' ? <Scan size={18} /> : (tx.type === 'USE' ? <QrCode size={18} /> : <Settings size={18} />);
      let iconBg = tx.type === 'EARN' 
          ? (isSpecial ? 'bg-yellow-900/20 text-yellow-500' : 'bg-teal-50 text-teal-600') 
          : (tx.type === 'USE' 
              ? (isSpecial ? 'bg-slate-800 text-gray-400' : 'bg-orange-50 text-orange-600')
              : 'bg-blue-50 text-blue-600'); // INFO
              
      let amountTxt = tx.type === 'INFO' ? '' : `${tx.type === 'EARN' ? '+' : '-'}${tx.amount.toLocaleString()}`;
      let amountClass = tx.type === 'EARN' 
          ? (isSpecial ? 'text-yellow-600' : 'text-teal-600') 
          : (isSpecial ? 'text-white' : 'text-slate-800');

      let originalAmount: number | null = null;
      let originalCourse: string | null = null;
      let desc = tx.description || '';

      // 1. Extract Original Amount (for strikethrough)
      const match = desc.match(/\(元: (\d+)pt\)/);
      if (match) {
          originalAmount = parseInt(match[1]);
          desc = desc.replace(/\(元: \d+pt\)/, '').trim();
      }

      // 2. Extract Original Course
      const courseMatch = desc.match(/\(元コース: ([^)]+)\)/);
      if (courseMatch) {
          originalCourse = courseMatch[1];
          desc = desc.replace(/\(元コース: [^)]+\)/, '').trim();
      }

      // 3. Extract Cast Name
      if ((tx as any).served_by) {
          subTitle = (tx as any).served_by;
      }

      // 4. Determine Title Logic
      if (tx.type === 'INFO') {
          title = desc; // Use raw description for now, or parse if needed
          if (desc.includes('電話番号変更')) title = '電話番号変更';
          if (desc.includes('メールアドレス変更')) title = 'メールアドレス変更';
      }
      else if (tx.amount === 0 && desc.includes('【システム】')) {
          amountTxt = '';
          if (desc.includes('ランク変更')) {
              title = desc.includes('→ 特別会員') ? '特別会員へランクアップ！' : '通常会員へ変更';
              icon = desc.includes('→ 特別会員') ? <ShieldCheck size={18} /> : <User size={18} />;
              iconBg = desc.includes('→ 特別会員') ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500';
          } else if (desc.includes('有効期限')) {
              title = '有効期限の更新';
              icon = <HistoryIcon size={18} />;
              iconBg = isSpecial ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-500';
          }
      } 
      else if (desc.includes('【利用】')) {
          title = desc.replace('【利用】', '').trim();
      } 
      else if (desc.includes('【修正:')) {
          if (originalCourse) {
              title = originalCourse;
          } else {
              title = tx.type === 'EARN' ? 'ポイント調整（加算）' : 'ポイント調整（減算）';
          }
      } 
      else if (desc.includes('【調整:')) {
           title = tx.type === 'EARN' ? 'ポイント調整（加算）' : 'ポイント調整（減算）';
      }
      else if (desc.includes('Course QR:')) {
           title = desc.replace('Course QR:', '').trim();
      }
      else if (desc.includes('Point usage via QR scan') || desc === 'QRコード利用') {
           title = 'ポイント利用';
      }
      else {
           // Fallback for any other English or raw descriptions
           title = desc.replace('Point usage via QR scan', 'ポイント利用') || (tx.type === 'EARN' ? 'ポイント獲得' : (tx.type === 'USE' ? 'ポイント利用' : '通知'));
      }

      return { title, subTitle, icon, iconBg, amountTxt, amountClass, originalAmount };
  };

  // Fetch Transactions Logic
  useEffect(() => {
    fetchHistory();
  }, [user]);

  // Check for Account Deletion (Show Overlay)
  useEffect(() => {
      if (profile && profile.is_deleted) {
          setShowDeletedModal(true);
      }
  }, [profile]);

  const handleLogout = () => {
       supabase.auth.signOut().then(() => {
           navigate('/');
       });
  };

  const fetchHistory = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('member_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
      
      if (error) {
          console.error('Error fetching transactions:', error);
      } else {
          setTransactions(data as any[] || []);
      }
      setLoadingHistory(false);
  };



  // Realtime Listener for ALL transactions (Sync & Payment Popup)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`transactions:${user.id}`)
      .on(
        'postgres_changes',
        {
            event: '*', // Listen for INSERT and UPDATE (Cancellation)
            schema: 'public',
            table: 'transactions',
            filter: `member_id=eq.${user.id}`,
        },
        (payload: any) => {
            fetchHistory(); // Always refresh history data

            // Handle Payment (USE) Popup - Only on new INSERT
            if (payload.eventType === 'INSERT') {
                const newTransaction = payload.new as Transaction;
                
                if (newTransaction.type === 'USE' && !newTransaction.is_cancelled) {
                    // Determine amount
                    setSpendAmount(newTransaction.amount.toString());
                    
                    // Show Success Popup & Return to Home
                    setActiveTab('home'); // Auto-navigate back to top
                    setSuccessMode('pay');
                    
                    // Auto-hide popup after 3 seconds
                    setTimeout(() => {
                        setSuccessMode('none');
                    }, 3000);
                }
            }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // ----------------------------------------------------------------
  // Real QR Scan Logic (Member EARNS points)
  // ----------------------------------------------------------------
  const handleScanResult = async (text: string) => {
      if (successMode !== 'none' || isSubmitting) return;
      if (!text) return;

      try {
          if (profile?.is_blacklisted) {
              setErrorMode('suspended');
              return;
          }
          if (profile?.is_deleted) {
              setErrorMode('deleted');
              return;
          }

          let data;
          try {
              data = JSON.parse(text);
          } catch {
              setActiveModal({ type: 'error', title: '読み取りエラー', message: 'このQRコードは店舗のポイント用QRではありません' });
              return;
          }

          const { type, courseId, courseName, timestamp, qrId, servedBy } = data;
          const amount = data.amount ?? data.points;

          if (type !== 'EARN' || !amount) {
              setActiveModal({ type: 'error', title: '読み取りエラー', message: '店舗のコースQRを選んでから表示されたコードを読み取ってください' });
              return;
          }

          const now = Date.now();
          if (!timestamp || now - timestamp > 1000 * 60 * 60) {
              setActiveModal({ type: 'error', title: 'エラー', message: 'QRコードの有効期限が切れています' });
              setActiveTab('home');
              return;
          }

          setIsSubmitting(true);

          const { error: rpcError } = await supabase.rpc('execute_point_transaction', {
              p_amount: Number(amount),
              p_description: courseName ? `【利用】${courseName}` : `コース利用: ${courseId || 'Manual'}`,
              p_type: 'EARN',
              p_qr_id: qrId,
              p_served_by: servedBy || null
          });

          if (rpcError) throw rpcError;

          setEarnedAmount(Number(amount));
          setSuccessMode('earn');
          setActiveTab('home');
          fetchHistory();
          setIsSubmitting(false);

          setTimeout(() => {
              setSuccessMode('none');
          }, 3000);

      } catch (e: any) {
          console.error("Earn Error:", e);
          setActiveModal({ type: 'error', title: 'エラー', message: "ポイント獲得に失敗しました\n" + (e.message || JSON.stringify(e)) });
          setIsSubmitting(false);
          setActiveTab('home');
      }
  };

  const handleConfirmAmount = () => {
    if (!spendAmount || Number(spendAmount) <= 0) return setActiveModal({ type: 'error', title: '入力エラー', message: "利用ポイントを入力してください" });
    if (Number(spendAmount) > (profile?.points || 0)) return setActiveModal({ type: 'error', title: '残高不足', message: "ポイント不足です" });
    setIsQrConfirmed(true);
  };

  // Auth Guard & Loading Logic
  if (authLoading || loadingHistory) {
      return (
          <div className="min-h-screen pb-20 font-sans bg-gray-50">
              {/* Skeleton Header */}
              <div className="relative pb-8 rounded-b-[30px] shadow-2xl overflow-hidden bg-slate-200">
                  <div className="h-40 bg-slate-300 animate-pulse"></div>
                  <div className="absolute top-0 left-0 w-full h-full p-6 pt-12 flex flex-col items-center z-10">
                       <Skeleton className="w-24 h-24 rounded-full border-4 border-white/20 mb-3" />
                       <Skeleton className="h-4 w-20 mb-2 bg-white/30" />
                       <Skeleton className="h-8 w-40 bg-white/40" />
                  </div>
              </div>

              {/* Skeleton Content */}
              <div className="px-5 -mt-8 relative z-20 space-y-6">
                  {/* Point Card Skeleton */}
                  <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
                      <div className="flex justify-between items-start">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="flex flex-col items-center py-4 space-y-2">
                           <Skeleton className="h-12 w-48" />
                           <Skeleton className="h-8 w-32" />
                      </div>
                      <Skeleton className="h-12 w-full rounded-xl" />
                  </div>

                  {/* Tabs Skeleton */}
                  <div className="grid grid-cols-2 gap-3">
                      <Skeleton className="h-16 rounded-xl" />
                      <Skeleton className="h-16 rounded-xl" />
                  </div>

                  {/* History Skeleton */}
                  <div className="space-y-4 pt-4">
                      <Skeleton className="h-6 w-32" />
                      <div className="space-y-3">
                          {[1, 2, 3].map((i) => (
                              <div key={i} className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-4">
                                  <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                                  <div className="flex-grow space-y-2">
                                      <Skeleton className="h-4 w-3/4" />
                                      <Skeleton className="h-3 w-1/2" />
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  if (!user || !profile) return null; 

  // Render Error Modal (Suspended/Deleted)
  if (errorMode) {
      return (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200">
              <div className="bg-white w-[90%] max-w-sm rounded-3xl p-8 text-center shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-red-500"></div>
                  
                  <div className="bg-red-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertTriangle size={48} className="text-red-500" />
                  </div>
                  
                  <h3 className="text-2xl font-black text-slate-800 mb-2">利用できません</h3>
                  
                  <p className="text-gray-500 font-medium mb-8 leading-relaxed">
                      {errorMode === 'suspended' && "現在、このアカウントは利用が制限されています。\n詳しくはスタッフにお問い合わせください。"}
                      {errorMode === 'deleted' && "このアカウントは削除されています。"}
                      {errorMode === 'generic' && "エラーが発生しました。"}
                  </p>

                  <button 
                      onClick={() => {
                          setErrorMode(null);
                          setActiveTab('home');
                      }}
                      className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-transform"
                  >
                      閉じる
                  </button>
              </div>
          </div>
      );
  }

  // Render Success Popup (PayPay Style)
  if (successMode !== 'none') {
      // Apply Gold theme for both Earn and Pay if Special Member
      const isGold = isSpecial;
      return (
          <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 ${isGold ? 'bg-gradient-to-br from-[#1a1d24] to-[#0f1115] text-white' : 'bg-white text-slate-800'}`}>
              
              {/* Confetti / Shine Effect for Gold */}
              {isGold && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-yellow-500/20 rounded-full blur-[100px] animate-pulse"></div>
                      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-yellow-300/10 rounded-full blur-[80px]"></div>
                  </div>
              )}

              <div className={`${isGold ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-yellow-500/50' : 'bg-teal-500 shadow-teal-500/30'} w-32 h-32 rounded-full flex items-center justify-center shadow-2xl mb-8 animate-[bounce_1s_infinite] relative z-10`}>
                  <CheckCircle2 size={64} className="text-white" />
              </div>
              
              <h2 className={`text-3xl font-black mb-2 relative z-10 ${isGold ? 'text-yellow-100' : 'text-slate-800'}`}>
                  {successMode === 'earn' ? '獲得しました！' : '利用完了！'}
              </h2>
              
              <p className={`text-5xl font-black tracking-tighter relative z-10 ${isGold ? 'text-yellow-400 drop-shadow-sm' : 'text-teal-500'}`}>
                  {successMode === 'earn' ? `+${earnedAmount}` : `-${spendAmount}`}
                  <span className={`text-2xl ml-2 font-bold ${isGold ? 'text-yellow-100/70' : 'text-gray-400'}`}>pt</span>
              </p>

              <div className="absolute bottom-20 z-10">
                  <button onClick={() => setSuccessMode('none')} className={`font-bold border-b pb-1 transition-colors ${isGold ? 'text-yellow-100/50 border-yellow-100/30 hover:text-yellow-100' : 'text-gray-400 border-gray-300 hover:text-gray-600'}`}>閉じる</button>
              </div>
          </div>
      )
  }

  if (activeTab === 'scan') {
      return (
          <FullScreenScanOverlay
              title="ポイント獲得"
              hint="店舗のQRコードをスキャンしてください"
              onClose={() => setActiveTab('home')}
              onScan={handleScanResult}
              onError={(message) => setActiveModal({ type: 'error', title: 'カメラエラー', message })}
          />
      );
  }

  if (activeTab === 'code') {
      return (
          <div className={`fixed inset-0 flex flex-col z-50 ${isSpecial ? 'bg-[#0f1115]' : 'bg-slate-50'}`}>
              <div className={`p-4 flex justify-between items-center shadow-sm z-10 transition-all ${isSpecial ? 'bg-[#151921] text-white border-b border-white/10' : 'bg-white text-slate-800'}`}>
                  <button onClick={() => setActiveTab('home')} className={`${isSpecial ? 'text-white hover:bg-white/10 rounded-full p-1' : 'text-slate-800'}`}><ChevronLeft size={28} /></button>
                  <span className="font-bold text-lg">使う (QR表示)</span>
                  <div className="w-6"></div>
              </div>
              <div className={`flex-grow flex flex-col items-center justify-center p-6 space-y-8 ${isSpecial ? 'bg-gradient-to-b from-[#0f1115] to-[#1a1d24]' : 'bg-gradient-to-b from-teal-50 to-slate-50'}`}>
                  <div className={`p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center transition-all duration-300 ${
                      isSpecial 
                        ? `bg-[#1a1d24] border border-yellow-500/20 ${isQrConfirmed ? 'scale-105 border-yellow-500/50 ring-4 ring-yellow-500/10' : ''}`
                        : `bg-white border border-gray-100 ${isQrConfirmed ? 'scale-105 border-teal-200 ring-4 ring-teal-50' : ''}`
                  }`}>
                      <div className="mb-6">
                        <p className={`text-sm mb-1 ${isSpecial ? 'text-gray-400' : 'text-gray-500'}`}>利用ポイント</p>
                        <div className="flex justify-center items-end gap-2">
                             <input 
                                type="number" 
                                value={spendAmount}
                                onChange={(e) => {
                                    setSpendAmount(e.target.value);
                                    setIsQrConfirmed(false); 
                                }}
                                placeholder="0"
                                className={`text-4xl font-bold text-center w-40 outline-none border-b-2 bg-transparent transition-colors ${
                                    isSpecial 
                                    ? 'text-white border-gray-600 focus:border-yellow-500 placeholder-gray-700' 
                                    : 'text-slate-800 border-teal-100 focus:border-teal-500 placeholder-gray-300'
                                }`}
                                autoFocus
                             />
                             <span className={`font-bold mb-2 ${isSpecial ? 'text-gray-500' : 'text-gray-400'}`}>pt</span>
                        </div>
                      </div>
                      
                      <div className="relative w-full flex justify-center mb-6">
                          <div
                              className={`bg-white p-3 rounded-xl shadow-lg inline-block ${
                                  isSpecial ? 'ring-2 ring-yellow-500/40' : ''
                              } ${isQrConfirmed ? '' : 'opacity-20 blur-sm grayscale'}`}
                          >
                              {isQrConfirmed ? (
                                  <QRCodeCanvas
                                      value={JSON.stringify({
                                          memberId: user.id,
                                          userId: user.id,
                                          type: 'USE',
                                          amount: Number(spendAmount),
                                      })}
                                      size={QR_CANVAS_SIZE}
                                      bgColor="#ffffff"
                                      fgColor="#000000"
                                      level="H"
                                      includeMargin={true}
                                      style={QR_CANVAS_STYLE}
                                  />
                              ) : (
                                  <div
                                      className="flex items-center justify-center text-gray-300"
                                      style={{ width: QR_CANVAS_STYLE.width, height: QR_CANVAS_STYLE.height }}
                                  >
                                      <QrCode size={200} />
                                  </div>
                              )}
                          </div>
                          {!isQrConfirmed && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <span className={`text-xs font-bold ${isSpecial ? 'text-gray-500' : 'text-slate-400'}`}>
                                      未確定
                                  </span>
                              </div>
                          )}
                      </div>

                      <p className={`text-xs transition-colors ${isQrConfirmed ? (isSpecial ? 'text-yellow-500 font-bold' : 'text-teal-600 font-bold') : (isSpecial ? 'text-gray-500' : 'text-slate-400')}`}>
                          {isQrConfirmed ? 'スタッフに提示してください（画面を明るく）' : '金額を入力して確定してください'}
                      </p>
                  </div>
                  
                  {!isQrConfirmed ? (
                      <button 
                        onClick={handleConfirmAmount} 
                        disabled={!spendAmount}
                        className={`w-full max-w-sm font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 disabled:shadow-none active:scale-95 transition-transform ${
                            isSpecial
                            ? 'bg-gradient-to-r from-yellow-700 to-yellow-600 text-white shadow-yellow-900/20 hover:from-yellow-600 hover:to-yellow-500'
                            : 'bg-slate-800 text-white shadow-slate-800/30'
                        }`}
                      >
                          金額を確定してQRを表示
                      </button>
                  ) : (
                      <div className="w-full max-w-sm space-y-3 animate-in fade-in slide-in-from-bottom-2">
                            {/* Simulation Button Removed - User must wait for staff to scan */}
                            <p className={`text-center text-sm font-bold animate-pulse ${isSpecial ? 'text-yellow-500' : 'text-teal-600'}`}>
                                スタッフがスキャンするのを待っています...
                            </p>
                            <button 
                                onClick={() => setIsQrConfirmed(false)}
                                className={`w-full text-sm font-bold py-2 ${isSpecial ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                金額を変更する
                            </button>
                      </div>
                  )}
              </div>
          </div>
      )
  }

  // History Full View
  if (activeTab === 'history') {
      return (
          <div className={`min-h-screen flex flex-col z-50 ${isSpecial ? 'bg-[#0f1115] text-white' : 'bg-slate-50 text-slate-900'}`}>
              <div className={`p-4 flex justify-between items-center z-10 sticky top-0 ${isSpecial ? 'bg-[#151921] border-b border-white/5' : 'bg-white shadow-sm'}`}>
                  <button onClick={() => setActiveTab('home')} className={`p-2 -ml-2 rounded-full transition-colors ${isSpecial ? 'text-white hover:bg-white/10' : 'text-slate-800 hover:bg-gray-100'}`}><ChevronLeft size={28} /></button>
                  <span className="font-bold text-lg">取引履歴一覧</span>
                  <div className="w-8"></div>
              </div>
              <div className={`flex-grow p-4 pb-20 ${isSpecial ? 'bg-transparent' : 'bg-gray-50'}`}>
                    <div className={`rounded-2xl shadow-sm overflow-hidden ${isSpecial ? 'bg-[#151921] border border-white/5' : 'bg-white border border-gray-100'}`}>
                        <div className="max-h-[80vh] overflow-y-auto">
                        {visibleTransactions.length === 0 ? (
                            <div className={`p-8 text-center ${isSpecial ? 'text-gray-500' : 'text-gray-400'}`}>履歴はありません</div>
                        ) : (
                            <div>
                                {visibleTransactions.map((tx, idx) => {
                                    const { title, subTitle, icon, iconBg, amountTxt, amountClass } = getTxDisplay(tx);
                                    return (
                                        <div key={tx.id} className={`p-4 flex justify-between items-center ${idx !== visibleTransactions.length - 1 ? (isSpecial ? 'border-b border-white/5' : 'border-b border-gray-100') : ''} ${tx.is_cancelled ? (isSpecial ? 'opacity-50 bg-black/20' : 'opacity-50 bg-gray-50') : ''}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tx.is_cancelled ? (isSpecial ? 'bg-slate-800 text-gray-500' : 'bg-gray-200 text-gray-400') : iconBg}`}>
                                                    {icon}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className={`font-bold text-sm ${isSpecial ? 'text-gray-200' : 'text-slate-800'}`}>{title}</p>
                                                        {tx.is_cancelled && <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded font-bold">取消済</span>}
                                                    </div>
                                                    {subTitle && (
                                                        <p className={`text-xs font-semibold mt-0.5 ${isSpecial ? 'text-yellow-600' : 'text-teal-600'}`}>
                                                            {subTitle}
                                                        </p>
                                                    )}
                                                    <p className={`font-bold text-sm ${isSpecial ? 'text-gray-500' : 'text-slate-500'}`}>
                                                        {new Date(tx.created_at).toLocaleDateString('ja-JP', {year: '2-digit', month: '2-digit', day: '2-digit'})}
                                                    </p>
                                                    <p className={`text-xs mt-0.5 ${isSpecial ? 'text-gray-400' : 'text-slate-400'}`}>
                                                        {new Date(tx.created_at).toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'})}
                                                    </p>
                                                    {/* Balance removed from here */}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {amountTxt && (
                                                    <p className={`font-bold ${tx.is_cancelled ? 'text-gray-500 line-through' : amountClass}`}>
                                                        {amountTxt}
                                                    </p>
                                                )}
                                                <p className={`text-xs font-normal mt-0.5 tracking-wide ${isSpecial ? 'text-white' : 'text-slate-900'}`}>
                                                    残高: {tx.balance_snapshot !== null && tx.balance_snapshot !== undefined ? `${tx.balance_snapshot.toLocaleString()}` : '-'}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        </div>
                    </div>
              </div>
          </div>
      )
  }

  // Home Screen
  return (
    <div className={`min-h-screen pb-20 font-sans transition-colors duration-500 ${isSpecial ? 'bg-[#0f1115] text-white' : 'bg-gray-50 text-slate-900'}`}>
      
      {/* Top Card Area (Teal Gradient) */}
      {/* Top Card Area (Teal Gradient or Gold) */}
      <div className={`relative pb-8 rounded-b-[30px] shadow-2xl overflow-hidden transition-all duration-500 ${
          profile.rank === 'special' 
              ? 'bg-gradient-to-br from-[#8a6e2f] via-[#bf953f] to-[#fbf5b7]' // Rich Gold Gradient
              : 'bg-[#2b9b96]'
      }`}>
         {/* Background Decoration */}
         {profile.rank === 'special' ? (
             <>
                 {/* Premium Overlay Textures */}
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.4),transparent_70%)] opacity-70"></div>
                 <div className="absolute inset-0 bg-[#000000] opacity-30 mix-blend-overlay"></div>
                 
                 {/* Sparkles/Glow */}
                 <div className="absolute top-10 right-10 w-32 h-32 bg-yellow-200 rounded-full blur-[60px] opacity-40 animate-pulse"></div>
                 <div className="absolute bottom-[-10px] left-[-10px] w-40 h-40 bg-orange-300 rounded-full blur-[50px] opacity-30"></div>
                 
                 {/* Particle/Sparkle Icons */}
                 <div className="absolute top-20 right-8 text-yellow-100 opacity-60 animate-spin-slow"><ShieldCheck size={48} /></div>
             </>
         ) : (
             <>
                <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-30px] left-[-30px] w-48 h-48 bg-teal-300/20 rounded-full blur-2xl"></div>
             </>
         )}

             <div className="relative z-10 p-5 pt-8 text-white">
                 <div className="flex justify-between items-start mb-4">
                     <div>
                         {profile.rank === 'special' && (
                             <div className="inline-flex items-center gap-1 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20 mb-1">
                                 <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
                                 <span className="text-[9px] font-bold tracking-widest text-yellow-100 uppercase">特別会員</span>
                             </div>
                         )}
                         <p className={`font-bold text-lg drop-shadow-sm mb-0.5 ${profile.rank === 'special' ? 'font-serif tracking-wide' : ''}`}>
                            {profile.name} 様
                         </p>
                         <p className="opacity-80 text-[10px] font-medium tracking-wider flex items-center gap-2">
                            ID: <span className="font-mono text-sm opacity-100">{profile.member_code}</span>
                         </p>
                     </div>
                     <button onClick={() => navigate('/member/settings')} className="opacity-80 hover:opacity-100 bg-white/20 p-2 rounded-full transition-colors flex items-center justify-center backdrop-blur-sm">
                         <Settings size={18} />
                     </button>
                 </div>

             <div className="text-center mt-2 mb-6">
                 <p className="font-medium opacity-80 mb-0.5 tracking-widest text-xs">保有ポイント</p>
                 <h1 className="text-6xl font-black tracking-tighter drop-shadow-lg leading-none flex items-baseline justify-center gap-1 font-sans">
                    {profile.points.toLocaleString()}<span className="text-2xl font-bold opacity-80">pt</span>
                 </h1>
             </div>
         </div>
      </div>

      {/* Floating Action Buttons */}
      <div className="px-6 -mt-6 relative z-20 grid grid-cols-2 gap-3 max-w-md mx-auto">
          <button 
            onClick={() => setActiveTab('scan')}
            className={`p-3 rounded-xl shadow-lg flex flex-col items-center justify-center gap-1.5 transition-transform hover:-translate-y-1 active:scale-95 touch-manipulation relative overflow-hidden group ${
                isSpecial 
                ? 'bg-gradient-to-br from-yellow-700 to-yellow-900 text-white border border-yellow-500/30' 
                : 'bg-slate-800 text-white shadow-slate-800/20'
            }`}
          >
              {isSpecial && <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-20 transition-opacity"></div>}
              <div className={`p-2 rounded-full ${isSpecial ? 'bg-black/20 text-yellow-100' : 'bg-white/10 text-white'}`}>
                  <Scan size={24} />
              </div>
              <span className={`font-bold text-base ${isSpecial ? 'text-yellow-100' : 'text-white'}`}>貯める</span>
          </button>

          <button 
            onClick={() => setActiveTab('code')}
            className={`p-3 rounded-xl shadow-lg flex flex-col items-center justify-center gap-1.5 transition-transform hover:-translate-y-1 active:scale-95 touch-manipulation ${
                isSpecial 
                ? 'bg-gradient-to-br from-slate-800 to-[#1a1d24] border border-slate-700' 
                : 'bg-white hover:bg-gray-50'
            }`}
          >
              <div className={`p-2 rounded-full ${isSpecial ? 'bg-yellow-900/20 text-yellow-500' : 'bg-teal-50 text-teal-600'}`}>
                  <QrCode size={24} />
              </div>
              <span className={`font-bold text-base ${isSpecial ? 'text-gray-300' : 'text-slate-700'}`}>使う</span>
          </button>
      </div>

      {/* Special Member CTA */}
      <div className="px-6 mt-4 max-w-md mx-auto">
           <button
            onClick={() => navigate('/member/special')}
            className={`w-full p-[2px] rounded-xl shadow-lg group transition-all active:scale-95 ${
                profile.rank === 'special' 
                    ? 'bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600' // Gold Border Gradient
                    : ''
            }`}
          >
           <div className={`w-full p-3 rounded-lg flex items-center justify-between transition-all ${
                profile.rank === 'special' 
                    ? 'bg-slate-900 text-white' 
                    : (profile.membership_status === 'pending' ? 'bg-slate-100 border-2 border-teal-500/30' : 'bg-white border border-gray-100')
            }`}>
              <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                      profile.rank === 'special' ? 'bg-gradient-to-br from-yellow-400 to-yellow-700 text-white shadow-lg' : (profile.membership_status === 'pending' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500')
                  }`}>
                      <ShieldCheck size={24} />
                  </div>
                  <div className="text-left">
                      <p className={`text-base font-bold ${profile.rank === 'special' ? 'text-yellow-400' : 'text-slate-700'}`}>
                          {profile.rank === 'special' ? '特別会員証を表示' : (profile.membership_status === 'pending' ? '申請確認中' : '特別会員にランクアップ')}
                      </p>
                      <p className={`text-xs ${profile.rank === 'special' ? 'text-gray-400' : 'text-gray-400'}`}>
                          {profile.rank === 'special' ? '特別コース受講時に提示' : (profile.membership_status === 'pending' ? 'スタッフの承認待ちです' : '詳細を確認する')}
                      </p>
                  </div>
              </div>
              <ChevronLeft size={20} className={`${profile.rank === 'special' ? 'text-yellow-600' : 'text-gray-300'} rotate-180 group-hover:translate-x-1 transition-transform`} />
           </div>
          </button>
      </div>

      {/* History List */}
      <div className="mt-4 px-6 max-w-md mx-auto">
          <div className="w-full flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                  <HistoryIcon size={18} className={isSpecial ? "text-yellow-500/70" : "text-gray-400"} />
                  <h2 className={`font-bold ${isSpecial ? "text-yellow-100/80" : "text-gray-600"}`}>履歴</h2>
              </div>
              <button 
                onClick={() => setActiveTab('history')}
                className="flex items-center gap-1 text-xs font-bold opacity-60 hover:opacity-100 transition-opacity"
              >
                  <span>すべて見る</span>
                  <ChevronLeft size={14} className="rotate-180" />
              </button>
          </div>
          
          <div className={`${isSpecial ? 'bg-[#151921] border border-white/5' : 'bg-white border border-gray-100'} rounded-2xl shadow-sm overflow-hidden`}>
              {visibleTransactions.length === 0 ? (
                  <div className={`p-8 text-center text-sm ${isSpecial ? 'text-gray-500' : 'text-gray-400'}`}>履歴はありません</div>
              ) : (
                  <div>
                      {visibleTransactions.slice(0, 3).map((tx, idx) => {
                          const { title, subTitle, icon, iconBg, amountTxt, amountClass, originalAmount } = getTxDisplay(tx);
                          return (
                              <div key={tx.id} className={`p-4 flex justify-between items-center ${idx !== 2 && idx !== visibleTransactions.length - 1 ? (isSpecial ? 'border-b border-white/5' : 'border-b border-gray-100') : ''} ${tx.is_cancelled ? (isSpecial ? 'opacity-50 bg-black/20' : 'opacity-50 bg-gray-50') : ''}`}>
                                  <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tx.is_cancelled ? (isSpecial ? 'bg-slate-800 text-gray-500' : 'bg-gray-200 text-gray-400') : iconBg}`}>
                                          {icon}
                                      </div>
                                      <div>
                                          <div className="flex items-center gap-2 flex-wrap">
                                              <p className={`text-sm font-bold ${tx.is_cancelled ? 'line-through text-gray-400 text-xs' : (isSpecial ? 'text-white' : 'text-slate-800')} ${title.length > 15 ? 'text-xs' : ''}`}>
                                                  {title}
                                              </p>
                                              {subTitle && (
                                                  <p className={`text-sm font-bold ${isSpecial ? 'text-yellow-500' : 'text-slate-600'}`}>
                                                      {subTitle}
                                                  </p>
                                              )}
                                          </div>
                                          <p className={`text-xs ${isSpecial ? 'text-gray-500' : 'text-gray-400'}`}>
                                              {new Date(tx.created_at).toLocaleDateString('ja-JP')}
                                              <span className="ml-2 opacity-80">
                                                  {new Date(tx.created_at).toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'})}
                                              </span>
                                          </p>
                                          {/* Balance removed from here */}
                                      </div>
                                  </div>
                                  
                                  {/* Amount Display */}
                                  <div className={`text-right font-black whitespace-nowrap ${tx.is_cancelled ? 'line-through text-gray-300' : amountClass}`}>
                                      {originalAmount !== null && !tx.is_cancelled ? (
                                          <div className="flex flex-col items-end leading-none">
                                              <span className="text-[10px] text-gray-400 line-through opacity-70 mb-0.5">{originalAmount.toLocaleString()}</span>
                                              <span>{amountTxt}</span>
                                          </div>
                                      ) : (
                                          amountTxt
                                      )}
                                      {/* Balance Moved Here */}
                                      <p className={`text-xs font-normal mt-0.5 tracking-wide ${isSpecial ? 'text-white' : 'text-slate-900'}`}>
                                          残高: {tx.balance_snapshot !== null && tx.balance_snapshot !== undefined ? `${tx.balance_snapshot.toLocaleString()}` : '-'}
                                      </p>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
      </div>
      {/* Standard Active Modal */}
      {activeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center transform transition-all scale-100">
                  <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                      activeModal.type === 'error' ? 'bg-red-100 text-red-500' : 'bg-teal-100 text-teal-600'
                  }`}>
                      {activeModal.type === 'error' ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                  </div>
                  <h3 className={`text-lg font-bold mb-2 ${
                      activeModal.type === 'error' ? 'text-red-600' : 'text-slate-800'
                  }`}>
                      {activeModal.title}
                  </h3>
                  <p className="text-slate-600 text-sm whitespace-pre-wrap mb-6 leading-relaxed">
                      {activeModal.message}
                  </p>
                  <button 
                      onClick={() => setActiveModal(null)}
                      className={`w-full text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-colors ${
                          activeModal.type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-teal-500 hover:bg-teal-600'
                      }`}
                  >
                      閉じる
                  </button>
              </div>
          </div>
      )}

      {/* Deleted Account Overlay */}
      {showDeletedModal && (
          <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <User size={40} className="text-gray-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">アカウント削除済み</h2>
                  <p className="text-gray-500 mb-8 leading-relaxed">
                      このアカウントは削除されています。<br/>
                      ログアウトします。
                  </p>
                  <button 
                      onClick={handleLogout}
                      className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-700 active:scale-[0.98] transition-all"
                  >
                      OK
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};

export default CardHome;
