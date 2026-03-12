import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { useLangGraphChat, type ChatMessage } from '@/hooks/useLangGraphChat';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useEventTracking } from '@/hooks/useEventTracking';
import { useAuth } from '@/hooks/useAuth';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useEmotionTheme, EMOTION_PALETTES, type Emotion } from '@/hooks/useEmotionTheme';
import { useLanguage } from '@/hooks/useLanguage';
import {
    MessageSquare, Image, Mic, Search, BookOpen,
    PenLine, Bot, Send, Loader2, ThumbsUp, ThumbsDown,
    Plus, ChevronRight, ChevronLeft, LogOut, Menu,
    Zap as ZapIcon, User, X, FileImage, ArrowDown,
    RefreshCw, Sun, Moon, Pin, Pencil, Trash2, MoreVertical, Check,
    Settings, Sparkles, Sliders, HelpCircle, Shield, Bell, AppWindow, Database, Users, Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { translations, type AppLanguage } from '../../locales';

// Types
type ActiveMenu = { id: string; x: number; y: number } | null;

// Emotion badge config
const EMOTION_DISPLAY: Record<Emotion, { emoji: string; label: string; color: string }> = {
    positive: { emoji: '😊', label: 'Tích cực', color: '#f97316' },
    surprise: { emoji: '😮', label: 'Tò mò', color: '#8b5cf6' },
    negative: { emoji: '😤', label: 'Tiêu cực', color: '#64748b' },
    neutral: { emoji: '💬', label: '', color: '#1d6de0' },
};

const EMOTION_GREETINGS: Partial<Record<Emotion, string>> = {
    positive: '😊 Tuyệt vời! Bạn đang cảm thấy rất tích cực. Hôm nay mình đi đâu nhỉ?',
    surprise: '😮 Có điều gì làm bạn tò mò sao? Hãy kể cho mình nghe nhé!',
    negative: '😌 Đừng lo, mình ở đây để hỗ trợ bạn. Hãy cho mình biết vấn đề của bạn.',
};

const navItems = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'read', label: 'Read', icon: BookOpen },
    { id: 'write', label: 'Write', icon: PenLine },
    { id: 'images', label: 'AI Images', icon: Image },
];

const quickActions = [
    { icon: Search, label: 'Tìm kiếm AI', desc: 'Hỏi về du lịch VN', color: '#1d6de0' },
    { icon: MessageSquare, label: 'Lên kế hoạch', desc: 'Lịch trình chi tiết', color: '#06b6d4' },
    { icon: Image, label: 'AI Images', desc: 'Khám phá hình ảnh', color: '#8b5cf6' },
    { icon: Mic, label: 'Hỗ trợ giọng nói', desc: 'Hỏi đáp tự nhiên', color: '#10b981' },
];

// Markdown components  
const mdComponents: Components = {
    img: ({ src, alt }) => (
        <img
            loading="lazy"
            src={src}
            alt={alt ?? 'image'}
            style={{
                display: 'block',
                margin: '8px 0',
                maxWidth: '100%',
                maxHeight: 300,
                borderRadius: 8,
                objectFit: 'cover'
            }}
        />
    ),
    a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
            {children}
        </a>
    ),
};

function processContent(content: string): string {
    return content.replace(
        /(?<!\[.*?\]\()((https?:\/\/)[^\s),"]+\.(?:jpg|jpeg|png|webp|gif))/gi,
        '\n![]($1)\n'
    );
}

//   Group sessions by time as ChatGPT does                  ─
function groupSessionsByTime(sessions: ReturnType<typeof useSessionManager>['sessions'], activeSessionId: string | null) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today); lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today); lastMonth.setMonth(lastMonth.getMonth() - 1);

    const groups: Record<string, typeof sessions> = {
        'Được ghim': [],
        'Hôm nay': [],
        'Hôm qua': [],
        '7 ngày qua': [],
        '30 ngày qua': [],
        'Cũ hơn': [],
    };

    sessions.forEach(s => {
        if (s.isPinned) { groups['Được ghim'].push(s); return; }
        const d = s.updatedAt;
        if (d >= today) groups['Hôm nay'].push(s);
        else if (d >= yesterday) groups['Hôm qua'].push(s);
        else if (d >= lastWeek) groups['7 ngày qua'].push(s);
        else if (d >= lastMonth) groups['30 ngày qua'].push(s);
        else groups['Cũ hơn'].push(s);
    });

    return Object.entries(groups).filter(([, v]) => v.length > 0);
}

// Custom Select Component for Premium UI
function CustomComboBox({ value, options, onChange }: { value: string; options: { label: string; value: string; color?: string }[]; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const { theme } = useThemeMode();
    const isDark = theme === 'dark';
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

    const updateCoords = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom,
                left: rect.left,
                width: rect.width
            });
        }
    }, []);

    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                containerRef.current && !containerRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setOpen(false);
            }
        };
        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
            updateCoords();
            window.addEventListener('resize', updateCoords);
            // Catch scroll in any parent (like the modal content)
            window.addEventListener('scroll', updateCoords, true);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('resize', updateCoords);
            window.removeEventListener('scroll', updateCoords, true);
        };
    }, [open, updateCoords]);

    const selectedOption = options.find(o => o.value === value) || options[0];

    return (
        <div ref={containerRef} style={{ position: 'relative', width: 'fit-content', minWidth: 140 }}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '8px 14px', background: 'var(--bg-muted)',
                    border: '1px solid var(--border)', borderRadius: 12,
                    color: 'var(--text)', fontSize: 14, cursor: 'pointer',
                    transition: 'all 0.2s', outline: 'none', gap: 10
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {selectedOption.color && <div style={{ width: 10, height: 10, borderRadius: '50%', background: selectedOption.color }} />}
                    <span style={{ fontWeight: 500 }}>{selectedOption.label}</span>
                </div>
                <ChevronRight size={14} style={{ transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.2s', opacity: 0.6 }} />
            </button>

            {open && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'fixed',
                        top: coords.top + 8,
                        left: Math.max(10, coords.left + (coords.width - 200)), // Ensure not off-screen left
                        minWidth: 200,
                        background: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px) saturate(180%)', borderRadius: 18,
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                        boxShadow: isDark ? '0 20px 50px rgba(0, 0, 0, 0.5)' : '0 20px 50px rgba(0, 0, 0, 0.1)',
                        zIndex: 9999,
                        padding: '8px', display: 'flex', flexDirection: 'column', gap: 2
                    }}
                >
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className="settings-tab-btn" // Reusing hover style
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                width: '100%', padding: '10px 12px',
                                background: opt.value === value ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)') : 'transparent',
                                border: 'none', borderRadius: 12,
                                color: 'var(--text)', fontSize: 14, cursor: 'pointer',
                                transition: 'all 0.2s', textAlign: 'left'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {opt.color && <div style={{ width: 10, height: 10, borderRadius: '50%', background: opt.color }} />}
                                <span style={{ fontWeight: opt.value === value ? 600 : 400 }}>{opt.label}</span>
                            </div>
                            {opt.value === value && <Check size={14} color="var(--primary)" strokeWidth={3} />}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </div>
    );
}

// Main component  
export function ChatbotInterface() {
    const { user, signOut } = useAuth();
    const { theme, toggleTheme } = useThemeMode();
    const navigate = useNavigate();
    const sessionManager = useSessionManager();
    const { appLanguage, langKey, t, setAppLanguage } = useLanguage();
    const [emotionEnabled, setEmotionEnabled] = useState(() => localStorage.getItem('vivi-emotion-enabled') !== 'false');
    const [customAccent, setCustomAccent] = useState(() => localStorage.getItem('vivi-custom-accent') || '#1d6de0');
    const emotionTheme = useEmotionTheme({ enabled: emotionEnabled, customAccent });
    const [activeNav, setActiveNav] = useState('chat');
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightOpen, setRightOpen] = useState(false);
    const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [activeSettingsTab, setActiveSettingsTab] = useState('general');
    const [isAdmin, setIsAdmin] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user) {
            setIsAdmin(false);
            return;
        }
        (async () => {
            try {
                const { data } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', user.id)
                    .single();
                if (data?.role === 'admin') {
                    setIsAdmin(true);
                }
            } catch (e) {
                console.error('Error fetching role:', e);
            }
        })();
    }, [user]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sidebar UI state
    const [contextMenu, setContextMenu] = useState<ActiveMenu>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [visibleCount, setVisibleCount] = useState(20); // lazy load
    const sidebarScrollRef = useRef<HTMLDivElement>(null);

    // We no longer auto-create empty sessions on load.
    // The session will be created on demand when the first message is sent.

    const {
        messages, isLoading, sendMessage, clearMessages,
        updateFeedback, suggestions, refreshSuggestions, error,
        switchSession, fetchInitialSuggestions, initialData,
        modelMode, setModelMode, preferences, sessionId
    } = useLangGraphChat(sessionManager.activeSessionId ?? undefined, langKey);

    const { trackPageView, trackChatMessage } = useEventTracking();
    const [input, setInput] = useState('');
    const [attachments, setAttachments] = useState<Array<{ url: string; name: string; size: number; type: string; mimeType: string }>>([]);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [isRefreshingSugg, setIsRefreshingSugg] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { trackPageView('chatbot'); }, [trackPageView]);

    // Fetch suggestions on new session
    const fetchedRef = useRef<string | null>(null);
    useEffect(() => {
        console.log('[DEBUG] ChatbotInterface Check: sessionId=', sessionId, 'messages.length=', messages.length, 'isLoading=', isLoading, 'fetchedRef=', fetchedRef.current);
        if (sessionId && messages.length === 0 && !isLoading && fetchedRef.current !== sessionId) {
            console.log('[DEBUG] ChatbotInterface FETCHING initial suggestions for', sessionId);
            fetchedRef.current = sessionId;
            fetchInitialSuggestions(preferences?.askedTopics);
        }
    }, [sessionId, messages.length, isLoading, fetchInitialSuggestions, preferences]);

    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // Sync emotion from backend (with backward compatibility) + trigger theme switch
    useEffect(() => {
        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.emotion);
        if (lastAssistant?.emotion) {
            let emotionValue = lastAssistant.emotion;
            const oldMap: Record<string, string> = {
                'happy': 'positive', 'excited': 'positive', 'calm': 'positive',
                'frustrated': 'negative', 'sad': 'negative', 'curious': 'surprise'
            };
            if (oldMap[emotionValue]) emotionValue = oldMap[emotionValue];

            emotionTheme.setEmotionFromBackend(emotionValue);
            setCurrentEmotion(emotionValue as Emotion);

            // Fix 3: Switch dark/light theme based on backend emotion
            const palette = EMOTION_PALETTES[emotionValue as Emotion];
            if (palette) {
                if (palette.mode === 'dark' && theme === 'light') toggleTheme();
                else if (palette.mode === 'light' && theme === 'dark') toggleTheme();
            }
        }
    }, [messages]);

    // Close context menu on outside click
    useEffect(() => {
        const handler = () => setContextMenu(null);
        if (contextMenu) window.addEventListener('click', handler);
        return () => window.removeEventListener('click', handler);
    }, [contextMenu]);

    // Focus rename input when it appears
    useEffect(() => {
        if (renamingId) setTimeout(() => renameInputRef.current?.focus(), 50);
    }, [renamingId]);

    // Sidebar lazy load on scroll
    const handleSidebarScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 80) {
            setVisibleCount(prev => Math.min(prev + 10, sessionManager.sessions.length));
        }
    }, [sessionManager.sessions.length]);

    // Active session name
    const activeSession = sessionManager.sessions.find(s => s.id === sessionManager.activeSessionId);
    const chatTitle = activeSession?.name || 'Cuộc trò chuyện mới';

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        let sid = sessionManager.activeSessionId;
        if ((!input.trim() && attachments.length === 0) || isLoading) return;

        // On-demand session creation if none is active
        if (!sid) {
            sid = await sessionManager.createSession(input.substring(0, 30) || 'Cuộc trò chuyện mới');
            if (!sid) return;
        }

        const msg = input.trim();
        setInput('');
        setAttachments([]);
        trackChatMessage('user', msg);

        // Emotion detection — silently update state only, no toasts
        const { emotion } = emotionTheme.processMessage(msg);
        if (emotion !== 'neutral') {
            setCurrentEmotion(emotion);

            // Silent theme switch (no toast notification)
            const palette = emotionTheme.palette;
            if (palette.mode === 'light' && theme === 'dark') toggleTheme();
            else if (palette.mode === 'dark' && theme === 'light') toggleTheme();
        }

        await sendMessage(
            msg,
            attachments.length > 0 ? attachments.map(a => ({ url: a.url, type: a.mimeType, name: a.name })) : undefined,
            sessionManager.memoryShareEnabled,
            (newTitle: string) => sessionManager.renameSession(sid!, newTitle),
            undefined, // modelMode
            langKey,
            sid // Provide exactly this SID as an override to ensure no async wiping
        );
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    };

    const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (!file) continue;
                const reader = new FileReader();
                reader.onload = () => setAttachments(prev => [...prev, { url: reader.result as string, type: 'image', name: `pasted-${Date.now()}.png`, size: file.size, mimeType: file.type }]);
                reader.readAsDataURL(file);
                break;
            }
        }
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newAttachments = await Promise.all(files.map(file => {
            return new Promise<{ url: string; name: string; size: number; type: string; mimeType: string }>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const isText = file.name.match(/\.(txt|jsonl|md|csv|json)$/i);
                    const content = reader.result as string;
                    resolve({
                        url: content,
                        type: isText ? 'file/text' : (file.type.startsWith('image/') ? 'image' : 'file'),
                        name: file.name,
                        size: file.size,
                        mimeType: isText ? 'text/plain' : file.type
                    });
                };
                if (file.name.match(/\.(txt|jsonl|md|csv|json)$/i)) {
                    reader.readAsText(file);
                } else {
                    reader.readAsDataURL(file);
                }
            });
        }));

        setAttachments(prev => [...prev, ...newAttachments]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSuggestion = async (text: string) => {
        if (isLoading) return;
        let sid = sessionManager.activeSessionId;
        if (!sid) {
            sid = await sessionManager.createSession(text.substring(0, 30) || 'Cuộc trò chuyện mới');
            if (!sid) return;
        }

        trackChatMessage('user', `(suggestion) ${text}`);
        sendMessage(text, undefined, sessionManager.memoryShareEnabled, (t: string) => sessionManager.renameSession(sid!, t), undefined, langKey, sid);
    };

    const handleSessionChange = (sid: string) => {
        switchSession(sid);
        sessionManager.setActiveSession(sid);
        setContextMenu(null);
    };

    // Context menu actions
    const openContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ id, x: e.clientX, y: e.clientY });
    };

    const startRename = (id: string, currentName: string) => {
        setRenamingId(id);
        setRenameValue(currentName);
        setContextMenu(null);
    };

    const commitRename = async () => {
        if (renamingId && renameValue.trim()) {
            await sessionManager.renameSession(renamingId, renameValue.trim());
        }
        setRenamingId(null);
        setRenameValue('');
    };

    const handleDeleteSession = async (id: string) => {
        setContextMenu(null);
        await sessionManager.deleteSession(id);
    };

    useEffect(() => {
        const sid = sessionManager.activeSessionId;
        if (sid && messages.length > 0) {
            const last = messages[messages.length - 1];
            sessionManager.updateSessionMeta(sid, messages.length, last?.content?.slice(0, 50) ?? '');
        }
    }, [messages, sessionManager]);

    const displayName = user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? 'Bạn';
    const initials = displayName.slice(0, 2).toUpperCase();
    const sidebarW = leftCollapsed ? 64 : 260;
    const emotionInfo = EMOTION_DISPLAY[currentEmotion] || EMOTION_DISPLAY.neutral;
    const emotionGreeting = EMOTION_GREETINGS[currentEmotion] || '';
    const groupedSessions = groupSessionsByTime(sessionManager.sessions.slice(0, visibleCount), sessionManager.activeSessionId);

    // If sessions are loading and we don't have an active session in state yet, 
    // show a full-screen loader to prevent "New Chat" flicker.
    if (sessionManager.isLoading && !sessionManager.activeSessionId) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 size={40} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: 16 }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Đang tải cuộc trò chuyện...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden', position: 'fixed', inset: 0 }}>
            {mobileSidebarOpen && <div className="mobile-overlay" onClick={() => setMobileSidebarOpen(false)} />}

            <div
                className={mobileSidebarOpen ? "sidebar-mobile-visible" : "sidebar-mobile-hidden"}
                style={{
                    width: sidebarW,
                    flexShrink: 0,
                    background: 'var(--bg-card)',
                    borderRight: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'width 0.2s ease, left 0.3s ease',
                    position: 'relative'
                }}
            >

                <div style={{ padding: leftCollapsed ? '14px 0' : '14px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: leftCollapsed ? 'center' : 'flex-start', gap: 8 }}>
                    <img src="/Logo.png" alt="ViVi" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    {!leftCollapsed && (
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
                                Vi<span style={{ color: 'var(--primary)' }}>Vi</span>
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500 }}>Vietnam Virtual Assistant</div>
                        </div>
                    )}
                    {!leftCollapsed && (
                        <button onClick={() => sessionManager.setActiveSession(null)} title="Cuộc trò chuyện mới" style={{ width: 28, height: 28, borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                            <Plus size={14} />
                        </button>
                    )}
                </div>

                <button onClick={() => setLeftCollapsed(!leftCollapsed)} style={{ position: 'absolute', right: -11, top: 18, width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', zIndex: 20 }}>
                    {leftCollapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
                </button>

                <div ref={sidebarScrollRef} style={{ flex: 1, overflowY: 'auto', padding: leftCollapsed ? '10px 8px' : '8px 0' }} onScroll={handleSidebarScroll}>
                    {leftCollapsed ? (
                        /* Collapsed: just icons */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <button onClick={() => sessionManager.setActiveSession(null)} title={t.newChat} style={{ width: 44, height: 44, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                <Plus size={22} />
                            </button>
                        </div>
                    ) : (
                        /* Expanded: grouped sessions */
                        groupedSessions.length === 0 && !sessionManager.isLoading ? (
                            <div style={{ textAlign: 'center', padding: '20px 16px' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chưa có cuộc trò chuyện nào</div>
                            </div>
                        ) : (
                            groupedSessions.map(([label, sessions]) => (
                                <div key={label}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '10px 14px 4px' }}>{label}</div>
                                    {sessions.map(s => (
                                        <div key={s.id} style={{ position: 'relative' }}>
                                            {renamingId === s.id ? (
                                                /* Rename input */
                                                <div style={{ padding: '4px 10px' }}>
                                                    <input
                                                        ref={renameInputRef}
                                                        value={renameValue}
                                                        onChange={e => setRenameValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') commitRename();
                                                            if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                                                        }}
                                                        onBlur={commitRename}
                                                        style={{ width: '100%', padding: '6px 8px', fontSize: 13, borderRadius: 6, border: '1px solid var(--primary)', background: 'var(--input-bg)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }}
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    onClick={() => {
                                                        handleSessionChange(s.id);
                                                        setMobileSidebarOpen(false);
                                                    }}
                                                    style={{
                                                        padding: '6px 14px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        borderRadius: 8,
                                                        margin: '1px 6px',
                                                        background: s.id === sessionManager.activeSessionId ? 'rgba(29,109,224,0.12)' : 'transparent',
                                                        color: s.id === sessionManager.activeSessionId ? 'var(--text)' : 'var(--text-secondary)',
                                                    }}
                                                    onMouseOver={e => {
                                                        if (s.id !== sessionManager.activeSessionId) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                                        const btn = e.currentTarget.querySelector('.session-menu-btn') as HTMLElement;
                                                        if (btn) btn.style.opacity = '1';
                                                    }}
                                                    onMouseOut={e => {
                                                        if (s.id !== sessionManager.activeSessionId) e.currentTarget.style.background = 'transparent';
                                                        const btn = e.currentTarget.querySelector('.session-menu-btn') as HTMLElement;
                                                        if (btn) btn.style.opacity = '0';
                                                    }}
                                                >
                                                    {s.isPinned && <Pin size={10} style={{ flexShrink: 0, color: 'var(--primary)' }} />}
                                                    <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {s.name || 'Cuộc trò chuyện mới'}
                                                    </span>
                                                    <button
                                                        className="session-menu-btn"
                                                        onClick={e => openContextMenu(e, s.id)}
                                                        style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', opacity: 0, transition: 'opacity 0.15s' }}
                                                    >
                                                        <MoreVertical size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))
                        )
                    )}

                    {!leftCollapsed && visibleCount < sessionManager.sessions.length && (
                        <div style={{ textAlign: 'center', padding: '8px', fontSize: 12, color: 'var(--text-muted)' }}>
                            <Loader2 size={14} className="animate-spin" style={{ margin: '0 auto' }} />
                        </div>
                    )}
                </div>

                <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0, position: 'relative' }}>
                    <div style={{ padding: leftCollapsed ? '6px 4px 0' : '6px 6px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {navItems.map(({ id, label, icon: Icon }) => (
                            <button key={id} title={leftCollapsed ? label : undefined} onClick={() => setActiveNav(id)} style={{ width: '100%', padding: '7px 10px', marginBottom: 1, background: activeNav === id ? 'rgba(29,109,224,0.12)' : 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', color: activeNav === id ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: leftCollapsed ? 'center' : 'flex-start', gap: 9, fontSize: 13, fontFamily: 'inherit', fontWeight: activeNav === id ? 600 : 400 }}>
                                <Icon size={15} style={{ flexShrink: 0 }} />
                                {!leftCollapsed && label}
                            </button>
                        ))}
                    </div>

                    <div style={{ padding: leftCollapsed ? '4px' : '4px 8px 8px' }}>
                        <button onClick={toggleTheme} title={leftCollapsed ? (theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối') : undefined} style={{ width: '100%', padding: leftCollapsed ? '8px 0' : '7px 10px', marginBottom: 2, background: 'transparent', border: 'none', borderRadius: 7, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: leftCollapsed ? 'center' : 'flex-start', gap: 9, fontSize: 13, fontFamily: 'inherit' }}>
                            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                            {!leftCollapsed && (theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối')}
                        </button>

                        {!leftCollapsed && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', marginBottom: 2 }}>
                                <ZapIcon size={12} color={modelMode === 'gemini' ? '#f59e0b' : '#8b5cf6'} />
                                <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{modelMode === 'gemini' ? 'Gemini' : 'Qwen3'}</span>
                                <button onClick={() => setModelMode(modelMode === 'gemini' ? 'qwen' : 'gemini')} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 100, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit' }}>Đổi</button>
                            </div>
                        )}

                        {!leftCollapsed && currentEmotion !== 'neutral' && (
                            <div style={{ padding: '4px 10px', marginBottom: 2 }}>
                                <span className="emotion-badge" style={{ color: emotionInfo.color, borderColor: `${emotionInfo.color}30`, background: `${emotionInfo.color}12` }}>
                                    {emotionInfo.emoji} {emotionInfo.label}
                                </span>
                            </div>
                        )}

                        <div
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            style={{ padding: leftCollapsed ? '7px 0' : '6px 10px', display: 'flex', alignItems: 'center', justifyContent: leftCollapsed ? 'center' : 'flex-start', gap: 8, marginBottom: 2, cursor: 'pointer', borderRadius: 8 }}
                            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-muted)'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'white' }}>{initials}</div>
                            {!leftCollapsed && (
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
                                </div>
                            )}
                        </div>

                        {userMenuOpen && (
                            <div ref={userMenuRef} style={{ position: 'absolute', bottom: 50, left: leftCollapsed ? 64 : 10, width: 250, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '6px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 1000 }}>
                                <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'white' }}>{initials}</div>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{displayName}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{user?.email}</div>
                                    </div>
                                </div>
                                <div style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                                    <button onClick={() => { setUserMenuOpen(false); window.location.href = '/profile'; }} style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13 }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <User size={15} /> Hồ sơ cá nhân
                                    </button>
                                    {isAdmin && (
                                        <button onClick={() => { setUserMenuOpen(false); window.location.href = '/admin'; }} style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13 }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                            <Shield size={15} /> Admin Dashboard
                                        </button>
                                    )}
                                    <button style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13 }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <Sparkles size={15} /> Upgrade plan
                                    </button>
                                    <button style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13 }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <User size={15} /> Personalization
                                    </button>
                                    <button onClick={() => { setSettingsOpen(true); setUserMenuOpen(false); }} style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13 }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <Settings size={15} /> Settings
                                    </button>
                                </div>
                                <div style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                                    <button style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13 }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><HelpCircle size={15} /> Help</div>
                                        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                                    </button>
                                    <button onClick={async () => { await signOut(); navigate('/'); }} style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13 }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-muted)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <LogOut size={15} /> Log out
                                    </button>
                                </div>
                                <div style={{ padding: '8px', marginTop: 2 }}>
                                    <div style={{ background: 'var(--bg-muted)', padding: '12px', borderRadius: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, fontWeight: 700, color: 'white' }}>{initials}</div>
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>{displayName}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1 }}>Free</div>
                                            </div>
                                        </div>
                                        <button style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>Upgrade</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {contextMenu && (
                <div
                    onClick={e => e.stopPropagation()}
                    style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', minWidth: 160, padding: '4px 0', overflow: 'hidden' }}
                >
                    {[
                        { icon: Pin, label: sessionManager.sessions.find(s => s.id === contextMenu.id)?.isPinned ? 'Bỏ ghim' : 'Ghim', action: () => { sessionManager.togglePin(contextMenu.id); setContextMenu(null); } },
                        { icon: Pencil, label: 'Đổi tên', action: () => startRename(contextMenu.id, sessionManager.sessions.find(s => s.id === contextMenu.id)?.name || '') },
                        { icon: Trash2, label: 'Xóa', action: () => handleDeleteSession(contextMenu.id), danger: true },
                    ].map(({ icon: Icon, label, action, danger }) => (
                        <button key={label} onClick={action} style={{ width: '100%', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: danger ? '#ef4444' : 'var(--text)', fontFamily: 'inherit', textAlign: 'left' }}
                            onMouseOver={e => (e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.06)')}
                            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <Icon size={14} />
                            {label}
                        </button>
                    ))}
                </div>
            )}

            <div className="chat-main-area main-content-mobile" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

                <div className="chat-header-mobile" style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', flexShrink: 0, minHeight: 52 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, overflowX: 'hidden' }}>
                        <button
                            className="mobile-only"
                            onClick={() => setMobileSidebarOpen(true)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', marginRight: 8, padding: 4 }}
                        >
                            <Menu size={20} />
                        </button>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {chatTitle}
                        </span>
                        {currentEmotion !== 'neutral' && (
                            <span className="emotion-badge" style={{ fontSize: 11, color: emotionInfo.color, borderColor: `${emotionInfo.color}30`, background: `${emotionInfo.color}12`, flexShrink: 0 }}>
                                {emotionInfo.emoji}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {messages.length > 0 && (
                            <button onClick={() => sessionManager.setActiveSession(null)} style={{ padding: '5px 12px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <RefreshCw size={11} /> Mới
                            </button>
                        )}
                        <button className="desktop-only" onClick={() => setRightOpen(!rightOpen)} style={{ padding: '5px 10px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, fontFamily: 'inherit' }}>
                            {rightOpen ? '→' : '←'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div style={{ margin: '8px 16px', padding: '9px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
                        ⚠️ {error}
                    </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }} onScroll={e => {
                    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120);
                }}>
                    {isLoading && messages.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60%' }}>
                            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
                        </div>
                    ) : messages.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60%', textAlign: 'center' }}>
                            <div style={{ marginBottom: 16 }}>
                                <img src="/Logo.png" alt="ViVi" style={{ width: 68, height: 68, borderRadius: 18, objectFit: 'cover', boxShadow: '0 8px 32px rgba(29,109,224,0.2)' }} />
                            </div>
                            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
                                Xin chào, {displayName}! 👋
                            </h2>
                            <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: emotionGreeting ? 8 : 28, maxWidth: 460 }}>
                                {(initialData as { welcome_message?: string } | undefined)?.welcome_message ?? 'Mình là ViVi, trợ lý du lịch AI cho Việt Nam!'}
                            </p>
                            {emotionGreeting && (
                                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, padding: '8px 18px', background: `${emotionInfo.color}12`, borderRadius: 10, border: `1px solid ${emotionInfo.color}30` }}>
                                    {emotionGreeting}
                                </div>
                            )}

                            <div className="quick-actions-mobile" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 24, maxWidth: 480, width: '100%' }}>
                                {quickActions.map(({ icon: Icon, label, desc, color }) => (
                                    <button key={label} onClick={() => handleSuggestion(label)} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit', transition: 'all 0.2s' }}
                                        onMouseOver={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = `${color}08`; }}
                                        onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
                                    >
                                        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Icon size={16} color={color} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {suggestions.length > 0 && (
                                <div>
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>💡 Gợi ý dành cho bạn:</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                                        {suggestions.slice(0, 5).map((s, i) => {
                                            const text = typeof s === 'string' ? s : (s as { text: string }).text;
                                            // Fix 2: Count how many times user asked about locations in this suggestion
                                            const topicCounts = preferences?.topicCounts || {};
                                            let matchCount = 0;
                                            const lowerText = text.toLowerCase();
                                            Object.entries(topicCounts).forEach(([topic, count]) => {
                                                if (lowerText.includes(topic.toLowerCase()) || topic.toLowerCase().includes(lowerText.split(' ').slice(-1)[0])) {
                                                    matchCount += count as number;
                                                }
                                            });
                                            return (
                                                <button key={i} onClick={() => handleSuggestion(text)} style={{ position: 'relative', padding: '7px 16px', borderRadius: 100, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                                                    onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                                                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                                >
                                                    {text}
                                                    {matchCount > 0 && (
                                                        <span style={{
                                                            position: 'absolute', top: -6, right: -6,
                                                            minWidth: 18, height: 18, borderRadius: '50%',
                                                            background: '#ef4444', color: 'white',
                                                            fontSize: 10, fontWeight: 700,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            padding: '0 4px', lineHeight: 1,
                                                            boxShadow: '0 2px 6px rgba(239,68,68,0.4)',
                                                        }}>
                                                            {matchCount}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760, margin: '0 auto' }}>
                            {messages.map(msg => (
                                <MessageBubble key={msg.id} message={msg} onFeedback={updateFeedback} />
                            ))}
                            <div ref={scrollRef} />
                        </div>
                    )}
                </div>

                {showScrollBtn && (
                    <button onClick={() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' })} style={{ position: 'absolute', bottom: 96, right: 24, width: 34, height: 34, borderRadius: '50%', background: 'var(--primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 12px rgba(29,109,224,0.4)', zIndex: 10 }}>
                        <ArrowDown size={15} />
                    </button>
                )}

                {suggestions.length > 0 && messages.length > 0 && (
                    <div style={{ padding: '10px 0px 5px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
                        <Sparkles size={14} color="var(--primary)" />
                        {suggestions.slice(0, 5).map((s, i) => {
                            const text = typeof s === 'string' ? s : (s as { text: string }).text;
                            return (
                                <button key={i} onClick={() => handleSuggestion(text)} style={{ padding: '4px 12px', borderRadius: 100, border: '1px solid var(--border)', background: 'var(--bg-muted)', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'inherit', transition: 'all 0.2s' }}
                                    onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                >
                                    {text}
                                </button>
                            );
                        })}
                        <button onClick={async () => { setIsRefreshingSugg(true); await refreshSuggestions(); setIsRefreshingSugg(false); }} disabled={isRefreshingSugg} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            <RefreshCw size={10} className={isRefreshingSugg ? 'animate-spin' : ''} />
                        </button>
                    </div>
                )}

                <div style={{ padding: '5px 20px 5px', background: 'var(--bg-card)', flexShrink: 0 }}>
                    <form onSubmit={handleSubmit} style={{ position: 'relative', display: 'flex', flexDirection: 'column', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '8px 12px 8px 16px', outline: 'none' }}>

                        {attachments.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                {attachments.map((att, idx) => (
                                    <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 12, padding: '6px 12px', maxWidth: '100%' }}>
                                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', flexShrink: 0 }}>
                                            {att.type === 'image' ? <FileImage size={12} color="var(--primary)" /> : <Bot size={12} color="var(--primary)" />}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{att.name}</span>
                                                <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1 }}>{att.type === 'image' ? 'Image' : 'File'} • {(att.size / 1024).toFixed(1)} KB</span>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
                                            <X size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,.txt,.jsonl,.csv,.md" multiple style={{ display: 'none' }} />
                            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0, marginRight: 8 }} title="Đính kèm file">
                                <Plus size={20} />
                            </button>

                            <textarea
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                placeholder={attachments.length > 0 ? t.askFile : t.ask}
                                disabled={isLoading}
                                rows={1}
                                style={{ flex: 1, resize: 'none', minHeight: 24, maxHeight: 120, padding: '4px 0', border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', outline: 'none', lineHeight: 1.5 }}
                            />

                            <button type="submit" disabled={(!input.trim() && attachments.length === 0) || isLoading} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: (!input.trim() && attachments.length === 0) || isLoading ? 'var(--bg-muted)' : 'var(--text)', cursor: (!input.trim() && attachments.length === 0) || isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: (!input.trim() && attachments.length === 0) || isLoading ? 'var(--text-muted)' : 'var(--bg)', flexShrink: 0, transition: 'all 0.2s' }}>
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowDown size={18} style={{ transform: 'rotate(-90deg)' }} />}
                            </button>
                        </div>
                    </form>
                    <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                        ViVi có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
                    </div>
                </div>
            </div>

            {rightOpen && (
                <div className="right-panel-mobile" style={{ width: 260, flexShrink: 0, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', padding: 16, overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Context</h3>
                        <button onClick={() => setRightOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={15} /></button>
                    </div>

                    {currentEmotion !== 'neutral' && (
                        <div style={{ padding: 10, borderRadius: 10, background: `${emotionInfo.color}10`, border: `1px solid ${emotionInfo.color}25`, marginBottom: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: emotionInfo.color, marginBottom: 4 }}>Cảm xúc</div>
                            <div style={{ fontSize: 20 }}>{emotionInfo.emoji}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>{emotionInfo.label}</div>
                            {emotionGreeting && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.5 }}>{emotionGreeting}</div>}
                        </div>
                    )}

                    {messages.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <Bot size={28} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
                            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chat context sẽ hiện ở đây</p>
                        </div>
                    ) : (
                        <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>{messages.length} tin nhắn</div>
                            {messages.slice(-3).map(m => (
                                <div key={m.id} style={{ padding: 9, borderRadius: 8, background: 'var(--bg-muted)', marginBottom: 7, border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: m.role === 'user' ? 'var(--primary)' : 'var(--text-muted)', marginBottom: 3 }}>
                                        {m.role === 'user' ? 'Bạn' : 'ViVi'} {m.emotion && m.role === 'assistant' ? EMOTION_DISPLAY[m.emotion as Emotion]?.emoji : ''}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                        {m.content}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {settingsOpen && (
                <div
                    onClick={() => setSettingsOpen(false)}
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="settings-modal-mobile"
                        style={{ width: 800, height: 600, maxWidth: '95vw', maxHeight: '90vh', background: 'var(--bg)', borderRadius: 16, display: 'flex', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}
                    >
                        <div className="settings-sidebar-mobile" style={{ width: 230, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div className="desktop-only" style={{ padding: '0 10px 14px', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Settings</div>
                            {[
                                { id: 'general', icon: Settings, label: t.general || 'General' },
                                { id: 'notifications', icon: Bell, label: t.notifications || 'Notifications' },
                                { id: 'personalization', icon: Sliders, label: t.personalization || 'Personalization' },
                                { id: 'account', icon: User, label: t.account || 'Account' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log('Switching to tab:', tab.id);
                                        setActiveSettingsTab(tab.id);
                                    }}
                                    className="settings-tab-btn"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                                        background: tab.id === activeSettingsTab ? 'rgba(29, 109, 224, 0.15)' : 'transparent',
                                        border: 'none', borderRadius: 12,
                                        color: tab.id === activeSettingsTab ? 'var(--primary)' : 'var(--text)',
                                        fontSize: 14, cursor: 'pointer', transition: 'all 0.2s',
                                        fontWeight: tab.id === activeSettingsTab ? 600 : 400,
                                        textAlign: 'left', width: '100%', position: 'relative', zIndex: 10
                                    }}
                                >
                                    <tab.icon
                                        size={18}
                                        style={{ pointerEvents: 'none' }}
                                        color={tab.id === activeSettingsTab ? 'var(--primary)' : 'var(--text-muted)'}
                                    />
                                    <span style={{ pointerEvents: 'none' }}>{tab.label}</span>
                                </button>
                            ))}
                        </div>
                        <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>{activeSettingsTab}</h2>
                                <button
                                    onClick={() => setSettingsOpen(false)}
                                    className="btn-close-settings"
                                    style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 50, width: 32, height: 32, cursor: 'pointer', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                    title="Close"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 28, position: 'relative' }}>
                                <Lock size={20} style={{ color: 'var(--text)', marginBottom: 12 }} />
                                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Secure your account</div>
                                <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.5, maxWidth: '90%' }}>Add multi-factor authentication (MFA), like a passkey or text message, to help protect your account when logging in.</div>
                                <button style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 8, color: 'var(--text)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Set up MFA</button>
                                <button style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
                            </div>

                            {activeSettingsTab === 'general' && (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {[
                                            {
                                                label: t.appearance,
                                                type: 'combobox',
                                                value: theme,
                                                options: [
                                                    { label: 'System', value: 'system' },
                                                    { label: 'Dark', value: 'dark' },
                                                    { label: 'Light', value: 'light' }
                                                ],
                                                onChange: (val: string) => {
                                                    if (val === 'system') {
                                                        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                                                        if (isDark && theme !== 'dark') toggleTheme();
                                                        else if (!isDark && theme !== 'light') toggleTheme();
                                                        localStorage.removeItem('theme');
                                                    } else {
                                                        if (val === 'light' && theme !== 'light') toggleTheme();
                                                        else if (val === 'dark' && theme !== 'dark') toggleTheme();
                                                    }
                                                }
                                            },
                                            {
                                                label: t.accentColor,
                                                type: 'combobox',
                                                value: customAccent,
                                                options: [
                                                    { label: 'Default', value: '#1d6de0', color: '#1d6de0' },
                                                    { label: 'Blue', value: '#3b82f6', color: '#3b82f6' },
                                                    { label: 'Green', value: '#10b981', color: '#10b981' },
                                                    { label: 'Yellow', value: '#f59e0b', color: '#f59e0b' },
                                                    { label: 'Pink', value: '#ec4899', color: '#ec4899' },
                                                    { label: 'Orange', value: '#f97316', color: '#f97316' },
                                                ],
                                                onChange: (val: string) => {
                                                    setCustomAccent(val);
                                                    localStorage.setItem('vivi-custom-accent', val);
                                                    if (!emotionEnabled) document.documentElement.style.setProperty('--primary', val);
                                                }
                                            },
                                            {
                                                label: t.language,
                                                type: 'combobox',
                                                value: appLanguage,
                                                options: [
                                                    { label: 'Auto-detect', value: 'auto' },
                                                    { label: 'Tiếng Việt', value: 'vi' },
                                                    { label: 'English', value: 'en' },
                                                    { label: '简体中文', value: 'zh' }
                                                ],
                                                onChange: (val: string) => {
                                                    setAppLanguage(val as any);
                                                    localStorage.setItem('vivi-lang', val);
                                                }
                                            },
                                            { label: t.spokenLanguage, value: 'Auto-detect', desc: "For best results, select the language you mainly speak. If it's not listed, it may still be supported via auto-detection." },
                                        ].map((item, i, arr) => (
                                            <div key={item.label} style={{ display: 'flex', alignItems: item.desc ? 'flex-start' : 'center', justifyContent: 'space-between', padding: '20px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                <div>
                                                    <div style={{ fontSize: 15, color: 'var(--text)', fontWeight: 500 }}>{item.label}</div>
                                                    {item.desc && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, maxWidth: 380, lineHeight: 1.5 }}>{item.desc}</div>}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                    {item.type === 'combobox' ? (
                                                        <CustomComboBox
                                                            value={item.value}
                                                            options={item.options || []}
                                                            onChange={item.onChange!}
                                                        />
                                                    ) : (
                                                        <div onClick={(item as any).onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: (item as any).onClick ? 'pointer' : 'default', fontSize: 14, color: 'var(--text-secondary)' }}>
                                                            {item.value || (item as any).type === 'select' ? item.value : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {activeSettingsTab === 'notifications' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Manage your email and push notifications.</div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: 15, color: 'var(--text)' }}>Push notifications</div>
                                        <div style={{ width: 44, height: 24, background: 'var(--primary)', borderRadius: 20, position: 'relative', cursor: 'pointer' }}>
                                            <div style={{ width: 20, height: 20, background: 'white', borderRadius: '50%', position: 'absolute', top: 2, right: 2 }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSettingsTab === 'personalization' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Tailor the assistant to your preferences.</div>
                                    <div style={{ padding: '20px 0', borderBottom: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ fontSize: 15, color: 'var(--text)', marginBottom: 8 }}>{t.emotionTheme}</div>
                                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.emotionThemeDesc}</div>
                                            </div>
                                            <div
                                                onClick={() => {
                                                    const newValue = !emotionEnabled;
                                                    setEmotionEnabled(newValue);
                                                    localStorage.setItem('vivi-emotion-enabled', String(newValue));
                                                    // Force immediate reset if disabled
                                                    if (!newValue) {
                                                        const root = document.documentElement;
                                                        root.style.setProperty('--primary', customAccent);
                                                        root.style.setProperty('--primary-accent', '#06b6d4');
                                                        root.removeAttribute('data-emotion');
                                                    }
                                                }}
                                                style={{
                                                    width: 44, height: 24,
                                                    background: emotionEnabled ? 'var(--primary)' : 'var(--bg-muted)',
                                                    borderRadius: 20, position: 'relative', cursor: 'pointer',
                                                    transition: 'all 0.2s', border: '1px solid var(--border)'
                                                }}
                                            >
                                                <div style={{
                                                    width: 18, height: 18, background: 'white', borderRadius: '50%',
                                                    position: 'absolute', top: 2,
                                                    left: emotionEnabled ? 22 : 2,
                                                    transition: 'all 0.2s',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                                }}></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ padding: '20px 0', borderBottom: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: 15, color: 'var(--text)', marginBottom: 8 }}>Memory</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>ViVi will become more helpful as it chats with you.</div>
                                        <button style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 8, fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>Manage Memory</button>
                                    </div>
                                </div>
                            )}

                            {activeSettingsTab !== 'general' && activeSettingsTab !== 'notifications' && activeSettingsTab !== 'personalization' && (
                                <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Mục cấu hình này đang được hoàn thiện.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

//   Message Bubble     
function MessageBubble({ message, onFeedback }: { message: ChatMessage; onFeedback: (id: string, score: number) => void }) {
    const isUser = message.role === 'user';
    const emotionDisplay = message.emotion ? EMOTION_DISPLAY[message.emotion as Emotion] : null;

    return (
        <div style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', border: `1px solid ${isUser ? 'transparent' : 'var(--border)'}` }}>
                {isUser ? (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, var(--primary), #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={13} color="white" />
                    </div>
                ) : (
                    <img src="/Logo.png" alt="ViVi" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
            </div>

            <div className="bubble-max-width-mobile" style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                {isUser && message.attachments && message.attachments.length > 0 && (
                    <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                        {message.attachments.map((att, i) =>
                            att.type.startsWith('image/') ? (
                                <img key={i} src={att.url} alt={att.name} style={{ maxWidth: 200, maxHeight: 150, borderRadius: 8, objectFit: 'cover' }} />
                            ) : (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(29,109,224,0.12)', borderRadius: 8, fontSize: 12 }}>
                                    <FileImage size={12} color="var(--primary)" />
                                    <span>{att.name}</span>
                                </div>
                            )
                        )}
                    </div>
                )}

                <div style={{ padding: '10px 14px', borderRadius: 14, borderTopRightRadius: isUser ? 4 : 14, borderTopLeftRadius: isUser ? 14 : 4, background: isUser ? 'var(--primary)' : 'var(--bg-card)', border: isUser ? 'none' : '1px solid var(--border)', color: isUser ? 'white' : 'var(--text)', fontSize: 14, lineHeight: 1.6 }}>
                    {message.isLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Loader2 size={13} className="animate-spin" />
                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>ViVi đang suy nghĩ...</span>
                        </div>
                    ) : isUser ? (
                        message.content
                    ) : (
                        <div className="prose">
                            <ReactMarkdown components={mdComponents}>
                                {processContent(message.content)}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
                    {!isUser && !message.isLoading && emotionDisplay?.label && (
                        <span style={{ fontSize: 11, color: emotionDisplay.color }}>{emotionDisplay.emoji}</span>
                    )}
                    {!isUser && !message.isLoading && (
                        <>
                            <button onClick={() => onFeedback(message.id, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: message.feedbackScore === 1 ? 'var(--primary)' : 'var(--text-muted)', padding: '2px 3px', borderRadius: 4 }}><ThumbsUp size={11} /></button>
                            <button onClick={() => onFeedback(message.id, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: message.feedbackScore === -1 ? '#ef4444' : 'var(--text-muted)', padding: '2px 3px', borderRadius: 4 }}><ThumbsDown size={11} /></button>
                        </>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>
                        {new Date(message.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>
        </div>
    );
}
