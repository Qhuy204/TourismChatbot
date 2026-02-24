import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Sun, Moon, Zap, Loader2, Eye, EyeOff, ArrowLeft, Globe } from 'lucide-react';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useLanguage } from '@/hooks/useLanguage';

export default function AuthPage() {
    const navigate = useNavigate();
    const { signIn, signUp, user, loading: authLoading } = useAuth();
    const { theme, toggleTheme } = useThemeMode();
    const { appLanguage, setAppLanguage, t } = useLanguage();

    const [tab, setTab] = useState<'login' | 'signup'>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showForgot, setShowForgot] = useState(false);
    const [langOpen, setLangOpen] = useState(false);

    // Login fields
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Signup fields
    const [displayName, setDisplayName] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupConfirm, setSignupConfirm] = useState('');

    // Forgot password
    const [forgotEmail, setForgotEmail] = useState('');

    useEffect(() => {
        if (user && !authLoading) {
            navigate('/app');
        }
    }, [user, authLoading, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginEmail || !loginPassword) return;
        setIsLoading(true);
        const { error } = await signIn(loginEmail, loginPassword);
        setIsLoading(false);
        if (error) {
            toast.error(t.loginFailed);
        } else {
            toast.success(t.loginSuccess);
            navigate('/app');
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (signupPassword !== signupConfirm) {
            toast.error(t.passwordsDontMatch);
            return;
        }
        if (signupPassword.length < 6) {
            toast.error(t.passwordTooShort);
            return;
        }
        setIsLoading(true);
        const { error } = await signUp(signupEmail, signupPassword, displayName);
        setIsLoading(false);
        if (error) {
            toast.error(t.loginFailed.replace('Đăng nhập', 'Đăng ký')); // Hack or add separate key
        } else {
            toast.success(t.signupSuccess);
        }
    };

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        await supabase.auth.resetPasswordForEmail(forgotEmail, {
            redirectTo: `${window.location.origin}/auth`,
        });
        setIsLoading(false);
        toast.success('Đã gửi email đặt lại mật khẩu!');
        setShowForgot(false);
    };

    if (authLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
                <Loader2 size={32} className="animate-spin" color="var(--primary)" />
            </div>
        );
    }

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '11px 14px',
        borderRadius: 9,
        background: 'var(--input-bg)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        fontSize: 14,
        outline: 'none',
        fontFamily: 'inherit',
        transition: 'border-color 0.2s, box-shadow 0.2s',
    };

    return (
        <div className="bg-network" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            {/* Theme toggle + back */}
            <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: 10 }}>
                <button
                    onClick={toggleTheme}
                    style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                    {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setLangOpen(!langOpen)}
                        style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    >
                        <Globe size={15} />
                    </button>
                    {langOpen && (
                        <div style={{
                            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: 12, padding: 6, boxShadow: 'var(--shadow-lg)',
                            minWidth: 120, zIndex: 1000
                        }}>
                            {[
                                { label: 'Tiếng Việt', value: 'vi' },
                                { label: 'English', value: 'en' },
                                { label: '简体中文', value: 'zh' }
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => { setAppLanguage(opt.value as any); setLangOpen(false); }}
                                    style={{
                                        width: '100%', padding: '8px 12px', borderRadius: 8,
                                        background: appLanguage === opt.value ? 'var(--bg-muted)' : 'transparent',
                                        border: 'none', color: 'var(--text)', fontSize: 13,
                                        textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div style={{ position: 'absolute', top: 20, left: 20 }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14 }}>
                    <ArrowLeft size={14} />
                    {t.backToHome}
                </Link>
            </div>

            {/* Card */}
            <div className="card" style={{ width: '100%', maxWidth: 420, padding: 40 }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center' }}>
                        <img src="/Logo.png" alt="ViVi" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', boxShadow: '0 4px 16px rgba(29,109,224,0.2)' }} />
                    </div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
                        {t.welcomeTo} <span style={{ color: 'var(--primary)' }}>ViVi</span>
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.heroDesc.split('.')[0]}</p>
                </div>

                {/* Forgot Password */}
                {showForgot ? (
                    <form onSubmit={handleForgot}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t.resetPassword}</h2>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>{t.enterEmail}</p>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t.email}</label>
                            <input style={inputStyle} type="email" placeholder="you@example.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px 0', marginBottom: 12 }} disabled={isLoading}>
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : t.sendResetLink}
                        </button>
                        <button type="button" onClick={() => setShowForgot(false)} style={{ width: '100%', padding: '10px 0', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <ArrowLeft size={13} /> {t.backToHome.split(' ').slice(1).join(' ')} {t.login}
                        </button>
                    </form>
                ) : (
                    <>
                        {/* Tabs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, background: 'var(--bg-muted)', borderRadius: 9, padding: 4, marginBottom: 28 }}>
                            {(['login', 'signup'] as const).map(tabItem => (
                                <button
                                    key={tabItem}
                                    onClick={() => setTab(tabItem)}
                                    style={{
                                        padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s',
                                        background: tab === tabItem ? 'var(--bg-card)' : 'transparent',
                                        color: tab === tabItem ? 'var(--text)' : 'var(--text-muted)',
                                        boxShadow: tab === tabItem ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                                    }}
                                >
                                    {tabItem === 'login' ? t.login : t.signup}
                                </button>
                            ))}
                        </div>

                        {/* Login Form */}
                        {tab === 'login' && (
                            <form onSubmit={handleLogin}>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t.email}</label>
                                    <input style={inputStyle} type="email" placeholder="you@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t.password}</label>
                                        <button type="button" onClick={() => setShowForgot(true)} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                            {t.forgotPassword}
                                        </button>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <input style={inputStyle} type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>
                                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px 0', marginTop: 20 }} disabled={isLoading}>
                                    {isLoading ? <><Loader2 size={15} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />{t.loggingIn}</> : t.login}
                                </button>
                            </form>
                        )}

                        {/* Signup Form */}
                        {tab === 'signup' && (
                            <form onSubmit={handleSignup}>
                                <div style={{ marginBottom: 14 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t.displayName}</label>
                                    <input style={inputStyle} type="text" placeholder={t.displayName} value={displayName} onChange={e => setDisplayName(e.target.value)} />
                                </div>
                                <div style={{ marginBottom: 14 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t.email}</label>
                                    <input style={inputStyle} type="email" placeholder="you@example.com" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required />
                                </div>
                                <div style={{ marginBottom: 14 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t.password}</label>
                                    <input style={inputStyle} type="password" placeholder={t.passwordTooShort} value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required />
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{t.confirmPassword}</label>
                                    <input style={inputStyle} type="password" placeholder="••••••••" value={signupConfirm} onChange={e => setSignupConfirm(e.target.value)} required />
                                </div>
                                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px 0', marginTop: 20 }} disabled={isLoading}>
                                    {isLoading ? <><Loader2 size={15} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />{t.signingUp}</> : t.signup}
                                </button>
                            </form>
                        )}
                    </>
                )}

                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>
                    {t.agreeTo}{' '}
                    <a href="#" style={{ color: 'var(--primary)' }}>{t.termsOfService}</a>
                </p>
            </div>
        </div>
    );
}
