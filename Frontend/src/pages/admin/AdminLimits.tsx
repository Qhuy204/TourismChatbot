import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Typography, Empty, Space } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getAdminApiBaseUrl } from '@/lib/api-config';

const { Title } = Typography;

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
    const apiUrl = getAdminApiBaseUrl();

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

    const roleColumns: ColumnsType<QuotaRole> = [
        { title: 'Role', dataIndex: 'role', key: 'role', render: (v: string) => <strong>{v}</strong> },
        { title: 'Daily Requests', dataIndex: 'daily_requests', key: 'daily_requests' },
        { title: 'Daily Tokens', dataIndex: 'daily_tokens', key: 'daily_tokens', render: (v: number) => v.toLocaleString() },
    ];

    const overrideColumns: ColumnsType<QuotaOverride> = [
        { title: 'User ID', dataIndex: 'user_id', key: 'user_id', render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
        { title: 'Custom Requests', dataIndex: 'daily_requests', key: 'daily_requests', render: (v: number | null) => v ?? '-' },
        { title: 'Custom Tokens', dataIndex: 'daily_tokens', key: 'daily_tokens', render: (v: number | null) => v?.toLocaleString() ?? '-' },
    ];

    return (
        <div>
            <Title level={3} style={{ marginBottom: 20 }}>
                <SafetyCertificateOutlined style={{ marginRight: 10 }} /> Limits & Quotas
            </Title>

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card title="Default Role Limits">
                    <Table
                        columns={roleColumns}
                        dataSource={data?.roles || []}
                        rowKey="role"
                        loading={isLoading}
                        pagination={false}
                        size="middle"
                    />
                </Card>

                <Card title="User Overrides">
                    {data?.overrides?.length === 0 ? (
                        <Empty description="No custom overrides active." />
                    ) : (
                        <Table
                            columns={overrideColumns}
                            dataSource={data?.overrides || []}
                            rowKey="user_id"
                            loading={isLoading}
                            pagination={false}
                            size="middle"
                        />
                    )}
                </Card>
            </Space>
        </div>
    );
}
