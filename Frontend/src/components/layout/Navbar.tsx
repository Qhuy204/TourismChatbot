import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useAuth } from '@/hooks/useAuth';
import { Sun, Moon, Menu, X, LayoutDashboard, Globe } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

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
    const [langOpen, setLangOpen] = useState(false);
    const navigate = useNavigate();

    const links = navLinks(t);

    return (
        <nav style={{
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backdropFilter: 'blur(12px)',
        }}>
            <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
                {/* Logo */}
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                    <img src="/Logo.png" alt="ViVi" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }} />
                    <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                        Vi<span className="text-gradient">Vi</span>
                    </span>
                </Link>

                {/* Desktop Nav Links */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="desktop-nav">
                    {links.map(link => (
                        <Link
                            key={link.path}
                            to={link.path}
                            style={{
                                padding: '6px 14px',
                                borderRadius: 6,
                                fontSize: 14,
                                fontWeight: 500,
                                color: 'var(--text-secondary)',
                                textDecoration: 'none',
                                transition: 'color 0.2s ease',
                            }}
                            onMouseOver={e => (e.currentTarget.style.color = 'var(--text)')}
                            onMouseOut={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                {/* Right Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: 'var(--bg-muted)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>

                    {/* Language Toggle */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setLangOpen(!langOpen)}
                            style={{
                                height: 36, padding: '0 12px', borderRadius: 8,
                                background: 'var(--bg-muted)',
                                border: '1px solid var(--border)',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-secondary)',
                                transition: 'all 0.2s ease',
                                gap: 6, fontSize: 13, fontWeight: 600
                            }}
                        >
                            <Globe size={14} />
                            <span>{appLanguage.toUpperCase()}</span>
                        </button>
                        {langOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                                background: 'var(--bg-card)', border: '1px solid var(--border)',
                                borderRadius: 12, padding: 6, boxShadow: 'var(--shadow-lg)',
                                minWidth: 140, zIndex: 1000
                            }}>
                                {[
                                    { label: 'Tiếng Việt', value: 'vi' },
                                    { label: 'English', value: 'en' },
                                    { label: '简体中文', value: 'zh' }
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => { setAppLanguage(opt.value as any); setLangOpen(false); }}
                                        style={{
                                            width: '100%', padding: '8px 12px', borderRadius: 8,
                                            background: appLanguage === opt.value ? 'var(--bg-muted)' : 'transparent',
                                            border: 'none', color: 'var(--text)', fontSize: 13,
                                            textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s'
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Auth Button */}
                    {user ? (
                        <button
                            className="btn-primary"
                            onClick={() => navigate('/app')}
                            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            <LayoutDashboard size={14} />
                            <span className="desktop-only">{t.goDashboard || 'Go to App'}</span>
                            <span className="mobile-only">{t.goDashboard ? 'App' : 'App'}</span>
                        </button>
                    ) : (
                        <button
                            className="btn-primary"
                            onClick={() => navigate('/auth')}
                            style={{ padding: '8px 20px' }}
                        >
                            {t.logout ? (appLanguage === 'vi' ? 'Đăng nhập' : (appLanguage === 'zh' ? '登录' : 'Login')) : 'Login'}
                        </button>
                    )}

                    {/* Mobile Hamburger */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="mobile-menu-btn"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text)',
                            cursor: 'pointer',
                        }}
                    >
                        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div style={{
                    background: 'var(--bg-card)',
                    borderTop: '1px solid var(--border)',
                    padding: '12px 0',
                }}>
                    <div className="container">
                        {links.map(link => (
                            <Link
                                key={link.path}
                                to={link.path}
                                onClick={() => setMobileOpen(false)}
                                style={{
                                    display: 'block',
                                    padding: '10px 0',
                                    color: 'var(--text-secondary)',
                                    textDecoration: 'none',
                                    fontSize: 15,
                                    borderBottom: '1px solid var(--border)',
                                }}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <style>{`
        .mobile-menu-btn { display: none; }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
        </nav>
    );
}
