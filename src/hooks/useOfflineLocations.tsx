/**
 * useOfflineLocations - IndexedDB-based offline location cache
 * 
 * Syncs locations from Supabase and provides offline search capability.
 * Uses IndexedDB for persistent storage that survives browser restarts.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { openDB, type IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';

interface CachedLocation {
    id: number;
    name: string;
    city?: string | null;
    province?: string | null;
    category: string;
    description?: string | null;
    syncedAt: Date;
}

const DB_NAME = 'tourism_chatbot_offline';
const STORE_NAME = 'locations';
const DB_VERSION = 1;
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useOfflineLocations() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [locations, setLocations] = useState<CachedLocation[]>([]);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dbRef = useRef<IDBPDatabase | null>(null);

    // Initialize IndexedDB
    const getDB = useCallback(async (): Promise<IDBPDatabase> => {
        if (dbRef.current) return dbRef.current;

        const db = await openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('category', 'category');
                    store.createIndex('city', 'city');
                    store.createIndex('name', 'name');
                }
            },
        });

        dbRef.current = db;
        return db;
    }, []);

    // Load locations from IndexedDB
    const loadFromCache = useCallback(async () => {
        try {
            const db = await getDB();
            const cached = await db.getAll(STORE_NAME);
            setLocations(cached);

            // Get last sync time
            if (cached.length > 0) {
                const latest = cached.reduce((a, b) =>
                    new Date(a.syncedAt) > new Date(b.syncedAt) ? a : b
                );
                setLastSync(new Date(latest.syncedAt));
            }
        } catch (err) {
            console.error('Failed to load from cache:', err);
            setError('Failed to load cached locations');
        }
    }, [getDB]);

    // Sync from Supabase to IndexedDB
    const syncLocations = useCallback(async (): Promise<number> => {
        if (!isOnline) {
            setError('No internet connection');
            return 0;
        }

        setIsSyncing(true);
        setError(null);

        try {
            // Fetch from Supabase
            const { data, error: fetchError } = await supabase
                .from('locations_cache')
                .select('id, name, city, province, category, description')
                .order('extracted_at', { ascending: false })
                .limit(1000);

            if (fetchError) throw fetchError;
            if (!data || data.length === 0) return 0;

            const db = await getDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const syncTime = new Date();

            // Store each location
            for (const loc of data) {
                await tx.store.put({
                    ...loc,
                    syncedAt: syncTime
                });
            }

            await tx.done;
            setLastSync(syncTime);

            // Update local state
            const all = await db.getAll(STORE_NAME);
            setLocations(all);

            return data.length;

        } catch (err) {
            console.error('Sync failed:', err);
            setError(err instanceof Error ? err.message : 'Sync failed');
            return 0;
        } finally {
            setIsSyncing(false);
        }
    }, [isOnline, getDB]);

    // Search locations (works offline)
    const searchLocations = useCallback(async (query: string): Promise<CachedLocation[]> => {
        if (!query || query.length < 2) return [];

        try {
            const db = await getDB();
            const all = await db.getAll(STORE_NAME);

            const q = query.toLowerCase().trim();
            return all.filter(loc =>
                loc.name.toLowerCase().includes(q) ||
                loc.city?.toLowerCase().includes(q) ||
                loc.province?.toLowerCase().includes(q) ||
                loc.description?.toLowerCase().includes(q)
            );
        } catch (err) {
            console.error('Search failed:', err);
            return [];
        }
    }, [getDB]);

    // Get locations by category
    const getByCategory = useCallback(async (category: string): Promise<CachedLocation[]> => {
        try {
            const db = await getDB();
            const index = db.transaction(STORE_NAME).store.index('category');
            return await index.getAll(category);
        } catch (err) {
            console.error('Category filter failed:', err);
            return [];
        }
    }, [getDB]);

    // Get unique categories
    const getCategories = useCallback((): string[] => {
        const cats = new Set(locations.map(l => l.category));
        return Array.from(cats).sort();
    }, [locations]);

    // Clear cache
    const clearCache = useCallback(async () => {
        try {
            const db = await getDB();
            await db.clear(STORE_NAME);
            setLocations([]);
            setLastSync(null);
        } catch (err) {
            console.error('Clear cache failed:', err);
        }
    }, [getDB]);

    // Monitor online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Load from cache on mount
    useEffect(() => {
        loadFromCache();
    }, [loadFromCache]);

    // Auto-sync when coming online
    useEffect(() => {
        if (isOnline && !isSyncing) {
            // Check if sync is needed (last sync > SYNC_INTERVAL ago)
            const needsSync = !lastSync ||
                (Date.now() - lastSync.getTime() > SYNC_INTERVAL);

            if (needsSync) {
                syncLocations();
            }
        }
    }, [isOnline, lastSync, isSyncing, syncLocations]);

    return {
        locations,
        isOnline,
        isSyncing,
        lastSync,
        error,
        syncLocations,
        searchLocations,
        getByCategory,
        getCategories,
        clearCache,
        totalCached: locations.length
    };
}

export type { CachedLocation };
