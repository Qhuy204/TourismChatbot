import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useLanguage } from '@/hooks/useLanguage';
import { toast } from 'sonner';
import {
    ConfigProvider, Card, Row, Col, Button, Input, Statistic, Avatar, Tag, Space, Spin, Typography,
    theme as antdTheme,
} from 'antd';
import {
    ArrowLeftOutlined, CameraOutlined, SaveOutlined, SunOutlined, MoonOutlined,
    EnvironmentOutlined, CompassOutlined, MessageOutlined, CalendarOutlined, UserOutlined,
    LoadingOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

const TRAVEL_STYLES = [
    { value: 'adventure', label: '🏔️ Phiêu lưu' },
    { value: 'relaxation', label: '🏖️ Nghỉ dưỡng' },
    { value: 'culture', label: '🏛️ Văn hóa' },
    { value: 'nature', label: '🌿 Thiên nhiên' },
    { value: 'food', label: '🍜 Ẩm thực' },
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
        display_name: '', avatar_url: null, travel_style: '',
        preferred_cities: [], theme: 'auto',
    });
    const [stats, setStats] = useState({ sessions: 0, messages: 0, joinDate: '' });
    const [role, setRole] = useState('user');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const isDark = theme === 'dark';

    useEffect(() => {
        if (!authLoading && !user) navigate('/auth');
    }, [user, authLoading, navigate]);

    useEffect(() => {
        if (!user) return;
        const meta = user.user_metadata || {};
        setProfile(prev => ({
            ...prev,
            display_name: meta.display_name || meta.full_name || user.email?.split('@')[0] || '',
            avatar_url: meta.avatar_url || null,
        }));

        (async () => {
            const { data } = await supabase.from('user_preferences').select('*').eq('user_id', user.id).single();
            if (data) setProfile(prev => ({ ...prev, travel_style: data.travel_style || '', preferred_cities: data.preferred_cities || [], theme: data.theme || 'auto' }));
        })();

        (async () => {
            const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();
            if (data) setRole(data.role);
        })();

        (async () => {
            const { count: sessionCount } = await supabase.from('chat_sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
            const { count: msgCount } = await supabase.from('chat_logs').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('role', 'user');
            setStats({ sessions: sessionCount || 0, messages: msgCount || 0, joinDate: user.created_at || '' });
        })();
    }, [user]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        setUploading(true);
        const ext = file.name.split('.').pop();
        const path = `${user.id}/avatar.${ext}`;
        const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
        if (error) { toast.error('Upload avatar thất bại'); setUploading(false); return; }
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
        await supabase.auth.updateUser({ data: { display_name: profile.display_name } });
        await supabase.from('user_preferences').upsert({
            user_id: user.id, travel_style: profile.travel_style,
            preferred_cities: profile.preferred_cities, theme: profile.theme,
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

    const antdThemeConfig = useMemo(() => ({
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
            colorPrimary: '#1d6de0',
            borderRadius: 10,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        },
    }), [isDark]);

    const roleColors: Record<string, string> = { admin: 'red', api_client: 'purple', user: 'blue' };

    if (authLoading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
            </div>
        );
    }

    return (
        <ConfigProvider theme={antdThemeConfig}>
            <div style={{ minHeight: '100vh', background: isDark ? '#05070a' : '#f0f4ff', padding: '24px 16px' }}>
                <div style={{ maxWidth: 640, margin: '0 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/app')}>
                            Quay lại
                        </Button>
                        <Button type="text" icon={isDark ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme} />
                    </div>

                    <Card style={{ marginBottom: 16 }} styles={{ body: { display: 'flex', alignItems: 'center', gap: 20 } }}>
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                            <Avatar
                                size={80}
                                src={profile.avatar_url}
                                icon={!profile.avatar_url && <UserOutlined />}
                                style={{
                                    background: 'linear-gradient(135deg, #1d6de0, #8b5cf6)',
                                    border: '3px solid var(--bg-card)',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                }}
                            />
                            <label style={{
                                position: 'absolute', bottom: -2, right: -2,
                                width: 28, height: 28, borderRadius: '50%',
                                background: '#1d6de0', border: '2px solid var(--bg-card)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: 'white',
                            }}>
                                {uploading ? <LoadingOutlined style={{ fontSize: 12 }} spin /> : <CameraOutlined style={{ fontSize: 12 }} />}
                                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                            </label>
                        </div>
                        <div style={{ flex: 1 }}>
                            <Space align="center" size={8} style={{ marginBottom: 4 }}>
                                <Title level={4} style={{ margin: 0 }}>{profile.display_name || 'User'}</Title>
                                <Tag color={roleColors[role] || 'blue'}>{role.replace('_', ' ').toUpperCase()}</Tag>
                            </Space>
                            <Text type="secondary" style={{ fontSize: 13, display: 'block' }}>{user?.email}</Text>
                        </div>
                    </Card>

                    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                        {[
                            { icon: <MessageOutlined />, label: 'Tin nhắn', value: stats.messages },
                            { icon: <CompassOutlined />, label: 'Phiên chat', value: stats.sessions },
                            { icon: <CalendarOutlined />, label: 'Tham gia', value: stats.joinDate ? new Date(stats.joinDate).toLocaleDateString('vi-VN') : '—' },
                        ].map(({ icon, label, value }) => (
                            <Col xs={8} key={label}>
                                <Card size="small" styles={{ body: { textAlign: 'center', padding: '16px 8px' } }}>
                                    <Statistic title={label} value={value} prefix={<span style={{ color: '#1d6de0' }}>{icon}</span>} valueStyle={{ fontSize: 18, fontWeight: 700 }} />
                                </Card>
                            </Col>
                        ))}
                    </Row>

                    <Card
                        title={<Space><UserOutlined style={{ color: '#1d6de0' }} /> Thông tin cá nhân</Space>}
                        style={{ marginBottom: 16 }}
                    >
                        <div style={{ marginBottom: 16 }}>
                            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Tên hiển thị</Text>
                            <Input
                                value={profile.display_name}
                                onChange={e => setProfile(prev => ({ ...prev, display_name: e.target.value }))}
                                placeholder="Nhập tên hiển thị"
                                size="large"
                            />
                        </div>
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Email</Text>
                            <Input value={user?.email || ''} disabled size="large" />
                        </div>
                    </Card>

                    <Card
                        title={<Space><CompassOutlined style={{ color: '#1d6de0' }} /> Sở thích du lịch</Space>}
                        style={{ marginBottom: 16 }}
                    >
                        <div style={{ marginBottom: 20 }}>
                            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Phong cách</Text>
                            <Space size={8} wrap>
                                {TRAVEL_STYLES.map(s => (
                                    <Tag
                                        key={s.value}
                                        color={profile.travel_style === s.value ? '#1d6de0' : undefined}
                                        style={{
                                            cursor: 'pointer', padding: '6px 16px', borderRadius: 100,
                                            fontSize: 13, fontWeight: profile.travel_style === s.value ? 600 : 400,
                                        }}
                                        onClick={() => setProfile(prev => ({ ...prev, travel_style: s.value }))}
                                    >
                                        {s.label}
                                    </Tag>
                                ))}
                            </Space>
                        </div>

                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                                <EnvironmentOutlined style={{ marginRight: 4 }} />
                                Thành phố yêu thích ({profile.preferred_cities.length}/5)
                            </Text>
                            <Space size={[6, 8]} wrap>
                                {POPULAR_CITIES.map(city => {
                                    const selected = profile.preferred_cities.includes(city);
                                    return (
                                        <Tag
                                            key={city}
                                            color={selected ? '#1d6de0' : undefined}
                                            style={{ cursor: 'pointer', borderRadius: 100, fontSize: 12, padding: '3px 12px' }}
                                            onClick={() => {
                                                if (!selected && profile.preferred_cities.length >= 5) {
                                                    toast.error('Tối đa 5 thành phố');
                                                    return;
                                                }
                                                toggleCity(city);
                                            }}
                                        >
                                            {city}
                                        </Tag>
                                    );
                                })}
                            </Space>
                        </div>
                    </Card>

                    <Button
                        type="primary"
                        size="large"
                        block
                        icon={saving ? <LoadingOutlined spin /> : <SaveOutlined />}
                        loading={saving}
                        onClick={handleSave}
                        style={{ borderRadius: 12, fontWeight: 700, height: 48, boxShadow: '0 4px 16px rgba(29,109,224,0.3)' }}
                    >
                        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </Button>

                    <div style={{ height: 40 }} />
                </div>
            </div>
        </ConfigProvider>
    );
}
