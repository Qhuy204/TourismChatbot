import { useState, useEffect, useCallback } from 'react';
import { useSessionCookies } from './useSessionCookies';

interface Recommendation {
    question: string;
    category: string;
    source: 'trending' | 'personalized' | 'similar_users';
    score: number;
}

interface UseRecommendationsReturn {
    recommendations: Recommendation[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

/**
 * Hook to fetch personalized question recommendations based on user's topics.
 * Topics are tracked via cookies in useSessionCookies.
 */
export function useRecommendations(userId: string): UseRecommendationsReturn {
    const { preferences } = useSessionCookies();
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchRecommendations = useCallback(async () => {
        if (!userId) return;

        setLoading(true);
        setError(null);

        try {
            const apiBase = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
            const res = await fetch(`${apiBase}/langgraph/recommendations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    topics: preferences.askedTopics || [],
                    limit: 5
                })
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch recommendations: ${res.status}`);
            }

            const data = await res.json();
            setRecommendations(data.recommendations || []);
        } catch (e) {
            console.error('Failed to fetch recommendations:', e);
            setError(e instanceof Error ? e.message : 'Unknown error');
            setRecommendations([]);
        } finally {
            setLoading(false);
        }
    }, [userId, preferences.askedTopics]);

    useEffect(() => {
        fetchRecommendations();
    }, [fetchRecommendations]);

    return {
        recommendations,
        loading,
        error,
        refresh: fetchRecommendations
    };
}
