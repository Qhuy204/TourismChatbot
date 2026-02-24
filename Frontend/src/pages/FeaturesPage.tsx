import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import {
    MessageSquare, Image, Mic, Search, GitBranch,
    Zap, Shield, Globe, CheckCircle, BarChart3
} from 'lucide-react';

const featureGroups = [
    {
        title: 'Smart RAG Conversations',
        desc: 'Vietnam Knowledge Base',
        icon: MessageSquare,
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
        icon: Image,
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
        icon: Mic,
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
        icon: Globe,
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
        icon: GitBranch,
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
        icon: BarChart3,
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

            {/* Hero */}
            <section className="bg-network py-mobile-12" style={{ padding: '80px 0 60px' }}>
                <div className="container" style={{ maxWidth: 640 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'rgba(29,109,224,0.12)', border: '1px solid var(--border-strong)',
                        padding: '5px 14px', borderRadius: 100, marginBottom: 20,
                    }}>
                        <Zap size={13} color="var(--primary)" />
                        <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>Explore Features</span>
                    </div>
                    <h1 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3rem)', fontWeight: 800, color: 'var(--text)', marginBottom: 16, lineHeight: 1.1 }}>
                        Explore Our <span className="text-gradient">Features</span>
                    </h1>
                    <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        Everything you need to plan, discover, and experience Vietnam — all powered by cutting-edge AI.
                    </p>
                </div>
            </section>

            {/* Feature Cards */}
            <section className="py-mobile-12" style={{ padding: '80px 0' }}>
                <div className="container">
                    <div className="grid-cols-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'clamp(16px, 3vw, 28px)' }}>
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
            <section className="py-mobile-12" style={{ padding: '80px 0', background: 'var(--bg-muted)' }}>
                <div className="container" style={{ textAlign: 'center', maxWidth: 700 }}>
                    <Search size={40} color="var(--primary)" style={{ margin: '0 auto 20px' }} />
                    <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 1.8rem)', fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>
                        Powered by Advanced AI
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
                        Combining Gemini and Qwen models with real-time retrieval for accurate, up-to-date travel information about Vietnam destinations.
                    </p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {['Gemini 3.0 Flash', 'RAG Retrieval', 'Supabase Vector DB', 'LangGraph Agents'].map(tag => (
                            <span key={tag} style={{
                                padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600,
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
