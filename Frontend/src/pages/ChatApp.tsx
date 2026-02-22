import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ChatbotInterface } from '@/components/chatbot/ChatbotInterface';
import { Loader2 } from 'lucide-react';

export default function ChatApp() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/auth');
        }
    }, [user, loading, navigate]);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
                <Loader2 size={32} color="var(--primary)" className="animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    return <ChatbotInterface />;
}
