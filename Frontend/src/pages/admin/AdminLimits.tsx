import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Trash2, Edit } from 'lucide-react';

interface QuotaRole {
    role: string;
    daily_requests: number;
    daily_tokens: number;
}

interface QuotaOverride {
    user_id: string;
    daily_requests: number | null;
    daily_tokens: number | null;
}

export default function AdminLimits() {
    const queryClient = useQueryClient();
    const apiUrl = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:8001';

    const getAuthHeaders = async () => {
        const { data } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session?.access_token}`
        };
    };

    const { data, isLoading } = useQuery<{ roles: QuotaRole[], overrides: QuotaOverride[] }>({
        queryKey: ['admin-limits'],
        queryFn: async () => {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiUrl}/admin/limits`, { headers });
            if (!res.ok) throw new Error('Failed to load limits');
            return res.json();
        },
        staleTime: 60000,
    });

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Activity color="var(--primary)" /> Limits & Quotas
            </h1>

            {isLoading ? <p>Loading limits...</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Role Limits */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Default Role Limits</h2>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: 12, color: 'var(--text-muted)' }}>Role</th>
                                    <th style={{ padding: 12, color: 'var(--text-muted)' }}>Daily Requests</th>
                                    <th style={{ padding: 12, color: 'var(--text-muted)' }}>Daily Tokens</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.roles.map((r, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: 12, fontWeight: 600 }}>{r.role}</td>
                                        <td style={{ padding: 12 }}>{r.daily_requests}</td>
                                        <td style={{ padding: 12 }}>{r.daily_tokens.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Overrides */}
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>User Overrides</h2>
                        {data?.overrides.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>No custom overrides active.</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ padding: 12, color: 'var(--text-muted)' }}>User ID</th>
                                        <th style={{ padding: 12, color: 'var(--text-muted)' }}>Custom Requests</th>
                                        <th style={{ padding: 12, color: 'var(--text-muted)' }}>Custom Tokens</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.overrides.map((o, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>{o.user_id}</td>
                                            <td style={{ padding: 12 }}>{o.daily_requests ?? '-'}</td>
                                            <td style={{ padding: 12 }}>{o.daily_tokens?.toLocaleString() ?? '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
