import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useLanguage } from '@/hooks/useLanguage';
import { toast } from 'sonner';
import {
    ArrowLeft, Camera, Save, Loader2, Sun, Moon,
    MapPin, Compass, Globe, Calendar, MessageSquare, User as UserIcon
} from 'lucide-react';

const TRAVEL_STYLES = [
    { value: 'adventure', label: '🏔️ Phiêu lưu', labelEn: '🏔️ Adventure' },
    { value: 'relaxation', label: '🏖️ Nghỉ dưỡng', labelEn: '🏖️ Relaxation' },
    { value: 'culture', label: '🏛️ Văn hóa', labelEn: '🏛️ Culture' },
    { value: 'nature', label: '🌿 Thiên nhiên', labelEn: '🌿 Nature' },
    { value: 'food', label: '🍜 Ẩm thực', labelEn: '🍜 Food' },
];

const POPULAR_CITIES = [
    'Hà Nội', 'Đà Nẵng', 'Hồ Chí Minh', 'Huế', 'Hội An',
    'Phú Quốc', 'Nha Trang', 'Đà Lạt', 'Sapa', 'Quy Nhơn',
    'Cần Thơ', 'Ninh Bình', 'Hạ Long', 'Mũi Né', 'Côn Đảo',
];

interface UserProfile {
    display_name: string;
    avatar_url: string | null;
    travel_style: string;
    preferred_cities: string[];
    theme: string;
}

export default function ProfilePage() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();
    const { theme, toggleTheme } = useThemeMode();
    const { t } = useLanguage();

    const [profile, setProfile] = useState<UserProfile>({
        display_name: '',
        avatar_url: null,
        travel_style: '',
        preferred_cities: [],
        theme: 'auto',
    });
    const [stats, setStats] = useState({ sessions: 0, messages: 0, joinDate: '' });
    const [role, setRole] = useState('user');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Redirect if not logged in
    useEffect(() => {
        if (!authLoading && !user) navigate('/auth');
    }, [user, authLoading, navigate]);

    // Load profile data
    useEffect(() => {
        if (!user) return;

        // Display name from auth metadata
        const meta = user.user_metadata || {};
        setProfile(prev => ({
            ...prev,
            display_name: meta.display_name || meta.full_name || user.email?.split('@')[0] || '',
            avatar_url: meta.avatar_url || null,
        }));

        // Load preferences from user_preferences table
        (async () => {
            const { data } = await supabase
                .from('user_preferences')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (data) {
                setProfile(prev => ({
                    ...prev,
                    travel_style: data.travel_style || '',
                    preferred_cities: data.preferred_cities || [],
                    theme: data.theme || 'auto',
                }));
            }
        })();

        // Load role
        (async () => {
            const { data } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', user.id)
                .single();
            if (data) setRole(data.role);
        })();

        // Load stats
        (async () => {
            const { count: sessionCount } = await supabase
                .from('chat_sessions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            const { count: msgCount } = await supabase
                .from('chat_logs')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('role', 'user');

            setStats({
                sessions: sessionCount || 0,
                messages: msgCount || 0,
                joinDate: user.created_at || '',
            });
        })();
    }, [user]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setUploading(true);
        const ext = file.name.split('.').pop();
        const path = `${user.id}/avatar.${ext}`;

        const { error } = await supabase.storage
            .from('avatars')
            .upload(path, file, { upsert: true });

        if (error) {
            toast.error('Upload avatar thất bại');
            setUploading(false);
            return;
        }

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        const avatarUrl = urlData.publicUrl + `?t=${Date.now()}`;

        await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
        setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
        setUploading(false);
        toast.success('Avatar đã cập nhật!');
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);

        // Update display name in auth metadata
        await supabase.auth.updateUser({
            data: { display_name: profile.display_name },
        });

        // Upsert preferences
        await supabase.from('user_preferences').upsert({
            user_id: user.id,
            travel_style: profile.travel_style,
            preferred_cities: profile.preferred_cities,
            theme: profile.theme,
        }, { onConflict: 'user_id' });

        setSaving(false);
        toast.success('Hồ sơ đã lưu!');
    };

    const toggleCity = (city: string) => {
        setProfile(prev => ({
            ...prev,
            preferred_cities: prev.preferred_cities.includes(city)
                ? prev.preferred_cities.filter(c => c !== city)
                : [...prev.preferred_cities, city],
        }));
    };

    if (authLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
                <Loader2 size={32} className="animate-spin" color="var(--primary)" />
            </div>
        );
    }

    const cardStyle: React.CSSProperties = {
        background: 'var(--bg-card)', borderRadius: 16,
        border: '1px solid var(--border)', padding: 24,
    };

    const labelStyle: React.CSSProperties = {
        fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8, display: 'block',
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '10px 14px', borderRadius: 9,
        background: 'var(--input-bg)', border: '1px solid var(--border)',
        color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'inherit',
    };

    const roleBadge: Record<string, { bg: string; color: string; label: string }> = {
        admin: { bg: '#ef44441a', color: '#ef4444', label: 'Admin' },
        api_client: { bg: '#8b5cf61a', color: '#8b5cf6', label: 'API Client' },
        user: { bg: '#3b82f61a', color: '#3b82f6', label: 'User' },
    };
    const badge = roleBadge[role] || roleBadge.user;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px' }}>
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                    <button onClick={() => navigate('/app')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, fontFamily: 'inherit' }}>
                        <ArrowLeft size={16} /> Quay lại
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={toggleTheme} style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                        </button>
                    </div>
                </div>

                {/* Avatar & Name Card */}
                <div style={{ ...cardStyle, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--primary), #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', border: '3px solid var(--bg-card)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        }}>
                            {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <UserIcon size={32} color="white" />
                            )}
                        </div>
                        <label style={{
                            position: 'absolute', bottom: -2, right: -2,
                            width: 28, height: 28, borderRadius: '50%',
                            background: 'var(--primary)', border: '2px solid var(--bg-card)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'white',
                        }}>
                            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                            <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                        </label>
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                                {profile.display_name || 'User'}
                            </h2>
                            <span style={{
                                padding: '2px 10px', borderRadius: 100,
                                background: badge.bg, color: badge.color,
                                fontSize: 11, fontWeight: 700,
                            }}>
                                {badge.label}
                            </span>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{user?.email}</p>
                    </div>
                </div>

                {/* Stats Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    {[
                        { icon: MessageSquare, label: 'Tin nhắn', value: stats.messages },
                        { icon: Compass, label: 'Phiên chat', value: stats.sessions },
                        { icon: Calendar, label: 'Tham gia', value: stats.joinDate ? new Date(stats.joinDate).toLocaleDateString('vi-VN') : '—' },
                    ].map(({ icon: Icon, label, value }) => (
                        <div key={label} style={{ ...cardStyle, padding: 16, textAlign: 'center' }}>
                            <Icon size={18} color="var(--primary)" style={{ marginBottom: 6 }} />
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                        </div>
                    ))}
                </div>

                {/* Edit Profile Card */}
                <div style={{ ...cardStyle, marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <UserIcon size={16} color="var(--primary)" /> Thông tin cá nhân
                    </h3>

                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Tên hiển thị</label>
                        <input
                            style={inputStyle}
                            value={profile.display_name}
                            onChange={e => setProfile(prev => ({ ...prev, display_name: e.target.value }))}
                            placeholder="Nhập tên hiển thị"
                        />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                        <label style={labelStyle}>Email</label>
                        <input style={{ ...inputStyle, opacity: 0.6 }} value={user?.email || ''} disabled />
                    </div>
                </div>

                {/* Travel Preferences Card */}
                <div style={{ ...cardStyle, marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Compass size={16} color="var(--primary)" /> Sở thích du lịch
                    </h3>

                    <div style={{ marginBottom: 20 }}>
                        <label style={labelStyle}>Phong cách</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {TRAVEL_STYLES.map(s => (
                                <button
                                    key={s.value}
                                    onClick={() => setProfile(prev => ({ ...prev, travel_style: s.value }))}
                                    style={{
                                        padding: '8px 16px', borderRadius: 100,
                                        border: `1px solid ${profile.travel_style === s.value ? 'var(--primary)' : 'var(--border)'}`,
                                        background: profile.travel_style === s.value ? 'var(--primary)' : 'var(--bg-card)',
                                        color: profile.travel_style === s.value ? 'white' : 'var(--text-secondary)',
                                        cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', transition: 'all 0.2s',
                                    }}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>
                            <MapPin size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                            Thành phố yêu thích ({profile.preferred_cities.length}/5)
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {POPULAR_CITIES.map(city => {
                                const selected = profile.preferred_cities.includes(city);
                                return (
                                    <button
                                        key={city}
                                        onClick={() => {
                                            if (!selected && profile.preferred_cities.length >= 5) {
                                                toast.error('Tối đa 5 thành phố');
                                                return;
                                            }
                                            toggleCity(city);
                                        }}
                                        style={{
                                            padding: '5px 12px', borderRadius: 100, fontSize: 12,
                                            border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                                            background: selected ? 'var(--primary)' : 'transparent',
                                            color: selected ? 'white' : 'var(--text-secondary)',
                                            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                                        }}
                                    >
                                        {city}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        width: '100%', padding: '14px 0', borderRadius: 12,
                        background: 'var(--primary)', border: 'none',
                        color: 'white', fontSize: 15, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'all 0.2s', opacity: saving ? 0.7 : 1,
                        boxShadow: '0 4px 16px rgba(29,109,224,0.3)',
                    }}
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>

                <div style={{ height: 40 }} />
            </div>
        </div>
    );
}
