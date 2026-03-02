import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Trash2, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ChatSession {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

export default function AdminConversations() {
    const [page, setPage] = useState(1);
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

    const { data, isLoading } = useQuery<{ data: ChatSession[], count: number }>({
        queryKey: ['admin-conversations', page, searchTerm],
        queryFn: async () => {
            const headers = await getAuthHeaders();
            const url = new URL(`${apiUrl}/admin/conversations`);
            url.searchParams.append('page', page.toString());
            url.searchParams.append('limit', '50');
            if (searchTerm) url.searchParams.append('search', searchTerm);

            const res = await fetch(url.toString(), { headers });
            if (!res.ok) throw new Error('Failed to load conversations');
            return res.json();
        },
        staleTime: 30000,
    });

    const deleteMutation = useMutation({
        mutationFn: async (sessionId: string) => {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiUrl}/admin/conversations/${sessionId}`, {
                method: 'DELETE',
                headers
            });
            if (!res.ok) throw new Error('Delete failed');
            return res.json();
        },
        onSuccess: () => {
            toast.success("Conversation soft deleted");
            queryClient.invalidateQueries({ queryKey: ['admin-conversations'] });
        },
        onError: () => {
            toast.error("Failed to delete conversation");
        }
    });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <MessageSquare color="var(--primary)" /> Conversations
                </h1>

                <div style={{ position: 'relative' }}>
                    <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        placeholder="Search title..."
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
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
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ID</th>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Title</th>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>User ID</th>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Updated At</th>
                            <th style={{ padding: '16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}><Loader2 className="animate-spin" size={24} style={{ margin: '0 auto' }} /></td></tr>
                        ) : data?.data.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No conversations found.</td></tr>
                        ) : data?.data.map(conv => (
                            <tr key={conv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: 16, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{conv.id.substring(0, 8)}...</td>
                                <td style={{ padding: 16, fontWeight: 500 }}>{conv.title || 'Untitled'}</td>
                                <td style={{ padding: 16, fontFamily: 'monospace', fontSize: 12 }}>{conv.user_id.substring(0, 8)}...</td>
                                <td style={{ padding: 16, fontSize: 14, color: 'var(--text-muted)' }}>{new Date(conv.updated_at).toLocaleString()}</td>
                                <td style={{ padding: 16 }}>
                                    <button
                                        onClick={() => { if (confirm("Are you sure?")) deleteMutation.mutate(conv.id) }}
                                        disabled={deleteMutation.isPending}
                                        style={{ padding: 6, borderRadius: 6, border: '1px solid #ef444450', background: '#ef444410', color: '#ef4444', cursor: 'pointer' }}
                                        title="Soft Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {data && data.count > 50 && (
                    <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)' }}>Previous</button>
                        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Page {page}</span>
                        <button disabled={data.data.length < 50} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)' }}>Next</button>
                    </div>
                )}
            </div>
        </div>
    );
}
