import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/hooks/useAuth';
import { Check, Zap, Star, Building2, ArrowRight } from 'lucide-react';

const plans = [
    {
        name: 'Explorer',
        price: 'Free',
        description: 'Dành cho người dùng cá nhân muốn trải nghiệm sức mạnh của AI du lịch.',
        icon: Star,
        cta: 'Bắt đầu miễn phí',
        ctaStyle: 'outline',
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
        icon: Zap,
        cta: 'Nâng cấp ngay',
        ctaStyle: 'primary',
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
        icon: Building2,
        cta: 'Liên hệ tư vấn',
        ctaStyle: 'outline',
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

            {/* Hero */}
            <section className="bg-network py-mobile-12" style={{ padding: '80px 0 60px' }}>
                <div className="container" style={{ maxWidth: 640 }}>
                    <h1 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3rem)', fontWeight: 800, color: 'var(--text)', marginBottom: 16, lineHeight: 1.1 }}>
                        Plans for Teams of<br />
                        <span className="text-gradient">Every Size</span>
                    </h1>
                    <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        Simple, Transparent Pricing That Grows With Your App. No Limits, No Barriers.
                    </p>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="py-mobile-12" style={{ padding: '80px 0' }}>
                <div className="container">
                    <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem, 3.5vw, 1.8rem)', fontWeight: 800, color: 'var(--text)', marginBottom: 44 }}>
                        Flexible Plans for Every Team
                    </h2>
                    <div className="grid-cols-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, alignItems: 'start' }}>
                        {plans.map(({ name, price, period, description, icon: Icon, cta, ctaStyle, features, highlight }) => (
                            <div
                                key={name}
                                className={highlight ? '' : 'card'}
                                style={{
                                    padding: 32,
                                    borderRadius: 16,
                                    border: highlight ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    background: highlight
                                        ? 'linear-gradient(135deg, rgba(29,109,224,0.12) 0%, var(--bg-card) 100%)'
                                        : 'var(--bg-card)',
                                    boxShadow: highlight ? 'var(--shadow-glow)' : 'var(--shadow)',
                                    position: 'relative',
                                }}
                            >
                                {highlight && (
                                    <div style={{
                                        position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                                        background: 'var(--primary)', color: 'white',
                                        padding: '4px 16px', borderRadius: 100, fontSize: 12, fontWeight: 700,
                                    }}>
                                        Most Popular
                                    </div>
                                )}

                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    background: 'var(--bg-muted)', border: '1px solid var(--border)',
                                    borderRadius: 100, padding: '4px 14px', marginBottom: 24,
                                }}>
                                    <Icon size={13} color="var(--primary)" />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
                                </div>

                                <div style={{ marginBottom: 8 }}>
                                    <span style={{ fontSize: price === 'Custom' ? 38 : 52, fontWeight: 900, color: 'var(--text)', letterSpacing: '-2px' }}>{price}</span>
                                    {period && <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>{period}</span>}
                                </div>

                                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.6 }}>{description}</p>

                                <button
                                    onClick={() => {
                                        if (price === 'Custom') navigate('/contact');
                                        else navigate(user ? '/app' : '/auth');
                                    }}
                                    className={ctaStyle === 'primary' ? 'btn-primary' : 'btn-outline'}
                                    style={{ width: '100%', padding: '11px 0', marginBottom: 28, fontSize: 14 }}
                                >
                                    {price === 'Custom' ? cta : (user ? 'Go to Dashboard' : cta)}
                                </button>

                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>
                                        + Features included
                                    </div>
                                    {features.map(feature => (
                                        <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                            <Check size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ CTA */}
            <section className="py-mobile-12" style={{ padding: '80px 0', background: 'var(--bg-muted)' }}>
                <div className="container" style={{ textAlign: 'center' }}>
                    <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 1.8rem)', fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
                        Still have questions?
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 28 }}>
                        Our team is happy to help you find the right plan.
                    </p>
                    <button
                        className="btn-primary"
                        style={{ padding: '12px 32px' }}
                        onClick={() => navigate('/contact')}
                    >
                        Contact Sales <ArrowRight size={15} style={{ display: 'inline', marginLeft: 6 }} />
                    </button>
                </div>
            </section>

            <Footer />
        </div>
    );
}
