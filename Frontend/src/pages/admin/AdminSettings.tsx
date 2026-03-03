import { Card, Form, Select, InputNumber, Button, Typography, Space } from 'antd';
import { SettingOutlined, SaveOutlined } from '@ant-design/icons';
import { toast } from 'sonner';

const { Title } = Typography;

export default function AdminSettings() {
    const handleSave = () => {
        toast.info("Settings functionality will be available in a future update.");
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Title level={3} style={{ margin: 0 }}>
                    <SettingOutlined style={{ marginRight: 10 }} /> Global Settings
                </Title>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                    Save Changes
                </Button>
            </div>

            <Card title="General Configuration">
                <Form layout="vertical" disabled>
                    <Form.Item
                        label="Maintenance Mode"
                        help="Temporarily halts all non-admin connections. Triggered automatically during Model Reloads."
                    >
                        <Select
                            defaultValue="active_users_only"
                            options={[
                                { value: 'active_users_only', label: 'System Default (Active Users Only)' },
                                { value: 'lock_all', label: 'Lock All Access' },
                            ]}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Global Message Retention"
                        help="Days to keep old messages before moving to cold storage."
                    >
                        <InputNumber defaultValue={90} style={{ width: '100%' }} suffix="days" />
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
}
