import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
    Card, Row, Col, Statistic, Alert, Button, Spin, Progress, Space, Typography, Descriptions,
} from 'antd';
import {
    UserOutlined, MessageOutlined, BarChartOutlined, RiseOutlined,
    CloudServerOutlined, ThunderboltOutlined, WarningOutlined,
    CloseCircleOutlined, LoadingOutlined, ReloadOutlined,
    DashboardOutlined, HddOutlined, DatabaseOutlined,
    SafetyCertificateOutlined,
} from '@ant-design/icons';
import { getAdminApiBaseUrl, getAdminWsUrl } from '@/lib/api-config';

const { Title } = Typography;

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

    const apiUrl = getAdminApiBaseUrl();

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
        staleTime: 60000,
    });

    useEffect(() => {
        let ws: WebSocket | null = null;
        let isSubscribed = true;

        const connectWs = async () => {
            const { data } = await supabase.auth.getSession();
            if (!isSubscribed) return;
            const token = data.session?.access_token;
            if (!token) return;

            const wsUrl = getAdminWsUrl(token);
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
            if (ws) ws.close();
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

    return (
        <div>
            <Title level={3} style={{ marginBottom: 24 }}>
                <DashboardOutlined style={{ marginRight: 10 }} />
                System Overview
            </Title>

            {appState === 'MAINTENANCE' && (
                <Alert
                    message="Hệ thống Đang Bảo Trì"
                    description="Model đang được reload. Các request mới sẽ tạm ngưng."
                    type="warning"
                    showIcon
                    icon={<LoadingOutlined spin />}
                    style={{ marginBottom: 20 }}
                />
            )}
            {appState === 'ERROR' && (
                <Alert
                    message="Lỗi Nghiêm Trọng"
                    description="Có lỗi nghiêm trọng ở Backend AI. Vui lòng kiểm tra Server Logs!"
                    type="error"
                    showIcon
                    icon={<CloseCircleOutlined />}
                    style={{ marginBottom: 20 }}
                />
            )}

            {appMetrics && (
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    {[
                        { icon: <UserOutlined />, title: 'Tổng users', value: appMetrics.total_users, color: '#3b82f6' },
                        { icon: <MessageOutlined />, title: 'Tổng tin nhắn', value: appMetrics.total_messages, color: '#10b981' },
                        { icon: <BarChartOutlined />, title: 'Tổng sessions', value: appMetrics.total_sessions, color: '#f59e0b' },
                        { icon: <RiseOutlined />, title: 'Active hôm nay', value: appMetrics.active_today, color: '#8b5cf6' },
                        { icon: <MessageOutlined />, title: 'Tin nhắn hôm nay', value: appMetrics.messages_today, color: '#ef4444' },
                    ].map(({ icon, title, value, color }) => (
                        <Col xs={12} sm={8} lg={4} xl={4} key={title}>
                            <Card hoverable size="small" styles={{ body: { textAlign: 'center', padding: '16px 12px' } }}>
                                <Statistic
                                    title={title}
                                    value={value}
                                    prefix={<span style={{ color }}>{icon}</span>}
                                    valueStyle={{ fontWeight: 800 }}
                                />
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}

            {hwMetrics && (
                <Card
                    title={
                        <Space>
                            <CloudServerOutlined style={{ color: '#3b82f6' }} />
                            Hardware Status (Live)
                        </Space>
                    }
                    extra={
                        <Button
                            type="primary"
                            ghost
                            icon={<ReloadOutlined />}
                            disabled={appState === 'MAINTENANCE'}
                            onClick={handleReloadModel}
                            size="small"
                        >
                            {appState === 'MAINTENANCE' ? 'Đang tản nhiệt...' : 'Reload Qwen3 Model'}
                        </Button>
                    }
                    style={{ marginBottom: 24 }}
                >
                    <Row gutter={[16, 16]}>
                        <Col xs={12} sm={6}>
                            <Card size="small" styles={{ body: { textAlign: 'center' } }}>
                                <DashboardOutlined style={{ color: '#8b5cf6', fontSize: 18, marginBottom: 8 }} />
                                <div style={{ fontSize: 11, color: '#8b9db8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>GPU Util</div>
                                <Progress type="dashboard" percent={hwMetrics.gpu?.utilization ?? 0} size={80} strokeColor="#8b5cf6" />
                                <div style={{ fontSize: 11, color: '#8b9db8', marginTop: 4 }}>
                                    {Math.round((hwMetrics.gpu?.memory_used || 0) / 1024 * 10) / 10} / {Math.round((hwMetrics.gpu?.memory_total || 0) / 1024 * 10) / 10} GB
                                </div>
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card size="small" styles={{ body: { textAlign: 'center' } }}>
                                <CloudServerOutlined style={{ color: '#f59e0b', fontSize: 18, marginBottom: 8 }} />
                                <div style={{ fontSize: 11, color: '#8b9db8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>CPU</div>
                                <Progress type="dashboard" percent={hwMetrics.cpu?.utilization ?? 0} size={80} strokeColor="#f59e0b" />
                                <div style={{ fontSize: 11, color: '#8b9db8', marginTop: 4 }}>
                                    {hwMetrics.cpu?.cores || 0} Cores
                                </div>
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card size="small" styles={{ body: { textAlign: 'center' } }}>
                                <DatabaseOutlined style={{ color: '#3b82f6', fontSize: 18, marginBottom: 8 }} />
                                <div style={{ fontSize: 11, color: '#8b9db8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>RAM</div>
                                <Progress type="dashboard" percent={hwMetrics.ram?.percent ?? 0} size={80} strokeColor="#3b82f6" />
                                <div style={{ fontSize: 11, color: '#8b9db8', marginTop: 4 }}>
                                    {Math.round((hwMetrics.ram?.used || 0) / 1024 / 1024 / 1024 * 10) / 10} GB Used
                                </div>
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card size="small" styles={{ body: { textAlign: 'center' } }}>
                                <HddOutlined style={{ color: '#ef4444', fontSize: 18, marginBottom: 8 }} />
                                <div style={{ fontSize: 11, color: '#8b9db8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Disk</div>
                                <Progress type="dashboard" percent={hwMetrics.disk?.percent ?? 0} size={80} strokeColor="#ef4444" />
                                <div style={{ fontSize: 11, color: '#8b9db8', marginTop: 4 }}>
                                    {Math.round((hwMetrics.disk?.used || 0) / 1024 / 1024 / 1024 * 10) / 10} GB Used
                                </div>
                            </Card>
                        </Col>
                    </Row>
                </Card>
            )}

            {queueMetrics && (
                <Card
                    title={
                        <Space>
                            <DashboardOutlined style={{ color: '#8b5cf6' }} />
                            Trạng thái GPU Queue
                        </Space>
                    }
                    style={{ marginBottom: 24 }}
                >
                    <Row gutter={[16, 16]}>
                        <Col xs={12} sm={6}>
                            <Statistic
                                title="Hàng đợi"
                                value={queueMetrics.queue_size}
                                suffix="pending"
                                prefix={<ThunderboltOutlined style={{ color: '#3b82f6' }} />}
                                valueStyle={{ fontWeight: 800 }}
                            />
                        </Col>
                        <Col xs={12} sm={6}>
                            <Statistic
                                title="Circuit Breaker"
                                value={queueMetrics.circuit_breaker_state.toUpperCase()}
                                prefix={<SafetyCertificateOutlined style={{ color: queueMetrics.is_gpu_available ? '#10b981' : '#ef4444' }} />}
                                valueStyle={{
                                    fontWeight: 800, fontSize: 16,
                                    color: queueMetrics.is_gpu_available ? '#10b981' : '#ef4444',
                                }}
                            />
                        </Col>
                        <Col xs={12} sm={6}>
                            <Statistic
                                title="Đã xử lý (GPU)"
                                value={queueMetrics.total_processed}
                                prefix={<ThunderboltOutlined style={{ color: '#10b981' }} />}
                                valueStyle={{ fontWeight: 800 }}
                            />
                        </Col>
                        <Col xs={12} sm={6}>
                            <Statistic
                                title="Lỗi / Fallback"
                                value={queueMetrics.total_failures}
                                prefix={<CloseCircleOutlined style={{ color: '#ef4444' }} />}
                                valueStyle={{ fontWeight: 800 }}
                            />
                        </Col>
                    </Row>
                </Card>
            )}
        </div>
    );
}
