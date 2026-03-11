import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Card, Row, Col, Statistic, Button, Segmented, Upload, Space, Typography, Spin,
} from 'antd';
import {
    BarChartOutlined, DownloadOutlined, UploadOutlined,
    MessageOutlined, RiseOutlined, UserOutlined, ThunderboltOutlined,
    LoadingOutlined,
} from '@ant-design/icons';
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { getAdminApiBaseUrl } from '@/lib/api-config';

const { Title } = Typography;

interface DailyData {
    date: string;
    messages: number;
    active_users: number;
    tokens: number;
    sessions: number;
}

export default function AdminAnalytics() {
    const [days, setDays] = useState<number>(14);
    const [topLimit, setTopLimit] = useState<number>(10);
    const [exporting, setExporting] = useState<string | null>(null);
    const apiUrl = getAdminApiBaseUrl();

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
        staleTime: 120000,
    });

    const { data: locStats, isLoading: isLocLoading } = useQuery<{ stats: { location: string, count: number, percentage: number }[] }>({
        queryKey: ['admin-loc-analytics', topLimit],
        queryFn: async () => {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiUrl}/langgraph/admin/analytics/locations?limit=${topLimit}`, { headers });
            if (!res.ok) throw new Error('Failed to load location stats');
            return res.json();
        },
        staleTime: 60000,
    });

    const { data: topicStats, isLoading: isTopicLoading } = useQuery<{ stats: { topic: string, count: number, label: string }[] }>({
        queryKey: ['admin-top-analytics', topLimit],
        queryFn: async () => {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiUrl}/langgraph/admin/analytics/topics?limit=${topLimit}`, { headers });
            if (!res.ok) throw new Error('Failed to load topic stats');
            return res.json();
        },
        staleTime: 60000,
    });

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];

    const chartData = analytics?.data || [];
    const totals = chartData.reduce((acc, d) => ({
        messages: acc.messages + d.messages,
        sessions: acc.sessions + d.sessions,
        tokens: acc.tokens + d.tokens,
        activeUsers: Math.max(acc.activeUsers, d.active_users),
    }), { messages: 0, sessions: 0, tokens: 0, activeUsers: 0 });

    const formattedData = chartData.map(d => ({
        ...d,
        label: new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    }));

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
                a.href = url; a.download = `${dataset}_export.json`; a.click();
                URL.revokeObjectURL(url);
            } else {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${dataset}_export.csv`; a.click();
                URL.revokeObjectURL(url);
            }
            toast.success(`Exported ${dataset} successfully!`);
        } catch {
            toast.error(`Export ${dataset} failed`);
        } finally {
            setExporting(null);
        }
    };

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
                if (result.errors?.length > 0) toast.warning(`${result.errors.length} rows had errors`);
            } else {
                toast.error('Import failed');
            }
        } catch {
            toast.error('Import request failed');
        }
        return false; // prevent AntD auto-upload
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Title level={3} style={{ margin: 0 }}>
                    <BarChartOutlined style={{ marginRight: 10 }} /> Analytics & Exports
                </Title>
                <Segmented
                    options={[
                        { label: '7D', value: 7 },
                        { label: '14D', value: 14 },
                        { label: '30D', value: 30 },
                    ]}
                    value={days}
                    onChange={(v) => setDays(v as number)}
                />
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
                </div>
            ) : (
                <>
                    <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                        {[
                            { icon: <MessageOutlined />, title: 'Tổng tin nhắn', value: totals.messages, color: '#3b82f6' },
                            { icon: <RiseOutlined />, title: 'Sessions mới', value: totals.sessions, color: '#10b981' },
                            { icon: <ThunderboltOutlined />, title: 'Tokens Used', value: totals.tokens, color: '#f59e0b' },
                            { icon: <UserOutlined />, title: 'Peak Active', value: totals.activeUsers, color: '#8b5cf6' },
                        ].map(({ icon, title, value, color }) => (
                            <Col xs={12} sm={6} key={title}>
                                <Card size="small" hoverable styles={{ body: { textAlign: 'center' } }}>
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

                    <Card title="📈 Tin nhắn & Sessions theo ngày" style={{ marginBottom: 24 }}>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={formattedData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Line type="monotone" dataKey="messages" stroke="#3b82f6" strokeWidth={2.5} name="Tin nhắn" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="sessions" stroke="#10b981" strokeWidth={2.5} name="Sessions" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>

                    <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
                        <Col xs={24} lg={12}>
                            <Card
                                title="📍 Top Locations"
                                extra={
                                    <Segmented
                                        size="small"
                                        options={[5, 10, 15, 20]}
                                        value={topLimit}
                                        onChange={(v) => setTopLimit(v as number)}
                                    />
                                }
                            >
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={locStats?.stats || []} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="location" type="category" width={100} tick={{ fontSize: 11 }} />
                                        <Tooltip
                                            formatter={(value: any, name: any, props: any) => {
                                                if (value === undefined || value === null) return ['0', 'Số câu hỏi'];
                                                return [
                                                    `${value} (${props?.payload?.percentage ?? 0}%)`,
                                                    'Số câu hỏi'
                                                ];
                                            }}
                                        />
                                        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Lượt hỏi" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Card>
                        </Col>
                        <Col xs={24} lg={12}>
                            <Card title="🧩 Intent Distribution">
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={topicStats?.stats || []}
                                            dataKey="count"
                                            nameKey="label"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            label={({ payload, percent }: any) => `${payload.label} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {(topicStats?.stats || []).map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Card>
                        </Col>
                    </Row>

                    <Card title="📦 Export & Import Data">
                        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
                            {[
                                { key: 'users', label: 'Users & Roles', icon: <UserOutlined />, color: '#3b82f6' },
                                { key: 'sessions', label: 'Chat Sessions', icon: <MessageOutlined />, color: '#10b981' },
                                { key: 'audit_logs', label: 'Audit Logs', icon: <BarChartOutlined />, color: '#f59e0b' },
                                { key: 'usage', label: 'Usage Tracking', icon: <RiseOutlined />, color: '#8b5cf6' },
                            ].map(({ key, label, icon, color }) => (
                                <Col xs={24} sm={12} md={6} key={key}>
                                    <Card size="small">
                                        <Space style={{ marginBottom: 12 }}>
                                            <span style={{ color }}>{icon}</span>
                                            <strong style={{ fontSize: 13 }}>{label}</strong>
                                        </Space>
                                        <Space style={{ width: '100%' }}>
                                            <Button
                                                size="small"
                                                icon={<DownloadOutlined />}
                                                loading={exporting === key}
                                                onClick={() => handleExport(key, 'csv')}
                                                block
                                            >
                                                CSV
                                            </Button>
                                            <Button
                                                size="small"
                                                icon={<DownloadOutlined />}
                                                loading={exporting === key}
                                                onClick={() => handleExport(key, 'json')}
                                                block
                                            >
                                                JSON
                                            </Button>
                                        </Space>
                                    </Card>
                                </Col>
                            ))}
                        </Row>

                        <Upload.Dragger
                            accept=".csv"
                            showUploadList={false}
                            beforeUpload={(file) => { handleImport(file); return false; }}
                        >
                            <p className="ant-upload-drag-icon">
                                <UploadOutlined style={{ fontSize: 32, color: '#1d6de0' }} />
                            </p>
                            <p className="ant-upload-text">Import Quota Overrides</p>
                            <p className="ant-upload-hint">
                                Upload a CSV with columns: <code>user_id</code>, <code>daily_requests</code>, <code>daily_tokens</code>
                            </p>
                        </Upload.Dragger>
                    </Card>
                </>
            )}
        </div>
    );
}
