import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    BarChart3, Download, Upload, TrendingUp, Loader2,
    FileSpreadsheet, Users, MessageSquare, Activity
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface DailyData {
    date: string;
    messages: number;
    active_users: number;
    tokens: number;
    sessions: number;
}

export default function AdminAnalytics() {
    const [days, setDays] = useState(14);
    const [exporting, setExporting] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const apiUrl = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:8001';

    const getAuthHeaders = async () => {
        const { data } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session?.access_token}`
        };
    };

    const { data: analytics, isLoading } = useQuery<{ days: number, data: DailyData[] }>({
        queryKey: ['admin-analytics', days],
        queryFn: async () => {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiUrl}/admin/analytics?days=${days}`, { headers });
            if (!res.ok) throw new Error('Failed to load analytics');
            return res.json();
        },
        staleTime: 120000, // Cache 2 min
    });

    const chartData = analytics?.data || [];

    // Compute totals
    const totals = chartData.reduce((acc, d) => ({
        messages: acc.messages + d.messages,
        sessions: acc.sessions + d.sessions,
        tokens: acc.tokens + d.tokens,
        activeUsers: Math.max(acc.activeUsers, d.active_users),
    }), { messages: 0, sessions: 0, tokens: 0, activeUsers: 0 });

    // Format date labels
    const formattedData = chartData.map(d => ({
        ...d,
        label: new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    }));

    // Export handler
    const handleExport = async (dataset: string, format: string = 'csv') => {
        setExporting(dataset);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiUrl}/admin/export/${dataset}?format=${format}`, { headers });

            if (format === 'json') {
                const json = await res.json();
                const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${dataset}_export.json`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${dataset}_export.csv`;
                a.click();
                URL.revokeObjectURL(url);
            }
            toast.success(`Exported ${dataset} successfully!`);
        } catch {
            toast.error(`Export ${dataset} failed`);
        } finally {
            setExporting(null);
        }
    };

    // Import handler
    const handleImport = async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data: session } = await supabase.auth.getSession();
            const res = await fetch(`${apiUrl}/admin/import/quota_overrides`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.session?.access_token}` },
                body: formData,
            });
            const result = await res.json();
            if (result.success) {
                toast.success(`Imported ${result.imported} quota overrides!`);
                if (result.errors.length > 0) {
                    toast.warning(`${result.errors.length} rows had errors`);
                }
            } else {
                toast.error('Import failed');
            }
        } catch {
            toast.error('Import request failed');
        }
    };

    const cardStyle: React.CSSProperties = {
        background: 'var(--bg-card)', borderRadius: 16,
        border: '1px solid var(--border)', padding: 24,
    };

    const statCardStyle: React.CSSProperties = {
        ...cardStyle, padding: 16, textAlign: 'center' as const,
    };

    const btnStyle: React.CSSProperties = {
        padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
        background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer',
        fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'inherit',
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <BarChart3 color="var(--primary)" /> Analytics & Exports
                </h1>

                <div style={{ display: 'flex', gap: 8 }}>
                    {[7, 14, 30].map(d => (
                        <button key={d} onClick={() => setDays(d)} style={{
                            ...btnStyle,
                            background: days === d ? 'var(--primary)' : 'var(--bg)',
                            color: days === d ? 'white' : 'var(--text)',
                            border: days === d ? '1px solid var(--primary)' : '1px solid var(--border)',
                        }}>
                            {d}D
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                    <Loader2 size={32} className="animate-spin" color="var(--primary)" />
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                        {[
                            { icon: MessageSquare, label: 'Tổng tin nhắn', value: totals.messages, color: '#3b82f6' },
                            { icon: Activity, label: 'Sessions mới', value: totals.sessions, color: '#10b981' },
                            { icon: TrendingUp, label: 'Tokens Used', value: totals.tokens.toLocaleString(), color: '#f59e0b' },
                            { icon: Users, label: 'Peak Active', value: totals.activeUsers, color: '#8b5cf6' },
                        ].map(({ icon: Icon, label, value, color }) => (
                            <div key={label} style={statCardStyle}>
                                <Icon size={18} color={color} style={{ marginBottom: 6 }} />
                                <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Messages & Sessions Line Chart */}
                    <div style={{ ...cardStyle, marginBottom: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px 0' }}>📈 Tin nhắn & Sessions theo ngày</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={formattedData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                                    labelStyle={{ fontWeight: 700 }}
                                />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Line type="monotone" dataKey="messages" stroke="#3b82f6" strokeWidth={2.5} name="Tin nhắn" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="sessions" stroke="#10b981" strokeWidth={2.5} name="Sessions" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Active Users Bar Chart */}
                    <div style={{ ...cardStyle, marginBottom: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px 0' }}>👥 Active Users theo ngày</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={formattedData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                                />
                                <Bar dataKey="active_users" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Users" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Token Usage Area Chart */}
                    <div style={{ ...cardStyle, marginBottom: 24 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px 0' }}>🔥 Token Usage Trend</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={formattedData}>
                                <defs>
                                    <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
                                    formatter={(value: number | undefined) => [(value ?? 0).toLocaleString(), 'Tokens']}
                                />
                                <Area type="monotone" dataKey="tokens" stroke="#f59e0b" strokeWidth={2.5} fill="url(#tokenGradient)" name="Tokens" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Export & Import Section */}
                    <div style={{ ...cardStyle }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px 0' }}>📦 Export & Import Data</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
                            {[
                                { key: 'users', label: 'Users & Roles', icon: Users, color: '#3b82f6' },
                                { key: 'sessions', label: 'Chat Sessions', icon: MessageSquare, color: '#10b981' },
                                { key: 'audit_logs', label: 'Audit Logs', icon: FileSpreadsheet, color: '#f59e0b' },
                                { key: 'usage', label: 'Usage Tracking', icon: Activity, color: '#8b5cf6' },
                            ].map(({ key, label, icon: Icon, color }) => (
                                <div key={key} style={{ padding: 16, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                        <Icon size={18} color={color} />
                                        <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            onClick={() => handleExport(key, 'csv')}
                                            disabled={exporting === key}
                                            style={{ ...btnStyle, flex: 1, justifyContent: 'center', fontSize: 12 }}
                                        >
                                            {exporting === key ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                            CSV
                                        </button>
                                        <button
                                            onClick={() => handleExport(key, 'json')}
                                            disabled={exporting === key}
                                            style={{ ...btnStyle, flex: 1, justifyContent: 'center', fontSize: 12 }}
                                        >
                                            {exporting === key ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                            JSON
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Import Section */}
                        <div style={{ padding: 20, background: 'var(--bg)', borderRadius: 12, border: '2px dashed var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <Upload size={20} color="var(--primary)" />
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>Import Quota Overrides</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Upload a CSV with columns: <code>user_id</code>, <code>daily_requests</code>, <code>daily_tokens</code></div>
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                style={{ display: 'none' }}
                                onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (f) handleImport(f);
                                    e.target.value = '';
                                }}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    ...btnStyle,
                                    background: 'var(--primary)',
                                    color: 'white',
                                    border: '1px solid var(--primary)',
                                    width: '100%',
                                    justifyContent: 'center',
                                    padding: '10px 16px',
                                }}
                            >
                                <Upload size={16} /> Chọn file CSV để upload
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
