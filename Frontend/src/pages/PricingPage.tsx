import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/hooks/useAuth';
import { Check, Zap, Star, Building2, ArrowRight } from 'lucide-react';

const plans = [
    {
        name: 'Basic',
        price: 'Free',
        description: 'Perfect for casual travelers exploring Vietnam.',
        icon: Star,
        cta: 'Start for Free',
        ctaStyle: 'outline',
        features: [
            'Smart AI Conversations (Gemini Flash)',
            'Contextual Follow-up Suggestions',
            'Basic Destination Discovery',
            'Community Support',
            'History Tracking (Last 7 days)',
        ],
        highlight: false,
    },
    {
        name: 'Pro Explorer',
        price: '$9.99',
        period: '/month',
        description: 'The ultimate tool for serious travelers and digital nomads.',
        icon: Zap,
        cta: 'Get Started Now',
        ctaStyle: 'primary',
        features: [
            'Everything in Basic',
            'Multi-Modal Uploads (PDF, Excel, Images)',
            'Advanced Route & Itinerary Planning',
            'AI Voice Assistance (Beta)',
            'Real-Time Web Intelligence',
            'Unlimited Conversation History',
            'Priority Response Time',
        ],
        highlight: true,
    },
    {
        name: 'Business/Enterprise',
        price: 'Custom',
        description: 'For travel agencies and large scale tour operators.',
        icon: Building2,
        cta: 'Contact Sales',
        ctaStyle: 'outline',
        features: [
            'Everything in Pro Explorer',
            'Custom AI Model Training (SFT)',
            'Enterprise API Access',
            'Dedicated Account Manager',
            'SLA & High Availability',
            'Team Collaboration Workspace',
            'Advanced Analytics Dashboard',
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
