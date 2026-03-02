import { useState, useEffect } from 'react';
import { useNavigate, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useThemeMode } from '@/hooks/useThemeMode';
import { toast } from 'sonner';
import {
    LayoutDashboard, Users, Activity, Settings,
    Database, ArrowLeft, Loader2, Moon, Sun,
    MessageSquare, ShieldAlert, BarChart3
} from 'lucide-react';

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, loading: authLoading } = useAuth();
    const { theme, toggleTheme } = useThemeMode();
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            navigate('/auth', { replace: true });
        }
    }, [user, authLoading, navigate]);

    useEffect(() => {
        if (!user) return;
        (async () => {
            const { data } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .single();
            if (data?.role === 'admin') {
                setIsAdmin(true);
            } else {
                toast.error('Bạn không có quyền truy cập trang Administration');
                navigate('/app', { replace: true });
            }
        })();
    }, [user, navigate]);

    if (authLoading || isAdmin === null) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
                <Loader2 size={32} className="animate-spin" color="var(--primary)" />
            </div>
        );
    }

    const navItems = [
        { path: '/admin', icon: LayoutDashboard, label: 'Overview' },
        { path: '/admin/users', icon: Users, label: 'Users Management' },
        { path: '/admin/limits', icon: Activity, label: 'Limits & Quotas' },
        { path: '/admin/conversations', icon: MessageSquare, label: 'Conversations' },
        { path: '/admin/logs', icon: ShieldAlert, label: 'Audit Logs' },
        { path: '/admin/system', icon: Database, label: 'System Check' },
        { path: '/admin/analytics', icon: BarChart3, label: 'Analytics & Exports' },
        { path: '/admin/settings', icon: Settings, label: 'Settings' }
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
            {/* Sidebar */}
            <aside style={{ width: 260, borderRight: '1px solid var(--border)', background: 'var(--bg-card)', padding: '24px 16px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: 32, padding: '0 8px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Qwen3-VL-8B</div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>Admin Center</div>
                </div>

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                                    borderRadius: 10, textDecoration: 'none',
                                    background: isActive ? 'var(--primary-10)' : 'transparent',
                                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                                    fontWeight: isActive ? 600 : 500,
                                    fontSize: 14, transition: 'all 0.2s'
                                }}
                            >
                                <Icon size={18} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                    <Link to="/app" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, textDecoration: 'none', color: 'var(--text-muted)', fontSize: 14, fontWeight: 500 }}>
                        <ArrowLeft size={18} /> Exit Admin
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                <header style={{ height: 60, borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 24px' }}>
                    <button onClick={toggleTheme} style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                    </button>
                </header>

                <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
                    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}
