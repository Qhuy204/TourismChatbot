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
    const [state, setState] = useState<SessionManagerState>({
        sessions: [],
        activeSessionId: null,
        memoryShareEnabled: false,
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
                // Fetch sessions from Backend
                const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/sessions/${user.id}`);
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
                const restoredSessionId = (savedActiveSession && sessions.some(s => s.id === savedActiveSession))
                    ? savedActiveSession
                    : null;

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

    // Create new session via Backend
    const createSession = useCallback(async (name?: string) => {
        if (!user?.id) return null;

        const newId = crypto.randomUUID();
        const title = name || `Cuộc hội thoại mới`;

        try {
            const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    session_id: newId,
                    title: title,
                }),
            });

            if (!response.ok) throw new Error('Failed to create session');

            const newSession: ChatSession = {
                id: newId,
                name: title,
                createdAt: new Date(),
                updatedAt: new Date(),
                isPinned: false,
                messageCount: 0,
                preview: '',
            };

            setState(prev => ({
                ...prev,
                sessions: [newSession, ...prev.sessions],
                activeSessionId: newId,
            }));

            return newId;
        } catch (e) {
            console.error('Create session error:', e);
            return null;
        }
    }, [user?.id]);

    // Delete session via Backend
    const deleteSession = useCallback(async (sessionId: string) => {
        if (!user?.id) return;

        try {
            const response = await fetch(`${LANGGRAPH_API_URL}/langgraph/sessions/${sessionId}`, {
                method: 'DELETE',
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
        deleteSession,
        renameSession,
        togglePin,
        setActiveSession,
        updateSessionMeta,
        toggleMemoryShare,
    };
}
