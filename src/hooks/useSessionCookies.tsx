/**
 * useSessionCookies - Cookie-based session persistence
 * 
 * Persists chat session ID and preferences using cookies.
 * Handles session restoration across page reloads.
 */
import { useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';

interface FunnelState {
    step: string;
    data?: any;
    updatedAt: string;
}

interface SessionPreferences {
    theme?: 'light' | 'dark' | 'auto';
    memoryShareEnabled?: boolean;
    lastVisitedAt?: string;
    funnelState?: FunnelState;
}

interface SessionData {
    sessionId: string;
    guestId: string;
    token: string | null;
    preferences: SessionPreferences;
}

const SESSION_COOKIE = 'tc_session';
const TOKEN_COOKIE = 'tc_token';
const GUEST_COOKIE = 'tc_guest_id';
const PREFS_COOKIE = 'tc_preferences';
const COOKIE_EXPIRY = 30; // days (for session/prefs)
const LONG_TERM_EXPIRY = 365; // days (for guest_id)

export function useSessionCookies() {
    const [sessionData, setSessionData] = useState<SessionData | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load all data from cookies on mount
    useEffect(() => {
        const savedSession = Cookies.get(SESSION_COOKIE);
        const savedToken = Cookies.get(TOKEN_COOKIE);
        const savedGuestId = Cookies.get(GUEST_COOKIE);
        const savedPrefs = Cookies.get(PREFS_COOKIE);

        let sessionId = savedSession;
        let token = savedToken || null;
        let guestId = savedGuestId;
        let preferences: SessionPreferences = {};

        // 1. Handle Guest ID (Persistent identity for non-logged users)
        if (!guestId) {
            guestId = `g_${crypto.randomUUID()}`;
            Cookies.set(GUEST_COOKIE, guestId, {
                expires: LONG_TERM_EXPIRY,
                sameSite: 'Lax'
            });
        }

        // 2. Handle Session ID (Current conversation context)
        if (!sessionId) {
            sessionId = crypto.randomUUID();
            Cookies.set(SESSION_COOKIE, sessionId, {
                expires: COOKIE_EXPIRY,
                sameSite: 'Lax'
            });
        }

        // 3. Handle Preferences
        if (savedPrefs) {
            try {
                preferences = JSON.parse(savedPrefs);
            } catch {
                console.warn('Invalid preferences cookie');
            }
        }

        // Update last visit timestamp
        preferences.lastVisitedAt = new Date().toISOString();

        setSessionData({
            sessionId,
            guestId,
            token,
            preferences
        });
        setIsLoaded(true);
    }, []);

    // Save Session ID
    const saveSession = useCallback((sessionId: string) => {
        Cookies.set(SESSION_COOKIE, sessionId, { expires: COOKIE_EXPIRY, sameSite: 'Lax' });
        setSessionData(prev => prev ? { ...prev, sessionId } : null);
    }, []);

    // Save Auth Token (JWT)
    const saveToken = useCallback((token: string | null) => {
        if (token) {
            Cookies.set(TOKEN_COOKIE, token, {
                expires: COOKIE_EXPIRY,
                sameSite: 'Strict', // Higher security for tokens
                secure: window.location.protocol === 'https:'
            });
        } else {
            Cookies.remove(TOKEN_COOKIE);
        }
        setSessionData(prev => prev ? { ...prev, token } : null);
    }, []);

    // Save Preferences (including Funnel State)
    const savePreferences = useCallback((prefs: Partial<SessionPreferences>) => {
        setSessionData(prev => {
            if (!prev) return null;
            const updated = { ...prev.preferences, ...prefs };
            Cookies.set(PREFS_COOKIE, JSON.stringify(updated), {
                expires: COOKIE_EXPIRY,
                sameSite: 'Lax'
            });
            return { ...prev, preferences: updated };
        });
    }, []);

    // Update Funnel State Helper
    const setFunnelState = useCallback((step: string, data?: any) => {
        savePreferences({
            funnelState: {
                step,
                data,
                updatedAt: new Date().toISOString()
            }
        });
    }, [savePreferences]);

    // Clear everything (Logout/Reset)
    const clearSession = useCallback(() => {
        Cookies.remove(SESSION_COOKIE);
        Cookies.remove(TOKEN_COOKIE);
        Cookies.remove(GUEST_COOKIE);
        Cookies.remove(PREFS_COOKIE);

        // Re-initialize with new IDs
        const newSessionId = crypto.randomUUID();
        const newGuestId = `g_${crypto.randomUUID()}`;

        Cookies.set(SESSION_COOKIE, newSessionId, { expires: COOKIE_EXPIRY });
        Cookies.set(GUEST_COOKIE, newGuestId, { expires: LONG_TERM_EXPIRY });

        setSessionData({
            sessionId: newSessionId,
            guestId: newGuestId,
            token: null,
            preferences: { lastVisitedAt: new Date().toISOString() }
        });
    }, []);

    // Check if previous session exists
    const hasPreviousSession = useCallback((): boolean => {
        const saved = Cookies.get(SESSION_COOKIE);
        return !!saved;
    }, []);

    // Get previous session ID without restoring
    const getPreviousSessionId = useCallback((): string | null => {
        return Cookies.get(SESSION_COOKIE) || null;
    }, []);

    return {
        sessionId: sessionData?.sessionId || '',
        guestId: sessionData?.guestId || '',
        token: sessionData?.token,
        preferences: sessionData?.preferences || {},
        saveSession,
        saveToken,
        savePreferences,
        setFunnelState,
        clearSession,
        hasPreviousSession,
        getPreviousSessionId,
        isLoaded
    };
}

export type { SessionData, SessionPreferences };
