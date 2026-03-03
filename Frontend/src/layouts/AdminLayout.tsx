import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useThemeMode } from '@/hooks/useThemeMode';
import { toast } from 'sonner';
import { ConfigProvider, Layout, Menu, Spin, theme as antdTheme, Button, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
    DashboardOutlined, UserOutlined, SafetyCertificateOutlined,
    MessageOutlined, AuditOutlined, CloudServerOutlined,
    BarChartOutlined, SettingOutlined, ArrowLeftOutlined,
    SunOutlined, MoonOutlined, LoadingOutlined,
} from '@ant-design/icons';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

type MenuItem = Required<MenuProps>['items'][number];

const navItems: MenuItem[] = [
    { key: '/admin', icon: <DashboardOutlined />, label: 'Overview' },
    { key: '/admin/users', icon: <UserOutlined />, label: 'Users Management' },
    { key: '/admin/limits', icon: <SafetyCertificateOutlined />, label: 'Limits & Quotas' },
    { key: '/admin/conversations', icon: <MessageOutlined />, label: 'Conversations' },
    { key: '/admin/logs', icon: <AuditOutlined />, label: 'Audit Logs' },
    { key: '/admin/system', icon: <CloudServerOutlined />, label: 'System Check' },
    { key: '/admin/analytics', icon: <BarChartOutlined />, label: 'Analytics & Exports' },
    { key: '/admin/settings', icon: <SettingOutlined />, label: 'Settings' },
];

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, loading: authLoading } = useAuth();
    const { theme, toggleTheme } = useThemeMode();
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/auth', { replace: true });
        }
    }, [user, authLoading, navigate]);

    useEffect(() => {
        if (!user) return;
        (async () => {
            const { data } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .single();
            if (data?.role === 'admin') {
                setIsAdmin(true);
            } else {
                toast.error('Bạn không có quyền truy cập trang Administration');
                navigate('/app', { replace: true });
            }
        })();
    }, [user, navigate]);

    const isDark = theme === 'dark';

    const antdThemeConfig = useMemo(() => ({
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
            colorPrimary: '#1d6de0',
            borderRadius: 10,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            colorSuccess: '#10b981',
            colorWarning: '#f59e0b',
            colorError: '#ef4444',
            colorInfo: '#3b82f6',
            ...(isDark ? {
                colorBgContainer: '#0e1320',
                colorBgElevated: '#131c2f',
                colorBgLayout: '#05070a',
                colorBorder: 'rgba(99, 130, 200, 0.18)',
                colorText: '#e8edf5',
                colorTextSecondary: '#8b9db8',
            } : {
                colorBgContainer: '#ffffff',
                colorBgElevated: '#f8faff',
                colorBgLayout: '#f0f4ff',
                colorBorder: '#dbe5f1',
                colorText: '#0f172a',
                colorTextSecondary: '#64748b',
            }),
        },
        components: {
            Menu: {
                itemBorderRadius: 10,
                itemMarginInline: 8,
                iconSize: 16,
            },
            Layout: {
                siderBg: isDark ? '#0e1320' : '#ffffff',
                headerBg: isDark ? '#0e1320' : '#ffffff',
            },
        },
    }), [isDark]);

    if (authLoading || isAdmin === null) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
            </div>
        );
    }

    const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
        navigate(key);
    };

    return (
        <ConfigProvider theme={antdThemeConfig}>
            <Layout style={{ minHeight: '100vh' }}>
                <Sider
                    collapsible
                    collapsed={collapsed}
                    onCollapse={setCollapsed}
                    width={260}
                    collapsedWidth={72}
                    breakpoint="lg"
                    style={{
                        borderRight: `1px solid ${isDark ? 'rgba(99, 130, 200, 0.18)' : '#dbe5f1'}`,
                        position: 'sticky',
                        top: 0,
                        height: '100vh',
                        overflow: 'auto',
                    }}
                >
                    <div style={{
                        padding: collapsed ? '20px 8px' : '20px 20px',
                        transition: 'padding 0.2s',
                    }}>
                        {!collapsed && (
                            <>
                                <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
                                    Qwen3-VL-8B
                                </Text>
                                <Text style={{ fontSize: 20, fontWeight: 800, display: 'block' }}>
                                    Admin Center
                                </Text>
                            </>
                        )}
                        {collapsed && (
                            <Text style={{ fontSize: 16, fontWeight: 800, textAlign: 'center', display: 'block' }}>
                                AC
                            </Text>
                        )}
                    </div>

                    <Menu
                        mode="inline"
                        selectedKeys={[location.pathname]}
                        items={navItems}
                        onClick={handleMenuClick}
                        style={{ border: 'none', flex: 1 }}
                    />

                    <div style={{
                        padding: collapsed ? '12px 8px' : '12px 16px',
                        borderTop: `1px solid ${isDark ? 'rgba(99, 130, 200, 0.18)' : '#dbe5f1'}`,
                    }}>
                        <Link
                            to="/app"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 12px', borderRadius: 10,
                                textDecoration: 'none',
                                color: isDark ? '#8b9db8' : '#64748b',
                                fontSize: 14, fontWeight: 500,
                                justifyContent: collapsed ? 'center' : 'flex-start',
                            }}
                        >
                            <ArrowLeftOutlined />
                            {!collapsed && 'Exit Admin'}
                        </Link>
                    </div>
                </Sider>

                <Layout>
                    <Header style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                        padding: '0 24px',
                        borderBottom: `1px solid ${isDark ? 'rgba(99, 130, 200, 0.18)' : '#dbe5f1'}`,
                        height: 56,
                    }}>
                        <Button
                            type="text"
                            icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                            onClick={toggleTheme}
                            size="middle"
                        />
                    </Header>

                    <Content style={{ padding: '28px 36px', overflow: 'auto' }}>
                        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                            <Outlet />
                        </div>
                    </Content>
                </Layout>
            </Layout>
        </ConfigProvider>
    );
}
