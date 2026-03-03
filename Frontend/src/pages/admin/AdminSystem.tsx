import { Card, Alert, Typography, Space } from 'antd';
import { CloudServerOutlined, DatabaseOutlined } from '@ant-design/icons';
import AdminOverview from './AdminOverview';

const { Title } = Typography;

export default function AdminSystem() {
    return (
        <div>
            <Title level={3} style={{ marginBottom: 20 }}>
                <CloudServerOutlined style={{ marginRight: 10 }} /> System Diagnostics
            </Title>

            <Card
                title={
                    <Space>
                        <DatabaseOutlined style={{ color: '#1d6de0' }} />
                        Live Telemetry
                    </Space>
                }
                style={{ marginBottom: 24 }}
            >
                <AdminOverview />
            </Card>

            <Alert
                type="warning"
                showIcon
                message="Additional internal system logs and Docker diagnostics will be available here in a future update."
            />
        </div>
    );
}
