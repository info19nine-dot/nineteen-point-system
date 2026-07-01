import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, Pencil, ChevronUp, ChevronDown, AlertCircle, HelpCircle, PauseCircle, PlayCircle } from 'lucide-react';
import { fetchPointsPaused, setPointsPaused } from '../../lib/appSettings';

type Course = {
    id: string;
    label: string;
    points: number;
    display_order: number;
};

const Settings = () => {
    const { session } = useSupabase();
    const navigate = useNavigate();

    const [courses, setCourses] = useState<Course[]>([]);


    // 新規追加用ステート
    const [isAdding, setIsAdding] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newPoints, setNewPoints] = useState<string>('');

    // 編集用ステート
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState('');
    const [editPoints, setEditPoints] = useState<string>('');

    // Common Modals State
    const [errorModal, setErrorModal] = useState<{show: boolean, message: string}>({show: false, message: ''});
    const [confirmModal, setConfirmModal] = useState<{show: boolean, message: string, onConfirm: () => void}>({show: false, message: '', onConfirm: () => {}});

    const [pointsPaused, setPointsPausedState] = useState(false);
    const [loadingMaintenance, setLoadingMaintenance] = useState(true);
    const [togglingMaintenance, setTogglingMaintenance] = useState(false);

    const fetchCourses = async () => {

        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .order('display_order', { ascending: true }); // Order by display_order
        
        if (error) {
            console.error('Error fetching courses:', error);
        } else {
            setCourses(data || []);
        }

    };

    useEffect(() => {
        fetchCourses();
        fetchPointsPaused().then(setPointsPausedState).finally(() => setLoadingMaintenance(false));
    }, []);

    if (!session) return <div>Access Denied</div>;

    const handleAdd = async () => {
        const pointsNum = Number(newPoints);
        if (!newLabel || pointsNum <= 0) {
            setErrorModal({show: true, message: '名称とポイントを入力してください'});
            return;
        }
        
        // Calculate next order
        const maxOrder = courses.length > 0 ? Math.max(...courses.map(c => c.display_order || 0)) : -1;
        const nextOrder = maxOrder + 1;

        const { error } = await supabase
            .from('courses')
            .insert([{ label: newLabel, points: newPoints, display_order: nextOrder }]);

        if (error) {
            setErrorModal({show: true, message: '追加に失敗しました: ' + error.message});
            console.error(error);
        } else {
            setNewLabel('');
            setNewPoints('');
            setIsAdding(false);
            fetchCourses();
        }
    };

    const handleDelete = async (id: string) => {
        setConfirmModal({
            show: true, 
            message: '本当に削除しますか？', 
            onConfirm: async () => {
                const { error } = await supabase
                    .from('courses')
                    .delete()
                    .eq('id', id);

                if (error) {
                    setErrorModal({show: true, message: '削除に失敗しました'});
                    console.error(error);
                } else {
                    fetchCourses();
                }
            }
        });
    };

    const startEditing = (course: Course) => {
        setEditingId(course.id);
        setEditLabel(course.label);
        setEditPoints(String(course.points));
    };

    const handleUpdate = async (id: string) => {
        const pointsNum = Number(editPoints);
        if (!editLabel || pointsNum <= 0) {
            setErrorModal({show: true, message: '名称とポイントを入力してください'});
            return;
        }

        const { error } = await supabase
            .from('courses')
            .update({ label: editLabel, points: pointsNum })
            .eq('id', id);

        if (error) {
            setErrorModal({show: true, message: '更新に失敗しました'});
            console.error(error);
        } else {
            setEditingId(null);
            fetchCourses();
        }
    };

    const handleMove = async (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === courses.length - 1) return;

        const newCourses = [...courses];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        
        // Swap in local array
        [newCourses[index], newCourses[targetIndex]] = [newCourses[targetIndex], newCourses[index]];
        
        // Optimistic UI update (optional but good for UX)
        // setCourses(newCourses); // We'll just wait for fetch to be safe

        // Update ALL orders to ensure consistency (fixes potential duplicate 0s issue)
        const updates = newCourses.map((c, i) => ({
            id: c.id,
            display_order: i
        }));


        // Execute all updates
        await Promise.all(updates.map(u => 
            supabase.from('courses').update({ display_order: u.display_order }).eq('id', u.id)
        ));
        
        fetchCourses();
    };

    const handleToggleMaintenance = async () => {
        const next = !pointsPaused;
        setTogglingMaintenance(true);
        const error = await setPointsPaused(next);
        setTogglingMaintenance(false);
        if (error) {
            setErrorModal({ show: true, message: 'メンテナンス設定の更新に失敗しました' });
            return;
        }
        setPointsPausedState(next);
    };

    return (
        <div className="min-h-screen bg-slate-100 pb-20">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="px-4 h-14 flex items-center justify-between">
                    <button 
                        onClick={() => navigate('/admin')}
                        className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="font-bold text-lg text-slate-700">コース設定</h1>
                    <div className="w-10"></div> {/* Spacer for centering */}
                </div>
            </header>

            <main className="max-w-md mx-auto px-6 py-6 space-y-8">
                <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <PauseCircle size={18} className="text-orange-500" />
                        ポイント操作の一時停止
                    </h2>
                    <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                        ONにすると会員の「貯める」「使う」だけ停止します。ログインと履歴閲覧はできます。
                    </p>
                    <button
                        onClick={handleToggleMaintenance}
                        disabled={loadingMaintenance || togglingMaintenance}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                            pointsPaused
                                ? 'bg-teal-600 text-white hover:bg-teal-700'
                                : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                    >
                        {togglingMaintenance ? (
                            '更新中...'
                        ) : pointsPaused ? (
                            <>
                                <PlayCircle size={18} />
                                再開する（現在: 停止中）
                            </>
                        ) : (
                            <>
                                <PauseCircle size={18} />
                                貯める・使うを停止する
                            </>
                        )}
                    </button>
                </section>

                <section className="animate-in fade-in slide-in-from-left-4 duration-300">
                    {/* Course Settings Content */}
                    <div className="space-y-4">
                        {courses.map((course, index) => (
                            <div key={course.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-3">
                                {/* Edit Mode vs View Mode */}
                                {editingId === course.id ? (
                                    <div className="flex flex-col gap-3 animate-in fade-in">
                                        <input 
                                            type="text" 
                                            className="w-full bg-gray-50 p-2 rounded border border-teal-200 outline-none focus:ring-2 focus:ring-teal-500"
                                            value={editLabel}
                                            onChange={(e) => setEditLabel(e.target.value)}
                                            placeholder="コース名"
                                        />
                                        <input 
                                            type="number" 
                                            className="w-full bg-gray-50 p-2 rounded border border-teal-200 outline-none focus:ring-2 focus:ring-teal-500"
                                            value={editPoints}
                                            onChange={(e) => setEditPoints(e.target.value)}
                                            placeholder="ポイント"
                                        />
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setEditingId(null)}
                                                className="flex-1 py-2 bg-gray-100 rounded text-gray-500 font-bold text-xs"
                                            >
                                                キャンセル
                                            </button>
                                            <button 
                                                onClick={() => handleUpdate(course.id)}
                                                className="flex-1 py-2 bg-teal-500 text-white rounded font-bold text-xs shadow-md"
                                            >
                                                保存
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            {/* Sort Controls */}
                                            <div className="flex flex-col gap-1">
                                                <button 
                                                    onClick={() => handleMove(index, 'up')}
                                                    disabled={index === 0}
                                                    className="p-1 text-gray-400 hover:text-teal-600 disabled:opacity-20 transition-colors"
                                                >
                                                    <ChevronUp size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleMove(index, 'down')}
                                                    disabled={index === courses.length - 1}
                                                    className="p-1 text-gray-400 hover:text-teal-600 disabled:opacity-20 transition-colors"
                                                >
                                                    <ChevronDown size={16} />
                                                </button>
                                            </div>
                                            
                                            <div>
                                                <p className="font-bold text-lg text-slate-700">{course.label}</p>
                                                <p className="text-teal-600 font-bold">{course.points.toLocaleString()} pt</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => startEditing(course)}
                                                className="p-2 text-gray-400 hover:text-teal-600 bg-gray-50 hover:bg-teal-50 rounded-lg transition-colors"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(course.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {!isAdding ? (
                        <button 
                            onClick={() => setIsAdding(true)}
                            className="w-full mt-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold flex items-center justify-center gap-2 hover:bg-gray-50 hover:border-teal-300 hover:text-teal-600 transition-colors"
                        >
                            <Plus size={20} /> コースを追加
                        </button>
                    ) : (
                        <div className="mt-4 bg-white p-4 rounded-xl shadow-md border border-teal-100 animate-in fade-in slide-in-from-top-2">
                            <h3 className="font-bold mb-3 text-sm text-gray-500">新規コース</h3>
                            <div className="space-y-3 mb-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">コース名 (例: 120分)</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-gray-50 p-2 rounded border border-gray-200 outline-none focus:border-teal-500"
                                        value={newLabel}
                                        onChange={(e) => setNewLabel(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">付与ポイント</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-gray-50 p-2 rounded border border-gray-200 outline-none focus:border-teal-500"
                                        value={newPoints}
                                        onChange={(e) => setNewPoints(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setIsAdding(false)} className="flex-1 py-2 bg-gray-100 rounded text-gray-500 font-bold text-sm">キャンセル</button>
                                <button onClick={handleAdd} className="flex-1 py-2 bg-teal-500 text-white rounded font-bold text-sm shadow-md shadow-teal-500/30">追加する</button>
                            </div>
                        </div>
                    )}
                </section>
            </main>

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

export default Settings;
