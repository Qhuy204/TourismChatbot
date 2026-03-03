import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Card, Row, Col, Tag, Typography, Space, Avatar } from 'antd';
import { RiseOutlined, ClockCircleOutlined, StarOutlined, GlobalOutlined, TeamOutlined, ThunderboltOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const stats = [
    { value: '100%', label: 'Destination Coverage', icon: <RiseOutlined /> },
    { value: '50%', label: 'Faster Planning', icon: <ClockCircleOutlined /> },
    { value: '90%', label: 'User Satisfaction', icon: <StarOutlined /> },
];

const team = [
    { name: 'Qhuy', role: 'Full-stack AI Developer / Founder', initials: 'QH' },
];

export default function AboutPage() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <Navbar />

            <section className="bg-network" style={{ padding: '80px 0 60px' }}>
                <div className="container" style={{ maxWidth: 640 }}>
                    <Title style={{ fontSize: 48, marginBottom: 16, lineHeight: 1.1 }}>
                        <span className="text-gradient">Story</span> About Us
                    </Title>
                    <Paragraph type="secondary" style={{ fontSize: 17, lineHeight: 1.7 }}>
                        Built by a passionate developer on a mission to make Vietnam exploration accessible, fast, and intelligent for everyone.
                    </Paragraph>
                </div>
            </section>

            <section className="py-mobile-12" style={{ padding: '80px 0' }}>
                <div className="container">
                    <Row gutter={[48, 32]} align="middle">
                        <Col xs={0} md={12}>
                            <div style={{ position: 'relative', height: 420 }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0,
                                    width: 250, height: 200, borderRadius: 20,
                                    background: 'linear-gradient(135deg, #1d6de0, #06b6d4)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transform: 'rotate(-3deg)', overflow: 'hidden',
                                }}>
                                    <GlobalOutlined style={{ fontSize: 64, color: 'rgba(255,255,255,0.3)' }} />
                                    <span style={{ position: 'absolute', fontSize: 13, fontWeight: 600, color: 'white', bottom: 16, left: 16 }}>Vietnam Tourism AI</span>
                                </div>
                                <div style={{
                                    position: 'absolute', top: 80, left: 140,
                                    width: 220, height: 180, borderRadius: 20,
                                    background: 'linear-gradient(135deg, #8b5cf6, #1d6de0)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transform: 'rotate(2deg)', overflow: 'hidden',
                                }}>
                                    <TeamOutlined style={{ fontSize: 52, color: 'rgba(255,255,255,0.3)' }} />
                                    <span style={{ position: 'absolute', fontSize: 13, fontWeight: 600, color: 'white', bottom: 16, left: 16 }}>10K+ Travelers</span>
                                </div>
                                <div style={{
                                    position: 'absolute', top: 220, left: 20,
                                    width: 180, height: 160, borderRadius: 20,
                                    background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transform: 'rotate(-1deg)',
                                }}>
                                    <ThunderboltOutlined style={{ fontSize: 44, color: 'rgba(255,255,255,0.3)' }} />
                                    <span style={{ position: 'absolute', fontSize: 13, fontWeight: 600, color: 'white', bottom: 12, left: 12 }}>AI-Powered</span>
                                </div>
                            </div>
                        </Col>

                        <Col xs={24} md={12}>
                            <Title level={2} style={{ marginBottom: 24, lineHeight: 1.2 }}>
                                We're Revolutionizing How<br />
                                <span className="text-gradient">Travelers Explore Vietnam.</span>
                            </Title>
                            <Paragraph type="secondary" style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 20 }}>
                                Born from a passion for travel and technology, AIBOT began as a research project at the intersection of large language models and Vietnam's rich tourism landscape. We believe every traveler deserves a knowledgeable, patient, and always-available travel companion.
                            </Paragraph>
                            <Paragraph type="secondary" style={{ fontSize: 15, lineHeight: 1.8, marginBottom: 32 }}>
                                Our AI is trained on thousands of destinations, local guides, reviews, and cultural insights — giving you answers that feel like advice from a local friend who happens to know everything.
                            </Paragraph>
                            <Space size={8} wrap>
                                {['Travel Expert', 'AI-Powered', 'Multilingual', 'Real-Time'].map(tag => (
                                    <Tag key={tag} color="blue" style={{ padding: '4px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600 }}>
                                        {tag}
                                    </Tag>
                                ))}
                            </Space>
                        </Col>
                    </Row>
                </div>
            </section>

            <section className="py-mobile-12" style={{ padding: '80px 0', background: 'var(--bg-muted)' }}>
                <div className="container">
                    <Title level={3} style={{ textAlign: 'center', marginBottom: 44 }}>
                        Connecting Worldwide Teams
                    </Title>
                    <Row gutter={[32, 32]}>
                        {stats.map(({ value, label, icon }) => (
                            <Col xs={24} sm={8} key={label}>
                                <Card hoverable style={{ textAlign: 'center' }}>
                                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(29,109,224,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                        <span style={{ fontSize: 24, color: 'var(--primary)' }}>{icon}</span>
                                    </div>
                                    <div style={{ fontSize: 44, fontWeight: 900, color: 'var(--primary)', letterSpacing: '-2px', marginBottom: 8 }}>{value}</div>
                                    <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>{label}</Text>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </div>
            </section>

            <section className="py-mobile-12" style={{ padding: '80px 0' }}>
                <div className="container">
                    <Title level={3} style={{ textAlign: 'center', marginBottom: 44 }}>
                        The Developer Behind AIBOT
                    </Title>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {team.map(({ name, role, initials }) => (
                            <Card key={name} hoverable style={{ textAlign: 'center', maxWidth: 300, width: '100%' }}>
                                <Avatar
                                    size={80}
                                    style={{
                                        background: 'linear-gradient(135deg, #1d6de0, #06b6d4)',
                                        fontSize: 22, fontWeight: 800,
                                        marginBottom: 20,
                                        boxShadow: '0 8px 16px rgba(29, 109, 224, 0.2)',
                                    }}
                                >
                                    {initials}
                                </Avatar>
                                <Title level={4} style={{ marginBottom: 6 }}>{name}</Title>
                                <Text type="secondary">{role}</Text>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
