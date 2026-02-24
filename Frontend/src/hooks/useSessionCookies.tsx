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
    // Enhanced tracking
    topicCounts?: Record<string, number>; // { 'beach': 5, 'Đà Nẵng': 3 }
    askedTopics?: string[];               // Keep for backward compatibility/quick access
    questionCount?: number;
    recentLocations?: string[];           // Locations from last response (max 5)
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
const COOKIE_EXPIRY = 30; // days
const LONG_TERM_EXPIRY = 365; // days

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
        if (!preferences.askedTopics) preferences.askedTopics = [];
        if (!preferences.questionCount) preferences.questionCount = 0;

        // Save initial prefs to cookie so it exists immediately
        Cookies.set(PREFS_COOKIE, JSON.stringify(preferences), {
            expires: COOKIE_EXPIRY,
            sameSite: 'Lax'
        });

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

    // Track topic from user's message for recommendations
    const trackTopic = useCallback((
        text: string,
        isLocation: boolean = false,
        meta?: { city?: string; province?: string; adminId?: string }
    ) => {
        const detected: string[] = [];
        const lowerText = text.toLowerCase();

        // 1. Expanded Category Mapping
        const categoryMap: Record<string, string[]> = {
            'beach': ['biển', 'bãi tắm', 'đảo', 'vịnh', 'beach', 'island'],
            'mountain': ['núi', 'rừng', 'đèo', 'cao nguyên', 'mountain', 'trekking'],
            'food': ['ăn', 'uống', 'ẩm thực', 'đặc sản', 'nhà hàng', 'quán', 'hải sản', 'food', 'seafood', 'mì quảng', 'bánh đa cua'],
            'itinerary': ['lịch trình', 'tour', 'đi đâu', 'chơi gì', 'kế hoạch'],
            'accommodation': ['khách sạn', 'hotel', 'resort', 'homestay', 'nhà nghỉ', 'ở đâu'],
            'heritage': ['di tích', 'lịch sử', 'văn hóa', 'bảo tàng', 'phố cổ', 'heritage', 'history']
        };

        Object.entries(categoryMap).forEach(([cat, keywords]) => {
            if (keywords.some(kw => lowerText.includes(kw))) {
                detected.push(cat);
            }
        });

        // 2. Comprehensive Vietnamese Provinces (63 Provinces)
        const provinces = [
            'An Giang', 'Bà Rịa - Vũng Tàu', 'Bắc Giang', 'Bắc Kạn', 'Bạc Liêu', 'Bắc Ninh', 'Bến Tre', 'Bình Định', 'Bình Dương', 'Bình Phước', 'Bình Thuận', 'Cà Mau', 'Cần Thơ', 'Cao Bằng', 'Đà Nẵng', 'Đắk Lắk', 'Đắk Nông', 'Điện Biên', 'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Giang', 'Hà Nam', 'Hà Nội', 'Hà Tĩnh', 'Hải Dương', 'Hải Phòng', 'Hậu Giang', 'Hòa Bình', 'Hưng Yên', 'Khánh Hòa', 'Kiên Giang', 'Kon Tum', 'Lai Châu', 'Lâm Đồng', 'Lạng Sơn', 'Lào Cai', 'Long An', 'Nam Định', 'Nghệ An', 'Ninh Bình', 'Ninh Thuận', 'Phú Thọ', 'Phú Yên', 'Quảng Bình', 'Quảng Nam', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị', 'Sóc Trăng', 'Sơn La', 'Tây Ninh', 'Thái Bình', 'Thái Nguyên', 'Thanh Hóa', 'Thừa Thiên Huế', 'Tiền Giang', 'TP HCM', 'Sài Gòn', 'Trà Vinh', 'Tuyên Quang', 'Vĩnh Long', 'Vĩnh Phúc', 'Yên Bái', 'Hội An', 'Đà Lạt', 'Phú Quốc', 'Côn Đảo', 'Sapa'
        ];

        provinces.forEach(p => {
            const escapedP = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedP}\\b`, 'gi');
            if (regex.test(text)) {
                detected.push(p);
            }
        });

        // 3. Handle explicit locations with disambiguation logic
        if (isLocation) {
            let label = text;
            // Add disambiguation info if available (e.g., "Bãi Dài (Phú Quốc)")
            if (meta?.province || meta?.city) {
                const parent = (meta.city && meta.city !== text) ? meta.city : meta.province;
                if (parent) label = `${text} (${parent})`;
            }
            detected.push(label);
        }

        if (detected.length > 0) {
            console.log("🎯 Tracking interests:", detected);
            setSessionData(prev => {
                if (!prev) return null;

                const currentCounts = { ...(prev.preferences.topicCounts || {}) };

                detected.forEach(topic => {
                    // Update counts
                    currentCounts[topic] = (currentCounts[topic] || 0) + 1;
                });

                // Keep only top 15 topics based on frequency
                const sortedTopics = Object.entries(currentCounts)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([name]) => name)
                    .slice(0, 15);

                // IMPORTANT: Prune currentCounts to only keep the top 15 to prevent cookie size from exceeding 4KB
                const prunedCounts: Record<string, number> = {};
                sortedTopics.forEach(topic => {
                    prunedCounts[topic] = currentCounts[topic];
                });

                const updated = {
                    ...prev.preferences,
                    topicCounts: prunedCounts,
                    askedTopics: sortedTopics,
                    questionCount: (prev.preferences.questionCount || 0) + 1
                };

                Cookies.set(PREFS_COOKIE, JSON.stringify(updated), {
                    expires: COOKIE_EXPIRY,
                    sameSite: 'Lax'
                });
                return { ...prev, preferences: updated };
            });
        }
    }, []);

    // Update recent locations from latest response
    const updateRecentLocations = useCallback((locations: string[]) => {
        setSessionData(prev => {
            if (!prev) return null;

            const current = prev.preferences.recentLocations || [];
            const filtered = current.filter(loc => !locations.includes(loc));
            const newRecent = [...locations, ...filtered].slice(0, 10);

            const updated = {
                ...prev.preferences,
                recentLocations: newRecent
            };

            Cookies.set(PREFS_COOKIE, JSON.stringify(updated), {
                expires: COOKIE_EXPIRY,
                sameSite: 'Lax'
            });
            return { ...prev, preferences: updated };
        });
    }, []);

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
        trackTopic,
        updateRecentLocations,
        clearSession,
        hasPreviousSession,
        getPreviousSessionId,
        isLoaded
    };
}

export type { SessionData, SessionPreferences };
