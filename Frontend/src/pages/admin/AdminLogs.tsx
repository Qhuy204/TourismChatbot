import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Loader2, Filter } from 'lucide-react';

interface AuditLog {
    id: string;
    admin_id: string;
    action: string;
    target_type: string;
    target_id: string;
    justification: string | null;
    ip_address: string | null;
    timestamp: string;
    current_hash: string | null;
}

export default function AdminLogs() {
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState('');
    const apiUrl = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:8001';

    const getAuthHeaders = async () => {
        const { data } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session?.access_token}`
        };
    };

    const { data, isLoading } = useQuery<{ data: AuditLog[], count: number }>({
        queryKey: ['admin-logs', page, actionFilter],
        queryFn: async () => {
            const headers = await getAuthHeaders();
            const url = new URL(`${apiUrl}/admin/logs`);
            url.searchParams.append('page', page.toString());
            url.searchParams.append('limit', '50');
            if (actionFilter) url.searchParams.append('action', actionFilter);

            const res = await fetch(url.toString(), { headers });
            if (!res.ok) throw new Error('Failed to load logs');
            return res.json();
        },
        staleTime: 30000,
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ShieldAlert color="var(--primary)" /> Audit Logs
                </h1>

                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Filter size={16} color="var(--text-muted)" />
                    <select
                        value={actionFilter}
                        onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                        style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', outline: 'none' }}
                    >
                        <option value="">All Actions</option>
                        <option value="ban_user">Ban User</option>
                        <option value="unban_user">Unban User</option>
                        <option value="change_role">Change Role</option>
                        <option value="set_quota_override">Set Quota</option>
                        <option value="reload_model">Reload Model</option>
                        <option value="soft_delete_conversation">Delete Conversation</option>
                    </select>
                </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timestamp</th>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Admin ID</th>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Action</th>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target</th>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}><Loader2 className="animate-spin" size={24} style={{ margin: '0 auto' }} /></td></tr>
                        ) : data?.data.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No logs found.</td></tr>
                        ) : data?.data.map(log => (
                            <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                <td style={{ padding: 16, fontFamily: 'monospace', fontSize: 12 }}>{log.admin_id.substring(0, 8)}...</td>
                                <td style={{ padding: 16, fontWeight: 600 }}>
                                    <span style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 12 }}>
                                        {log.action}
                                    </span>
                                </td>
                                <td style={{ padding: 16, fontSize: 13 }}>
                                    <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: 10 }}>{log.target_type}</span><br />
                                    <span style={{ fontFamily: 'monospace' }}>{log.target_id}</span>
                                </td>
                                <td style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{log.ip_address || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {data && data.count > 50 && (
                    <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)' }}>Previous</button>
                        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Page {page} / {Math.ceil(data.count / 50)}</span>
                        <button disabled={data.data.length < 50} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)' }}>Next</button>
                    </div>
                )}
            </div>
        </div>
    );
}
