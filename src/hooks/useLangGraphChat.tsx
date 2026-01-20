/**
 * useLangGraphChat - Hook for interacting with LangGraph backend
 * 
 * Supports session switching and memory sharing.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
    debug?: {
        rewrite_method?: string;
        is_relevant?: boolean;
        context_count?: number;
        model_used?: string;
        retrieved_sources?: any[];
    };
}

// Session storage for messages
const sessionMessagesCache: Record<string, ChatMessage[]> = {};

export function useLangGraphChat(initialSessionId?: string) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const sessionIdRef = useRef<string>(initialSessionId || crypto.randomUUID());

    // Load messages from cache when session changes
    useEffect(() => {
        if (initialSessionId) {
            sessionIdRef.current = initialSessionId;
            const cached = sessionMessagesCache[initialSessionId];
            setMessages(cached || []);
            setSuggestions([]);
        }
    }, [initialSessionId]);

    // Save messages to cache on change
    useEffect(() => {
        if (messages.length > 0 && !messages.some(m => m.isLoading)) {
            sessionMessagesCache[sessionIdRef.current] = messages;
        }
    }, [messages]);

    /**
     * Send a message to LangGraph backend
     */
    const sendMessage = useCallback(async (
        content: string,
        attachments?: Array<{ url: string; type: string; name?: string }>,
        memoryShareEnabled: boolean = false
    ) => {
        if (!content.trim() || !user?.id) return;

        setError(null);

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

            // Call LangGraph API
            const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: memoryShareEnabled ? user.id : `${user.id}_${sessionIdRef.current}`,
                    session_id: sessionIdRef.current,
                    message: content.trim(),
                    history: history,
                }),
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data: LangGraphResponse = await response.json();
            console.log('LangGraph API response:', data);

            // Replace loading message with actual response
            const assistantMessage: ChatMessage = {
                id: loadingMessage.id,
                role: 'assistant',
                content: data.response || (data.intent === 'guard_violation' ? 'Xin lỗi, tôi chỉ có thể trả lời các câu hỏi về du lịch Việt Nam.' : 'Xin lỗi, tôi không tìm thấy câu trả lời phù hợp.'),
                timestamp: new Date(),
                emotion: data.emotion_detected,
                intent: data.intent,
            };

            setMessages(prev =>
                prev.map(m => m.id === loadingMessage.id ? assistantMessage : m)
            );

            // Update suggestions
            setSuggestions(data.suggested_prompts || []);

            // Debug logging
            if (data.debug) {
                const debugData = data.debug as any;
                console.log('🔍 LangGraph Debug Info:', debugData);
                if (debugData.retrieved_sources && debugData.retrieved_sources.length > 0) {
                    console.group('📚 retrieval data details:');
                    debugData.retrieved_sources.forEach((s: any, idx: number) => {
                        console.log(`--- Source #${idx + 1} [${s.image_id}] (Score: ${s.score}) ---`);
                        console.log(`Question: ${s.q}`);
                        console.log(`Answer: ${s.a}`);
                    });
                    console.groupEnd();
                }
            }

        } catch (err) {
            console.error('LangGraph API error:', err);
            setError(err instanceof Error ? err.message : 'Failed to send message');

            // Remove loading message on error
            setMessages(prev => prev.filter(m => m.id !== loadingMessage.id));
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, messages]);

    /**
     * Refresh suggestions without sending a message
     */
    const refreshSuggestions = useCallback(async () => {
        if (!user?.id) return;

        try {
            const currentTexts = suggestions.map(s => s.text);

            const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/suggestions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: user.id,
                    session_id: sessionIdRef.current,
                    exclude: currentTexts,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setSuggestions(data.suggestions || []);
            }
        } catch (err) {
            console.error('Failed to refresh suggestions:', err);
        }
    }, [user?.id, suggestions]);

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
    };
}
