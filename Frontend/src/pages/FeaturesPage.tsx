import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import {
    MessageSquare, Image, Mic, Search, GitBranch,
    Zap, Shield, Globe, CheckCircle
} from 'lucide-react';

const featureGroups = [
    {
        title: 'Intelligent Conversations',
        desc: 'Chat That Grows With You',
        icon: MessageSquare,
        color: '#1d6de0',
        points: [
            'Context-aware conversations about Vietnam destinations',
            'Personalized recommendations based on history',
            'Multi-turn dialogue for complex trip planning',
            'Smart follow-up suggestions',
        ],
    },
    {
        title: 'Visual Search & Recognition',
        desc: 'See and Discover',
        icon: Image,
        color: '#8b5cf6',
        points: [
            'Upload photos to identify locations instantly',
            'AI-generated destination images',
            'Visual itinerary planning',
            'Photo-based restaurant search',
        ],
    },
    {
        title: 'Voice Assistance',
        desc: 'Hands-Free Travel',
        icon: Mic,
        color: '#10b981',
        points: [
            'Natural language voice queries',
            'Offline voice caching for no-internet zones',
            'Multi-language voice support',
            'Real-time translation',
        ],
    },
    {
        title: 'Real-Time Web Access',
        desc: 'Always Up-to-Date',
        icon: Globe,
        color: '#06b6d4',
        points: [
            'Live weather & travel advisories',
            'Current hotel and flight prices',
            'Up-to-date attraction hours',
            'Breaking travel news',
        ],
    },
    {
        title: 'Automated Workflows',
        desc: 'Project Kickoff & Planning',
        icon: GitBranch,
        color: '#f59e0b',
        points: [
            'One-click itinerary generation',
            'Auto-assign tasks and reminders',
            'Document attachment for trip files',
            'Team collaboration features',
        ],
    },
    {
        title: 'AI Security & Privacy',
        desc: 'Travel with Confidence',
        icon: Shield,
        color: '#ef4444',
        points: [
            'End-to-end encrypted conversations',
            'GDPR compliant data handling',
            'No conversation storage by default',
            'Self-destruct session option',
        ],
    },
];

export default function FeaturesPage() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <Navbar />

            {/* Hero */}
            <section className="bg-network" style={{ padding: '80px 0 60px' }}>
                <div className="container" style={{ maxWidth: 640 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'rgba(29,109,224,0.12)', border: '1px solid var(--border-strong)',
                        padding: '5px 14px', borderRadius: 100, marginBottom: 24,
                    }}>
                        <Zap size={13} color="var(--primary)" />
                        <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>Explore Features</span>
                    </div>
                    <h1 style={{ fontSize: 48, fontWeight: 800, color: 'var(--text)', marginBottom: 16, lineHeight: 1.1 }}>
                        Explore Our <span className="text-gradient">Features</span>
                    </h1>
                    <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        Everything you need to plan, discover, and experience Vietnam — all powered by cutting-edge AI.
                    </p>
                </div>
            </section>

            {/* Feature Cards */}
            <section style={{ padding: '80px 0' }}>
                <div className="container">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 28 }}>
                        {featureGroups.map(({ title, desc, icon: Icon, color, points }) => (
                            <div key={title} className="card" style={{ padding: 36 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginBottom: 24 }}>
                                    <div style={{
                                        width: 52, height: 52, borderRadius: 14,
                                        background: `${color}18`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Icon size={24} color={color} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: `${color}`, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                                            {desc}
                                        </div>
                                        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {points.map(point => (
                                        <div key={point} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                            <CheckCircle size={14} color="var(--primary)" style={{ marginTop: 2, flexShrink: 0 }} />
                                            <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{point}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Bottom feature: Workflow */}
            <section style={{ padding: '80px 0', background: 'var(--bg-muted)' }}>
                <div className="container" style={{ textAlign: 'center', maxWidth: 700 }}>
                    <Search size={40} color="var(--primary)" style={{ margin: '0 auto 20px' }} />
                    <h2 style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
                        Powered by Advanced AI
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.7, marginBottom: 32 }}>
                        Combining Gemini and Qwen models with real-time retrieval for accurate, up-to-date travel information about Vietnam destinations.
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {['Gemini 3.0 Flash', 'RAG Retrieval', 'Supabase Vector DB', 'LangGraph Agents'].map(tag => (
                            <span key={tag} style={{
                                padding: '6px 16px', borderRadius: 100, fontSize: 13, fontWeight: 600,
                                background: 'rgba(29,109,224,0.1)', color: 'var(--primary)',
                                border: '1px solid var(--border-strong)',
                            }}>
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
