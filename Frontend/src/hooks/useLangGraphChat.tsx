/**
 * useLangGraphChat — Full port from legacy with:
 * - Streaming SSE chat
 * - Contextual suggestions based on extracted locations (histogram-ranked)
 * - Initial personalized suggestions (frequent topics → backend endpoint)
 * - Emotion metadata from backend response
 * - Session switching + message cache
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionCookies } from '@/hooks/useSessionCookies';
import { supabase } from '@/lib/supabase';

const LANGGRAPH_API_URL = import.meta.env.VITE_LANGGRAPH_API_URL || 'http://localhost:8000';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    feedbackScore?: number | null;
    isLoading?: boolean;
    attachments?: Array<{ url: string; type: string; name: string }>;
    emotion?: string;
    intent?: string;
}

export interface SuggestionItem {
    text: string;
    category: 'next_step' | 'personalized' | 'open_ended';
}

// Per-session message cache (avoids re-fetching on tab switch)
const sessionMessagesCache: Record<string, ChatMessage[]> = {};

export function useLangGraphChat(initialSessionId?: string, language: string = 'vi') {
    const { user } = useAuth();
    const {
        sessionId: savedSessionId,
        saveSession,
        trackTopic,
        updateRecentLocations,
        preferences,
        isLoaded: cookiesLoaded,
    } = useSessionCookies();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
    const [recentLocations, setRecentLocations] = useState<string[]>([]);
    const [initialData, setInitialData] = useState<{ welcome_message?: string; suggestions: SuggestionItem[] } | null>(null);
    const [modelMode, setModelModeInternal] = useState<'gemini' | 'qwen'>(() => {
        const saved = localStorage.getItem(`model_mode_${user?.id}`);
        return saved === 'qwen' ? 'qwen' : 'gemini';
    });

    // Wrap setModelMode to persist to localStorage per-user
    const setModelMode = useCallback((mode: 'gemini' | 'qwen') => {
        setModelModeInternal(mode);
        if (user?.id) {
            localStorage.setItem(`model_mode_${user.id}`, mode);
        }
    }, [user?.id]);
    const [error, setError] = useState<string | null>(null);

    const sidRef = useRef<string>(initialSessionId || savedSessionId || '');

    // Generate UUID lazily only when we are sure we need a NEW session
    if (!sidRef.current && !initialSessionId && !savedSessionId && cookiesLoaded) {
        sidRef.current = crypto.randomUUID();
    }

    // Load chat history when session + auth ready
    useEffect(() => {
        const loadHistory = async (sid: string) => {
            if (!user?.id) return;
            const cached = sessionMessagesCache[sid];
            if (cached) { setMessages(cached); return; }

            setIsLoading(true);
            try {
                const res = await fetch(`${LANGGRAPH_API_URL}/langgraph/history/${sid}`);
                if (!res.ok) throw new Error('Failed');
                const data = await res.json();

                const loaded: ChatMessage[] = (data.history || []).map((log: Record<string, unknown>) => ({
                    id: String(log.id),
                    role: log.role as 'user' | 'assistant',
                    content: log.message as string,
                    timestamp: new Date(log.created_at as string),
                    emotion: log.role === 'assistant' ? (log.context as Record<string, unknown>)?.emotion as string : undefined,
                    intent: log.role === 'assistant' ? (log.context as Record<string, unknown>)?.intent as string : undefined,
                }));
                setMessages(loaded);
                sessionMessagesCache[sid] = loaded;
            } catch {
                setError('Không thể tải lịch sử cuộc trò chuyện');
            } finally {
                setIsLoading(false);
            }
        };

        if (cookiesLoaded && sidRef.current) {
            loadHistory(sidRef.current);
        }
    }, [cookiesLoaded, user?.id]);

    // Handle session switch and cleanup empty sessions
    useEffect(() => {
        console.log('[DEBUG] useLangGraphChat useEffect session switch. initialSessionId=', initialSessionId, 'sidRef.current=', sidRef.current);

        // If the prop matches our current internal ID, nothing to do.
        if (initialSessionId === sidRef.current) return;

        // If we are switching TO "New Chat" (undefined) AND we are ALREADY empty, skip to avoid infinite loops.
        if (!initialSessionId && messages.length === 0) {
            return;
        }

        // Cleanup old session if it was empty before switching
        if (messages.length === 0 && sidRef.current) {
            console.log('[DEBUG] Cleaning up old empty session:', sidRef.current);
            fetch(`${LANGGRAPH_API_URL}/langgraph/sessions/cleanup/${sidRef.current}`, {
                method: 'DELETE'
            }).catch(e => console.warn('Failed to cleanup empty session:', e));
        }

        if (!initialSessionId) {
            const newSid = crypto.randomUUID();
            console.log('[DEBUG] Generating new empty session:', newSid);
            sidRef.current = newSid;
            setMessages([]);
            setSuggestions([]);
            setError(null);
            return;
        }

        console.log('[DEBUG] Switching to existing session:', initialSessionId);
        sidRef.current = initialSessionId;
        setSuggestions([]);
        setError(null);

        const cached = sessionMessagesCache[initialSessionId];
        if (cached) {
            console.log('[DEBUG] Session hit cache! Messages length:', cached.length);
            setMessages(cached);
            return;
        }

        console.log('[DEBUG] Session NOT in cache, fetching history for:', initialSessionId);
        setMessages([]); // Clear old messages immediately
        setIsLoading(true);
        fetch(`${LANGGRAPH_API_URL}/langgraph/history/${initialSessionId}`)
            .then(r => {
                if (!r.ok) throw new Error('API error');
                return r.json();
            })
            .then(data => {
                const msgs: ChatMessage[] = (data.history || []).map((log: Record<string, unknown>) => ({
                    id: String(log.id),
                    role: log.role as 'user' | 'assistant',
                    content: log.message as string,
                    timestamp: new Date(log.created_at as string),
                    emotion: log.role === 'assistant' ? (log.context as Record<string, unknown>)?.emotion as string : undefined,
                    intent: log.role === 'assistant' ? (log.context as Record<string, unknown>)?.intent as string : undefined,
                    attachments: log.role === 'user' ? (log.context as Record<string, unknown>)?.attachments as any[] : undefined,
                }));
                console.log('[DEBUG] Fetched history for', initialSessionId, 'length:', msgs.length);
                setMessages(msgs);
                sessionMessagesCache[initialSessionId] = msgs;
            })
            .catch(err => {
                console.error('Failed to load session history:', err);
                setError('Không thể tải lịch sử cuộc trò chuyện');
            })
            .finally(() => setIsLoading(false));
    }, [initialSessionId]);

    // Cleanup empty session on component unmount
    useEffect(() => {
        return () => {
            if (messages.length === 0 && sidRef.current) {
                // Use keepalive or Beacon API if possible, but fetch is usually fine for simple unmounts
                fetch(`${LANGGRAPH_API_URL}/langgraph/sessions/cleanup/${sidRef.current}`, {
                    method: 'DELETE',
                    keepalive: true
                }).catch(() => { });
            }
        };
    }, [messages.length]);

    // Persist cookies on session change
    useEffect(() => {
        if (cookiesLoaded && sidRef.current) saveSession(sidRef.current);
    }, [cookiesLoaded, saveSession]);

    // Cache messages
    useEffect(() => {
        if (messages.length > 0 && !messages.some(m => m.isLoading)) {
            sessionMessagesCache[sidRef.current] = messages;
        }
    }, [messages]);

    // Note: Removed frontend auto-title fallback to rely entirely on backend SLM

    // sendMessage
    const sendMessage = useCallback(async (
        content: string,
        attachments?: Array<{ url: string; type: string; name?: string }>,
        memoryShareEnabled: boolean = false,
        onNewTitle?: (title: string) => void,
        overrideModelMode?: 'gemini' | 'qwen',
        language?: string,
        overrideSessionId?: string,
    ) => {
        if (!content.trim() || !user?.id || isLoading) return;
        setError(null);

        if (overrideSessionId && overrideSessionId !== sidRef.current) {
            sidRef.current = overrideSessionId;
        }

        const currentSid = sidRef.current;
        const isFirstMessage = messages.filter(m => !m.isLoading).length === 0;

        // Track topic for histogram-based recommendations
        trackTopic(content.trim());

        // Immediate client-side fallback title removed to let backend handle it

        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date(),
            attachments: attachments?.map(a => ({ url: a.url, type: a.type, name: a.name || 'file' })),
        };
        const loadingMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isLoading: true,
        };

        setMessages(prev => [...prev, userMsg, loadingMsg]);
        setIsLoading(true);

        try {
            const history = messages
                .filter(m => !m.isLoading)
                .map(m => ({ role: m.role, content: m.content }));

            const res = await fetch(`${LANGGRAPH_API_URL}/langgraph/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    session_id: currentSid,
                    message: content.trim(),
                    history,
                    memory_scope: memoryShareEnabled ? 'global' : 'session',
                    model_mode: overrideModelMode || modelMode,
                    attachments: attachments?.map(a => ({ url: a.url, type: a.type, name: a.name || 'image' })),
                    language: language || 'vi'
                }),
            });

            if (!res.ok) throw new Error(`API error: ${res.status}`);

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) throw new Error('No reader');

            let assistantContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                for (const line of chunk.split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const data = JSON.parse(line.slice(6));

                        if (data.type === 'metadata') {
                            setMessages(prev => prev.map(m =>
                                m.id === loadingMsg.id ? { ...m, emotion: data.emotion, intent: data.intent } : m
                            ));
                        } else if (data.type === 'content') {
                            assistantContent += data.content;
                            setMessages(prev => prev.map(m =>
                                m.id === loadingMsg.id ? { ...m, content: assistantContent, isLoading: false } : m
                            ));
                        } else if (data.type === 'final') {
                            setSuggestions(data.suggested_prompts || []);

                            if (data.new_title && onNewTitle) onNewTitle(data.new_title);

                            // Location-based contextual suggestions
                            if (data.extracted_locations?.length > 0) {
                                const locationNames: string[] = data.extracted_locations.map((loc: Record<string, string>) => loc.name);
                                setRecentLocations(locationNames.slice(0, 3));
                                updateRecentLocations(locationNames);

                                // Track each location with histogram
                                data.extracted_locations.forEach((loc: Record<string, string>) => {
                                    trackTopic(loc.name, true, {
                                        city: loc.city,
                                        province: loc.province,
                                        adminId: loc.admin_id,
                                    });
                                });

                                // Fetch AI-powered contextual suggestions (non-blocking)
                                fetch(`${LANGGRAPH_API_URL}/langgraph/contextual_suggestions`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        locations: locationNames.slice(0, 3),
                                        last_question: userMsg.content,
                                        limit: 4,
                                    }),
                                })
                                    .then(r => r.json())
                                    .then(result => {
                                        if (result.suggestions?.length > 0) {
                                            setSuggestions(prev => {
                                                const base = data.suggested_prompts || prev;
                                                return [...result.suggestions, ...base.slice(0, 1)].slice(0, 5);
                                            });
                                        }
                                    })
                                    .catch(e => console.warn('Contextual suggestions error:', e));
                            }
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    } catch (e) {
                        console.warn('SSE parse error:', e);
                    }
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gửi tin nhắn thất bại');
            setMessages(prev => prev.filter(m => m.id !== loadingMsg.id));
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, messages, modelMode, trackTopic, updateRecentLocations]);

    // fetchInitialSuggestions: histogram-based personalization
    const fetchInitialSuggestions = useCallback(async (topics?: string[], forceSet: boolean = false) => {
        if (!user?.id) return;

        // Sort topics by frequency from cookie histogram
        const topicCounts = preferences?.topicCounts || {};
        const sortedTopics = Object.entries(topicCounts)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([name]) => name)
            .slice(0, 10);

        const mergedTopics = Array.from(new Set([...sortedTopics, ...(topics || [])])).slice(0, 10);
        const recentLocations = preferences?.recentLocations || [];

        try {
            const res = await fetch(`${LANGGRAPH_API_URL}/langgraph/initial_suggestions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    topics: mergedTopics,
                    recent_locations: recentLocations,
                    language: language
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setInitialData(data);
                if (messages.length === 0 || forceSet) setSuggestions(data.suggestions || []);
            }
        } catch (e) {
            console.error('Initial suggestions failed:', e);
        }
    }, [user?.id, messages.length, preferences]);

    // refreshSuggestions: location-context or fallback
    const refreshSuggestions = useCallback(async () => {
        if (!user?.id) return;

        // KHI VÀO ĐOẠN CHAT TRỐNG => Dùng Suggest Toàn cục (Global - Histogram)
        if (messages.length === 0) {
            await fetchInitialSuggestions(undefined, true);
            return;
        }

        // KHI VÀO CHAT ĐÃ CÓ CONVERSATION => Dùng Suggest Cục bộ (Local - Context)
        const locations = recentLocations.slice(0, 3);
        const userMsgs = messages.filter(m => m.role === 'user').slice(-5).map(m => m.content);
        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && !m.isLoading);
        const lastResponse = lastAssistant?.content?.slice(0, 500) || '';

        try {
            const res = await fetch(`${LANGGRAPH_API_URL}/langgraph/contextual_suggestions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    locations: locations, // Có thể rỗng, DB Backend tự linh hoạt fallback sang user_msgs 
                    limit: 4,
                    user_messages: userMsgs,
                    last_response: lastResponse,
                    language: language
                }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.suggestions?.length > 0) {
                    setSuggestions(data.suggestions);
                    return;
                }
            }
        } catch (e) {
            console.warn('Refresh contextual suggestions error:', e);
        }
    }, [user?.id, messages, recentLocations, fetchInitialSuggestions]);

    // clearMessages
    const clearMessages = useCallback(() => {
        if (messages.length === 0 && sidRef.current) {
            fetch(`${LANGGRAPH_API_URL}/langgraph/sessions/cleanup/${sidRef.current}`, {
                method: 'DELETE'
            }).catch(e => console.warn('Failed to cleanup empty session:', e));
        }
        setMessages([]);
        setSuggestions([]);
        sidRef.current = crypto.randomUUID();
    }, [messages.length]);

    // updateFeedback
    const updateFeedback = useCallback(async (messageId: string, score: number) => {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedbackScore: score } : m));

        const msg = messages.find(m => m.id === messageId);
        if (msg && user?.id) {
            await supabase.from('chat_logs')
                .update({ feedback_score: score })
                .eq('user_id', user.id)
                .eq('session_id', sidRef.current)
                .eq('role', msg.role)
                .ilike('message', msg.content.slice(0, 100) + '%')
                .then(() => { });
        }
    }, [messages, user?.id]);

    // switchSession
    const switchSession = useCallback((newSid: string) => {
        if (messages.length > 0 && !messages.some(m => m.isLoading)) {
            sessionMessagesCache[sidRef.current] = messages;
        }
        // Let the useEffect handle the actual loading, we just cache the current
    }, [messages]);

    return {
        messages,
        isLoading,
        suggestions,
        error,
        sendMessage,
        refreshSuggestions,
        clearMessages,
        updateFeedback,
        switchSession,
        sessionId: sidRef.current,
        fetchInitialSuggestions,
        initialData,
        modelMode,
        setModelMode,
        preferences,
        recentLocations,
    };
}
