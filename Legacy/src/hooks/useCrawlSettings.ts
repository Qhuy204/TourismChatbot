import { useState, useEffect, useCallback, useRef } from 'react';

interface CrawlSettings {
    schedulerEnabled: boolean;
    scheduleInterval: number;
    selectedFeatures: string[];
    lastCrawlTime: string | null;
}

const DEFAULT_SETTINGS: CrawlSettings = {
    schedulerEnabled: false,
    scheduleInterval: 30,
    selectedFeatures: ['hotels', 'restaurants'],
    lastCrawlTime: null,
};

// Persist scheduler settings in localStorage
export function useCrawlSettings() {
    const [settings, setSettings] = useState<CrawlSettings>(() => {
        if (typeof window === 'undefined') return DEFAULT_SETTINGS;
        const saved = localStorage.getItem('crawl-settings');
        return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    });

    const schedulerRef = useRef<NodeJS.Timeout | null>(null);
    const [nextRunTime, setNextRunTime] = useState<Date | null>(null);

    // Save to localStorage whenever settings change
    useEffect(() => {
        localStorage.setItem('crawl-settings', JSON.stringify(settings));
    }, [settings]);

    // Restore scheduler on mount if it was enabled
    useEffect(() => {
        if (settings.schedulerEnabled && settings.selectedFeatures.length > 0) {
            startSchedulerInternal();
        }

        return () => {
            if (schedulerRef.current) {
                clearInterval(schedulerRef.current);
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const startSchedulerInternal = useCallback(() => {
        if (schedulerRef.current) {
            clearInterval(schedulerRef.current);
        }

        const intervalMs = settings.scheduleInterval * 60 * 1000;

        // Calculate next run from last crawl time (if exists), otherwise from now
        const baseTime = settings.lastCrawlTime
            ? new Date(settings.lastCrawlTime).getTime()
            : Date.now();
        const nextRun = new Date(baseTime + intervalMs);
        setNextRunTime(nextRun);

        // If next run is already past, set a new one from now
        if (nextRun.getTime() < Date.now()) {
            setNextRunTime(new Date(Date.now() + intervalMs));
        }

        schedulerRef.current = setInterval(() => {
            // Trigger crawl callback
            setSettings(prev => ({ ...prev, lastCrawlTime: new Date().toISOString() }));
            setNextRunTime(new Date(Date.now() + intervalMs));
        }, intervalMs);
    }, [settings.scheduleInterval, settings.lastCrawlTime]);

    const updateSettings = useCallback((updates: Partial<CrawlSettings>) => {
        setSettings(prev => ({ ...prev, ...updates }));
    }, []);

    const startScheduler = useCallback(() => {
        updateSettings({ schedulerEnabled: true });
        startSchedulerInternal();
    }, [updateSettings, startSchedulerInternal]);

    const stopScheduler = useCallback(() => {
        if (schedulerRef.current) {
            clearInterval(schedulerRef.current);
            schedulerRef.current = null;
        }
        setNextRunTime(null);
        updateSettings({ schedulerEnabled: false });
    }, [updateSettings]);

    const toggleFeature = useCallback((featureId: string) => {
        setSettings(prev => ({
            ...prev,
            selectedFeatures: prev.selectedFeatures.includes(featureId)
                ? prev.selectedFeatures.filter(id => id !== featureId)
                : [...prev.selectedFeatures, featureId]
        }));
    }, []);

    return {
        settings,
        updateSettings,
        startScheduler,
        stopScheduler,
        toggleFeature,
        nextRunTime,
        isSchedulerRunning: !!schedulerRef.current,
    };
}
