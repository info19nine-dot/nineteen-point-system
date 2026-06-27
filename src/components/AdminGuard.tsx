import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../contexts/SupabaseContext';
import { STAFF_LOGIN_PATH } from '../lib/routes';
import { Loader2 } from 'lucide-react';

export const AdminGuard = ({ children }: { children: React.ReactNode }) => {
    const { session, loading, isAdmin } = useSupabase();
    const navigate = useNavigate();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        if (loading) return;

        if (!session) {
            navigate(STAFF_LOGIN_PATH);
            return;
        }

        // Use the context's computed isAdmin property
        if (isAdmin) {
            setIsAuthorized(true);
        } else {
            navigate('/card');
        }
    }, [session, loading, isAdmin, navigate]);

    if (loading || !isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-teal-500" size={48} />
            </div>
        );
    }

    return <>{children}</>;
};
