import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useLanguage } from '@/hooks/useLanguage';
import { ConfigProvider, Card, Tabs, Form, Input, Button, Divider, Dropdown, Spin, Typography, Space, theme as antdTheme } from 'antd';
import type { MenuProps } from 'antd';
import {
    SunOutlined, MoonOutlined, ArrowLeftOutlined, GlobalOutlined,
    MailOutlined, LockOutlined, UserOutlined, LoadingOutlined,
    GoogleOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export default function AuthPage() {
    const navigate = useNavigate();
    const { signIn, signUp, signInWithGoogle, user, loading: authLoading } = useAuth();
    const { theme, toggleTheme } = useThemeMode();
    const { appLanguage, setAppLanguage, t } = useLanguage();

    const [tab, setTab] = useState('login');
    const [isLoading, setIsLoading] = useState(false);
    const [showForgot, setShowForgot] = useState(false);

    const isDark = theme === 'dark';

    useEffect(() => {
        if (user && !authLoading) navigate('/app');
    }, [user, authLoading, navigate]);

    const handleLogin = async (values: { email: string; password: string }) => {
        setIsLoading(true);
        const { error } = await signIn(values.email, values.password);
        setIsLoading(false);
        if (error) {
            toast.error(t.loginFailed);
        } else {
            toast.success(t.loginSuccess);
            navigate('/app');
        }
    };

    const handleSignup = async (values: { displayName: string; email: string; password: string; confirm: string }) => {
        if (values.password !== values.confirm) {
            toast.error(t.passwordsDontMatch);
            return;
        }
        if (values.password.length < 6) {
            toast.error(t.passwordTooShort);
            return;
        }
        setIsLoading(true);
        const { error } = await signUp(values.email, values.password, values.displayName);
        setIsLoading(false);
        if (error) {
            toast.error(t.loginFailed.replace('Đăng nhập', 'Đăng ký'));
        } else {
            toast.success(t.signupSuccess);
        }
    };

    const handleForgot = async (values: { email: string }) => {
        setIsLoading(true);
        await supabase.auth.resetPasswordForEmail(values.email, {
            redirectTo: `${window.location.origin}/auth`,
        });
        setIsLoading(false);
        toast.success('Đã gửi email đặt lại mật khẩu!');
        setShowForgot(false);
    };

    const handleGoogle = async () => {
        setIsLoading(true);
        const { error } = await signInWithGoogle();
        setIsLoading(false);
        if (error) toast.error('Đăng nhập Google thất bại');
    };

    const langItems: MenuProps['items'] = [
        { key: 'vi', label: 'Tiếng Việt' },
        { key: 'en', label: 'English' },
        { key: 'zh', label: '简体中文' },
    ];

    const antdThemeConfig = useMemo(() => ({
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
            colorPrimary: '#1d6de0',
            borderRadius: 10,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        },
    }), [isDark]);

    if (authLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
            </div>
        );
    }

    return (
        <ConfigProvider theme={antdThemeConfig}>
            <div className="bg-network" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 10 }}>
                    <Button type="text" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme} />
                    <Dropdown
                        menu={{ items: langItems, onClick: ({ key }) => setAppLanguage(key as any), selectedKeys: [appLanguage] }}
                        trigger={['click']}
                    >
                        <Button type="text" icon={<GlobalOutlined />} />
                    </Dropdown>
                </div>
                <div style={{ position: 'absolute', top: 20, left: 20 }}>
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: isDark ? '#8b9db8' : '#64748b', textDecoration: 'none', fontSize: 14 }}>
                        <ArrowLeftOutlined /> {t.backToHome}
                    </Link>
                </div>

                <Card style={{ width: '100%', maxWidth: 420, borderRadius: 16 }} styles={{ body: { padding: 40 } }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 32 }}>
                        <img src="/Logo.png" alt="ViVi" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', boxShadow: '0 4px 16px rgba(29,109,224,0.2)', marginBottom: 16 }} />
                        <Title level={3} style={{ marginBottom: 6 }}>
                            {t.welcomeTo} <span style={{ color: '#1d6de0' }}>ViVi</span>
                        </Title>
                        <Text type="secondary" style={{ fontSize: 13 }}>{t.heroDesc.split('.')[0]}</Text>
                    </div>

                    {showForgot ? (
                        <>
                            <Title level={4} style={{ marginBottom: 6 }}>{t.resetPassword}</Title>
                            <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 24 }}>{t.enterEmail}</Paragraph>
                            <Form layout="vertical" onFinish={handleForgot}>
                                <Form.Item name="email" rules={[{ required: true, type: 'email' }]}>
                                    <Input prefix={<MailOutlined />} placeholder="you@example.com" size="large" />
                                </Form.Item>
                                <Button type="primary" htmlType="submit" block size="large" loading={isLoading} style={{ marginBottom: 12 }}>
                                    {t.sendResetLink}
                                </Button>
                                <Button type="text" block onClick={() => setShowForgot(false)} icon={<ArrowLeftOutlined />}>
                                    {t.login}
                                </Button>
                            </Form>
                        </>
                    ) : (
                        <>
                            <Tabs
                                activeKey={tab}
                                onChange={setTab}
                                centered
                                items={[
                                    { key: 'login', label: t.login },
                                    { key: 'signup', label: t.signup },
                                ]}
                                style={{ marginBottom: 24 }}
                            />

                            {tab === 'login' && (
                                <Form layout="vertical" onFinish={handleLogin}>
                                    <Form.Item name="email" rules={[{ required: true, type: 'email' }]}>
                                        <Input prefix={<MailOutlined />} placeholder="you@example.com" size="large" />
                                    </Form.Item>
                                    <Form.Item
                                        name="password"
                                        rules={[{ required: true }]}
                                        extra={
                                            <Button type="link" onClick={() => setShowForgot(true)} style={{ padding: 0, height: 'auto', fontSize: 12 }}>
                                                {t.forgotPassword}
                                            </Button>
                                        }
                                    >
                                        <Input.Password prefix={<LockOutlined />} placeholder="••••••••" size="large" />
                                    </Form.Item>
                                    <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
                                        {isLoading ? t.loggingIn : t.login}
                                    </Button>
                                </Form>
                            )}

                            {tab === 'signup' && (
                                <Form layout="vertical" onFinish={handleSignup}>
                                    <Form.Item name="displayName">
                                        <Input prefix={<UserOutlined />} placeholder={t.displayName} size="large" />
                                    </Form.Item>
                                    <Form.Item name="email" rules={[{ required: true, type: 'email' }]}>
                                        <Input prefix={<MailOutlined />} placeholder="you@example.com" size="large" />
                                    </Form.Item>
                                    <Form.Item name="password" rules={[{ required: true, min: 6 }]}>
                                        <Input.Password prefix={<LockOutlined />} placeholder={t.passwordTooShort} size="large" />
                                    </Form.Item>
                                    <Form.Item name="confirm" rules={[{ required: true }]}>
                                        <Input.Password prefix={<LockOutlined />} placeholder="••••••••" size="large" />
                                    </Form.Item>
                                    <Button type="primary" htmlType="submit" block size="large" loading={isLoading}>
                                        {isLoading ? t.signingUp : t.signup}
                                    </Button>
                                </Form>
                            )}

                            <Divider plain style={{ fontSize: 12, color: isDark ? '#8b9db8' : '#94a3b8' }}>hoặc</Divider>

                            <Button
                                block
                                size="large"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontWeight: 600 }}
                                onClick={handleGoogle}
                                loading={isLoading}
                                icon={
                                    <svg width="18" height="18" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                }
                            >
                                Continue with Google
                            </Button>
                        </>
                    )}

                    <Paragraph type="secondary" style={{ textAlign: 'center', fontSize: 12, marginTop: 24 }}>
                        {t.agreeTo}{' '}
                        <a href="#" style={{ color: '#1d6de0' }}>{t.termsOfService}</a>
                    </Paragraph>
                </Card>
            </div>
        </ConfigProvider>
    );
}
