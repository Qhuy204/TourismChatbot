import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useThemeMode } from '@/hooks/useThemeMode';
import { Sun, Moon, Menu, X } from 'lucide-react';

const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'About', path: '/about' },
    { label: 'Features', path: '/features' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'Contact Us', path: '/contact' },
];

export function Navbar() {
    const { theme, toggleTheme } = useThemeMode();
    const [mobileOpen, setMobileOpen] = useState(false);
    const navigate = useNavigate();

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
                        Vi<span style={{ color: 'var(--primary)' }}>Vi</span>
                    </span>
                </Link>

                {/* Desktop Nav Links */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="desktop-nav">
                    {navLinks.map(link => (
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

                    {/* Login Button */}
                    <button
                        className="btn-primary"
                        onClick={() => navigate('/auth')}
                        style={{ padding: '8px 20px' }}
                    >
                        Login
                    </button>

                    {/* Mobile Hamburger */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="mobile-menu-btn"
                        style={{
                            display: 'none',
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
                        {navLinks.map(link => (
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
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
        </nav>
    );
}
