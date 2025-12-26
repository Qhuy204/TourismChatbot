import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserWithRole, AppRole } from '@/types/dataset';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { toast } from 'sonner';

export function useUsers() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    if (!user || !isAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Get profiles with roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name');

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        return;
      }

      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role as AppRole]));

      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => ({
        id: profile.user_id,
        email: '', // Not accessible due to RLS on auth.users
        display_name: profile.display_name || 'Unknown',
        role: rolesMap.get(profile.user_id) || 'user',
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateUserRole = useCallback(async (userId: string, newRole: AppRole) => {
    if (!isAdmin) {
      toast.error('Bạn không có quyền thay đổi role');
      return false;
    }

    try {
      // Check if role exists
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });

        if (error) throw error;
      }

      await fetchUsers();
      toast.success('Đã cập nhật role');
      return true;
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Không thể cập nhật role');
      return false;
    }
  }, [isAdmin, fetchUsers]);

  return {
    users,
    loading,
    updateUserRole,
    refetch: fetchUsers,
  };
}
