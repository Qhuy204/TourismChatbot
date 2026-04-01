/**
 * useSessionManager - Manage multiple chat sessions
 * 
 * Features:
 * - Create/Delete sessions
 * - Rename sessions
 * - Pin important sessions
 * - Persist to localStorage
 * - Memory sharing toggle
 */
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export interface ChatSession {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    isPinned: boolean;
    messageCount: number;
    preview: string; // Last message preview
}

interface SessionManagerState {
    sessions: ChatSession[];
    activeSessionId: string | null;
    memoryShareEnabled: boolean;
}

const LANGGRAPH_API_URL = import.meta.env.VITE_LANGGRAPH_API_URL || 'http://localhost:8000';
const MEMORY_KEY = 'chatbot_memory_share';

export function useSessionManager() {
    const { user } = useAuth();
    const [state, setState] = useState<SessionManagerState>(() => {
        // Synchronous restoration from localStorage if possible
        // However, useAuth might not be ready yet. Let's try to get the last known user ID from localStorage keys.
        let savedActiveSessionId: string | null = null;
        const keys = Object.keys(localStorage);
        const activeSessionKey = keys.find(k => k.startsWith('active_session_'));
        if (activeSessionKey) {
            savedActiveSessionId = localStorage.getItem(activeSessionKey);
        }

        // If explicitly at /chat/ or /chat, don't restore old session
        const isNewChatRoute = typeof window !== 'undefined' && (window.location.pathname === '/chat' || window.location.pathname === '/chat/');

        return {
            sessions: [],
            activeSessionId: isNewChatRoute ? null : savedActiveSessionId,
            memoryShareEnabled: false,
        };
    });
    const [isLoading, setIsLoading] = useState(true);

    // Load from Backend on mount or user change
    useEffect(() => {
        if (!user?.id) {
            setIsLoading(false);
            return;
        }

        const fetchSessions = async () => {
            setIsLoading(true);
            try {
                // FIX #8: Include auth token so backend can verify ownership
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/sessions/${user.id}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                });
                if (!response.ok) throw new Error('Failed to fetch sessions');
                const data = await response.json();

                const sessions: ChatSession[] = (data.sessions || []).map((s: any) => ({
                    id: s.id,
                    name: s.title,
                    createdAt: new Date(s.created_at),
                    updatedAt: new Date(s.updated_at),
                    isPinned: s.is_pinned || false,
                    messageCount: s.message_count || 0,
                    preview: s.first_message || '',
                }));

                // Restore last active session from localStorage (per-user scoped)
                const savedActiveSession = localStorage.getItem(`active_session_${user.id}`);

                // Allow activeSessionId to stay even if not in fetched list (it might be a new unsaved session)
                const restoredSessionId = savedActiveSession;

                setState(prev => ({
                    ...prev,
                    sessions,
                    activeSessionId: restoredSessionId,
                }));
            } catch (e) {
                console.error('Failed to load sessions:', e);
            } finally {
                setIsLoading(false);
            }
        };

        const memoryShare = localStorage.getItem(`${MEMORY_KEY}_${user.id}`);
        if (memoryShare) {
            setState(prev => ({ ...prev, memoryShareEnabled: memoryShare === 'true' }));
        }

        fetchSessions();
    }, [user?.id]);

    // Persist memory share to localStorage (keep it local for now)
    useEffect(() => {
        if (!user?.id) return;
        localStorage.setItem(`${MEMORY_KEY}_${user.id}`, String(state.memoryShareEnabled));
    }, [state.memoryShareEnabled, user?.id]);

    // Persist active session to localStorage
    useEffect(() => {
        if (!user?.id) return;
        if (state.activeSessionId) {
            localStorage.setItem(`active_session_${user.id}`, state.activeSessionId);
        } else {
            localStorage.removeItem(`active_session_${user.id}`);
        }
    }, [state.activeSessionId, user?.id]);

    // Create new session - local only
    const createSession = useCallback(() => {
        setState(prev => ({
            ...prev,
            activeSessionId: null,
        }));
        return null;
    }, []);

    // Explicitly Register session to Backend (call this on first message)
    const registerSession = useCallback(async (sessionId: string, title: string, firstMessage?: string) => {
        if (!user?.id) return false;

        try {
            const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    session_id: sessionId,
                    title: title,
                    first_message: firstMessage
                }),
            });

            if (!response.ok) throw new Error('Failed to register session');

            // Add to local list if not present
            setState(prev => {
                if (prev.sessions.some(s => s.id === sessionId)) return prev;

                const newSession: ChatSession = {
                    id: sessionId,
                    name: title,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isPinned: false,
                    messageCount: 1,
                    preview: firstMessage || '',
                };
                return {
                    ...prev,
                    sessions: [newSession, ...prev.sessions]
                };
            });
            return true;
        } catch (e) {
            console.error('Register session error:', e);
            return false;
        }
    }, [user?.id]);

    // Delete session via Backend
    const deleteSession = useCallback(async (sessionId: string) => {
        if (!user?.id) return;

        try {
            // FIX #8: Include auth token so backend can verify ownership
            const { data: { session: authSession } } = await supabase.auth.getSession();
            const token = authSession?.access_token;
            const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            });

            if (!response.ok) throw new Error('Failed to delete session');

            setState(prev => {
                const newSessions = prev.sessions.filter(s => s.id !== sessionId);
                const newActiveId = prev.activeSessionId === sessionId
                    ? (newSessions[0]?.id || null)
                    : prev.activeSessionId;

                return {
                    ...prev,
                    sessions: newSessions,
                    activeSessionId: newActiveId,
                };
            });
        } catch (e) {
            console.error('Delete session error:', e);
        }
    }, [user?.id]);

    // Rename session via Backend
    const renameSession = useCallback(async (sessionId: string, newName: string) => {
        if (!user?.id) return;

        try {
            const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    session_id: sessionId,
                    title: newName,
                }),
            });

            if (!response.ok) throw new Error('Failed to rename session');

            setState(prev => ({
                ...prev,
                sessions: prev.sessions.map(s =>
                    s.id === sessionId ? { ...s, name: newName, updatedAt: new Date() } : s
                ),
            }));
        } catch (e) {
            console.error('Rename session error:', e);
        }
    }, [user?.id]);

    // Pin/Unpin session (Backend doesn't support yet, keeping local or adding to API soon)
    const togglePin = useCallback((sessionId: string) => {
        // For now just local until we add is_pinned to chat_sessions table
        setState(prev => ({
            ...prev,
            sessions: prev.sessions.map(s =>
                s.id === sessionId ? { ...s, isPinned: !s.isPinned, updatedAt: new Date() } : s
            ),
        }));
    }, []);

    // Set active session
    const setActiveSession = useCallback((sessionId: string | null) => {
        setState(prev => ({ ...prev, activeSessionId: sessionId }));
    }, []);

    // Update session metadata (local update after message send)
    const updateSessionMeta = useCallback((sessionId: string, messageCount: number, preview: string) => {
        setState(prev => ({
            ...prev,
            sessions: prev.sessions.map(s =>
                s.id === sessionId ? { ...s, messageCount, preview, updatedAt: new Date() } : s
            ),
        }));
    }, []);

    // Toggle memory sharing
    const toggleMemoryShare = useCallback(() => {
        setState(prev => ({ ...prev, memoryShareEnabled: !prev.memoryShareEnabled }));
    }, []);

    // Get sorted sessions (pinned first, then by date)
    const sortedSessions = [...state.sessions].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    return {
        sessions: sortedSessions,
        activeSessionId: state.activeSessionId,
        memoryShareEnabled: state.memoryShareEnabled,
        isLoading,
        createSession,
        registerSession,
        deleteSession,
        renameSession,
        togglePin,
        setActiveSession,
        updateSessionMeta,
        toggleMemoryShare,
    };
}
