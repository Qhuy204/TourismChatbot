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

const STORAGE_KEY = 'chatbot_sessions';
const MEMORY_KEY = 'chatbot_memory_share';

export function useSessionManager() {
    const { user } = useAuth();
    const [state, setState] = useState<SessionManagerState>({
        sessions: [],
        activeSessionId: null,
        memoryShareEnabled: false,
    });

    // Load from localStorage on mount
    useEffect(() => {
        if (!user?.id) return;

        const stored = localStorage.getItem(`${STORAGE_KEY}_${user.id}`);
        const memoryShare = localStorage.getItem(`${MEMORY_KEY}_${user.id}`);

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setState(prev => ({
                    ...prev,
                    sessions: parsed.sessions.map((s: any) => ({
                        ...s,
                        createdAt: new Date(s.createdAt),
                        updatedAt: new Date(s.updatedAt),
                    })),
                    activeSessionId: parsed.activeSessionId,
                }));
            } catch (e) {
                console.error('Failed to parse sessions:', e);
            }
        }

        if (memoryShare) {
            setState(prev => ({ ...prev, memoryShareEnabled: memoryShare === 'true' }));
        }
    }, [user?.id]);

    // Persist to localStorage on change
    useEffect(() => {
        if (!user?.id) return;

        localStorage.setItem(`${STORAGE_KEY}_${user.id}`, JSON.stringify({
            sessions: state.sessions,
            activeSessionId: state.activeSessionId,
        }));
        localStorage.setItem(`${MEMORY_KEY}_${user.id}`, String(state.memoryShareEnabled));
    }, [state, user?.id]);

    // Create new session
    const createSession = useCallback((name?: string) => {
        const newSession: ChatSession = {
            id: crypto.randomUUID(),
            name: name || `Cuộc trò chuyện ${state.sessions.length + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            isPinned: false,
            messageCount: 0,
            preview: '',
        };

        setState(prev => ({
            ...prev,
            sessions: [newSession, ...prev.sessions],
            activeSessionId: newSession.id,
        }));

        return newSession.id;
    }, [state.sessions.length]);

    // Delete session
    const deleteSession = useCallback((sessionId: string) => {
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
    }, []);

    // Rename session
    const renameSession = useCallback((sessionId: string, newName: string) => {
        setState(prev => ({
            ...prev,
            sessions: prev.sessions.map(s =>
                s.id === sessionId ? { ...s, name: newName, updatedAt: new Date() } : s
            ),
        }));
    }, []);

    // Pin/Unpin session
    const togglePin = useCallback((sessionId: string) => {
        setState(prev => ({
            ...prev,
            sessions: prev.sessions.map(s =>
                s.id === sessionId ? { ...s, isPinned: !s.isPinned, updatedAt: new Date() } : s
            ),
        }));
    }, []);

    // Set active session
    const setActiveSession = useCallback((sessionId: string) => {
        setState(prev => ({ ...prev, activeSessionId: sessionId }));
    }, []);

    // Update session metadata (message count, preview)
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
        createSession,
        deleteSession,
        renameSession,
        togglePin,
        setActiveSession,
        updateSessionMeta,
        toggleMemoryShare,
    };
}
