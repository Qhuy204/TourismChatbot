import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Mail, CheckCircle, Send, Phone, MapPin } from 'lucide-react';

export default function ContactPage() {
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', message: '' });
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <Navbar />

            {/* Hero */}
            <section className="bg-network py-mobile-12" style={{ padding: '80px 0 60px' }}>
                <div className="container" style={{ maxWidth: 640 }}>
                    <h1 style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3rem)', fontWeight: 800, color: 'var(--text)', marginBottom: 16, lineHeight: 1.1 }}>
                        We'd Love to <span className="text-gradient">Hear From You</span>
                    </h1>
                    <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        Have a question about AIBOT? Want a demo or enterprise plan? Reach out and we'll get back to you within 24 hours.
                    </p>
                </div>
            </section>

            {/* Contact Body */}
            <section className="py-mobile-12" style={{ padding: '80px 0' }}>
                <div className="container">
                    <div className="flex-col-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 'clamp(32px, 5vw, 52px)', alignItems: 'start' }}>
                        {/* Left: Contact Info */}
                        <div>
                            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
                                Contact Sales
                            </h2>
                            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28, lineHeight: 1.7 }}>
                                Connect with us for custom solutions or product insights.
                            </p>

                            {[
                                'Request a demo',
                                'Find the right product for your business',
                                'Onboarding assistance',
                            ].map(item => (
                                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                    <CheckCircle size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{item}</span>
                                </div>
                            ))}

                            <div style={{ marginTop: 40 }}>
                                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Support</h3>
                                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
                                    Need help with technical issues or products?
                                </p>
                                {[
                                    { icon: Mail, text: 'support@aibot.vn' },
                                    { icon: Phone, text: '+84 (0) 123 456 789' },
                                    { icon: MapPin, text: 'Ho Chi Minh City, Vietnam' },
                                ].map(({ icon: Icon, text }) => (
                                    <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: 9,
                                            background: 'rgba(29,109,224,0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>
                                            <Icon size={15} color="var(--primary)" />
                                        </div>
                                        <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>{text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right: Form */}
                        <div className="card" style={{ padding: 40 }}>
                            {submitted ? (
                                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                    <div style={{
                                        width: 64, height: 64, borderRadius: 16,
                                        background: 'rgba(16,185,129,0.12)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 20px',
                                    }}>
                                        <CheckCircle size={32} color="#10b981" />
                                    </div>
                                    <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                                        Message Sent!
                                    </h3>
                                    <p style={{ color: 'var(--text-muted)' }}>
                                        We'll get back to you within 24 hours.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                                        Let's Begin The Discussion
                                    </h3>
                                    <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>
                                        Fill out the form and our team will reach out to you promptly.
                                    </p>
                                    <form onSubmit={handleSubmit}>
                                        <div className="grid-cols-mobile-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>First Name</label>
                                                <input
                                                    type="text"
                                                    placeholder="James"
                                                    required
                                                    value={form.firstName}
                                                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Last Name</label>
                                                <input
                                                    type="text"
                                                    placeholder="Smith"
                                                    required
                                                    value={form.lastName}
                                                    onChange={e => setForm({ ...form, lastName: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: 16 }}>
                                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Email Address</label>
                                            <input
                                                type="email"
                                                placeholder="james@example.com"
                                                required
                                                value={form.email}
                                                onChange={e => setForm({ ...form, email: e.target.value })}
                                            />
                                        </div>
                                        <div style={{ marginBottom: 24 }}>
                                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Message</label>
                                            <textarea
                                                rows={5}
                                                placeholder="Tell us about your needs..."
                                                required
                                                value={form.message}
                                                onChange={e => setForm({ ...form, message: e.target.value })}
                                                style={{ resize: 'vertical' }}
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="btn-primary"
                                            style={{ width: '100%', padding: '13px 0', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                        >
                                            <Send size={16} />
                                            Submit Request
                                        </button>
                                    </form>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}
