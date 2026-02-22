import { useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';


// Event types with their default scores
const EVENT_SCORES: Record<string, number> = {
    page_view: 1,
    click: 2,
    search: 3,
    view_item: 3,
    bookmark: 4,
    like: 5,
    review: 8,
    chat_message: 2,
    conversion: 10,
};

// Calculate score based on duration (in ms)
function calculateDurationBonus(durationMs: number): number {
    if (durationMs < 3000) return 0;      // < 3s = lướt
    if (durationMs < 10000) return 1;     // 3-10s = quan tâm nhẹ
    if (durationMs < 30000) return 2;     // 10-30s = quan tâm
    if (durationMs < 60000) return 3;     // 30-60s = rất quan tâm
    return 5;                              // > 60s = cực kỳ quan tâm
}

// Generate a session ID (persisted for the browser session)
function getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('tracking_session_id');
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem('tracking_session_id', sessionId);
    }
    return sessionId;
}

interface ViewSession {
    objectType: string;
    objectId: string;
    startTime: number;
    page: string;
}

export interface TrackEventParams {
    eventType: string;
    eventName: string;
    page?: string;
    objectType?: string;
    objectId?: string;
    durationMs?: number;
    payload?: Record<string, unknown>;
}

export function useEventTracking() {
    const { user } = useAuth();
    const viewSessions = useRef<Map<string, ViewSession>>(new Map());

    // Core tracking function
    const trackEvent = useCallback(async (params: TrackEventParams) => {
        if (!user?.id) return;

        const baseScore = EVENT_SCORES[params.eventType] || 1;
        const durationBonus = params.durationMs ? calculateDurationBonus(params.durationMs) : 0;
        const totalScore = baseScore + durationBonus;

        try {
            const { error } = await supabase.from('user_events').insert({
                user_id: user.id,
                event_type: params.eventType,
                event_name: params.eventName,
                page: params.page || window.location.pathname,
                object_type: params.objectType || null,
                object_id: params.objectId || null,
                duration_ms: params.durationMs || null,
                score: totalScore,
                payload: (params.payload as Record<string, unknown>) || null,
                session_id: getOrCreateSessionId(),
            });

            if (error) {
                console.error('Failed to track event:', error);
            }
        } catch (err) {
            console.error('Event tracking error:', err);
        }
    }, [user?.id]);

    // Track page view
    const trackPageView = useCallback((pageName: string, additionalData?: Record<string, unknown>) => {
        trackEvent({
            eventType: 'page_view',
            eventName: `view_${pageName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
            page: window.location.pathname,
            payload: additionalData,
        });
    }, [trackEvent]);

    // Track click with optional duration
    const trackClick = useCallback((
        objectType: string,
        objectId: string,
        objectName?: string,
        additionalData?: Record<string, unknown>
    ) => {
        trackEvent({
            eventType: 'click',
            eventName: `click_${objectType}_${objectId}`.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            objectType,
            objectId,
            payload: { ...additionalData, object_name: objectName },
        });
    }, [trackEvent]);

    // Track search
    const trackSearch = useCallback((
        keyword: string,
        filters?: Record<string, unknown>,
        resultCount?: number
    ) => {
        trackEvent({
            eventType: 'search',
            eventName: `search_${keyword.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
            payload: { keyword, filters, result_count: resultCount },
        });
    }, [trackEvent]);

    // Start viewing an item (for duration tracking)
    const startViewSession = useCallback((objectType: string, objectId: string, page?: string) => {
        const sessionKey = `${objectType}_${objectId}`;
        viewSessions.current.set(sessionKey, {
            objectType,
            objectId,
            startTime: Date.now(),
            page: page || window.location.pathname,
        });
    }, []);

    // End viewing an item and record the event with duration
    const endViewSession = useCallback((objectType: string, objectId: string, objectName?: string) => {
        const sessionKey = `${objectType}_${objectId}`;
        const session = viewSessions.current.get(sessionKey);

        if (session) {
            const durationMs = Date.now() - session.startTime;
            viewSessions.current.delete(sessionKey);

            trackEvent({
                eventType: 'view_item',
                eventName: `view_${objectType}_${objectId}`.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                page: session.page,
                objectType,
                objectId,
                durationMs,
                payload: { object_name: objectName },
            });
        }
    }, [trackEvent]);

    // Track bookmark/save
    const trackBookmark = useCallback((
        objectType: string,
        objectId: string,
        objectName?: string
    ) => {
        trackEvent({
            eventType: 'bookmark',
            eventName: `bookmark_${objectType}_${objectId}`.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            objectType,
            objectId,
            payload: { object_name: objectName },
        });
    }, [trackEvent]);

    // Track chat message
    const trackChatMessage = useCallback((
        messageType: 'user' | 'assistant',
        messagePreview?: string,
        sessionId?: string
    ) => {
        trackEvent({
            eventType: 'chat_message',
            eventName: `chat_${messageType}`,
            payload: {
                message_type: messageType,
                message_preview: messagePreview?.slice(0, 100),
                chat_session_id: sessionId,
            },
        });
    }, [trackEvent]);

    // Get item click count (for analysis)
    const getItemClickCount = useCallback(async (
        objectType: string,
        objectId: string
    ): Promise<number> => {
        if (!user?.id) return 0;

        try {
            const { count, error } = await supabase
                .from('user_events')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('object_type', objectType)
                .eq('object_id', objectId)
                .in('event_type', ['click', 'view_item']);

            if (error) {
                console.error('Failed to get click count:', error);
                return 0;
            }

            return count || 0;
        } catch {
            return 0;
        }
    }, [user?.id]);

    // Get user's total interaction score for an item
    const getItemTotalScore = useCallback(async (
        objectType: string,
        objectId: string
    ): Promise<number> => {
        if (!user?.id) return 0;

        try {
            const { data, error } = await supabase
                .from('user_events')
                .select('score')
                .eq('user_id', user.id)
                .eq('object_type', objectType)
                .eq('object_id', objectId);

            if (error) {
                console.error('Failed to get total score:', error);
                return 0;
            }

            return data?.reduce((sum, row) => sum + (row.score || 0), 0) || 0;
        } catch {
            return 0;
        }
    }, [user?.id]);

    return {
        trackEvent,
        trackPageView,
        trackClick,
        trackSearch,
        trackBookmark,
        trackChatMessage,
        startViewSession,
        endViewSession,
        getItemClickCount,
        getItemTotalScore,
    };
}
