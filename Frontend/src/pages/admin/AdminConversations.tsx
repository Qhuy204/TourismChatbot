import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Table, Input, Button, Popconfirm, Typography, Tag } from 'antd';
import { MessageOutlined, DeleteOutlined } from '@ant-design/icons';
import { toast } from 'sonner';
import type { ColumnsType } from 'antd/es/table';
import { getAdminApiBaseUrl } from '@/lib/api-config';

const { Title } = Typography;

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
    const apiUrl = getAdminApiBaseUrl();

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

    const columns: ColumnsType<ChatSession> = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 110,
            render: (id: string) => (
                <code style={{ fontSize: 12, opacity: 0.6 }}>{id.substring(0, 8)}...</code>
            ),
        },
        {
            title: 'Title',
            dataIndex: 'title',
            key: 'title',
            render: (title: string) => title || <Tag>Untitled</Tag>,
        },
        {
            title: 'User ID',
            dataIndex: 'user_id',
            key: 'user_id',
            width: 120,
            render: (uid: string) => (
                <code style={{ fontSize: 12 }}>{uid.substring(0, 8)}...</code>
            ),
        },
        {
            title: 'Updated At',
            dataIndex: 'updated_at',
            key: 'updated_at',
            width: 170,
            render: (val: string) => new Date(val).toLocaleString(),
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 80,
            render: (_: unknown, record: ChatSession) => (
                <Popconfirm
                    title="Xóa cuộc hội thoại này?"
                    onConfirm={() => deleteMutation.mutate(record.id)}
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                >
                    <Button
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                        type="text"
                        loading={deleteMutation.isPending}
                    />
                </Popconfirm>
            ),
        },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Title level={3} style={{ margin: 0 }}>
                    <MessageOutlined style={{ marginRight: 10 }} /> Conversations
                </Title>
                <Input.Search
                    placeholder="Search title..."
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                    allowClear
                    style={{ width: 280 }}
                />
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
                        showTotal: (total) => `${total} conversations`,
                    }}
                />
            </Card>
        </div>
    );
}
