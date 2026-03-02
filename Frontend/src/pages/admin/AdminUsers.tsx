import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Activity, Trash2, Ban } from 'lucide-react';

interface UserInfo {
    id: string;
    email: string;
    full_name: string;
    role: string;
    total_messages: number;
    total_tokens: number;
    last_active: string;
}

export default function AdminUsers() {
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    const apiUrl = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:8001';

    const getAuthHeaders = async () => {
        const { data } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session?.access_token}`
        };
    };

    const { data: users = [], isLoading: loading } = useQuery<UserInfo[]>({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiUrl}/admin/users`, { headers });
            if (!res.ok) throw new Error('Failed to load users');
            const data = await res.json();
            return Array.isArray(data) ? data : (data.users || []);
        },
        staleTime: 60000,
    });

    const handleChangeRole = async (userId: string, newRole: string) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiUrl}/admin/users/${userId}/role`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ role: newRole })
            });

            if (res.ok) {
                toast.success('Cap nhat role thanh cong');
                queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            } else {
                toast.error('Cap nhat that bai');
            }
        } catch (e) {
            console.error(e);
            toast.error('Loi cap nhat role');
        }
    };

    const handleBanUser = async (userId: string) => {
        const reason = prompt('Nhập lý do ban:');
        if (!reason) return;

        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiUrl}/admin/users/${userId}/ban`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ reason })
            });

            if (res.ok) {
                toast.success('Đã ban User thành công. User sẽ tự disconnect.');
            } else {
                toast.error("Lỗi khi ban");
            }
        } catch (e) {
            console.error(e);
            toast.error("Lỗi mạng khi ban");
        }
    };

    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Users color="var(--primary)" /> Quản lý Users
                </h1>

                <div style={{ position: 'relative' }}>
                    <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        placeholder="Search email/name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{
                            padding: '8px 16px 8px 36px', borderRadius: 8, border: '1px solid var(--border)',
                            background: 'var(--bg-card)', color: 'var(--text)', outline: 'none', width: 250
                        }}
                    />
                </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>User</th>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role</th>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Usage</th>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Last Active</th>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading users...</td></tr>
                        ) : filteredUsers.map(user => (
                            <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: 16 }}>
                                    <div style={{ fontWeight: 600 }}>{user.full_name || 'No Name'}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.email}</div>
                                </td>
                                <td style={{ padding: 16 }}>
                                    <select
                                        value={user.role || 'user'}
                                        onChange={(e) => handleChangeRole(user.id, e.target.value)}
                                        style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
                                    >
                                        <option value="user">User</option>
                                        <option value="api_client">API Client</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </td>
                                <td style={{ padding: 16 }}>
                                    <div style={{ fontSize: 14 }}><b>{user.total_messages?.toLocaleString()}</b> msgs</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.total_tokens?.toLocaleString()} tokens</div>
                                </td>
                                <td style={{ padding: 16, fontSize: 14, color: 'var(--text-muted)' }}>
                                    {user.last_active ? new Date(user.last_active).toLocaleDateString() : 'N/A'}
                                </td>
                                <td style={{ padding: 16 }}>
                                    <button
                                        onClick={() => handleBanUser(user.id)}
                                        style={{ padding: 6, borderRadius: 6, border: '1px solid #ef444450', background: '#ef444410', color: '#ef4444', cursor: 'pointer' }}
                                        title="Ban User"
                                    >
                                        <Ban size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
