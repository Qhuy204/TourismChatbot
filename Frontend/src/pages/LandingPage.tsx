import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button, Card, Row, Col, Statistic, Space, Tag, Typography } from 'antd';
import {
    MessageOutlined, PictureOutlined, AudioOutlined, ThunderboltOutlined,
    SearchOutlined, CalendarOutlined, StarOutlined, RiseOutlined,
    ClockCircleOutlined, CheckCircleOutlined, ArrowRightOutlined,
    RobotOutlined, BarChartOutlined, GlobalOutlined, SafetyOutlined,
    CompassOutlined, SendOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

export default function LandingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t } = useLanguage();

    const quickActions = [
        { icon: <SearchOutlined />, label: t.search, desc: 'Real-time Vietnam DB', color: '#1d6de0' },
        { icon: <CompassOutlined />, label: 'Route Plan', desc: 'Optimum itineraries', color: '#06b6d4' },
        { icon: <PictureOutlined />, label: 'AI Vision', desc: 'Analyze travel photos', color: '#8b5cf6' },
        { icon: <AudioOutlined />, label: 'Voice companion', desc: 'Smart voice navigation', color: '#10b981' },
    ];

    const features = [
        { icon: <MessageOutlined />, label: t.feat1, desc: t.feat1Desc },
        { icon: <ThunderboltOutlined />, label: t.feat2, desc: t.feat2Desc },
        { icon: <PictureOutlined />, label: t.feat3, desc: t.feat3Desc },
        { icon: <GlobalOutlined />, label: t.feat4, desc: t.feat4Desc },
        { icon: <SafetyOutlined />, label: t.feat5, desc: t.feat5Desc },
        { icon: <BarChartOutlined />, label: t.feat6, desc: t.feat6Desc },
    ];

    const stats = [
        { value: '100%', label: t.statsCoverage, icon: <RiseOutlined /> },
        { value: '50%', label: t.statsFaster, icon: <ClockCircleOutlined /> },
        { value: '90%', label: t.statsSatisfaction, icon: <StarOutlined /> },
    ];

    const steps = [
        { num: '01', title: t.step1, desc: t.step1Desc },
        { num: '02', title: t.step2, desc: t.step2Desc },
        { num: '03', title: t.step3, desc: t.step3Desc },
        { num: '04', title: t.step4, desc: t.step4Desc },
    ];

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <Navbar />

            <section className="bg-network py-mobile-12" style={{ padding: '120px 0 80px' }}>
                <div className="container" style={{ textAlign: 'center' }}>
                    <Tag color="blue" style={{ marginBottom: 24, padding: '4px 16px', borderRadius: 100, fontSize: 13, fontWeight: 600 }}>
                        <ThunderboltOutlined /> {t.features}
                    </Tag>

                    <Title style={{
                        fontSize: 'clamp(2.2rem, 8vw, 4.5rem)',
                        fontWeight: 800,
                        lineHeight: 1.1,
                        marginBottom: 20,
                        letterSpacing: '-2px',
                    }}>
                        {t.heroTitle}<br className="desktop-only" />
                        <span className="text-gradient">{t.heroSubtitle}</span>
                    </Title>

                    <Paragraph type="secondary" style={{
                        fontSize: 16,
                        maxWidth: 600,
                        margin: '0 auto 32px',
                        lineHeight: 1.6,
                    }}>
                        {t.heroDesc}
                    </Paragraph>

                    <Space size={12} wrap>
                        <Button
                            type="primary"
                            size="large"
                            icon={<ArrowRightOutlined />}
                            className="animate-glow"
                            style={{ padding: '0 32px', height: 48, fontSize: 16, borderRadius: 12 }}
                            onClick={() => navigate(user ? '/app' : '/auth')}
                        >
                            {user ? t.goDashboard : t.getStarted}
                        </Button>
                        <Button
                            size="large"
                            style={{ padding: '0 32px', height: 48, fontSize: 16, borderRadius: 12 }}
                            onClick={() => navigate('/features')}
                        >
                            {t.howItWorks}
                        </Button>
                    </Space>
                </div>
            </section>

            <section className="py-mobile-12" style={{ padding: '80px 0', background: 'var(--bg-muted)' }}>
                <div className="container">
                    <Card
                        style={{
                            borderRadius: 20,
                            boxShadow: 'var(--shadow-glow)',
                            maxWidth: 1000,
                            margin: '0 auto',
                        }}
                    >
                        <div className="flex-col-mobile" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', minHeight: 460 }}>
                            <div className="hidden-mobile" style={{ background: 'var(--bg)', padding: '24px 16px', borderRight: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '0 4px' }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #1d6de0, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <ThunderboltOutlined style={{ color: 'white', fontSize: 13 }} />
                                    </div>
                                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>ViVi</span>
                                </div>
                                {[
                                    { icon: <MessageOutlined />, label: 'Chat', active: true },
                                    { icon: <RobotOutlined />, label: 'Bots' },
                                    { icon: <SearchOutlined />, label: 'Search' },
                                    { icon: <PictureOutlined />, label: 'AI Images' },
                                ].map(({ icon, label, active }) => (
                                    <div key={label} style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                                        background: active ? 'rgba(29,109,224,0.15)' : 'transparent',
                                        color: active ? 'var(--primary)' : 'var(--text-muted)',
                                        fontSize: 13, fontWeight: active ? 600 : 400,
                                    }}>
                                        {icon}
                                        {label}
                                    </div>
                                ))}
                            </div>

                            <div style={{ padding: 24, background: 'var(--bg-card)' }}>
                                <Title level={4} style={{ marginBottom: 4 }}>
                                    {t.ask.split(' ')[0]}! 👋
                                </Title>
                                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 24 }}>
                                    {t.heroDesc.split('.')[0]}?
                                </Text>
                                <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                                    {quickActions.map(({ icon, label, desc, color }) => (
                                        <Col xs={24} sm={12} key={label}>
                                            <Card
                                                size="small"
                                                hoverable
                                                styles={{ body: { padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 } }}
                                            >
                                                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <span style={{ color, fontSize: 15 }}>{icon}</span>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                                                </div>
                                            </Card>
                                        </Col>
                                    ))}
                                </Row>
                                <div style={{
                                    display: 'flex', gap: 8,
                                    background: 'var(--bg-muted)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 10, padding: '10px 14px',
                                }}>
                                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>{t.ask}</span>
                                    <Button type="primary" shape="default" icon={<SendOutlined />} size="small" style={{ borderRadius: 7 }} />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </section>

            <section style={{ padding: '48px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div className="container" style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 28, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
                        {t.trustedBy}
                    </Text>
                    <Space size={[32, 16]} wrap style={{ justifyContent: 'center', opacity: 0.5 }}>
                        {['DeepMind', 'Gemini', 'Unsloth', 'LangGraph', 'Supabase'].map(name => (
                            <span key={name} style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '-0.5px' }}>
                                {name}
                            </span>
                        ))}
                    </Space>
                </div>
            </section>

            <section className="py-mobile-12" style={{ padding: '100px 0' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <Title level={2} style={{ marginBottom: 12 }}>
                            {t.processTitle.split(',')[0]}, <span className="text-gradient">{t.processTitle.split(',')[1] || t.processTitle}</span>
                        </Title>
                        <Paragraph type="secondary" style={{ fontSize: 15 }}>
                            {t.processSubtitle}
                        </Paragraph>
                    </div>
                    <Row gutter={[24, 24]}>
                        {steps.map(({ num, title, desc }) => (
                            <Col xs={24} sm={12} md={6} key={num}>
                                <Card hoverable style={{ textAlign: 'center', height: '100%' }}>
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 12,
                                        background: 'rgba(29,109,224,0.12)',
                                        border: '1px solid var(--border-strong)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 16px',
                                    }}>
                                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)' }}>{num}</span>
                                    </div>
                                    <Title level={5} style={{ marginBottom: 8 }}>{title}</Title>
                                    <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>{desc}</Text>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </div>
            </section>

            <section className="py-mobile-12" style={{ padding: '80px 0', background: 'var(--bg-muted)' }}>
                <div className="container">
                    <Row gutter={[32, 32]}>
                        {stats.map(({ value, label, icon }) => (
                            <Col xs={24} sm={8} key={label}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                                        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(29,109,224,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ fontSize: 22, color: 'var(--primary)' }}>{icon}</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--primary)', letterSpacing: '-2px' }}>{value}</div>
                                    <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>{label}</Text>
                                </div>
                            </Col>
                        ))}
                    </Row>
                </div>
            </section>

            <section className="py-mobile-12" style={{ padding: '100px 0' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <Title level={2} style={{ marginBottom: 12 }}>
                            {t.features}
                        </Title>
                        <Paragraph type="secondary" style={{ fontSize: 15, maxWidth: 500, margin: '0 auto' }}>
                            {t.heroDesc}
                        </Paragraph>
                    </div>
                    <Row gutter={[24, 24]}>
                        {features.map(({ icon, label, desc }) => (
                            <Col xs={24} sm={12} md={8} key={label}>
                                <Card hoverable style={{ height: '100%' }} styles={{ body: { display: 'flex', gap: 16 } }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(29,109,224,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: 20, color: 'var(--primary)' }}>{icon}</span>
                                    </div>
                                    <div>
                                        <Title level={5} style={{ marginBottom: 6 }}>{label}</Title>
                                        <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>{desc}</Text>
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </div>
            </section>

            <section className="py-mobile-12" style={{ padding: '100px 0', background: 'var(--bg-muted)' }}>
                <div className="container" style={{ textAlign: 'center' }}>
                    <Card style={{
                        borderRadius: 24, padding: '40px 24px',
                        boxShadow: 'var(--shadow-glow)',
                        maxWidth: 700,
                        margin: '0 auto',
                    }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: 16,
                            background: 'linear-gradient(135deg, #1d6de0, #06b6d4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 24px',
                        }}>
                            <ThunderboltOutlined style={{ fontSize: 28, color: 'white' }} />
                        </div>
                        <Title level={2} style={{ marginBottom: 12 }}>
                            {t.ctaTitle}
                        </Title>
                        <Paragraph type="secondary" style={{ fontSize: 16, maxWidth: 440, margin: '0 auto 36px' }}>
                            {t.ctaDesc}
                        </Paragraph>
                        <Space size={16} wrap>
                            <Button
                                type="primary"
                                size="large"
                                icon={<ArrowRightOutlined />}
                                style={{ padding: '0 36px', height: 48, fontSize: 16, borderRadius: 12 }}
                                onClick={() => navigate(user ? '/app' : '/auth')}
                            >
                                {user ? t.goDashboard : t.getStarted}
                            </Button>
                            <Button
                                size="large"
                                style={{ padding: '0 36px', height: 48, fontSize: 16, borderRadius: 12 }}
                                onClick={() => navigate('/pricing')}
                            >
                                Compare Plans
                            </Button>
                        </Space>
                        <Paragraph type="secondary" style={{ marginTop: 20, fontSize: 13 }}>
                            <CheckCircleOutlined style={{ color: 'var(--primary)', marginRight: 4 }} />
                            {t.freePlan}
                        </Paragraph>
                    </Card>
                </div>
            </section>

            <Footer />
        </div>
    );
}
