import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Table, Input, Select, Button, Popconfirm, Space, Typography, Tag } from 'antd';
import { UserOutlined, StopOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getAdminApiBaseUrl } from '@/lib/api-config';

const { Title } = Typography;

interface UserInfo {
    id: string;
    email: string;
    display_name: string;
    role: string;
    message_count: number;
    session_count: number;
    last_active: string;
    is_banned: boolean;
}

export default function AdminUsers() {
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();
    const apiUrl = getAdminApiBaseUrl();

    const getAuthHeaders = async () => {
        const { data } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session?.access_token}`
        };
    };

    const { data: users = [], isLoading } = useQuery<UserInfo[]>({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiUrl}/admin/users`, { headers });
            if (!res.ok) throw new Error('Failed to load users');
            const data = await res.json();
            return Array.isArray(data) ? data : (data.users || []);
        },
        staleTime: 60000,
    });

    const handleChangeRole = async (userId: string, newRole: string) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiUrl}/admin/users/${userId}/role`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ role: newRole })
            });
            if (res.ok) {
                toast.success('Cập nhật role thành công');
                queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            } else {
                toast.error('Cập nhật thất bại');
            }
        } catch (e) {
            console.error(e);
            toast.error('Lỗi cập nhật role');
        }
    };

    const handleBanUser = async (userId: string) => {
        const reason = prompt('Nhập lý do ban:');
        if (!reason) return;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${apiUrl}/admin/users/${userId}/ban`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ban: true, reason })
            });
            if (res.ok) {
                toast.success('Đã ban User thành công.');
                queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            } else {
                toast.error("Lỗi khi ban");
            }
        } catch (e) {
            console.error(e);
            toast.error("Lỗi mạng khi ban");
        }
    };

    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const roleColors: Record<string, string> = {
        admin: 'red',
        api_client: 'blue',
        user: 'default',
    };

    const columns: ColumnsType<UserInfo> = [
        {
            title: 'User',
            dataIndex: 'email',
            key: 'email',
            render: (_: string, record: UserInfo) => (
                <div>
                    <div style={{ fontWeight: 600 }}>{record.display_name || 'No Name'}</div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>{record.email}</div>
                </div>
            ),
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            width: 140,
            render: (role: string, record: UserInfo) => (
                <Select
                    value={role || 'user'}
                    onChange={(val) => handleChangeRole(record.id, val)}
                    size="small"
                    style={{ width: 120 }}
                    options={[
                        { value: 'user', label: <Tag color="default">User</Tag> },
                        { value: 'api_client', label: <Tag color="blue">API Client</Tag> },
                        { value: 'admin', label: <Tag color="red">Admin</Tag> },
                    ]}
                />
            ),
        },
        {
            title: 'Usage',
            key: 'usage',
            render: (_: unknown, record: UserInfo) => (
                <div>
                    <div><strong>{record.message_count?.toLocaleString()}</strong> msgs</div>
                    <div style={{ fontSize: 12, opacity: 0.6 }}>{record.session_count?.toLocaleString()} sessions</div>
                </div>
            ),
        },
        {
            title: 'Last Active',
            dataIndex: 'last_active',
            key: 'last_active',
            render: (val: string) => val ? new Date(val).toLocaleDateString() : 'N/A',
        },
        {
            title: 'Status',
            key: 'status',
            width: 80,
            render: (_: unknown, record: UserInfo) => record.is_banned
                ? <Tag color="error">Banned</Tag>
                : <Tag color="success">Active</Tag>,
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 80,
            render: (_: unknown, record: UserInfo) => (
                <Popconfirm
                    title="Ban user này?"
                    description="User sẽ bị chặn truy cập hệ thống."
                    onConfirm={() => handleBanUser(record.id)}
                    okText="Ban"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                >
                    <Button danger icon={<StopOutlined />} size="small" type="text" />
                </Popconfirm>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Title level={3} style={{ margin: 0 }}>
                    <UserOutlined style={{ marginRight: 10 }} /> Quản lý Users
                </Title>
                <Input.Search
                    placeholder="Search email/name..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    allowClear
                    style={{ width: 280 }}
                />
            </div>

            <Card styles={{ body: { padding: 0 } }}>
                <Table
                    columns={columns}
                    dataSource={filteredUsers}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    size="middle"
                    scroll={{ x: 700 }}
                />
            </Card>
        </div>
    );
}
