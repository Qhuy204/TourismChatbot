/**
 * useLangGraphChat - Hook for interacting with LangGraph backend
 * 
 * Supports session switching, memory sharing, and cookie-based persistence.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionCookies } from '@/hooks/useSessionCookies';
import { supabase } from '@/integrations/supabase/client';

// API Configuration
const LANGGRAPH_API_URL = import.meta.env.VITE_LANGGRAPH_API_URL || 'http://localhost:8000';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    feedbackScore?: number | null;
    isLoading?: boolean;
    attachments?: Array<{ url: string; type: string; name: string }>;
    // LangGraph metadata
    emotion?: string;
    intent?: string;
}

export interface SuggestionItem {
    text: string;
    category: 'next_step' | 'personalized' | 'open_ended';
}

interface LangGraphResponse {
    response: string;
    suggested_prompts: SuggestionItem[];
    emotion_detected: string;
    intent: string;
    memory_updated: boolean;
    new_title?: string | null;
    debug?: {
        rewrite_method?: string;
        is_relevant?: boolean;
        context_count?: number;
        model_used?: string;
        retrieved_sources?: any[];
    };
    extracted_locations?: any[];
}

// Session storage for messages
const sessionMessagesCache: Record<string, ChatMessage[]> = {};

export function useLangGraphChat(initialSessionId?: string) {
    const { user } = useAuth();
    const {
        sessionId: savedSessionId,
        saveSession,
        trackTopic,
        updateRecentLocations,
        preferences,
        isLoaded: cookiesLoaded
    } = useSessionCookies();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
    const [recentLocations, setRecentLocations] = useState<string[]>([]);
    const [initialData, setInitialData] = useState<{ welcome_message: string; suggestions: SuggestionItem[] } | null>(null);
    const [modelMode, setModelMode] = useState<'gemini' | 'qwen'>('gemini');
    const [error, setError] = useState<string | null>(null);

    // Use: provided initialSessionId > saved cookie session > generate new
    const sessionIdRef = useRef<string>(
        initialSessionId || savedSessionId || crypto.randomUUID()
    );

    // Sync session from Backend when loaded
    useEffect(() => {
        const loadHistory = async (sid: string) => {
            if (!user?.id) return;

            setIsLoading(true);
            // Check cache first
            const cached = sessionMessagesCache[sid];
            if (cached) {
                setMessages(cached);
                setIsLoading(false);
                return;
            }

            // Otherwise load from Backend
            try {
                const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/history/${sid}`);
                if (!response.ok) throw new Error('Failed to fetch history');
                const data = await response.json();

                if (data.history && data.history.length > 0) {
                    const loadedMessages: ChatMessage[] = data.history.map((log: any) => ({
                        id: log.id.toString(),
                        role: log.role as 'user' | 'assistant',
                        content: log.message,
                        timestamp: new Date(log.created_at),
                        emotion: log.role === 'assistant' ? log.context?.emotion : undefined,
                        intent: log.role === 'assistant' ? log.context?.intent : undefined,
                    }));
                    setMessages(loadedMessages);
                    sessionMessagesCache[sid] = loadedMessages;
                } else {
                    setMessages([]);
                }
            } catch (err) {
                console.error('Failed to load session history:', err);
                setError('Không thể tải lịch sử cuộc trò chuyện');
            } finally {
                setIsLoading(false);
            }
        };

        if (cookiesLoaded && sidRef.current) {
            loadHistory(sidRef.current);
        }
    }, [cookiesLoaded, user?.id]);

    // Handle initialSessionId changes (switching sessions)
    const sidRef = useRef(initialSessionId || savedSessionId);
    useEffect(() => {
        if (initialSessionId && initialSessionId !== sidRef.current) {
            sidRef.current = initialSessionId;
            // The first useEffect will trigger history loading if sidRef changes
            // But we need to ensure local state is cleared/updated
            setSuggestions([]);
            setError(null);

            // Re-run history load (implicitly via dependency)
            const loadHistory = async (sid: string) => {
                const cached = sessionMessagesCache[sid];
                if (cached) {
                    setMessages(cached);
                    return;
                }
                setIsLoading(true);
                try {
                    const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/history/${sid}`);
                    const data = await response.json();
                    const msgs = (data.history || []).map((log: any) => ({
                        id: log.id.toString(),
                        role: log.role as 'user' | 'assistant',
                        content: log.message,
                        timestamp: new Date(log.created_at),
                    }));
                    setMessages(msgs);
                    sessionMessagesCache[sid] = msgs;
                } catch (e) { console.error(e); }
                finally { setIsLoading(false); }
            };
            loadHistory(initialSessionId);
        }
    }, [initialSessionId]);

    // Save session to cookie when it changes
    useEffect(() => {
        if (cookiesLoaded && sidRef.current) {
            saveSession(sidRef.current);
        }
    }, [cookiesLoaded, saveSession, sidRef.current]);

    // Save messages to cache on change
    useEffect(() => {
        if (messages.length > 0 && !messages.some(m => m.isLoading)) {
            sessionMessagesCache[sidRef.current] = messages;
        }
    }, [messages]);

    /**
     * Send a message to LangGraph backend
     */
    const sendMessage = useCallback(async (
        content: string,
        attachments?: Array<{ url: string; type: string; name?: string }>,
        memoryShareEnabled: boolean = false,
        onNewTitle?: (title: string) => void,
        overrideModelMode?: 'gemini' | 'qwen'
    ) => {
        if (!content.trim() || !user?.id) return;

        setError(null);
        const currentSid = sidRef.current; // Use ref to ensure consistency

        // Track topic for recommendations in cookies
        trackTopic(content.trim());

        console.log(`📡 Sending chat request: mode=${overrideModelMode || modelMode}, session=${currentSid}`);

        // Add user message immediately
        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date(),
            attachments: attachments?.map(a => ({
                url: a.url,
                type: a.type,
                name: a.name || 'file',
            })),
        };
        setMessages(prev => [...prev, userMessage]);

        // Add loading message
        const loadingMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isLoading: true,
        };
        setMessages(prev => [...prev, loadingMessage]);
        setIsLoading(true);

        try {
            // Build history for API
            const history = messages
                .filter(m => !m.isLoading)
                .map(m => ({
                    role: m.role,
                    content: m.content,
                }));

            // Call LangGraph Streaming API
            const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user.id,
                    session_id: currentSid,
                    message: content.trim(),
                    history: history,
                    memory_scope: memoryShareEnabled ? 'global' : 'session',
                    model_mode: overrideModelMode || modelMode,
                }),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) throw new Error('No reader found');

            let assistantContent = '';
            let metadata: any = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.type === 'metadata') {
                                metadata = data;
                                setMessages(prev => prev.map(m =>
                                    m.id === loadingMessage.id
                                        ? { ...m, emotion: data.emotion, intent: data.intent }
                                        : m
                                ));
                            } else if (data.type === 'content') {
                                assistantContent += data.content;
                                setMessages(prev => prev.map(m =>
                                    m.id === loadingMessage.id
                                        ? { ...m, content: assistantContent, isLoading: false }
                                        : m
                                ));
                            } else if (data.type === 'final') {
                                setSuggestions(data.suggested_prompts || []);

                                // Handle session title update if provided
                                if (data.new_title && onNewTitle) {
                                    onNewTitle(data.new_title);
                                }

                                // Handle extracted locations - save to recentLocations for contextual suggestions
                                if (data.extracted_locations && data.extracted_locations.length > 0) {
                                    const locationNames = data.extracted_locations.map((loc: any) => loc.name);
                                    setRecentLocations(locationNames.slice(0, 3)); // Keep top 3 recent locations
                                    updateRecentLocations(locationNames.slice(0, 5)); // Persist to cookies

                                    // Fetch AI-generated contextual suggestions (async, non-blocking)
                                    fetch(`${LANGGRAPH_API_URL}/langgraph/contextual_suggestions`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            locations: locationNames.slice(0, 3),
                                            last_question: userMessage.content,
                                            limit: 4
                                        })
                                    })
                                        .then(res => res.json())
                                        .then(result => {
                                            if (result.suggestions && result.suggestions.length > 0) {
                                                // Merge AI contextual + general suggestions
                                                setSuggestions(prev => {
                                                    const aiSuggestions = data.suggested_prompts || prev;
                                                    return [...result.suggestions, ...aiSuggestions.slice(0, 1)].slice(0, 5);
                                                });
                                            }
                                        })
                                        .catch(err => console.warn('Contextual suggestions error:', err));

                                    data.extracted_locations.forEach((loc: any) => {
                                        trackTopic(loc.name, true, {
                                            city: loc.city,
                                            province: loc.province,
                                            adminId: loc.admin_id
                                        });
                                    });
                                }
                            } else if (data.type === 'error') {
                                throw new Error(data.message);
                            }
                        } catch (e) {
                            console.warn('Error parsing SSE chunk:', e);
                        }
                    }
                }
            }

        } catch (err) {
            console.error('LangGraph API error:', err);
            setError(err instanceof Error ? err.message : 'Failed to send message');

            // Remove loading message on error
            setMessages(prev => prev.filter(m => m.id !== loadingMessage.id));
        } finally {
            setIsLoading(false);
            console.log('🏁 Stream finished');
        }
    }, [user?.id, messages, modelMode]);

    /**
     * Fetch personalized initial suggestions for a new session
     */
    const fetchInitialSuggestions = useCallback(async (topics?: string[]) => {
        if (!user?.id) return;

        try {
            const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/initial_suggestions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user.id,
                    topics: topics || []
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setInitialData(data);
                if (messages.length === 0) {
                    setSuggestions(data.suggestions || []);
                }
            }
        } catch (err) {
            console.error('Failed to fetch initial suggestions:', err);
        }
    }, [user?.id, messages.length]);

    /**
     * Refresh suggestions without sending a message - uses AI contextual suggestions
     */
    const refreshSuggestions = useCallback(async () => {
        if (!user?.id) return;

        try {
            // Use recentLocations from state or cookies
            const locations = recentLocations.length > 0
                ? recentLocations
                : (preferences?.recentLocations || preferences?.askedTopics?.slice(0, 3) || []);

            if (locations.length > 0) {
                // Get recent user messages for style mimicry
                const userMessages = messages
                    .filter(m => m.role === 'user')
                    .slice(-5)
                    .map(m => m.content);

                // Use AI-powered contextual suggestions
                const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/contextual_suggestions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        locations: locations.slice(0, 3),
                        limit: 4,
                        user_messages: userMessages
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.suggestions && data.suggestions.length > 0) {
                        setSuggestions(data.suggestions);
                        return;
                    }
                }
            }

            // Fallback to initial suggestions endpoint
            const fallbackResponse = await fetch(`${LANGGRAPH_API_URL}/langgraph/initial_suggestions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    topics: preferences?.askedTopics || []
                }),
            });

            if (fallbackResponse.ok) {
                const data = await fallbackResponse.json();
                setSuggestions(data.suggestions || []);
            }
        } catch (err) {
            console.error('Failed to refresh suggestions:', err);
        }
    }, [user?.id, recentLocations, preferences, messages]);

    /**
     * Clear messages and start new session
     */
    const clearMessages = useCallback(() => {
        setMessages([]);
        setSuggestions([]);
        sessionIdRef.current = crypto.randomUUID();
    }, []);

    /**
     * Update feedback for a message
     */
    const updateFeedback = useCallback(async (messageId: string, score: number) => {
        setMessages(prev =>
            prev.map(m => m.id === messageId ? { ...m, feedbackScore: score } : m)
        );

        // Also update in database
        const message = messages.find(m => m.id === messageId);
        if (message && user?.id) {
            try {
                await supabase
                    .from('chat_logs')
                    .update({ feedback_score: score })
                    .eq('user_id', user.id)
                    .eq('session_id', sessionIdRef.current)
                    .eq('role', message.role)
                    .ilike('message', message.content.slice(0, 100) + '%');
            } catch (err) {
                console.error('Failed to update feedback:', err);
            }
        }
    }, [messages, user?.id]);

    /**
     * Switch to a different session
     */
    const switchSession = useCallback((newSessionId: string) => {
        // Save current messages to cache
        if (messages.length > 0 && !messages.some(m => m.isLoading)) {
            sessionMessagesCache[sessionIdRef.current] = messages;
        }

        // Switch to new session
        sessionIdRef.current = newSessionId;
        const cached = sessionMessagesCache[newSessionId];
        setMessages(cached || []);
        setSuggestions([]);
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
        sessionId: sessionIdRef.current,
        fetchInitialSuggestions,
        initialData,
        modelMode,
        setModelMode,
        preferences,
        recentLocations
    };
}
