import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getAdminApiBaseUrl } from '@/lib/api-config';
import { toast } from 'sonner';
import {
    Card, Row, Col, Statistic, Button, Table, Input, Select, Tag,
    Space, Typography, Tooltip, Badge,
} from 'antd';
import {
    EnvironmentOutlined, ThunderboltOutlined, ClockCircleOutlined,
    SyncOutlined, DatabaseOutlined, SearchOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface StagedResponse {
    log_id: number;
    session_id: string;
    intent: string;
    staged_at: string;
    user_preview: string;
    response_preview: string;
}

interface CachedLocation {
    id?: number;
    name: string;
    province: string;
    city: string;
    category: string;
    description: string;
    extracted_at: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function nextMidnightCountdown() {
    const now = new Date();
    const midnight = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
    ));
    const diff = Math.max(0, midnight.getTime() - now.getTime());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
}

const INTENT_COLORS: Record<string, string> = {
    place_exploration: 'blue',
    itinerary_planning: 'geekblue',
    food_drink: 'orange',
    transportation: 'cyan',
    accommodation: 'purple',
    budget_info: 'gold',
    opening_hours: 'green',
    history_culture: 'volcano',
};

const CATEGORY_COLORS: Record<string, string> = {
    beach: 'blue', heritage: 'purple', food: 'orange',
    nature: 'green', temple: 'red', mountain: 'cyan',
    island: 'geekblue', museum: 'magenta', city: 'blue', other: 'default',
};

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function AdminLocations() {
    const apiUrl = getAdminApiBaseUrl();
    const qc = useQueryClient();
    const [queueSearch, setQueueSearch] = useState('');
    const [queueIntent, setQueueIntent] = useState<string | undefined>();
    const [cacheSearch, setCacheSearch] = useState('');
    const [cacheCategory, setCacheCategory] = useState<string | undefined>();

    const getAuthHeaders = useCallback(async () => {
        const { data } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session?.access_token}`,
        };
    }, []);

    /* ─── Queries ─── */
    const { data: stats } = useQuery({
        queryKey: ['loc-staging-stats'],
        queryFn: async () => {
            const h = await getAuthHeaders();
            const r = await fetch(`${apiUrl}/langgraph/locations/staging-stats`, { headers: h });
            return r.json() as Promise<{ staged_count: number; oldest_staged_at: string | null }>;
        },
        refetchInterval: 15000,
    });

    const { data: queue = [], isLoading: queueLoading, refetch: refetchQueue } = useQuery({
        queryKey: ['loc-staging-queue'],
        queryFn: async () => {
            const h = await getAuthHeaders();
            const r = await fetch(`${apiUrl}/langgraph/locations/staging-queue?limit=200`, { headers: h });
            return r.json() as Promise<StagedResponse[]>;
        },
        refetchInterval: 15000,
    });

    const { data: cache = [], isLoading: cacheLoading, refetch: refetchCache } = useQuery({
        queryKey: ['loc-cache'],
        queryFn: async () => {
            const h = await getAuthHeaders();
            const r = await fetch(`${apiUrl}/langgraph/locations/cached?limit=500`, { headers: h });
            const d = await r.json();
            return (Array.isArray(d) ? d : d.locations ?? []) as CachedLocation[];
        },
        refetchInterval: 30000,
    });

    /* ─── Flush mutation ─── */
    const flushMut = useMutation({
        mutationFn: async () => {
            const h = await getAuthHeaders();
            const r = await fetch(`${apiUrl}/langgraph/locations/flush`, { method: 'POST', headers: h });
            if (!r.ok) throw new Error('Flush failed');
            return r.json() as Promise<{ locations_stored: number }>;
        },
        onSuccess: (d) => {
            toast.success(`✅ Flush xong — đã lưu ${d.locations_stored} địa điểm mới`);
            qc.invalidateQueries({ queryKey: ['loc-staging-stats'] });
            qc.invalidateQueries({ queryKey: ['loc-staging-queue'] });
            qc.invalidateQueries({ queryKey: ['loc-cache'] });
        },
        onError: () => toast.error('❌ Flush thất bại'),
    });

    /* ─── Filter ─── */
    const filteredQueue = queue.filter(r => {
        const matchQ = !queueSearch || [r.user_preview, r.response_preview, r.intent]
            .some(v => v?.toLowerCase().includes(queueSearch.toLowerCase()));
        const matchI = !queueIntent || r.intent === queueIntent;
        return matchQ && matchI;
    });

    const filteredCache = cache.filter(l => {
        const matchQ = !cacheSearch || [l.name, l.province, l.city, l.description]
            .some(v => v?.toLowerCase().includes(cacheSearch.toLowerCase()));
        return matchQ && (!cacheCategory || l.category === cacheCategory);
    });

    /* ─── Table columns ─── */
    const queueCols = [
        { title: 'Log ID', dataIndex: 'log_id', width: 80,
            render: (v: number) => <Text code style={{ fontSize: 11 }}>#{v}</Text> },
        { title: 'Session', dataIndex: 'session_id', width: 90,
            render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text> },
        { title: 'Intent', dataIndex: 'intent', width: 130,
            render: (v: string) => <Tag color={INTENT_COLORS[v] ?? 'default'} style={{ fontSize: 10 }}>{v || '?'}</Tag> },
        { title: 'Câu hỏi', dataIndex: 'user_preview',
            render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v || '–'}</Text> },
        { title: 'Response bot (preview)', dataIndex: 'response_preview',
            render: (v: string) => (
                <Tooltip title={v} placement="topLeft">
                    <Text style={{ fontSize: 12, display: 'block', maxWidth: 360,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v || '–'}
                    </Text>
                </Tooltip>
            ) },
        { title: 'Staged lúc', dataIndex: 'staged_at', width: 90,
            render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>
                {v ? new Date(v).toLocaleTimeString('vi-VN') : '–'}
            </Text> },
    ];

    const cacheCols = [
        { title: 'Tên địa điểm', dataIndex: 'name',
            render: (v: string) => <strong>{v}</strong> },
        { title: 'Tỉnh/Thành', dataIndex: 'province', width: 130 },
        { title: 'Thành phố', dataIndex: 'city', width: 130 },
        { title: 'Danh mục', dataIndex: 'category', width: 110,
            render: (v: string) => <Tag color={CATEGORY_COLORS[v] ?? 'default'}>{v || 'other'}</Tag> },
        { title: 'Mô tả', dataIndex: 'description',
            render: (v: string) => (
                <Tooltip title={v}>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', maxWidth: 260,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v || '–'}
                    </Text>
                </Tooltip>
            ) },
        { title: 'Ngày lưu', dataIndex: 'extracted_at', width: 130,
            render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>
                {v ? new Date(v).toLocaleString('vi-VN') : '–'}
            </Text> },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Title level={3} style={{ margin: 0 }}>
                    <EnvironmentOutlined style={{ marginRight: 10 }} />
                    Location Monitor
                </Title>
                <Space>
                    <Button
                        icon={<SyncOutlined />}
                        onClick={() => { refetchQueue(); refetchCache(); }}
                    >
                        Refresh
                    </Button>
                    <Button
                        type="primary"
                        icon={<ThunderboltOutlined />}
                        loading={flushMut.isPending}
                        onClick={() => flushMut.mutate()}
                    >
                        Flush Now
                    </Button>
                </Space>
            </div>

            {/* ─── Stat cards ─── */}
            <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={6}>
                    <Card size="small" hoverable styles={{ body: { textAlign: 'center' } }}>
                        <Statistic
                            title="⏳ Staging Queue"
                            value={stats?.staged_count ?? 0}
                            valueStyle={{ color: '#d29922', fontWeight: 800 }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {stats?.oldest_staged_at
                                ? 'Từ ' + new Date(stats.oldest_staged_at).toLocaleTimeString('vi-VN')
                                : 'Queue trống'}
                        </Text>
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" hoverable styles={{ body: { textAlign: 'center' } }}>
                        <Statistic
                            title="✅ Locations Cached"
                            value={cache.length}
                            valueStyle={{ color: '#3fb950', fontWeight: 800 }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>trong Supabase</Text>
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" hoverable styles={{ body: { textAlign: 'center' } }}>
                        <Statistic
                            title="🕛 Flush tiếp theo"
                            value={nextMidnightCountdown()}
                            valueStyle={{ color: '#58a6ff', fontWeight: 800, fontSize: 22 }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>UTC midnight</Text>
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" hoverable styles={{ body: { textAlign: 'center' } }}>
                        <Badge
                            status={flushMut.isPending ? 'processing' : 'success'}
                            text={flushMut.isPending ? 'Flushing...' : 'Idle'}
                            style={{ fontSize: 13, fontWeight: 600 }}
                        />
                        <br />
                        <Text type="secondary" style={{ fontSize: 11 }}>Flush status</Text>
                    </Card>
                </Col>
            </Row>

            {/* ─── Staging Queue ─── */}
            <Card
                title={
                    <Space>
                        <ClockCircleOutlined style={{ color: '#d29922' }} />
                        Staging Queue
                        <Tag color="gold">{filteredQueue.length} / {queue.length}</Tag>
                    </Space>
                }
                extra={
                    <Space>
                        <Input
                            prefix={<SearchOutlined />}
                            placeholder="Tìm trong response..."
                            value={queueSearch}
                            onChange={e => setQueueSearch(e.target.value)}
                            allowClear
                            style={{ width: 200 }}
                            size="small"
                        />
                        <Select
                            placeholder="Lọc intent"
                            value={queueIntent}
                            onChange={setQueueIntent}
                            allowClear
                            size="small"
                            style={{ width: 160 }}
                            options={Object.keys(INTENT_COLORS).map(k => ({ label: k, value: k }))}
                        />
                    </Space>
                }
                style={{ marginBottom: 20 }}
            >
                <Table
                    dataSource={filteredQueue}
                    columns={queueCols}
                    rowKey="log_id"
                    size="small"
                    loading={queueLoading}
                    pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] }}
                    locale={{ emptyText: '📭 Không có response nào trong staging queue' }}
                    scroll={{ x: 900 }}
                />
            </Card>

            {/* ─── Locations Cache ─── */}
            <Card
                title={
                    <Space>
                        <DatabaseOutlined style={{ color: '#3fb950' }} />
                        Locations Cache (Supabase)
                        <Tag color="green">{filteredCache.length} / {cache.length}</Tag>
                    </Space>
                }
                extra={
                    <Space>
                        <Input
                            prefix={<SearchOutlined />}
                            placeholder="Tìm địa điểm..."
                            value={cacheSearch}
                            onChange={e => setCacheSearch(e.target.value)}
                            allowClear
                            size="small"
                            style={{ width: 200 }}
                        />
                        <Select
                            placeholder="Danh mục"
                            value={cacheCategory}
                            onChange={setCacheCategory}
                            allowClear
                            size="small"
                            style={{ width: 140 }}
                            options={Object.keys(CATEGORY_COLORS).map(k => ({ label: k, value: k }))}
                        />
                    </Space>
                }
            >
                <Table
                    dataSource={filteredCache}
                    columns={cacheCols}
                    rowKey={(r, i) => r.name + i}
                    size="small"
                    loading={cacheLoading}
                    pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: [15, 30, 50] }}
                    locale={{ emptyText: '🗺️ Chưa có địa điểm nào trong cache' }}
                    scroll={{ x: 800 }}
                />
            </Card>
        </div>
    );
}
