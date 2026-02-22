import { Link } from 'react-router-dom';
import { Github, Twitter, Linkedin } from 'lucide-react';

export function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer style={{
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border)',
            padding: '60px 0 32px',
        }}>
            <div className="container">
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }}>
                    {/* Brand */}
                    <div>
                        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 16 }}>
                            <img src="/Logo.png" alt="ViVi" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }} />
                            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                                Vi<span style={{ color: 'var(--primary)' }}>Vi</span>
                            </span>
                        </Link>
                        <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 280 }}>
                            Your all-in-one AI assistant for travel planning, discovery, and personalized recommendations in Vietnam and beyond.
                        </p>
                        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                            {[Github, Twitter, Linkedin].map((Icon, i) => (
                                <a
                                    key={i}
                                    href="#"
                                    style={{
                                        width: 34, height: 34, borderRadius: 8,
                                        background: 'var(--bg-muted)',
                                        border: '1px solid var(--border)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--text-muted)',
                                        textDecoration: 'none',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onMouseOver={e => {
                                        e.currentTarget.style.color = 'var(--primary)';
                                        e.currentTarget.style.borderColor = 'var(--primary)';
                                    }}
                                    onMouseOut={e => {
                                        e.currentTarget.style.color = 'var(--text-muted)';
                                        e.currentTarget.style.borderColor = 'var(--border)';
                                    }}
                                >
                                    <Icon size={15} />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Product */}
                    <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>
                            Product
                        </h4>
                        {['Features', 'Pricing', 'About', 'Blog'].map(item => (
                            <Link
                                key={item}
                                to={`/${item.toLowerCase()}`}
                                style={{ display: 'block', fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 10, transition: 'color 0.2s' }}
                                onMouseOver={e => (e.currentTarget.style.color = 'var(--primary)')}
                                onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >
                                {item}
                            </Link>
                        ))}
                    </div>

                    {/* Support */}
                    <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>
                            Support
                        </h4>
                        {['Contact Us', 'Help Center', 'Privacy', 'Terms'].map(item => (
                            <a
                                key={item}
                                href="#"
                                style={{ display: 'block', fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 10, transition: 'color 0.2s' }}
                                onMouseOver={e => (e.currentTarget.style.color = 'var(--primary)')}
                                onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >
                                {item}
                            </a>
                        ))}
                    </div>

                    {/* Explore */}
                    <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>
                            Explore
                        </h4>
                        <Link
                            to="/app"
                            style={{
                                display: 'inline-block',
                                padding: '10px 20px',
                                background: 'var(--primary)',
                                color: 'white',
                                borderRadius: 8,
                                fontSize: 14,
                                fontWeight: 600,
                                textDecoration: 'none',
                                transition: 'all 0.2s ease',
                            }}
                            onMouseOver={e => (e.currentTarget.style.background = 'var(--primary-hover)')}
                            onMouseOut={e => (e.currentTarget.style.background = 'var(--primary)')}
                        >
                            Try for Free →
                        </Link>
                    </div>
                </div>

                {/* Bottom bar */}
                <div style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: 24,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                }}>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        © {year} ViVi — Việt Nam Virtual Assistant. All rights reserved.
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        Built with ❤️ for travelers in Vietnam
                    </p>
                </div>
            </div>

            <style>{`
        @media (max-width: 768px) {
          footer > div > div:first-child > div:first-child {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
        </footer>
    );
}
