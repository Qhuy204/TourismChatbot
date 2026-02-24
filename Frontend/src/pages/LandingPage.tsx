import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/hooks/useAuth';
import {
    MessageSquare, Image, Mic, Zap, Search, Calendar,
    Star, TrendingUp, Clock, CheckCircle, ArrowRight,
    Bot, BarChart3, Globe, Shield, Map
} from 'lucide-react';

const quickActions = [
    { icon: Search, label: 'Smart RAG', desc: 'Real-time Vietnam data', color: '#1d6de0' },
    { icon: Map, label: 'Itineraries', desc: 'AI-generated schedules', color: '#06b6d4' },
    { icon: Image, label: 'Multi-Modal', desc: 'Analyze travel photos', color: '#8b5cf6' },
    { icon: Mic, label: 'Voice Guide', desc: 'Smarter voice assistance', color: '#10b981' },
];

const features = [
    { icon: MessageSquare, label: 'Contextual Chat', desc: 'Natural dialogue with deep memory of your preferences.' },
    { icon: Zap, label: 'RAG Retrieval', desc: 'Instant access to up-to-date Vietnam tourism data and local secrets.' },
    { icon: Image, label: 'Visual Analysis', desc: 'Identify landmarks, menus, and documents using advanced AI vision.' },
    { icon: Globe, label: 'Multi-Lingual', desc: 'Seamlessly switch between Vietnamese, English, and other languages.' },
    { icon: Shield, label: 'Secure & Private', desc: 'Enterprise-grade encryption for all your personal travel data.' },
    { icon: BarChart3, label: 'Smart Insights', desc: 'Discover travel patterns and personalized recommendations.' },
];

const stats = [
    { value: '100%', label: 'Destination Coverage', icon: TrendingUp },
    { value: '50%', label: 'Faster Trip Planning', icon: Clock },
    { value: '90%', label: 'User Satisfaction', icon: Star },
];

const steps = [
    { num: '01', title: 'Contextual Input', desc: 'Ask anything or upload your travel documents.' },
    { num: '02', title: 'AI Processing', desc: 'Gemini & Qwen models analyze your request instantly.' },
    { num: '03', title: 'Data Retrieval', desc: 'We fetch real-time data from our Vietnam Knowledge Base.' },
    { num: '04', title: 'Instant Result', desc: 'Receive perfect plans, maps, and local insights.' },
];

export default function LandingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <Navbar />

            {/* ── Hero ── */}
            <section className="bg-network py-mobile-12" style={{ padding: '120px 0 80px' }}>
                <div className="container" style={{ textAlign: 'center' }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'rgba(29,109,224,0.12)', border: '1px solid var(--border-strong)',
                        padding: '6px 16px', borderRadius: 100, marginBottom: 24,
                    }}>
                        <Zap size={14} color="var(--primary)" />
                        <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                            All-in-one AI Travel Assistant
                        </span>
                    </div>

                    <h1 style={{
                        fontSize: 'clamp(2.2rem, 8vw, 4.5rem)',
                        fontWeight: 800,
                        lineHeight: 1.1,
                        color: 'var(--text)',
                        marginBottom: 20,
                        letterSpacing: '-2px',
                    }}>
                        All-in-one AI Assistant.<br className="desktop-only" />
                        <span className="text-gradient">Personalized, Fast and Free</span>
                    </h1>

                    <p style={{
                        fontSize: 16,
                        color: 'var(--text-secondary)',
                        maxWidth: 600,
                        margin: '0 auto 32px',
                        lineHeight: 1.6,
                    }}>
                        Your intelligent travel companion for Vietnam. Discover destinations,
                        plan itineraries, and get real-time travel insights — all powered by AI.
                    </p>

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                            className="btn-primary animate-glow"
                            style={{ padding: '14px 32px', fontSize: 16, borderRadius: 12 }}
                            onClick={() => navigate(user ? '/app' : '/auth')}
                        >
                            {user ? 'Go to Dashboard' : 'Get Started Free'}
                        </button>
                        <button
                            className="btn-outline"
                            style={{ padding: '14px 32px', fontSize: 16, borderRadius: 12 }}
                            onClick={() => navigate('/features')}
                        >
                            See how it works
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Dashboard Preview ── */}
            <section className="py-mobile-12" style={{ padding: '80px 0', background: 'var(--bg-muted)' }}>
                <div className="container">
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 20,
                        padding: 'clamp(16px, 4vw, 32px)',
                        boxShadow: 'var(--shadow-glow)',
                        maxWidth: 1000,
                        margin: '0 auto',
                    }}>
                        {/* Mini App Preview */}
                        <div className="flex-col-mobile" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', minHeight: 460 }}>
                            {/* Sidebar */}
                            <div className="hidden-mobile" style={{ background: 'var(--bg)', padding: '24px 16px', borderRight: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '0 4px' }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #1d6de0, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Zap size={13} color="white" />
                                    </div>
                                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>ViVi</span>
                                </div>
                                {[{ icon: MessageSquare, label: 'Chat', active: true }, { icon: Bot, label: 'Bots' }, { icon: Search, label: 'Search' }, { icon: Image, label: 'AI Images' }].map(({ icon: Icon, label, active }) => (
                                    <div key={label} style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                                        background: active ? 'rgba(29,109,224,0.15)' : 'transparent',
                                        color: active ? 'var(--primary)' : 'var(--text-muted)',
                                        fontSize: 13, fontWeight: active ? 600 : 400,
                                    }}>
                                        <Icon size={15} />
                                        {label}
                                    </div>
                                ))}
                            </div>

                            {/* Main Chat */}
                            <div style={{ padding: 24, background: 'var(--bg-card)' }}>
                                <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                                    Xin chào! 👋
                                </h3>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
                                    Tôi có thể giúp bạn lên kế hoạch du lịch hôm nay không?
                                </p>
                                <div className="grid-cols-mobile-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                                    {quickActions.map(({ icon: Icon, label, desc, color }) => (
                                        <div key={label} style={{
                                            padding: '14px 16px', borderRadius: 10,
                                            border: '1px solid var(--border)',
                                            background: 'var(--bg-muted)',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                            display: 'flex', alignItems: 'center', gap: 12,
                                        }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon size={15} color={color} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{
                                    display: 'flex', gap: 8,
                                    background: 'var(--bg-muted)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 10, padding: '10px 14px',
                                }}>
                                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>Bạn muốn đi đâu ở Việt Nam? Ví dụ: Lịch trình Đà Nẵng 3 ngày...</span>
                                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <ArrowRight size={13} color="white" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Trusted By ── */}
            <section style={{ padding: '48px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <div className="container" style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 28, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
                        Trusted by explorers worldwide
                    </p>
                    <div style={{ display: 'flex', gap: 'clamp(24px, 5vw, 48px)', justifyContent: 'center', flexWrap: 'wrap', opacity: 0.5 }}>
                        {['DeepMind', 'Gemini', 'Unsloth', 'LangGraph', 'Supabase'].map(name => (
                            <span key={name} style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '-0.5px' }}>
                                {name}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Process Steps ── */}
            <section className="py-mobile-12" style={{ padding: '100px 0' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.2rem)', fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
                            Explore Our Simple, <span className="text-gradient">Easy Process</span>
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                            Get started in minutes, not hours
                        </p>
                    </div>
                    <div className="grid-cols-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
                        {steps.map(({ num, title, desc }) => (
                            <div key={num} className="card" style={{ padding: 28, textAlign: 'center' }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 12,
                                    background: 'rgba(29,109,224,0.12)',
                                    border: '1px solid var(--border-strong)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 16px',
                                }}>
                                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)' }}>{num}</span>
                                </div>
                                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{title}</h3>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Stats ── */}
            <section className="py-mobile-12" style={{ padding: '80px 0', background: 'var(--bg-muted)' }}>
                <div className="container">
                    <div className="grid-cols-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
                        {stats.map(({ value, label, icon: Icon }) => (
                            <div key={label} style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(29,109,224,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Icon size={22} color="var(--primary)" />
                                    </div>
                                </div>
                                <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--primary)', letterSpacing: '-2px' }}>{value}</div>
                                <div style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features Grid ── */}
            <section className="py-mobile-12" style={{ padding: '100px 0' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: 56 }}>
                        <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.2rem)', fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
                            All Possible <span className="text-gradient">AI Solutions</span>
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: 15, maxWidth: 500, margin: '0 auto' }}>
                            Everything you need for the perfect travel experience
                        </p>
                    </div>
                    <div className="grid-cols-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                        {features.map(({ icon: Icon, label, desc }) => (
                            <div key={label} className="card" style={{ padding: 28, display: 'flex', gap: 16 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(29,109,224,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Icon size={20} color="var(--primary)" />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{label}</h3>
                                    <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="py-mobile-12" style={{ padding: '100px 0', background: 'var(--bg-muted)' }}>
                <div className="container" style={{ textAlign: 'center' }}>
                    <div className="py-mobile-12 px-mobile-6" style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 24, padding: '64px 48px',
                        boxShadow: 'var(--shadow-glow)',
                    }}>
                        <div style={{
                            width: 64, height: 64, borderRadius: 16,
                            background: 'linear-gradient(135deg, #1d6de0, #06b6d4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 24px',
                        }}>
                            <Zap size={28} color="white" />
                        </div>
                        <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.2rem)', fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
                            Ready to Explore Vietnam?
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: 16, maxWidth: 440, margin: '0 auto 36px' }}>
                            Join thousands of travelers who use ViVi to discover hidden gems and plan perfect trips with the power of AI.
                        </p>
                        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                className="btn-primary"
                                style={{ padding: '14px 36px', fontSize: 16, borderRadius: 12 }}
                                onClick={() => navigate(user ? '/app' : '/auth')}
                            >
                                {user ? 'Go to Dashboard' : 'Start for Free'} <ArrowRight size={16} style={{ display: 'inline', marginLeft: 6 }} />
                            </button>
                            <button
                                className="btn-outline"
                                style={{ padding: '14px 36px', fontSize: 16, borderRadius: 12 }}
                                onClick={() => navigate('/pricing')}
                            >
                                Compare Plans
                            </button>
                        </div>
                        <p style={{ marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                            <CheckCircle size={13} style={{ display: 'inline', marginRight: 4 }} color="var(--primary)" />
                            Free plan available for all explorers
                        </p>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
