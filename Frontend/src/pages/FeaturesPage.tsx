import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Card, Row, Col, Tag, Typography, Space } from 'antd';
import {
    MessageOutlined, PictureOutlined, AudioOutlined, SearchOutlined,
    BranchesOutlined, ThunderboltOutlined, SafetyOutlined, GlobalOutlined,
    CheckCircleOutlined, BarChartOutlined,
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const featureGroups = [
    {
        title: 'Smart RAG Conversations',
        desc: 'Vietnam Knowledge Base',
        icon: <MessageOutlined />,
        color: '#1d6de0',
        points: [
            'Context-aware chat powered by vector search',
            'Sourced from official Vietnam tourism data',
            'Handles complex itinerary reasoning',
            'Personalized suggestions for every query',
        ],
    },
    {
        title: 'AI Vision & Multi-Modal',
        desc: 'See, Upload, Discover',
        icon: <PictureOutlined />,
        color: '#8b5cf6',
        points: [
            'Identify landmarks from uploaded photos',
            'Scan travel documents (PDF/Excel) for insights',
            'Depth analysis for location orientation',
            'Image-to-itinerary automated generation',
        ],
    },
    {
        title: 'Voice travel companion',
        desc: 'Smarter Hands-Free',
        icon: <AudioOutlined />,
        color: '#10b981',
        points: [
            'Natural speech-to-text tour guidance',
            'Real-time translation for local interaction',
            'Audio-based destination storytelling',
            'Hands-free navigation commands',
        ],
    },
    {
        title: 'Real-Time Web Intelligence',
        desc: 'Web-Search Agent',
        icon: <GlobalOutlined />,
        color: '#06b6d4',
        points: [
            'Live weather, events, and advisories',
            'Automatic updates for flight & hotel prices',
            'Web-retrieval for breaking travel news',
            'Up-to-the-minute attraction opening hours',
        ],
    },
    {
        title: 'Automated Trip Planning',
        desc: 'Agentic Workflows',
        icon: <BranchesOutlined />,
        color: '#f59e0b',
        points: [
            'End-to-end trip blueprinting in seconds',
            'Multi-stop optimization for Vietnam routes',
            'Budget-conscious activity allocation',
            'Export itineraries to PDF or Calendar',
        ],
    },
    {
        title: 'Enterprise Analytics',
        desc: 'Data-Driven Travel',
        icon: <BarChartOutlined />,
        color: '#ef4444',
        points: [
            'Detailed logs of travel preferences',
            'Trend analysis for popular destination hotspots',
            'Business dashboard for tour operators',
            'Custom AI training for agency datasets',
        ],
    },
];

export default function FeaturesPage() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <Navbar />

            <section className="bg-network py-mobile-12" style={{ padding: '80px 0 60px' }}>
                <div className="container" style={{ maxWidth: 640 }}>
                    <Tag color="blue" style={{ marginBottom: 20, padding: '4px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600 }}>
                        <ThunderboltOutlined /> Explore Features
                    </Tag>
                    <Title style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3rem)', marginBottom: 16, lineHeight: 1.1 }}>
                        Explore Our <span className="text-gradient">Features</span>
                    </Title>
                    <Paragraph type="secondary" style={{ fontSize: 16, lineHeight: 1.7 }}>
                        Everything you need to plan, discover, and experience Vietnam — all powered by cutting-edge AI.
                    </Paragraph>
                </div>
            </section>

            <section className="py-mobile-12" style={{ padding: '80px 0' }}>
                <div className="container">
                    <Row gutter={[24, 24]}>
                        {featureGroups.map(({ title, desc, icon, color, points }) => (
                            <Col xs={24} md={12} key={title}>
                                <Card hoverable style={{ height: '100%' }} styles={{ body: { padding: 36 } }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 24 }}>
                                        <div style={{
                                            width: 52, height: 52, borderRadius: 14,
                                            background: `${color}18`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <span style={{ fontSize: 24, color }}>{icon}</span>
                                        </div>
                                        <div>
                                            <Text style={{ fontSize: 12, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                                {desc}
                                            </Text>
                                            <Title level={4} style={{ marginTop: 4, marginBottom: 0 }}>{title}</Title>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {points.map(point => (
                                            <div key={point} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                                <CheckCircleOutlined style={{ color: 'var(--primary)', marginTop: 4, flexShrink: 0 }} />
                                                <Text type="secondary" style={{ fontSize: 13.5, lineHeight: 1.6 }}>{point}</Text>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </div>
            </section>

            <section className="py-mobile-12" style={{ padding: '80px 0', background: 'var(--bg-muted)' }}>
                <div className="container" style={{ textAlign: 'center', maxWidth: 700 }}>
                    <SearchOutlined style={{ fontSize: 40, color: 'var(--primary)', marginBottom: 20 }} />
                    <Title level={2} style={{ marginBottom: 16 }}>
                        Powered by Advanced AI
                    </Title>
                    <Paragraph type="secondary" style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
                        Combining Gemini and Qwen models with real-time retrieval for accurate, up-to-date travel information about Vietnam destinations.
                    </Paragraph>
                    <Space size={10} wrap style={{ justifyContent: 'center' }}>
                        {['Gemini 3.0 Flash', 'RAG Retrieval', 'Supabase Vector DB', 'LangGraph Agents'].map(tag => (
                            <Tag key={tag} color="blue" style={{ padding: '4px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600 }}>
                                {tag}
                            </Tag>
                        ))}
                    </Space>
                </div>
            </section>

            <Footer />
        </div>
    );
}
