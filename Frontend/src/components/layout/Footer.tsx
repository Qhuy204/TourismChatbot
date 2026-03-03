import { Link } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { Row, Col, Space, Button, Typography } from 'antd';
import { GithubOutlined, TwitterOutlined, LinkedinOutlined, ArrowRightOutlined } from '@ant-design/icons';

const { Text } = Typography;

const socialIcons = [
    { icon: <GithubOutlined />, href: '#' },
    { icon: <TwitterOutlined />, href: '#' },
    { icon: <LinkedinOutlined />, href: '#' },
];

export function Footer() {
    const year = new Date().getFullYear();
    const { t } = useLanguage();

    return (
        <footer className="py-mobile-12" style={{
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border)',
            padding: '60px 0 32px',
        }}>
            <div className="container">
                <Row gutter={[40, 32]} style={{ marginBottom: 48 }}>
                    <Col xs={24} sm={24} md={8}>
                        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 16 }}>
                            <img src="/Logo.png" alt="ViVi" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }} />
                            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                                Vi<span style={{ color: 'var(--primary)' }}>Vi</span>
                            </span>
                        </Link>
                        <Text type="secondary" style={{ display: 'block', fontSize: 14, lineHeight: 1.7, maxWidth: 280, marginBottom: 20 }}>
                            {t.heroDesc}
                        </Text>
                        <Space size={8}>
                            {socialIcons.map((s, i) => (
                                <Button key={i} type="text" icon={s.icon} href={s.href} shape="default"
                                    style={{ border: '1px solid var(--border)', borderRadius: 8, width: 34, height: 34 }}
                                />
                            ))}
                        </Space>
                    </Col>

                    <Col xs={12} sm={8} md={5}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>
                            {t.features}
                        </div>
                        {[t.features, t.pricing, t.about, 'Blog'].map(item => (
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
                    </Col>

                    <Col xs={12} sm={8} md={5}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>
                            {t.help}
                        </div>
                        {[t.contact, t.help, 'Privacy', 'Terms'].map(item => (
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
                    </Col>

                    <Col xs={24} sm={8} md={6}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>
                            Explore
                        </div>
                        <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => window.location.href = '/app'}>
                            {t.getStarted}
                        </Button>
                    </Col>
                </Row>

                <div style={{
                    borderTop: '1px solid var(--border)',
                    paddingTop: 24,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                        © {year} ViVi — Việt Nam Virtual Assistant. All rights reserved.
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                        Built with ❤️ for travelers in Vietnam
                    </Text>
                </div>
            </div>
        </footer>
    );
}
