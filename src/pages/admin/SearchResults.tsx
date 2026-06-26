import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ChevronLeft, Search, User as UserIcon, ChevronRight, Users, ShieldCheck, FileText } from 'lucide-react';

type Member = {
    id: string;
    name: string;
    member_code: string;
    rank?: 'regular' | 'special';
    staff_memo?: string;
};

const SearchResults = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [results, setResults] = useState<Member[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSpecialOnly, setIsSpecialOnly] = useState(false);
    const [hasMemoOnly, setHasMemoOnly] = useState(false);

    useEffect(() => {
        const fetchMembers = async () => {
            setIsLoading(true);
            let queryBuilder = supabase
                .from('profiles')
                .select('id, name, member_code, rank, staff_memo, email')
                .eq('role', 'member');
            
            if (isSpecialOnly) {
                queryBuilder = queryBuilder.eq('rank', 'special');
            }

            if (hasMemoOnly) {
                // Filter for non-empty memos
                queryBuilder = queryBuilder.not('staff_memo', 'is', null).neq('staff_memo', '');
            }

            if (query) {
                // Search by Name or ID
                queryBuilder = queryBuilder.or(`name.ilike.%${query}%,member_code.ilike.%${query}%,email.ilike.%${query}%`);
            } else {
                // No query -> Show recent/all (limit 50)
                queryBuilder = queryBuilder.order('created_at', { ascending: false }).limit(50);
            }

            const { data, error } = await queryBuilder;

            if (error) {
                console.error('Error searching members:', error);
            } else {
                setResults(data || []);
            }
            setIsLoading(false);
        };

        fetchMembers();
    }, [query, isSpecialOnly, hasMemoOnly]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
            <div className="bg-[#2b9b96] p-6 pb-12 rounded-b-[40px] shadow-lg text-white mb-6">
                <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => navigate('/admin')} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold tracking-wider">
                        {query ? '会員検索結果' : '会員一覧'}
                    </h1>
                </div>
                
                <div className="flex flex-col gap-3">
                    <div className="bg-white/10 rounded-full px-4 py-2 flex items-center backdrop-blur-sm border border-white/20 w-full">
                        {query ? <Search size={16} className="text-white/70 mr-2" /> : <Users size={16} className="text-white/70 mr-2" />}
                        <span className="text-white font-medium text-xs truncate">{query || '検索なし'}</span>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                         <button 
                            onClick={() => setHasMemoOnly(!hasMemoOnly)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all border flex-shrink-0 ${
                                hasMemoOnly 
                                    ? 'bg-orange-500 text-white border-orange-400 shadow-lg' 
                                    : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                            }`}
                        >
                            <FileText size={16} className={hasMemoOnly ? 'fill-current' : ''} />
                            <span className="text-xs font-bold whitespace-nowrap">要確認</span>
                        </button>

                        <button 
                            onClick={() => setIsSpecialOnly(!isSpecialOnly)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all border flex-shrink-0 ${
                                isSpecialOnly 
                                    ? 'bg-yellow-500 text-white border-yellow-400 shadow-lg' 
                                    : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                            }`}
                        >
                            <ShieldCheck size={16} className={isSpecialOnly ? 'fill-current' : ''} />
                            <span className="text-xs font-bold whitespace-nowrap">特別会員</span>
                        </button>
                    </div>
                </div>
            </div>

            <main className="max-w-md mx-auto px-6 -mt-10 relative z-10 space-y-4">
                <p className="text-gray-500 font-bold ml-2 text-sm">
                    {isLoading ? '検索中...' : `${results.length} 件表示中`}
                </p>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full"></div>
                    </div>
                ) : results.length > 0 ? (
                    <div className="space-y-3">
                        {results.map((member) => (
                            <div 
                                key={member.id} 
                                onClick={() => navigate(`/admin/members/${member.id}`)}
                                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group active:scale-[0.98] transition-transform cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${member.rank === 'special' ? 'bg-yellow-100 text-yellow-600 border-2 border-yellow-400' : 'bg-slate-100 text-slate-500'}`}>
                                        {member.rank === 'special' ? <ShieldCheck size={20} className="fill-current" /> : (member.name ? member.name[0] : '?')}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 flex items-center gap-2">
                                            {member.name || '名称未設定'}
                                            {member.staff_memo && <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>}
                                        </p>
                                        <p className="text-xs text-teal-600 font-mono tracking-wider">ID: {member.member_code}</p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-gray-300 group-hover:text-teal-500 transition-colors" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                        <UserIcon size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-400 font-bold">会員が見つかりません</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default SearchResults;
