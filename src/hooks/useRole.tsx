import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/types/dataset';

interface RoleContextType {
  role: AppRole | null;
  isAdmin: boolean;
  isUser: boolean;
  loading: boolean;
  refetchRole: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async () => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching role:', error);
        setRole('user'); // Default to user
      } else {
        setRole((data?.role as AppRole) || 'user');
      }
    } catch (error) {
      console.error('Error fetching role:', error);
      setRole('user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRole();
  }, [user]);

  const isAdmin = role === 'admin';
  const isUser = role === 'user';

  return (
    <RoleContext.Provider value={{ role, isAdmin, isUser, loading, refetchRole: fetchRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
