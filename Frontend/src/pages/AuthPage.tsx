import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Zap, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useThemeMode } from '@/hooks/useThemeMode';
import { Sun, Moon } from 'lucide-react';

export default function AuthPage() {
    const navigate = useNavigate();
    const { signIn, signUp, user, loading: authLoading } = useAuth();
    const { theme, toggleTheme } = useThemeMode();

    const [tab, setTab] = useState<'login' | 'signup'>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showForgot, setShowForgot] = useState(false);

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
            toast.error('Đăng nhập thất bại. Kiểm tra lại email và mật khẩu.');
        } else {
            toast.success('Đăng nhập thành công!');
            navigate('/app');
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (signupPassword !== signupConfirm) {
            toast.error('Mật khẩu không khớp');
            return;
        }
        if (signupPassword.length < 6) {
            toast.error('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }
        setIsLoading(true);
        const { error } = await signUp(signupEmail, signupPassword, displayName);
        setIsLoading(false);
        if (error) {
            toast.error('Đăng ký thất bại. Thử lại sau.');
        } else {
            toast.success('Tạo tài khoản thành công! Kiểm tra email để xác nhận.');
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
            </div>
            <div style={{ position: 'absolute', top: 20, left: 20 }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14 }}>
                    <ArrowLeft size={14} />
                    Back to home
                </Link>
            </div>

            {/* Card */}
            <div className="card" style={{ width: '100%', maxWidth: 420, padding: 40 }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #1d6de0, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <Zap size={24} color="white" />
                    </div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
                        Welcome to <span style={{ color: 'var(--primary)' }}>ViVi</span>
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Your AI travel companion for Vietnam</p>
                </div>

                {/* Forgot Password */}
                {showForgot ? (
                    <form onSubmit={handleForgot}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Reset Password</h2>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Enter your email to receive a reset link</p>
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Email</label>
                            <input style={inputStyle} type="email" placeholder="you@example.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px 0', marginBottom: 12 }} disabled={isLoading}>
                            {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Send Reset Link'}
                        </button>
                        <button type="button" onClick={() => setShowForgot(false)} style={{ width: '100%', padding: '10px 0', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <ArrowLeft size={13} /> Back to login
                        </button>
                    </form>
                ) : (
                    <>
                        {/* Tabs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, background: 'var(--bg-muted)', borderRadius: 9, padding: 4, marginBottom: 28 }}>
                            {(['login', 'signup'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    style={{
                                        padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.2s',
                                        background: tab === t ? 'var(--bg-card)' : 'transparent',
                                        color: tab === t ? 'var(--text)' : 'var(--text-muted)',
                                        boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                                    }}
                                >
                                    {t === 'login' ? 'Đăng nhập' : 'Đăng ký'}
                                </button>
                            ))}
                        </div>

                        {/* Login Form */}
                        {tab === 'login' && (
                            <form onSubmit={handleLogin}>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Email</label>
                                    <input style={inputStyle} type="email" placeholder="you@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Mật khẩu</label>
                                        <button type="button" onClick={() => setShowForgot(true)} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                            Quên mật khẩu?
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
                                    {isLoading ? <><Loader2 size={15} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />Đang đăng nhập...</> : 'Đăng nhập'}
                                </button>
                            </form>
                        )}

                        {/* Signup Form */}
                        {tab === 'signup' && (
                            <form onSubmit={handleSignup}>
                                <div style={{ marginBottom: 14 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Tên hiển thị</label>
                                    <input style={inputStyle} type="text" placeholder="Tên của bạn" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                                </div>
                                <div style={{ marginBottom: 14 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Email</label>
                                    <input style={inputStyle} type="email" placeholder="you@example.com" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required />
                                </div>
                                <div style={{ marginBottom: 14 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Mật khẩu</label>
                                    <input style={inputStyle} type="password" placeholder="Ít nhất 6 ký tự" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required />
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Xác nhận mật khẩu</label>
                                    <input style={inputStyle} type="password" placeholder="••••••••" value={signupConfirm} onChange={e => setSignupConfirm(e.target.value)} required />
                                </div>
                                <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px 0', marginTop: 20 }} disabled={isLoading}>
                                    {isLoading ? <><Loader2 size={15} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />Đang tạo tài khoản...</> : 'Tạo tài khoản'}
                                </button>
                            </form>
                        )}
                    </>
                )}

                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 24 }}>
                    Bằng cách tiếp tục, bạn đồng ý với{' '}
                    <a href="#" style={{ color: 'var(--primary)' }}>điều khoản sử dụng</a>
                </p>
            </div>
        </div>
    );
}
