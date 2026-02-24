import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { TrendingUp, Clock, Star, Users, Globe, Zap } from 'lucide-react';

const stats = [
    { value: '100%', label: 'Destination Coverage', icon: TrendingUp },
    { value: '50%', label: 'Faster Planning', icon: Clock },
    { value: '90%', label: 'User Satisfaction', icon: Star },
];

const team = [
    { name: 'Qhuy', role: 'Full-stack AI Developer / Founder', initials: 'QH' },
];

export default function AboutPage() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <Navbar />

            {/* Hero */}
            <section className="bg-network" style={{ padding: '80px 0 60px' }}>
                <div className="container" style={{ maxWidth: 640 }}>
                    <h1 style={{ fontSize: 48, fontWeight: 800, color: 'var(--text)', marginBottom: 16, lineHeight: 1.1 }}>
                        <span className="text-gradient">Story</span> About Us
                    </h1>
                    <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        Built by a passionate developer on a mission to make Vietnam exploration accessible, fast, and intelligent for everyone.
                    </p>
                </div>
            </section>

            {/* Main Story */}
            <section className="py-mobile-12" style={{ padding: '80px 0' }}>
                <div className="container">
                    <div className="flex-col-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(32px, 5vw, 64px)', alignItems: 'center' }}>
                        {/* Image collage */}
                        <div className="hidden-mobile" style={{ position: 'relative', height: 420 }}>
                            <div style={{
                                position: 'absolute', top: 0, left: 0,
                                width: 250, height: 200, borderRadius: 20,
                                background: 'linear-gradient(135deg, #1d6de0, #06b6d4)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transform: 'rotate(-3deg)',
                                overflow: 'hidden',
                            }}>
                                <Globe size={64} color="rgba(255,255,255,0.3)" />
                                <span style={{ position: 'absolute', fontSize: 13, fontWeight: 600, color: 'white', bottom: 16, left: 16 }}>Vietnam Tourism AI</span>
                            </div>
                            <div style={{
                                position: 'absolute', top: 80, left: 140,
                                width: 220, height: 180, borderRadius: 20,
                                background: 'linear-gradient(135deg, #8b5cf6, #1d6de0)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transform: 'rotate(2deg)',
                                overflow: 'hidden',
                            }}>
                                <Users size={52} color="rgba(255,255,255,0.3)" />
                                <span style={{ position: 'absolute', fontSize: 13, fontWeight: 600, color: 'white', bottom: 16, left: 16 }}>10K+ Travelers</span>
                            </div>
                            <div style={{
                                position: 'absolute', top: 220, left: 20,
                                width: 180, height: 160, borderRadius: 20,
                                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transform: 'rotate(-1deg)',
                            }}>
                                <Zap size={44} color="rgba(255,255,255,0.3)" />
                                <span style={{ position: 'absolute', fontSize: 13, fontWeight: 600, color: 'white', bottom: 12, left: 12 }}>AI-Powered</span>
                            </div>
                        </div>

                        {/* Text */}
                        <div>
                            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.2rem)', fontWeight: 800, color: 'var(--text)', marginBottom: 24, lineHeight: 1.2 }}>
                                We're Revolutionizing How<br />
                                <span className="text-gradient">Travelers Explore Vietnam.</span>
                            </h2>
                            <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 20 }}>
                                Born from a passion for travel and technology, AIBOT began as a research project at the intersection of large language models and Vietnam's rich tourism landscape. We believe every traveler deserves a knowledgeable, patient, and always-available travel companion.
                            </p>
                            <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 32 }}>
                                Our AI is trained on thousands of destinations, local guides, reviews, and cultural insights — giving you answers that feel like advice from a local friend who happens to know everything.
                            </p>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                {['Travel Expert', 'AI-Powered', 'Multilingual', 'Real-Time'].map(tag => (
                                    <span key={tag} style={{
                                        padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                                        background: 'rgba(29,109,224,0.1)', color: 'var(--primary)',
                                        border: '1px solid var(--border-strong)',
                                    }}>{tag}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="py-mobile-12" style={{ padding: '80px 0', background: 'var(--bg-muted)' }}>
                <div className="container">
                    <h2 style={{ textAlign: 'center', fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 44 }}>
                        Connecting Worldwide Teams
                    </h2>
                    <div className="grid-cols-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
                        {stats.map(({ value, label, icon: Icon }) => (
                            <div key={label} className="card" style={{ padding: 32, textAlign: 'center' }}>
                                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(29,109,224,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <Icon size={24} color="var(--primary)" />
                                </div>
                                <div style={{ fontSize: 44, fontWeight: 900, color: 'var(--primary)', letterSpacing: '-2px', marginBottom: 8 }}>{value}</div>
                                <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Team */}
            <section className="py-mobile-12" style={{ padding: '80px 0' }}>
                <div className="container">
                    <h2 style={{ textAlign: 'center', fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 44 }}>
                        The Developer Behind AIBOT
                    </h2>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {team.map(({ name, role, initials }) => (
                            <div key={name} className="card" style={{ padding: '32px 48px', textAlign: 'center', maxWidth: 300, width: '100%' }}>
                                <div style={{
                                    width: 80, height: 80, borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #1d6de0, #06b6d4)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 20px',
                                    fontSize: 22, fontWeight: 800, color: 'white',
                                    boxShadow: '0 8px 16px rgba(29, 109, 224, 0.2)',
                                }}>
                                    {initials}
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{name}</div>
                                <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{role}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
