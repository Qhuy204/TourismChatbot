/**
 * useEmotionTheme — Frontend emotion detection + UI theme personalization.
 * 
 * Detects emotion from user messages (keyword-based, matching Backend logic),
 * maps emotion to UI colors, and auto-switches dark/light theme based on mood:
 * - happy/excited  → light mode + warm palette
 * - sad/frustrated → dark mode + calming palette
 * - curious/calm   → stays on current theme
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export type Emotion = 'neutral' | 'calm' | 'excited' | 'curious' | 'frustrated' | 'happy' | 'sad';

// ─── Emotion keyword maps (mirrors Backend emotion.yaml) ─────────────────────
const EMOTION_KEYWORDS: Record<Emotion, string[]> = {
    happy: [
        'tuyệt vời', 'hay quá', 'thích', 'yêu', 'wow', 'amazing', 'great', 'awesome',
        'xinh', 'đẹp', '!!', ':)', '😍', '😊', '🎉', '❤️', 'haha', 'vui',
        'tuyệt', 'ngon', 'hype', 'thích quá', 'quá đẹp', 'phê'
    ],
    excited: [
        'không thể tin', 'bất ngờ', 'OMG', 'wow', 'wow!!!', 'siêu', 'cực', 'đỉnh',
        'mê', 'idol', 'amazing', '🔥', '💥', 'phải thử', 'muốn đi ngay',
    ],
    curious: [
        '?', 'sao', 'tại sao', 'như thế nào', 'ở đâu', 'khi nào', 'có không', 'what', 'how', 'where', 'why',
        'muốn biết', 'cho hỏi', 'tôi cần', 'tư vấn', 'gợi ý',
    ],
    calm: [
        'cảm ơn', 'tốt thôi', 'bình thường', 'ổn', 'ok', 'được', 'thanks', 'thank you', 'appreciate',
    ],
    frustrated: [
        'chán', 'tệ', 'tồi', 'không tốt', 'thất vọng', 'khó chịu', 'bad', 'terrible', 'awful',
        'không hiểu', 'khó', 'sai', 'lỗi', 'không được', ':(',
    ],
    sad: [
        'buồn', 'nhớ', 'tiếc', 'đau', 'khóc', '😢', '😞', '😔', 'lonely', 'miss', 'sad', 'lost',
    ],
    neutral: [],
};

// ─── Emotion → color palette ─────────────────────────────────────────────────
export const EMOTION_PALETTES: Record<Emotion, {
    primary: string;    // CSS hex
    primaryHsl: string; // for --primary-hsl
    accent: string;
    bgCard: string;
    mode: 'light' | 'dark' | 'keep';
}> = {
    happy: {
        primary: '#f59e0b',  // amber
        primaryHsl: '38 96% 54%',
        accent: '#f97316',
        bgCard: '#fffbeb',
        mode: 'light',
    },
    excited: {
        primary: '#f97316',  // orange
        primaryHsl: '25 95% 55%',
        accent: '#ef4444',
        bgCard: '#fff7ed',
        mode: 'light',
    },
    curious: {
        primary: '#8b5cf6',  // violet-ish purple (not too bright)
        primaryHsl: '263 70% 60%',
        accent: '#06b6d4',
        bgCard: undefined as unknown as string,
        mode: 'keep',
    },
    calm: {
        primary: '#1d6de0',  // default blue
        primaryHsl: '218 78% 50%',
        accent: '#06b6d4',
        bgCard: undefined as unknown as string,
        mode: 'keep',
    },
    frustrated: {
        primary: '#64748b',  // slate, calming
        primaryHsl: '215 20% 45%',
        accent: '#94a3b8',
        bgCard: undefined as unknown as string,
        mode: 'dark',
    },
    sad: {
        primary: '#6366f1',  // indigo, introspective
        primaryHsl: '239 68% 68%',
        accent: '#818cf8',
        bgCard: undefined as unknown as string,
        mode: 'dark',
    },
    neutral: {
        primary: '#1d6de0',
        primaryHsl: '218 78% 50%',
        accent: '#06b6d4',
        bgCard: undefined as unknown as string,
        mode: 'keep',
    },
};

/**
 * Keyword-based emotion detection (fast, no network).
 */
export function detectEmotionFromText(text: string): { emotion: Emotion; confidence: number } {
    const lower = text.toLowerCase();
    const scores: Partial<Record<Emotion, number>> = {};

    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS) as [Emotion, string[]][]) {
        if (emotion === 'neutral') continue;
        const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
        if (score > 0) scores[emotion] = score;
    }

    if (Object.keys(scores).length === 0) {
        return { emotion: 'neutral', confidence: 0.5 };
    }

    const best = (Object.entries(scores) as [Emotion, number][]).sort((a, b) => b[1] - a[1])[0];
    return { emotion: best[0], confidence: Math.min(best[1] / 2, 1.0) };
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useEmotionTheme() {
    const { user } = useAuth();
    const [emotion, setEmotionState] = useState<Emotion>('neutral');
    const [emotionConfidence, setEmotionConfidence] = useState(0);
    const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load last emotion from Supabase on mount
    useEffect(() => {
        if (!user?.id) return;
        supabase
            .from('user_preferences')
            .select('last_detected_emotion, emotion_confidence')
            .eq('user_id', user.id)
            .single()
            .then(({ data }) => {
                if (data?.last_detected_emotion) {
                    setEmotionState(data.last_detected_emotion as Emotion);
                    setEmotionConfidence(data.emotion_confidence ?? 0);
                }
            });
    }, [user?.id]);

    // Apply CSS variables when emotion changes
    useEffect(() => {
        const palette = EMOTION_PALETTES[emotion] ?? EMOTION_PALETTES.neutral;
        const root = document.documentElement;
        root.style.setProperty('--primary', palette.primary);
        root.style.setProperty('--primary-accent', palette.accent);
        root.setAttribute('data-emotion', emotion);
    }, [emotion]);

    /**
     * Call this every time the user sends a message.
     * Detects emotion from message text, updates state + CSS variables,
     * and returns the detected emotion + whether theme mode should switch.
     */
    const processMessage = useCallback((text: string): { emotion: Emotion; shouldSwitchTheme: boolean; targetMode: 'light' | 'dark' | 'keep' } => {
        const { emotion: newEmotion, confidence } = detectEmotionFromText(text);
        const palette = EMOTION_PALETTES[newEmotion];

        if (newEmotion !== 'neutral') {
            setEmotionState(newEmotion);
            setEmotionConfidence(confidence);

            // Debounced persist to Supabase
            if (persistTimer.current) clearTimeout(persistTimer.current);
            persistTimer.current = setTimeout(() => {
                if (user?.id) {
                    supabase.from('user_preferences').upsert({
                        user_id: user.id,
                        last_detected_emotion: newEmotion,
                        emotion_confidence: confidence,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_id' }).then(() => { });
                }
            }, 2000);
        }

        return {
            emotion: newEmotion,
            shouldSwitchTheme: palette.mode !== 'keep',
            targetMode: palette.mode as 'light' | 'dark' | 'keep',
        };
    }, [user?.id]);

    /**
     * Update emotion from backend response metadata.
     */
    const setEmotionFromBackend = useCallback((backendEmotion: string, confidence: number = 0.8) => {
        const mapped = backendEmotion as Emotion;
        if (!EMOTION_PALETTES[mapped]) return;
        setEmotionState(mapped);
        setEmotionConfidence(confidence);
    }, []);

    const palette = EMOTION_PALETTES[emotion] ?? EMOTION_PALETTES.neutral;

    return {
        emotion,
        emotionConfidence,
        palette,
        processMessage,
        setEmotionFromBackend,
    };
}
