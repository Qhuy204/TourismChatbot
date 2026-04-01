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
    /** true = message is queued in line, waiting for current bot reply to finish */
    isQueued?: boolean;
    attachments?: Array<{ url: string; type: string; name: string }>;
    emotion?: string;
    intent?: string;
    /** FIX FE#3: Backend chat_log row ID, used for precise feedback updates */
    logId?: string;
}

export interface SuggestionItem {
    text: string;
    category: 'next_step' | 'personalized' | 'open_ended';
}

// Per-session message cache (avoids re-fetching on tab switch)
const sessionMessagesCache: Record<string, ChatMessage[]> = {};

export function useLangGraphChat(
    initialSessionId?: string,
    language: string = 'vi',
    options?: { onFirstMessage?: (sessionId: string, title: string, firstMessage: string) => void }
) {
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

    // Message queue: holds messages submitted while a response is streaming
    type QueuedMessage = {
        content: string;
        attachments?: Array<{ url: string; type: string; name?: string }>;
        memoryShareEnabled: boolean;
        onNewTitle?: (title: string) => void;
        overrideModelMode?: 'gemini' | 'qwen';
        language?: string;
        overrideSessionId?: string;
        /** id of the isQueued placeholder bubble to replace when this message is sent */
        queuedMsgId?: string;
    };
    const messageQueueRef = useRef<QueuedMessage[]>([]);
    const [queueLength, setQueueLength] = useState(0); // reactive indicator for UI
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

    const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
    const sidRef = useRef<string | null>(sessionId);
    const [isRegistered, setIsRegistered] = useState(false);

    // Sync ref with state
    useEffect(() => {
        sidRef.current = sessionId;
    }, [sessionId]);

    // Sync isRegistered based on sessionId availability
    useEffect(() => {
        if (sessionId) {
            // We only set isRegistered if it's already in the sessions list
            // or if it was explicitly passed as initial/saved.
            // For now, assume any existing ID is registered until known otherwise.
            setIsRegistered(true);
        } else {
            setIsRegistered(false);
        }
    }, [sessionId]);

    // Load chat history when session + auth ready
    useEffect(() => {
        const loadHistory = async (sid: string) => {
            if (!user?.id) return;
            const cached = sessionMessagesCache[sid];
            if (cached) { setMessages(cached); return; }

            setIsLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/history/${sid}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                });
                if (!response.ok) throw new Error('Failed');
                const data = await response.json();

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
        console.log('[DEBUG] useLangGraphChat: session switch DETECTED', initialSessionId);

        // If we are switching TO "New Chat" (undefined) AND we are ALREADY empty, skip to avoid infinite loops.
        if (!initialSessionId && messages.length === 0) {
            return;
        }

        // Cleanup old session if it was empty before switching
        if (messages.length === 0 && sidRef.current) {
            console.log('[DEBUG] Cleaning up old empty session:', sidRef.current);
            // This fetch is not awaited and runs in the background
            supabase.auth.getSession().then(({ data: { session } }) => {
                const token = session?.access_token;
                fetch(`${LANGGRAPH_API_URL}/langgraph/sessions/cleanup/${sidRef.current}`, {
                    method: 'DELETE',
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                }).catch(e => console.warn('Failed to cleanup empty session:', e));
            });
        }

        if (!initialSessionId) {
            console.log('[DEBUG] Switching to truly New Chat (lazy id)');
            sidRef.current = null;
            setSessionId(null);
            setMessages([]);
            setSuggestions([]);
            setIsRegistered(false);
            setError(null);
            return;
        }

        console.log('[DEBUG] Switching to existing session:', initialSessionId);
        sidRef.current = initialSessionId;
        setSessionId(initialSessionId);
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
        // This fetch is not awaited and runs in the background
        supabase.auth.getSession().then(({ data: { session } }) => {
            const token = session?.access_token;
            fetch(`${LANGGRAPH_API_URL}/langgraph/history/${initialSessionId}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            })
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
        });
    }, [initialSessionId]);

    // Cleanup empty session on component unmount
    useEffect(() => {
        return () => {
            if (messages.length === 0 && sidRef.current) {
                // Use keepalive or Beacon API if possible, but fetch is usually fine for simple unmounts
                // This fetch is not awaited and runs in the background
                supabase.auth.getSession().then(({ data: { session } }) => {
                    const token = session?.access_token;
                    fetch(`${LANGGRAPH_API_URL}/langgraph/sessions/cleanup/${sidRef.current}`, {
                        method: 'DELETE',
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                        keepalive: true
                    }).catch(() => { });
                });
            }
        };
    }, [messages.length]);

    // Persist cookies on session change
    useEffect(() => {
        if (cookiesLoaded && sidRef.current) saveSession(sidRef.current);
    }, [cookiesLoaded, saveSession]);

    // Cache messages
    useEffect(() => {
        if (messages.length > 0 && !messages.some(m => m.isLoading) && sidRef.current) {
            console.log('[DEBUG] useLangGraphChat: caching messages for', sidRef.current, 'count:', messages.length);
            sessionMessagesCache[sidRef.current] = messages;
        }
    }, [messages, sessionId]);

    // Note: Removed frontend auto-title fallback to rely entirely on backend SLM

    // Internal: executes a single send and drains the queue afterwards
    const _executeSend = useCallback(async (
        content: string,
        attachments?: Array<{ url: string; type: string; name?: string }>,
        memoryShareEnabled: boolean = false,
        onNewTitle?: (title: string) => void,
        overrideModelMode?: 'gemini' | 'qwen',
        language?: string,
        overrideSessionId?: string,
        // snapshot of messages at the time of send (needed because queue executes asynchronously)
        messagesSnapshot?: ChatMessage[],
        // if set, replace the queued placeholder with id=queuedMsgId instead of appending a new user bubble
        queuedMsgId?: string,
    ) => {
        setError(null);

        let currentSid = overrideSessionId || sessionId;
        let needsRegistration = !isRegistered;

        if (!currentSid) {
            currentSid = crypto.randomUUID();
            setSessionId(currentSid);
            needsRegistration = true;
        } else if (overrideSessionId && overrideSessionId !== sessionId) {
            setSessionId(overrideSessionId);
            needsRegistration = false; // Assume existing if overridden
            setIsRegistered(true);
        }

        // Register session if first message
        if (needsRegistration && options?.onFirstMessage) {
            options.onFirstMessage(currentSid, 'Cuộc hội thoại mới', content.trim());
            setIsRegistered(true);
        }

        // Track topic for histogram-based recommendations
        trackTopic(content.trim());

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

        // Use snapshot for history (to account for concurrent queue processing)
        let historyForRequest: { role: string; content: string }[] = [];
        setMessages(prev => {
            const base = messagesSnapshot ?? prev;
            historyForRequest = base
                .filter(m => !m.isLoading && !m.isQueued)
                .map(m => ({ role: m.role, content: m.content }));

            if (queuedMsgId) {
                // Replace the queued placeholder bubble — upgrade it from pending to sent
                const upgraded = prev.map(m =>
                    m.id === queuedMsgId ? { ...userMsg, id: queuedMsgId, isQueued: false } : m
                );
                return [...upgraded, loadingMsg];
            }
            return [...prev, userMsg, loadingMsg];
        });
        setIsLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const res = await fetch(`${LANGGRAPH_API_URL}/langgraph/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    user_id: user!.id,
                    session_id: currentSid,
                    message: content.trim(),
                    history: historyForRequest,
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
            // FIX FE#1: Buffer for incomplete SSE lines split across chunk boundaries
            let sseBuffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });
                // Split on newlines but only process complete lines
                const lines = sseBuffer.split('\n');
                // The last element may be an incomplete line — keep it in the buffer
                sseBuffer = lines.pop() ?? '';

                for (const line of lines) {
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
                            // FIX FE#2: Always clear isLoading on 'final', even if no content arrived
                            setMessages(prev => prev.map(m =>
                                m.id === loadingMsg.id
                                    ? { ...m, isLoading: false, logId: data.log_id ?? undefined }
                                    : m
                            ));
                            setSuggestions(data.suggested_prompts || []);

                            if (data.new_title && onNewTitle) onNewTitle(data.new_title);

                            if (data.extracted_locations?.length > 0) {
                                const locationNames: string[] = data.extracted_locations.map((loc: Record<string, string>) => loc.name);
                                setRecentLocations(locationNames.slice(0, 3));
                                updateRecentLocations(locationNames);

                                data.extracted_locations.forEach((loc: Record<string, string>) => {
                                    trackTopic(loc.name, true, {
                                        city: loc.city,
                                        province: loc.province,
                                        adminId: loc.admin_id,
                                    });
                                });
                            }
                        } else if (data.type === 'error') {
                            // FIX FE#2: Always clear isLoading on 'error'
                            setMessages(prev => prev.map(m =>
                                m.id === loadingMsg.id ? { ...m, isLoading: false } : m
                            ));
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

            // ── Drain queue: if there are queued messages, send next one ──
            const next = messageQueueRef.current.shift();
            setQueueLength(messageQueueRef.current.length);
            if (next) {
                // Small tick to let React re-render before next stream starts
                setTimeout(() => {
                    _executeSend(
                        next.content,
                        next.attachments,
                        next.memoryShareEnabled,
                        next.onNewTitle,
                        next.overrideModelMode,
                        next.language,
                        next.overrideSessionId,
                        undefined, // messagesSnapshot
                        next.queuedMsgId, // replace placeholder bubble
                    );
                }, 0);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, modelMode, trackTopic, updateRecentLocations]);

    // sendMessage: public API — queues if busy, sends immediately if idle
    const sendMessage = useCallback(async (
        content: string,
        attachments?: Array<{ url: string; type: string; name?: string }>,
        memoryShareEnabled: boolean = false,
        onNewTitle?: (title: string) => void,
        overrideModelMode?: 'gemini' | 'qwen',
        language?: string,
        overrideSessionId?: string,
    ) => {
        if (!content.trim() || !user?.id) return;

        if (isLoading) {
            // Bot is busy → enqueue for later
            const queuedMsgId = `queued-${crypto.randomUUID()}`;
            messageQueueRef.current.push({
                content,
                attachments,
                memoryShareEnabled,
                onNewTitle,
                overrideModelMode,
                language,
                overrideSessionId,
                queuedMsgId,
            });
            setQueueLength(messageQueueRef.current.length);

            // Show queued user message immediately in UI (grayed out / pending badge)
            setMessages(prev => [...prev, {
                id: queuedMsgId,
                role: 'user',
                content: content.trim(),
                timestamp: new Date(),
                attachments: attachments?.map(a => ({ url: a.url, type: a.type, name: a.name || 'file' })),
                isQueued: true,
            } as ChatMessage]);
            return;
        }

        // Bot is free → send immediately
        await _executeSend(
            content, attachments, memoryShareEnabled, onNewTitle,
            overrideModelMode, language, overrideSessionId,
        );
    }, [user?.id, isLoading, _executeSend]);

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
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/initial_suggestions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    user_id: user.id,
                    topics: mergedTopics,
                    recent_locations: recentLocations,
                    language: language
                }),
            });
            if (response.ok) {
                const data = await response.json();
                setInitialData(data);
                if (messages.length === 0 || forceSet) setSuggestions(data.suggestions || []);
            }
        } catch (e) {
            console.error('Initial suggestions failed:', e);
        }
    }, [user?.id, language, preferences]);

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
    }, [user?.id, recentLocations, fetchInitialSuggestions, language]);

    // clearMessages
    const clearMessages = useCallback(() => {
        if (messages.length === 0 && sidRef.current) {
            supabase.auth.getSession().then(({ data: { session } }) => {
                const token = session?.access_token;
                fetch(`${LANGGRAPH_API_URL}/langgraph/sessions/cleanup/${sidRef.current}`, {
                    method: 'DELETE',
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                }).catch(e => console.warn('Failed to cleanup empty session:', e));
            });
        }
        setMessages([]);
        setSuggestions([]);

        setSessionId(null);
        setIsRegistered(false);
    }, [messages.length]);

    // updateFeedback
    const updateFeedback = useCallback(async (messageId: string, score: number) => {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedbackScore: score } : m));

        const msg = messages.find(m => m.id === messageId);
        if (msg && user?.id && sidRef.current) {
            if (msg.logId) {
                // FIX FE#3: Update by exact DB row ID instead of content prefix match
                await supabase.from('chat_logs')
                    .update({ feedback_score: score })
                    .eq('id', msg.logId);
            } else {
                // Fallback for old messages without logId stored
                await supabase.from('chat_logs')
                    .update({ feedback_score: score })
                    .eq('user_id', user.id)
                    .eq('session_id', sidRef.current)
                    .eq('role', msg.role)
                    .ilike('message', msg.content.slice(0, 100) + '%');
            }
        }
    }, [messages, user?.id]);

    // switchSession
    const switchSession = useCallback((newSid: string) => {
        if (messages.length > 0 && !messages.some(m => m.isLoading) && sidRef.current) {
            sessionMessagesCache[sidRef.current] = messages;
        }
        // Let the useEffect handle the actual loading
    }, [messages]);

    return {
        messages,
        isLoading,
        queueLength,
        suggestions,
        error,
        sendMessage,
        refreshSuggestions,
        clearMessages,
        updateFeedback,
        switchSession,
        sessionId,
        fetchInitialSuggestions,
        initialData,
        modelMode,
        setModelMode,
        preferences,
        recentLocations,
    };
}
