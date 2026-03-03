import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/hooks/useAuth';
import { Card, Row, Col, Button, Tag, Typography, Space, Divider } from 'antd';
import { CheckCircleOutlined, ThunderboltOutlined, StarOutlined, BankOutlined, ArrowRightOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const plans = [
    {
        name: 'Explorer',
        price: 'Free',
        description: 'Dành cho người dùng cá nhân muốn trải nghiệm sức mạnh của AI du lịch.',
        icon: <StarOutlined />,
        cta: 'Bắt đầu miễn phí',
        ctaStyle: 'default' as const,
        features: [
            'Hệ trợ lý Gemini 1.5 Flash',
            'Truy xuất thông tin (RAG Engine)',
            'Nhận diện Intent & Emotion',
            'Gợi ý câu hỏi thông minh (Suggestions)',
            'Giao diện tương thích đa thiết bị',
        ],
        highlight: false,
    },
    {
        name: 'Voyager',
        price: '$9.99',
        period: '/month',
        description: 'Công cụ đắc lực cho những chuyến đi chuyên nghiệp và tối ưu.',
        icon: <ThunderboltOutlined />,
        cta: 'Nâng cấp ngay',
        ctaStyle: 'primary' as const,
        features: [
            'Tất cả tính năng bản Explorer',
            'Tool-use: Thời tiết & Tỷ giá Live (P1)',
            'Route Optimizer: Tối ưu lộ trình (P2)',
            'Price Engine: Tra cứu giá khách sạn (P3)',
            'Affiliate Booking: Đặt chỗ trực tiếp (P4)',
            'Xử lý Đa phương thức (PDF/Images/Excel)',
        ],
        highlight: true,
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        description: 'Giải pháp toàn diện cho các đơn vị lữ hành và doanh nghiệp du lịch.',
        icon: <BankOutlined />,
        cta: 'Liên hệ tư vấn',
        ctaStyle: 'default' as const,
        features: [
            'Tất cả tính năng bản Voyager',
            'Quản lý điểm đến (Wishlist Pro - P5)',
            'Semantic Cache: Phản hồi siêu tốc (P6)',
            'Custom SFT: Train model theo dữ liệu riêng',
            'Dashboard phân tích xu hướng du lịch',
            'Hỗ trợ triển khai API & White-label',
        ],
        highlight: false,
    },
];

export default function PricingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <Navbar />

            <section className="bg-network py-mobile-12" style={{ padding: '80px 0 60px' }}>
                <div className="container" style={{ maxWidth: 640 }}>
                    <Title style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3rem)', marginBottom: 16, lineHeight: 1.1 }}>
                        Plans for Teams of<br />
                        <span className="text-gradient">Every Size</span>
                    </Title>
                    <Paragraph type="secondary" style={{ fontSize: 16, lineHeight: 1.7 }}>
                        Simple, Transparent Pricing That Grows With Your App. No Limits, No Barriers.
                    </Paragraph>
                </div>
            </section>

            <section className="py-mobile-12" style={{ padding: '80px 0' }}>
                <div className="container">
                    <Title level={3} style={{ textAlign: 'center', marginBottom: 44 }}>
                        Flexible Plans for Every Team
                    </Title>
                    <Row gutter={[24, 24]} align="top">
                        {plans.map(({ name, price, period, description, icon, cta, ctaStyle, features, highlight }) => (
                            <Col xs={24} md={8} key={name}>
                                <Card
                                    hoverable
                                    style={{
                                        height: '100%',
                                        borderRadius: 16,
                                        border: highlight ? '2px solid var(--primary)' : undefined,
                                        background: highlight
                                            ? 'linear-gradient(135deg, rgba(29, 109, 224, 0.15) 0%, var(--bg-card) 100%)'
                                            : undefined,
                                        boxShadow: highlight ? 'var(--shadow-glow)' : undefined,
                                        position: 'relative',
                                        overflow: 'visible',
                                    }}
                                    styles={{ body: { padding: 32 } }}
                                >
                                    {highlight && (
                                        <div style={{
                                            position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                                            background: 'linear-gradient(135deg, #1d6de0, #06b6d4)', color: 'white',
                                            padding: '4px 16px', borderRadius: 100, fontSize: 12, fontWeight: 700,
                                            boxShadow: '0 4px 12px rgba(29, 109, 224, 0.3)', whiteSpace: 'nowrap',
                                        }}>
                                            Most Popular
                                        </div>
                                    )}

                                    <Tag style={{ marginBottom: 24, padding: '4px 14px', borderRadius: 100, fontWeight: 600 }}>
                                        {icon} {name}
                                    </Tag>

                                    <div style={{ marginBottom: 8 }}>
                                        <span style={{ fontSize: price === 'Custom' ? 38 : 52, fontWeight: 900, color: 'var(--text)', letterSpacing: '-2px' }}>{price}</span>
                                        {period && <Text type="secondary" style={{ fontSize: 16 }}>{period}</Text>}
                                    </div>

                                    <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>{description}</Paragraph>

                                    <Button
                                        type={ctaStyle === 'primary' ? 'primary' : 'default'}
                                        block
                                        size="large"
                                        style={{ marginBottom: 28, borderRadius: 10, fontWeight: 600 }}
                                        onClick={() => {
                                            if (price === 'Custom') navigate('/contact');
                                            else navigate(user ? '/app' : '/auth');
                                        }}
                                    >
                                        {price === 'Custom' ? cta : (user ? 'Go to Dashboard' : cta)}
                                    </Button>

                                    <Divider style={{ margin: '0 0 20px' }} />
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>
                                        + Features included
                                    </div>
                                    {features.map(feature => (
                                        <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                            <CheckCircleOutlined style={{ color: 'var(--primary)', flexShrink: 0, fontSize: 14 }} />
                                            <Text type="secondary" style={{ fontSize: 13 }}>{feature}</Text>
                                        </div>
                                    ))}
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </div>
            </section>

            <section className="py-mobile-12" style={{ padding: '80px 0', background: 'var(--bg-muted)' }}>
                <div className="container" style={{ textAlign: 'center' }}>
                    <Title level={3} style={{ marginBottom: 16 }}>
                        Still have questions?
                    </Title>
                    <Paragraph type="secondary" style={{ fontSize: 15, marginBottom: 28 }}>
                        Our team is happy to help you find the right plan.
                    </Paragraph>
                    <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={() => navigate('/contact')}>
                        Contact Sales
                    </Button>
                </div>
            </section>

            <Footer />
        </div>
    );
}
