import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
    Users, MessageSquare, BarChart3, TrendingUp,
    Cpu, Activity, Shield, Zap, XCircle, Server, Database, HardDrive, Loader2
} from 'lucide-react';

interface AppMetrics {
    total_users: number;
    total_messages: number;
    total_sessions: number;
    active_today: number;
    messages_today: number;
}

interface QueueMetrics {
    queue_size: number;
    circuit_breaker_state: string;
    total_processed: number;
    total_failures: number;
    is_gpu_available: boolean;
}

export default function AdminOverview() {
    const [hwMetrics, setHwMetrics] = useState<any>(null);
    const [queueMetrics, setQueueMetrics] = useState<QueueMetrics | null>(null);
    const [appState, setAppState] = useState('RUNNING');

    const apiUrl = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:8001';

    const getAuthHeaders = async () => {
        const { data } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session?.access_token}`
        };
    };

    const fetchAppMetrics = async (): Promise<AppMetrics> => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${apiUrl}/admin/metrics`, { headers });
        if (!res.ok) throw new Error("Failed to fetch metrics");
        return res.json();
    };

    const { data: appMetrics } = useQuery({
        queryKey: ['admin-overview-metrics'],
        queryFn: fetchAppMetrics,
        staleTime: 60000, // Cache for 1 minute
    });

    useEffect(() => {
        let ws: WebSocket | null = null;
        let isSubscribed = true;

        const connectWs = async () => {
            const { data } = await supabase.auth.getSession();
            if (!isSubscribed) return;
            const token = data.session?.access_token;
            if (!token) return;

            const wsUrl = apiUrl.replace('http', 'ws') + `/admin/live?token=${token}`;
            ws = new WebSocket(wsUrl);

            ws.onmessage = (event) => {
                if (!isSubscribed) return;
                try {
                    const payload = JSON.parse(event.data);
                    if (payload.type === 'metrics_update') {
                        setHwMetrics(payload.system);
                        setQueueMetrics(payload.queue);
                        setAppState(payload.state || 'RUNNING');
                    }
                } catch (e) {
                    console.error("WS Parse error", e);
                }
            };

            ws.onerror = (e) => {
                if (isSubscribed) console.error("WS error", e);
            };
        };

        connectWs();

        return () => {
            isSubscribed = false;
            if (ws) {
                // If connecting, wait or close. Closing right away triggers the warning but is safe.
                // We just rely on standard close.
                ws.close();
            }
        };
    }, []);

    const handleReloadModel = async () => {
        if (!confirm("Hệ thống sẽ bảo trì để reload model LLM. Chắc chắn tiếp tục?")) return;

        toast.info("Đang thực hiện reload model...");
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiUrl}/admin/models/reload`, {
                method: 'POST',
                headers
            });
            if (res.ok) {
                toast.success('Đã tải lại Model thành công!');
            } else {
                toast.error('Reload Model thất bại / Timeout');
            }
        } catch {
            toast.error('Lỗi khi gọi lệnh Reload Model');
        }
    };

    const cardStyle: React.CSSProperties = {
        background: 'var(--bg-card)', borderRadius: 16,
        border: '1px solid var(--border)', padding: 20,
    };

    return (
        <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>System Overview</h1>

            {appState === 'MAINTENANCE' && (
                <div style={{ padding: 16, background: '#f59e0b1a', border: '1px solid #f59e0b50', borderRadius: 12, marginBottom: 24, color: '#f59e0b', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Loader2 size={18} className="animate-spin" />
                    Hệ thống Mạng Đang Bảo Trì (Model Reloading). Các request mới sẽ tạm ngưng.
                </div>
            )}
            {appState === 'ERROR' && (
                <div style={{ padding: 16, background: '#ef44441a', border: '1px solid #ef444450', borderRadius: 12, marginBottom: 24, color: '#ef4444', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <XCircle size={18} />
                    Có lỗi nghiêm trọng ở Backend AI. Vui lòng kiểm tra Server Logs!
                </div>
            )}

            {/* Metrics Cards */}
            {appMetrics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
                    {[
                        { icon: Users, label: 'Tổng users', value: appMetrics.total_users, color: '#3b82f6' },
                        { icon: MessageSquare, label: 'Tổng tin nhắn', value: appMetrics.total_messages, color: '#10b981' },
                        { icon: BarChart3, label: 'Tổng sessions', value: appMetrics.total_sessions, color: '#f59e0b' },
                        { icon: TrendingUp, label: 'Active hôm nay', value: appMetrics.active_today, color: '#8b5cf6' },
                        { icon: MessageSquare, label: 'Tin nhắn hôm nay', value: appMetrics.messages_today, color: '#ef4444' },
                    ].map(({ icon: Icon, label, value, color }) => (
                        <div key={label} style={{ ...cardStyle, textAlign: 'center', padding: 16 }}>
                            <Icon size={18} color={color} style={{ marginBottom: 6 }} />
                            <div style={{ fontSize: 22, fontWeight: 800 }}>{value.toLocaleString()}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Hardware Status */}
            {hwMetrics && (
                <div style={{ ...cardStyle, marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                            <Server size={16} color="#3b82f6" /> Hardware Status (Live)
                        </h3>
                        <button
                            onClick={handleReloadModel}
                            disabled={appState === 'MAINTENANCE'}
                            style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: '#10b98120', color: '#10b981', border: '1px solid #10b98130', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                            {appState === 'MAINTENANCE' ? 'Đang tản nhiệt...' : 'Reload Qwen3 Model'}
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                        {/* GPU */}
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                                <Cpu size={14} color="#8b5cf6" /> GPU Util
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800 }}>
                                {hwMetrics.gpu?.utilization ?? 0}%
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                {Math.round((hwMetrics.gpu?.memory_used || 0) / 1024 * 10) / 10} / {Math.round((hwMetrics.gpu?.memory_total || 0) / 1024 * 10) / 10} GB
                            </div>
                        </div>

                        {/* CPU */}
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                                <Server size={14} color="#f59e0b" /> CPU
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800 }}>
                                {hwMetrics.cpu?.utilization ?? 0}%
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                {hwMetrics.cpu?.cores || 0} Cores
                            </div>
                        </div>

                        {/* RAM */}
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                                <Database size={14} color="#3b82f6" /> RAM
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800 }}>
                                {hwMetrics.ram?.percent ?? 0}%
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                {Math.round((hwMetrics.ram?.used || 0) / 1024 / 1024 / 1024 * 10) / 10} GB Used
                            </div>
                        </div>

                        {/* Disk */}
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                                <HardDrive size={14} color="#ef4444" /> Disk I/O
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800 }}>
                                {hwMetrics.disk?.percent ?? 0}%
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                {Math.round((hwMetrics.disk?.used || 0) / 1024 / 1024 / 1024 * 10) / 10} GB Used
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* GPU Queue Status */}
            {queueMetrics && (
                <div style={{ ...cardStyle, marginBottom: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px 0' }}>
                        <Cpu size={16} color="#8b5cf6" /> Trạng thái GPU Queue
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#3b82f620', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Activity size={20} color="#3b82f6" />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Hàng đợi</div>
                                <div style={{ fontSize: 18, fontWeight: 800 }}>{queueMetrics.queue_size} pending</div>
                            </div>
                        </div>
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: queueMetrics.is_gpu_available ? '#10b98120' : '#ef444420', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Shield size={20} color={queueMetrics.is_gpu_available ? '#10b981' : '#ef4444'} />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Circuit Breaker</div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: queueMetrics.is_gpu_available ? '#10b981' : '#ef4444' }}>
                                    {queueMetrics.circuit_breaker_state.toUpperCase()}
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#10b98120', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Zap size={20} color="#10b981" />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Đã xử lý (GPU)</div>
                                <div style={{ fontSize: 18, fontWeight: 800 }}>{queueMetrics.total_processed}</div>
                            </div>
                        </div>
                        <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ef444420', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <XCircle size={20} color="#ef4444" />
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Lỗi / Fallback</div>
                                <div style={{ fontSize: 18, fontWeight: 800 }}>{queueMetrics.total_failures}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
