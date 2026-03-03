import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Select, Typography, Tag, Space } from 'antd';
import { AuditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getAdminApiBaseUrl } from '@/lib/api-config';

const { Title } = Typography;

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

const actionColors: Record<string, string> = {
    ban_user: 'red',
    unban_user: 'green',
    change_role: 'blue',
    set_quota_override: 'orange',
    remove_quota_override: 'orange',
    reload_model: 'purple',
    soft_delete_conversation: 'volcano',
    cleanup_logs: 'default',
    export_users_async: 'cyan',
    export_sessions_async: 'cyan',
    export_audit_logs_async: 'cyan',
    export_usage_async: 'cyan',
};

const filterOptions = [
    { value: '', label: 'All Actions' },
    { value: 'ban_user', label: 'Ban User' },
    { value: 'unban_user', label: 'Unban User' },
    { value: 'change_role', label: 'Change Role' },
    { value: 'set_quota_override', label: 'Set Quota' },
    { value: 'reload_model', label: 'Reload Model' },
    { value: 'soft_delete_conversation', label: 'Delete Conversation' },
];

export default function AdminLogs() {
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState('');
    const apiUrl = getAdminApiBaseUrl();

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

    const columns: ColumnsType<AuditLog> = [
        {
            title: 'Timestamp',
            dataIndex: 'timestamp',
            key: 'timestamp',
            width: 170,
            render: (val: string) => (
                <span style={{ fontSize: 12 }}>{new Date(val).toLocaleString()}</span>
            ),
        },
        {
            title: 'Admin',
            dataIndex: 'admin_id',
            key: 'admin_id',
            width: 110,
            render: (id: string) => <code style={{ fontSize: 12 }}>{id.substring(0, 8)}...</code>,
        },
        {
            title: 'Action',
            dataIndex: 'action',
            key: 'action',
            width: 180,
            render: (action: string) => (
                <Tag color={actionColors[action] || 'default'}>{action}</Tag>
            ),
        },
        {
            title: 'Target',
            key: 'target',
            render: (_: unknown, record: AuditLog) => (
                <div>
                    <Tag style={{ fontSize: 10, textTransform: 'uppercase' }}>{record.target_type}</Tag>
                    <br />
                    <code style={{ fontSize: 12 }}>{record.target_id}</code>
                </div>
            ),
        },
        {
            title: 'IP',
            dataIndex: 'ip_address',
            key: 'ip_address',
            width: 130,
            render: (ip: string | null) => (
                <code style={{ fontSize: 12 }}>{ip || '-'}</code>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Title level={3} style={{ margin: 0 }}>
                    <AuditOutlined style={{ marginRight: 10 }} /> Audit Logs
                </Title>
                <Space>
                    <Select
                        value={actionFilter}
                        onChange={(val) => { setActionFilter(val); setPage(1); }}
                        options={filterOptions}
                        style={{ width: 200 }}
                        placeholder="Filter by action"
                    />
                </Space>
            </div>

            <Card styles={{ body: { padding: 0 } }}>
                <Table
                    columns={columns}
                    dataSource={data?.data || []}
                    rowKey="id"
                    loading={isLoading}
                    size="middle"
                    scroll={{ x: 700 }}
                    pagination={{
                        current: page,
                        total: data?.count || 0,
                        pageSize: 50,
                        onChange: (p) => setPage(p),
                        showTotal: (total) => `${total} logs`,
                    }}
                />
            </Card>
        </div>
    );
}
