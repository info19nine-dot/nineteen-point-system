import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../contexts/SupabaseContext';
import { STAFF_LOGIN_PATH } from '../lib/routes';
import { isStaffApp } from '../lib/appMode';
import { Loader2 } from 'lucide-react';

export const AdminGuard = ({ children }: { children: React.ReactNode }) => {
    const { session, loading, isAdmin, profile, refreshProfile } = useSupabase();
    const navigate = useNavigate();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const fetchingProfile = useRef(false);

    useEffect(() => {
        if (loading) return;

        if (!session) {
            setIsAuthorized(false);
            navigate(STAFF_LOGIN_PATH);
            return;
        }

        if (!profile) {
            setIsAuthorized(false);
            if (!fetchingProfile.current) {
                fetchingProfile.current = true;
                refreshProfile().finally(() => {
                    fetchingProfile.current = false;
                });
            }
            return;
        }

        if (isAdmin) {
            setIsAuthorized(true);
        } else {
            setIsAuthorized(false);
            navigate(isStaffApp ? STAFF_LOGIN_PATH : '/card', { replace: true });
        }
    }, [session, loading, isAdmin, profile, navigate, refreshProfile]);

    if (loading || !isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-teal-500" size={48} />
            </div>
        );
    }

    return <>{children}</>;
};
