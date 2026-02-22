import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export type EmotionTheme = 'calm' | 'excited' | 'curious' | 'frustrated' | 'neutral';
export type UITheme = 'auto' | 'dark' | 'light' | EmotionTheme;
export type AnimationLevel = 'subtle' | 'normal' | 'vibrant';

interface ThemeConfig {
    theme: UITheme;
    animationLevel: AnimationLevel;
    primaryColor: string;
    accentColor: string;
    emotion: EmotionTheme;
    emotionConfidence: number;
}

// Theme color configurations
const THEME_COLORS: Record<EmotionTheme, { primary: string; accent: string; bg: string }> = {
    calm: {
        primary: '210 60% 50%',    // Calm blue
        accent: '200 50% 60%',
        bg: 'from-blue-50 to-slate-50 dark:from-blue-950/20 dark:to-slate-950',
    },
    excited: {
        primary: '25 95% 55%',     // Warm orange
        accent: '15 90% 60%',
        bg: 'from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20',
    },
    curious: {
        primary: '280 60% 55%',    // Creative purple (not too violet)
        accent: '270 50% 60%',
        bg: 'from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20',
    },
    frustrated: {
        primary: '220 30% 50%',    // Muted, calming
        accent: '210 25% 55%',
        bg: 'from-slate-50 to-gray-50 dark:from-slate-950 dark:to-gray-950',
    },
    neutral: {
        primary: '200 50% 50%',    // Default teal
        accent: '190 45% 55%',
        bg: 'from-slate-50 to-white dark:from-slate-950 dark:to-black',
    },
};

const defaultConfig: ThemeConfig = {
    theme: 'auto',
    animationLevel: 'normal',
    primaryColor: THEME_COLORS.neutral.primary,
    accentColor: THEME_COLORS.neutral.accent,
    emotion: 'neutral',
    emotionConfidence: 0,
};

export function useTheme() {
    const { user } = useAuth();
    const [config, setConfig] = useState<ThemeConfig>(defaultConfig);
    const [isLoading, setIsLoading] = useState(true);

    // Load preferences from database
    useEffect(() => {
        async function loadPreferences() {
            if (!user?.id) {
                setConfig(defaultConfig);
                setIsLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('user_preferences')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') { // Not "no rows" error
                    console.error('Failed to load theme preferences:', error);
                }

                if (data) {
                    const emotion = (data.last_detected_emotion as EmotionTheme) || 'neutral';
                    const colors = THEME_COLORS[emotion] || THEME_COLORS.neutral;

                    setConfig({
                        theme: (data.theme as UITheme) || 'auto',
                        animationLevel: (data.animation_level as AnimationLevel) || 'normal',
                        primaryColor: colors.primary,
                        accentColor: colors.accent,
                        emotion,
                        emotionConfidence: data.emotion_confidence || 0,
                    });
                }
            } catch (err) {
                console.error('Theme load error:', err);
            } finally {
                setIsLoading(false);
            }
        }

        loadPreferences();
    }, [user?.id]);

    // Apply theme CSS variables
    useEffect(() => {
        if (typeof document === 'undefined') return;

        const root = document.documentElement;
        const colors = THEME_COLORS[config.emotion] || THEME_COLORS.neutral;

        // Set CSS custom properties
        root.style.setProperty('--theme-primary', colors.primary);
        root.style.setProperty('--theme-accent', colors.accent);

        // Set data attribute for theme-specific CSS
        root.setAttribute('data-emotion-theme', config.emotion);
        root.setAttribute('data-animation-level', config.animationLevel);

    }, [config.emotion, config.animationLevel]);

    // Update theme preference
    const setTheme = useCallback(async (theme: UITheme) => {
        setConfig(prev => ({ ...prev, theme }));

        if (!user?.id) return;

        try {
            await supabase
                .from('user_preferences')
                .upsert({
                    user_id: user.id,
                    theme,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' });
        } catch (err) {
            console.error('Failed to save theme:', err);
        }
    }, [user?.id]);

    // Update animation level
    const setAnimationLevel = useCallback(async (level: AnimationLevel) => {
        setConfig(prev => ({ ...prev, animationLevel: level }));

        if (!user?.id) return;

        try {
            await supabase
                .from('user_preferences')
                .upsert({
                    user_id: user.id,
                    animation_level: level,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' });
        } catch (err) {
            console.error('Failed to save animation level:', err);
        }
    }, [user?.id]);

    // Update emotion manually (from LangGraph backend)
    const setEmotion = useCallback(async (emotion: EmotionTheme, confidence: number = 1.0) => {
        const colors = THEME_COLORS[emotion] || THEME_COLORS.neutral;

        setConfig(prev => ({
            ...prev,
            emotion,
            emotionConfidence: confidence,
            primaryColor: colors.primary,
            accentColor: colors.accent,
        }));

        // Persist to database
        if (user?.id) {
            try {
                await supabase
                    .from('user_preferences')
                    .upsert({
                        user_id: user.id,
                        last_detected_emotion: emotion,
                        emotion_confidence: confidence,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_id' });
            } catch (err) {
                console.error('Failed to save emotion preference:', err);
            }
        }
    }, [user?.id]);

    // Legacy detectEmotion removed. Transitioning to backend-driven emotion detection.
    const detectEmotion = useCallback(async (messages: string[]) => {
        // NOP - Backend now handles this via LangGraph
        console.log('Legacy detectEmotion called, but frontend is now backend-driven.');
    }, []);

    // Get theme-specific background class
    const getBackgroundClass = useCallback(() => {
        return THEME_COLORS[config.emotion]?.bg || THEME_COLORS.neutral.bg;
    }, [config.emotion]);

    // Get animation duration multiplier based on level
    const getAnimationMultiplier = useCallback(() => {
        switch (config.animationLevel) {
            case 'subtle': return 1.5;  // Slower
            case 'vibrant': return 0.7; // Faster
            default: return 1;
        }
    }, [config.animationLevel]);

    return {
        ...config,
        isLoading,
        setTheme,
        setAnimationLevel,
        detectEmotion,
        setEmotion,
        getBackgroundClass,
        getAnimationMultiplier,
        themeColors: THEME_COLORS,
    };
}
