import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { ConfigProvider, Button, Drawer, Dropdown, Space, theme as antdTheme } from 'antd';
import type { MenuProps } from 'antd';
import {
    SunOutlined, MoonOutlined, MenuOutlined,
    AppstoreOutlined, GlobalOutlined, CloseOutlined,
} from '@ant-design/icons';

const navLinks = (t: any) => [
    { label: t.home, path: '/' },
    { label: t.about, path: '/about' },
    { label: t.features, path: '/features' },
    { label: t.pricing, path: '/pricing' },
    { label: t.contact, path: '/contact' },
];

export function Navbar() {
    const { theme, toggleTheme } = useThemeMode();
    const { user } = useAuth();
    const { appLanguage, setAppLanguage, t } = useLanguage();
    const [mobileOpen, setMobileOpen] = useState(false);
    const navigate = useNavigate();

    const isDark = theme === 'dark';
    const links = navLinks(t);

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
        components: {
            Button: { borderRadius: 8 },
        },
    }), [isDark]);

    return (
        <ConfigProvider theme={antdThemeConfig}>
            <nav style={{
                background: isDark ? 'rgba(14, 19, 32, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                borderBottom: `1px solid ${isDark ? 'rgba(99, 130, 200, 0.18)' : '#dbe5f1'}`,
                position: 'sticky',
                top: 0,
                zIndex: 100,
                backdropFilter: 'blur(16px)',
            }}>
                <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                        <img src="/Logo.png" alt="ViVi" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }} />
                        <span style={{ fontSize: 20, fontWeight: 800, color: isDark ? '#e8edf5' : '#0f172a', letterSpacing: '-0.5px' }}>
                            Vi<span className="text-gradient">Vi</span>
                        </span>
                    </Link>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} className="desktop-nav">
                        {links.map(link => (
                            <Link
                                key={link.path}
                                to={link.path}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: 8,
                                    fontSize: 14,
                                    fontWeight: 500,
                                    color: isDark ? '#b0bfd4' : '#475569',
                                    textDecoration: 'none',
                                    transition: 'all 0.2s ease',
                                }}
                                onMouseOver={e => {
                                    e.currentTarget.style.color = isDark ? '#e8edf5' : '#0f172a';
                                    e.currentTarget.style.background = isDark ? 'rgba(99, 130, 200, 0.1)' : 'rgba(29, 109, 224, 0.06)';
                                }}
                                onMouseOut={e => {
                                    e.currentTarget.style.color = isDark ? '#b0bfd4' : '#475569';
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    <Space size={8}>
                        <Button
                            type="text"
                            icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                            onClick={toggleTheme}
                            size="middle"
                        />

                        <Dropdown
                            menu={{
                                items: langItems,
                                onClick: ({ key }) => setAppLanguage(key as any),
                                selectedKeys: [appLanguage],
                            }}
                            trigger={['click']}
                        >
                            <Button type="text" icon={<GlobalOutlined />} size="middle">
                                <span className="desktop-only">{appLanguage.toUpperCase()}</span>
                            </Button>
                        </Dropdown>

                        {user ? (
                            <Button
                                type="primary"
                                icon={<AppstoreOutlined />}
                                onClick={() => navigate('/app')}
                            >
                                <span className="desktop-only">{t.goDashboard || 'Go to App'}</span>
                                <span className="mobile-only">App</span>
                            </Button>
                        ) : (
                            <Button type="primary" onClick={() => navigate('/auth')}>
                                {appLanguage === 'vi' ? 'Đăng nhập' : (appLanguage === 'zh' ? '登录' : 'Login')}
                            </Button>
                        )}

                        <Button
                            type="text"
                            icon={<MenuOutlined />}
                            onClick={() => setMobileOpen(true)}
                            className="mobile-menu-btn"
                        />
                    </Space>
                </div>

                <Drawer
                    title={
                        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                            <img src="/Logo.png" alt="ViVi" style={{ width: 30, height: 30, borderRadius: 8 }} />
                            <span style={{ fontSize: 18, fontWeight: 800, color: isDark ? '#e8edf5' : '#0f172a' }}>
                                Vi<span style={{ color: '#1d6de0' }}>Vi</span>
                            </span>
                        </Link>
                    }
                    placement="right"
                    onClose={() => setMobileOpen(false)}
                    open={mobileOpen}
                    size="default"
                    closeIcon={<CloseOutlined />}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {links.map(link => (
                            <Link
                                key={link.path}
                                to={link.path}
                                onClick={() => setMobileOpen(false)}
                                style={{
                                    display: 'block',
                                    padding: '12px 16px',
                                    borderRadius: 10,
                                    color: isDark ? '#b0bfd4' : '#475569',
                                    textDecoration: 'none',
                                    fontSize: 15,
                                    fontWeight: 500,
                                    transition: 'all 0.2s',
                                }}
                                onMouseOver={e => {
                                    e.currentTarget.style.background = isDark ? 'rgba(99, 130, 200, 0.1)' : 'rgba(29, 109, 224, 0.06)';
                                }}
                                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </Drawer>

                <style>{`
                    .mobile-menu-btn { display: none !important; }
                    @media (max-width: 768px) {
                        .desktop-nav { display: none !important; }
                        .mobile-menu-btn { display: flex !important; }
                    }
                `}</style>
            </nav>
        </ConfigProvider>
    );
}
