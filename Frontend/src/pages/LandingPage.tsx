import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import {
    MessageSquare, Image, Mic, Zap, Search, Calendar,
    Star, TrendingUp, Clock, CheckCircle, ArrowRight,
    Bot, BarChart3
} from 'lucide-react';

const quickActions = [
    { icon: Search, label: 'AI Search', desc: 'Find anything instantly', color: '#1d6de0' },
    { icon: Calendar, label: 'Trip Planning', desc: 'Plan your itinerary', color: '#06b6d4' },
    { icon: Image, label: 'AI Images', desc: 'Explore destinations', color: '#8b5cf6' },
    { icon: Mic, label: 'Voice Guide', desc: 'Audio travel tips', color: '#10b981' },
];

const features = [
    { icon: MessageSquare, label: 'Smart Chat', desc: 'Contextual conversations about Vietnam travel' },
    { icon: Image, label: 'Visual Search', desc: 'Upload photos to identify locations' },
    { icon: Mic, label: 'Voice Assist', desc: 'Hands-free travel assistance' },
    { icon: Search, label: 'Web Access', desc: 'Real-time travel information' },
    { icon: Bot, label: 'AI Bots', desc: 'Specialized travel agents' },
    { icon: BarChart3, label: 'Analytics', desc: 'Track your travel preferences' },
];

const stats = [
    { value: '100%', label: 'Destination Coverage', icon: TrendingUp },
    { value: '50%', label: 'Faster Trip Planning', icon: Clock },
    { value: '90%', label: 'User Satisfaction', icon: Star },
];

const steps = [
    { num: '01', title: 'Sign Up', desc: 'Create your free account in seconds' },
    { num: '02', title: 'Personalise', desc: 'Tell us your travel preferences' },
    { num: '03', title: 'Explore', desc: 'Get AI-powered recommendations' },
    { num: '04', title: 'Go Travel', desc: 'Enjoy your perfect trip' },
];

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <Navbar />

            {/* ── Hero ── */}
            <section className="bg-network" style={{ padding: '100px 0 80px' }}>
                <div className="container" style={{ textAlign: 'center' }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'rgba(29,109,224,0.12)', border: '1px solid var(--border-strong)',
                        padding: '6px 16px', borderRadius: 100, marginBottom: 32,
                    }}>
                        <Zap size={14} color="var(--primary)" />
                        <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                            All-in-one AI Travel Assistant
                        </span>
                    </div>

                    <h1 style={{
                        fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
                        fontWeight: 800,
                        lineHeight: 1.1,
                        color: 'var(--text)',
                        marginBottom: 24,
                        letterSpacing: '-2px',
                    }}>
                        All-in-one AI Assistant.<br />
                        <span className="text-gradient">Personalized, Fast and Free</span>
                    </h1>

                    <p style={{
                        fontSize: 18,
                        color: 'var(--text-secondary)',
                        maxWidth: 560,
                        margin: '0 auto 40px',
                        lineHeight: 1.7,
                    }}>
                        Your intelligent travel companion for Vietnam. Discover destinations,
                        plan itineraries, and get real-time travel insights — all powered by AI.
                    </p>

                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                            className="btn-primary animate-glow"
                            style={{ padding: '14px 36px', fontSize: 16, borderRadius: 12 }}
                            onClick={() => navigate('/app')}
                        >
                            Get Started Free
                        </button>
                        <button
                            className="btn-outline"
                            style={{ padding: '14px 36px', fontSize: 16, borderRadius: 12 }}
                            onClick={() => navigate('/features')}
                        >
                            Explore Features →
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Dashboard Preview ── */}
            <section style={{ padding: '80px 0', background: 'var(--bg-muted)' }}>
                <div className="container">
                    <div style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 20,
                        padding: 32,
                        boxShadow: 'var(--shadow-glow)',
                        maxWidth: 900,
                        margin: '0 auto',
                    }}>
                        {/* Mini App Preview */}
                        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 0, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', minHeight: 420 }}>
                            {/* Sidebar */}
                            <div style={{ background: 'var(--bg)', padding: '20px 12px', borderRight: '1px solid var(--border)' }}>
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
                                    Hi there! 👋
                                </h3>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
                                    How can I help you plan your trip today?
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
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
                                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>Ask me anything about Vietnam travel...</span>
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
                    <div style={{ display: 'flex', gap: 48, justifyContent: 'center', flexWrap: 'wrap', opacity: 0.5 }}>
                        {['TravelX', 'VietTour', 'Hanoi.io', 'ExploreAI', 'NomadCo'].map(name => (
                            <span key={name} style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '-0.5px' }}>
                                {name}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Process Steps ── */}
            <section style={{ padding: '100px 0' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: 64 }}>
                        <h2 style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
                            Explore Our Simple, <span className="text-gradient">Easy Process</span>
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
                            Get started in minutes, not hours
                        </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
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
            <section style={{ padding: '80px 0', background: 'var(--bg-muted)' }}>
                <div className="container">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
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
            <section style={{ padding: '100px 0' }}>
                <div className="container">
                    <div style={{ textAlign: 'center', marginBottom: 64 }}>
                        <h2 style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
                            All Possible <span className="text-gradient">AI Solutions</span>
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>
                            Everything you need for the perfect travel experience
                        </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
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
            <section style={{ padding: '100px 0', background: 'var(--bg-muted)' }}>
                <div className="container" style={{ textAlign: 'center' }}>
                    <div style={{
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
                        <h2 style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
                            Ready to Explore Vietnam?
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: 16, maxWidth: 440, margin: '0 auto 36px' }}>
                            Join thousands of travelers who use ViVi to discover hidden gems and plan perfect trips.
                        </p>
                        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                                className="btn-primary"
                                style={{ padding: '14px 36px', fontSize: 16, borderRadius: 12 }}
                                onClick={() => navigate('/app')}
                            >
                                Start for Free <ArrowRight size={16} style={{ display: 'inline', marginLeft: 6 }} />
                            </button>
                            <button
                                className="btn-outline"
                                style={{ padding: '14px 36px', fontSize: 16, borderRadius: 12 }}
                                onClick={() => navigate('/pricing')}
                            >
                                View Plans
                            </button>
                        </div>
                        <p style={{ marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                            <CheckCircle size={13} style={{ display: 'inline', marginRight: 4 }} color="var(--primary)" />
                            No credit card required · Free forever plan available
                        </p>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
