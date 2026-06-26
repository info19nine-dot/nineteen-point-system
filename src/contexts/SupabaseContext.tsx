import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

type Profile = {
  id: string;
  email: string | null;
  name: string;
  member_code: string;
  role: 'admin' | 'member';
  points: number;
  staff_memo?: string;
  is_blacklisted?: boolean;
  is_deleted?: boolean;
  rank?: 'regular' | 'special';
  membership_status?: 'none' | 'pending' | 'approved' | 'rejected';
  phone?: string;
  birthdate?: string;
  application_date?: string;
  membership_expiry?: string; 
};

type SupabaseContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
};

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export const SupabaseProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Initialize & Listen for Auth Changes
  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime Profile Updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          // console.log('Realtime profile update:', payload.new);
          const newProfile = payload.new as Profile;
          
          // Check for suspension (Realtime Force Logout)
          if (newProfile.is_blacklisted || newProfile.is_deleted) {
              supabase.auth.signOut().then(() => {
                  // Redirect via Router instead of window.location to prevent white screen
                  // Pass state to Login page to show Modal
                  navigate('/login', { 
                    replace: true, 
                    state: { 
                      suspended: true, 
                      rank: newProfile.rank 
                    } 
                  });
              });
              setSession(null);
              setUser(null);
              setProfile(null);
              return;
          }

          setProfile(newProfile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, navigate]); // Add navigate dependency

  // Fetch Role/Points from 'profiles' table
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        if (data) {
          // Check for suspension (Force Logout on Load)
          if (data.is_blacklisted || data.is_deleted) {
              await supabase.auth.signOut();
              // Redirect with State
              navigate('/login', { 
                replace: true, 
                state: { 
                  suspended: true, 
                  rank: data.rank 
                } 
              });
              setSession(null);
              setUser(null);
              setProfile(null);
              return;
          }
          setProfile(data);
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    navigate('/login');
  };

  const value = {
    session,
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || profile?.email === 'n19@admin.com',
    logout,
  };

  return (
    <SupabaseContext.Provider value={value}>
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
