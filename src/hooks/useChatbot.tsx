import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    feedbackScore?: number | null;
    isLoading?: boolean;
}

export interface ChatSession {
    id: string;
    title: string;
    first_message?: string;
    message_count: number;
    created_at: string;
    updated_at: string;
}

interface LocationData {
    id: string;
    landmark_name: string;
    city: string;
    district: string;
    qa_pairs: Array<{ q: string; a: string; type: string }>;
    image_path?: string;
    relevanceScore?: number;
    gps?: { lat: number; lon: number };
}

interface UserContext {
    recentViews: Array<{ object_id: string; object_type: string; score: number }>;
    topInterests: Array<{ object_id: string; total_score: number }>;
    recentSearches: string[];
}

export function useChatbot() {
    const { user, session } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [currentSessionTitle, setCurrentSessionTitle] = useState<string>('Cuộc hội thoại mới');
    const sessionIdRef = useRef<string>(crypto.randomUUID());

    // Lightweight location index for fast search
    interface LocationIndex {
        id: string;
        landmark_name: string;
        city: string;
        district: string;
    }

    // Cache for location index - stored in localStorage for persistence
    const CACHE_KEY = 'rag_location_index';
    const CACHE_EXPIRY_KEY = 'rag_location_index_expiry';
    const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

    const locationIndexRef = useRef<LocationIndex[] | null>(null);
    const fullRecordsMapRef = useRef<Map<string, unknown>>(new Map());
    const isLoadingRef = useRef(false);

    // Load location index (lightweight, cached in localStorage)
    const loadLocationIndex = useCallback(async (): Promise<LocationIndex[]> => {
        // Check memory cache first
        if (locationIndexRef.current) {
            return locationIndexRef.current;
        }

        // Check localStorage cache
        try {
            const cachedExpiry = localStorage.getItem(CACHE_EXPIRY_KEY);
            const cachedData = localStorage.getItem(CACHE_KEY);

            if (cachedExpiry && cachedData) {
                const expiry = parseInt(cachedExpiry, 10);
                if (Date.now() < expiry) {
                    const index = JSON.parse(cachedData) as LocationIndex[];
                    console.log(`Loaded ${index.length} locations from localStorage cache`);
                    locationIndexRef.current = index;
                    return index;
                }
            }
        } catch (e) {
            console.warn('Failed to load from localStorage cache:', e);
        }

        // Wait if already loading
        if (isLoadingRef.current) {
            while (isLoadingRef.current) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return locationIndexRef.current || [];
        }

        isLoadingRef.current = true;

        try {
            console.log('Building location index from database...');
            const allIndex: LocationIndex[] = [];
            let offset = 0;
            const batchSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('dataset_records')
                    .select('id, data')
                    .eq('is_deleted', false)
                    .range(offset, offset + batchSize - 1);

                if (error) {
                    console.error('Error loading records batch:', error);
                    break;
                }

                if (data && data.length > 0) {
                    // Extract only lightweight index data
                    for (const record of data) {
                        const recordData = record.data as Record<string, unknown>;
                        const metadata = recordData.metadata as Record<string, unknown> | undefined;
                        if (!metadata) continue;

                        const location = metadata.location as Record<string, unknown> | undefined;
                        allIndex.push({
                            id: record.id,
                            landmark_name: (metadata.landmark_name as string) || '',
                            city: (location?.city as string) || '',
                            district: (location?.district as string) || '',
                        });

                        // Also cache full record for later use
                        fullRecordsMapRef.current.set(record.id, record.data);
                    }
                    offset += batchSize;
                    hasMore = data.length === batchSize;
                } else {
                    hasMore = false;
                }
            }

            console.log(`Built index of ${allIndex.length} locations`);
            locationIndexRef.current = allIndex;

            // Save to localStorage
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(allIndex));
                localStorage.setItem(CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION_MS));
                console.log('Saved location index to localStorage cache');
            } catch (e) {
                console.warn('Failed to save to localStorage:', e);
            }

            return allIndex;
        } finally {
            isLoadingRef.current = false;
        }
    }, []);

    // Search relevant locations from cached index based on query AND conversation history
    const searchLocations = useCallback(async (query: string, conversationHistory: ChatMessage[] = []): Promise<LocationData[]> => {
        try {
            // Load location index (cached in localStorage)
            const locationIndex = await loadLocationIndex();

            // Extract keywords from query (remove common words)
            // Added generic travel terms to stop words to avoid matching generic content
            const stopWords = ['là', 'có', 'của', 'và', 'ở', 'tại', 'cho', 'tôi', 'bạn', 'về', 'thông', 'tin', 'địa', 'điểm', 'du', 'lịch', 'gì', 'nào', 'như', 'thế', 'sao', 'muốn', 'biết', 'hỏi', 'xin', 'chào', 'không', 'vâng', 'được', 'đồng', 'ước', 'đường', 'đi', 'cách', 'lối', 'giá', 'vé', 'ăn', 'uống', 'ngủ', 'nghỉ'];
            const queryLower = query.toLowerCase();
            let keywords = queryLower
                .split(/\s+/)
                .filter(k => k.length > 2 && !stopWords.includes(k));

            // If current query has very few keywords OR contains ONLY generic travel terms (which were filtered out)
            // Extract location names from recent conversation history
            // Changed condition: keywords.length < 2 (was < 2) OR if original query was meaningful but filtered down to nothing
            if (keywords.length < 2 && conversationHistory.length > 0) {
                console.log('Generic/Short query detected, extracting context from conversation history');

                // Get the last assistant message and last user message
                const lastAssistantMsg = [...conversationHistory].reverse().find(m => m.role === 'assistant');
                const lastUserMsg = [...conversationHistory].reverse().find(m => m.role === 'user' && m.content !== query);

                // Prioritize Assistant's context first (what did the bot just suggest?)
                const messagesToAnalyze = [lastAssistantMsg, lastUserMsg].filter(Boolean) as ChatMessage[];
                const locationNames = new Set<string>();

                for (const msg of messagesToAnalyze) {
                    const content = msg.content.toLowerCase();
                    let foundInThisMsg = false;

                    // Iterate through ALL locations to find exact matches
                    for (const loc of locationIndex) {
                        const landmarkLower = loc.landmark_name.toLowerCase();

                        // Exact match or strong partial match
                        if (content.includes(landmarkLower)) {
                            // Verify it's a significant match (not just a common word)
                            if (landmarkLower.length > 4) {
                                // Add location name parts as keywords
                                // Use the FULL landmark name to be specific, not just parts
                                locationNames.add(landmarkLower);
                                foundInThisMsg = true;
                            }
                        }
                    }

                    // CRITICAL: If we found context in the most recent message, STOP immediately.
                    // Do not look further back in history to avoid "pollution" from old topics.
                    if (foundInThisMsg) break;
                }

                if (locationNames.size > 0) {
                    // Reset keywords to ONLY the extracted context to ensure focused search
                    // This prevents mixing "Đường đi" (generic) with "Hạ Long" (specific context)
                    keywords = Array.from(locationNames);
                    console.log('Extracted location keywords from history:', Array.from(locationNames));
                }
            }

            console.log('RAG search keywords:', keywords, 'Searching', locationIndex.length, 'locations');

            // Search in lightweight index
            const matchedLocations: Array<{ index: typeof locationIndex[0]; score: number }> = [];

            for (const loc of locationIndex) {
                const textToSearch = [loc.landmark_name, loc.city, loc.district].join(' ').toLowerCase();
                const matchCount = keywords.filter(k => textToSearch.includes(k)).length;

                if (matchCount > 0) {
                    matchedLocations.push({ index: loc, score: matchCount });
                }
            }

            // Sort by score and take top 10
            matchedLocations.sort((a, b) => b.score - a.score);
            const topMatches = matchedLocations.slice(0, 10);

            console.log(`Found ${matchedLocations.length} matches, returning top ${topMatches.length}`);

            // Fetch full record data for matched locations
            const results: LocationData[] = [];
            for (const match of topMatches) {
                // Try memory cache first
                let fullData = fullRecordsMapRef.current.get(match.index.id);

                // If not in cache, fetch from DB
                if (!fullData) {
                    const { data } = await supabase
                        .from('dataset_records')
                        .select('data')
                        .eq('id', match.index.id)
                        .single();

                    if (data) {
                        fullData = data.data;
                        fullRecordsMapRef.current.set(match.index.id, fullData);
                    }
                }

                if (fullData) {
                    const recordData = fullData as Record<string, unknown>;
                    const metadata = recordData.metadata as Record<string, unknown> | undefined;
                    const location = metadata?.location as Record<string, unknown> | undefined;

                    const qaPairs = recordData.qa_pairs as Array<{ q: string; a: string; type: string }> | undefined;
                    const paths = recordData.paths as Record<string, unknown> | undefined;

                    // Extract GPS if available
                    const gps = location?.gps as { lat: number; lon: number } | undefined;

                    results.push({
                        id: match.index.id,
                        landmark_name: match.index.landmark_name,
                        city: match.index.city,
                        district: match.index.district,
                        qa_pairs: (qaPairs || []).filter(qa => qa.type !== 'ask_audio').slice(0, 5),
                        image_path: paths?.image as string | undefined,
                        relevanceScore: match.score,
                        gps: gps,
                    });
                }
            }

            return results;
        } catch (err) {
            console.error('Location search error:', err);
            return [];
        }
    }, [loadLocationIndex]);

    // Get user context from event history
    const getUserContext = useCallback(async (): Promise<UserContext> => {
        if (!user?.id) {
            return { recentViews: [], topInterests: [], recentSearches: [] };
        }

        try {
            // Get recent views
            const { data: recentViewsData } = await supabase
                .from('user_events')
                .select('object_id, object_type, score')
                .eq('user_id', user.id)
                .in('event_type', ['view_item', 'click'])
                .order('created_at', { ascending: false })
                .limit(10);

            // Get top interests (aggregated scores)
            const { data: interestsData } = await supabase
                .from('user_events')
                .select('object_id, score')
                .eq('user_id', user.id)
                .not('object_id', 'is', null)
                .order('created_at', { ascending: false })
                .limit(50);

            // Aggregate interests
            const interestMap = new Map<string, number>();
            for (const item of interestsData || []) {
                if (item.object_id) {
                    const current = interestMap.get(item.object_id) || 0;
                    interestMap.set(item.object_id, current + (item.score || 0));
                }
            }
            const topInterests = Array.from(interestMap.entries())
                .map(([object_id, total_score]) => ({ object_id, total_score }))
                .sort((a, b) => b.total_score - a.total_score)
                .slice(0, 5);

            // Get recent searches
            const { data: searchData } = await supabase
                .from('user_events')
                .select('payload')
                .eq('user_id', user.id)
                .eq('event_type', 'search')
                .order('created_at', { ascending: false })
                .limit(5);

            const recentSearches = (searchData || [])
                .map(s => (s.payload as Record<string, unknown>)?.keyword as string)
                .filter(Boolean);

            return {
                recentViews: recentViewsData || [],
                topInterests,
                recentSearches,
            };
        } catch (err) {
            console.error('Failed to get user context:', err);
            return { recentViews: [], topInterests: [], recentSearches: [] };
        }
    }, [user?.id]);

    // Build RAG prompt with context and conversation history
    const buildRAGPrompt = useCallback((
        query: string,
        locations: LocationData[],
        userContext: UserContext,
        conversationHistory: ChatMessage[] = []
    ): string => {
        let contextParts: string[] = [];

        // Add conversation history (last 10 messages for context continuity)
        if (conversationHistory.length > 0) {
            const recentMessages = conversationHistory.slice(-10);
            const historyText = recentMessages
                .filter(m => !m.isLoading)
                .map(m => `${m.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${m.content.slice(0, 500)}`)
                .join('\n');

            if (historyText.length > 0) {
                contextParts.push('--- LỊCH SỬ HỘI THOẠI GẦN ĐÂY ---');
                contextParts.push(historyText);
                contextParts.push('--- KẾT THÚC LỊCH SỬ ---\n');
            }
        }

        // Add user context
        if (userContext.recentViews.length > 0) {
            const viewedPlaces = userContext.recentViews
                .filter(v => v.object_type === 'place' || v.object_type === 'landmark')
                .map(v => v.object_id)
                .slice(0, 5);
            if (viewedPlaces.length > 0) {
                contextParts.push(`Người dùng gần đây đã xem các địa điểm: ${viewedPlaces.join(', ')}`);
            }
        }

        if (userContext.topInterests.length > 0) {
            const interests = userContext.topInterests.map(i => i.object_id).slice(0, 3);
            contextParts.push(`Sở thích chính: ${interests.join(', ')}`);
        }

        if (userContext.recentSearches.length > 0) {
            contextParts.push(`Tìm kiếm gần đây: ${userContext.recentSearches.join(', ')}`);
        }

        // Add location knowledge
        if (locations.length > 0) {
            contextParts.push('\n--- DỮ LIỆU ĐỊA ĐIỂM DU LỊCH ---');
            for (const loc of locations) {
                let locInfo = `\n📍 ${loc.landmark_name} (${loc.district}, ${loc.city})`;

                // Add GPS if available (important for map queries)
                if (loc.gps) {
                    locInfo += `\n   Tọa độ: ${loc.gps.lat}, ${loc.gps.lon}`;
                }

                if (loc.qa_pairs.length > 0) {
                    locInfo += '\nThông tin chi tiết:';
                    for (const qa of loc.qa_pairs) {
                        locInfo += `\n  Q: ${qa.q}\n  A: ${qa.a}`;
                    }
                }
                contextParts.push(locInfo);
            }
        }

        const systemContext = contextParts.length > 0
            ? `\n\n[CONTEXT CHO CHATBOT - DÙNG ĐỂ TRẢ LỜI CHÍNH XÁC HƠN]\n${contextParts.join('\n')}\n[KẾT THÚC CONTEXT]\n`
            : '';

        // Log context to console for debugging/transparency
        if (systemContext) {
            console.log('🔍 [RAG Context Generated]:', systemContext);
        }

        const formatInstructions = `
## HƯỚNG DẪN FORMAT PHẢN HỒI:
- Sử dụng **in đậm** cho tên địa điểm và thông tin quan trọng
- Sử dụng danh sách bullet (*) để liệt kê các địa điểm hoặc gợi ý
- Chia câu trả lời thành các phần rõ ràng với tiêu đề nếu cần
- Thêm emoji phù hợp để tăng tính sinh động (📍🏖️🏔️🌿🍜✨)
- Nếu đề xuất nhiều địa điểm, nhóm theo vùng miền hoặc chủ đề
- QUAN TRỌNG: Nếu người dùng hỏi tiếp về địa điểm đã đề cập, hãy trả lời dựa trên LỊCH SỬ HỘI THOẠI và DỮ LIỆU ĐỊA ĐIỂM
- Kết thúc bằng câu hỏi gợi mở để hiểu rõ hơn nhu cầu user

## VÍ DỤ FORMAT TỐT:
**Xin chào!** 👋 Tôi có thể giúp bạn về:
* **Địa điểm A** - Mô tả ngắn
* **Địa điểm B** - Mô tả ngắn

Bạn thích loại hình du lịch nào hơn?`;

        return `Bạn là trợ lý du lịch Việt Nam thông minh, thân thiện và chuyên nghiệp.

## NHIỆM VỤ:
- Tư vấn địa điểm du lịch dựa trên dữ liệu được cung cấp VÀ lịch sử hội thoại
- Cung cấp thông tin chính xác về các địa danh Việt Nam
- Gợi ý lịch trình, ẩm thực và hoạt động phù hợp với sở thích user
- NẾU người dùng hỏi tiếp về địa điểm đã đề cập trước đó, hãy DUY TRÌ NGỮ CẢNH và trả lời liên quan đến địa điểm đó

${formatInstructions}
${systemContext}

Câu hỏi của người dùng: ${query}`;
    }, []);

    // Save chat log to database
    const saveChatLog = useCallback(async (
        role: 'user' | 'assistant',
        message: string,
        context?: unknown,
        modelUsed?: string,
        responseTimeMs?: number
    ) => {
        if (!user?.id) return;

        try {
            await supabase.from('chat_logs').insert({
                user_id: user.id,
                session_id: sessionIdRef.current,
                role,
                message,
                context: context as Record<string, unknown>,
                model_used: modelUsed,
                response_time_ms: responseTimeMs,
            });
        } catch (err) {
            console.error('Failed to save chat log:', err);
        }
    }, [user?.id]);

    // Update feedback score for a message
    const updateFeedback = useCallback(async (messageId: string, feedbackScore: number) => {
        if (!user?.id) return;

        // Update local state
        setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, feedbackScore } : msg
        ));

        // Update in database (find by content match in recent logs)
        try {
            const message = messages.find(m => m.id === messageId);
            if (message) {
                await supabase
                    .from('chat_logs')
                    .update({ feedback_score: feedbackScore })
                    .eq('user_id', user.id)
                    .eq('session_id', sessionIdRef.current)
                    .eq('role', message.role)
                    .ilike('message', message.content.slice(0, 100) + '%')
                    .order('created_at', { ascending: false })
                    .limit(1);
            }
        } catch (err) {
            console.error('Failed to update feedback:', err);
        }
    }, [user?.id, messages]);

    // Send message with RAG
    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || !user?.id) return;

        // Add user message
        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: content.trim(),
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);

        // Add loading message
        const loadingMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isLoading: true,
        };
        setMessages(prev => [...prev, loadingMessage]);
        setIsLoading(true);

        const startTime = Date.now();

        try {
            // Ensure session exists (creates on first message with auto-generated title)
            if (!currentSessionId) {
                await ensureSession(content);
            }

            // Get RAG context (pass messages for context when query is short)
            const [locations, userContext] = await Promise.all([
                searchLocations(content, messages),
                getUserContext(),
            ]);

            // Build prompt with context AND conversation history
            const ragPrompt = buildRAGPrompt(content, locations, userContext, messages);

            // Save user message to chat log
            await saveChatLog('user', content);

            // Fetch API key from Supabase
            let apiKey: string | null = null;
            try {
                const { data: keyData, error: keyError } = await supabase.functions.invoke('manage-api-keys', {
                    body: { action: 'get_active', provider: 'gemini' }
                });

                if (!keyError && keyData?.api_key) {
                    apiKey = keyData.api_key;
                }
            } catch (e) {
                console.warn('Failed to get API key from Supabase, trying Python server fallback:', e);
            }

            // Call Gemini API via Python server
            const response = await fetch('http://localhost:3001/chat/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: ragPrompt,
                    model: 'gemini-2.5-flash',
                    temperature: 0.7,
                    max_tokens: 1024,
                    api_key: apiKey, // Pass the API key from Supabase
                }),
            });

            const responseTimeMs = Date.now() - startTime;

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();

            // Check for error in response body
            if (data.error) {
                console.error('Gemini API error:', data.error);
                throw new Error(data.error);
            }

            const assistantContent = data?.text || 'Xin lỗi, tôi không thể xử lý yêu cầu này. Vui lòng thử lại.';

            // Update loading message with actual content
            setMessages(prev => prev.map(msg =>
                msg.id === loadingMessage.id
                    ? { ...msg, content: assistantContent, isLoading: false }
                    : msg
            ));

            // Save assistant response to chat log
            await saveChatLog(
                'assistant',
                assistantContent,
                { locations: locations.map(l => l.landmark_name), userContext },
                'gemini-2.5-flash',
                responseTimeMs
            );

        } catch (err) {
            console.error('Chat error:', err);

            // Update loading message with error
            setMessages(prev => prev.map(msg =>
                msg.id === loadingMessage.id
                    ? {
                        ...msg,
                        content: 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.',
                        isLoading: false
                    }
                    : msg
            ));
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, searchLocations, getUserContext, buildRAGPrompt, saveChatLog]);

    // Load a specific session and its messages
    const loadSession = useCallback(async (sessionId: string) => {
        if (!user?.id) return;

        try {
            // Load session info
            const { data: sessionData } = await supabase
                .from('chat_sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (sessionData) {
                setCurrentSessionId(sessionId);
                setCurrentSessionTitle(sessionData.title);
                sessionIdRef.current = sessionId;
            }

            // Load messages
            const { data: messagesData, error } = await supabase
                .from('chat_logs')
                .select('*')
                .eq('user_id', user.id)
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Failed to load messages:', error);
                return;
            }

            if (messagesData && messagesData.length > 0) {
                setMessages(messagesData.map(log => ({
                    id: log.id.toString(),
                    role: log.role as 'user' | 'assistant',
                    content: log.message,
                    timestamp: new Date(log.created_at),
                    feedbackScore: log.feedback_score,
                })));
            } else {
                setMessages([]);
            }
        } catch (err) {
            console.error('Load session error:', err);
        }
    }, [user?.id]);

    // Load all sessions for the user
    const loadSessions = useCallback(async (autoSelectRecent = false) => {
        if (!user?.id) return;

        try {
            const { data, error } = await supabase
                .from('chat_sessions')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('Failed to load sessions:', error);
                return;
            }

            if (data) {
                setSessions(data.map(s => ({
                    id: s.id,
                    title: s.title,
                    first_message: s.first_message,
                    message_count: s.message_count || 0,
                    created_at: s.created_at,
                    updated_at: s.updated_at,
                })));

                // Auto-select most recent session if requested (e.g. on page load)
                if (autoSelectRecent && data.length > 0) {
                    const mostRecent = data[0];
                    console.log('Restoring most recent session:', mostRecent.title);
                    loadSession(mostRecent.id);
                }
            }
        } catch (err) {
            console.error('Load sessions error:', err);
        }
    }, [user?.id, loadSession]); // Added loadSession dependency

    // Create a new session
    const createNewSession = useCallback(async () => {
        setMessages([]);
        const newSessionId = crypto.randomUUID();
        sessionIdRef.current = newSessionId;
        setCurrentSessionId(null); // Will be created on first message
        setCurrentSessionTitle('Cuộc hội thoại mới');
    }, []);

    // Create or update session on first message of a new conversation
    const ensureSession = useCallback(async (firstMessage: string) => {
        if (!user?.id || currentSessionId) return currentSessionId;

        try {
            // Generate a fresh session ID to avoid conflicts
            const newSessionId = crypto.randomUUID();
            sessionIdRef.current = newSessionId;

            // Auto-generate title from first message
            const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');

            const { data, error } = await supabase
                .from('chat_sessions')
                .insert({
                    id: newSessionId,
                    user_id: user.id,
                    title,
                    first_message: firstMessage,
                    message_count: 1,
                })
                .select()
                .single();

            if (error) {
                // If duplicate key error, try again with new ID
                if (error.code === '23505') {
                    const retryId = crypto.randomUUID();
                    sessionIdRef.current = retryId;

                    const { data: retryData } = await supabase
                        .from('chat_sessions')
                        .insert({
                            id: retryId,
                            user_id: user.id,
                            title,
                            first_message: firstMessage,
                            message_count: 1,
                        })
                        .select()
                        .single();

                    if (retryData) {
                        setCurrentSessionId(retryData.id);
                        setCurrentSessionTitle(retryData.title);
                        loadSessions();
                        return retryData.id;
                    }
                }
                console.error('Failed to create session:', error);
                return null;
            }

            if (data) {
                setCurrentSessionId(data.id);
                setCurrentSessionTitle(data.title);
                // Refresh session list
                loadSessions();
                return data.id;
            }
        } catch (err) {
            console.error('Create session error:', err);
        }
        return null;
    }, [user?.id, currentSessionId, loadSessions]);

    // Update session message count
    const updateSessionMessageCount = useCallback(async () => {
        if (!currentSessionId) return;

        try {
            await supabase
                .from('chat_sessions')
                .update({
                    message_count: messages.length + 1,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentSessionId);
        } catch (err) {
            console.error('Update session error:', err);
        }
    }, [currentSessionId, messages.length]);

    // Load sessions on mount
    useEffect(() => {
        if (user?.id) {
            // Pass true to auto-restore the last session on load
            loadSessions(true);
        }
    }, [user?.id, loadSessions]);

    return {
        messages,
        isLoading,
        sendMessage,
        clearChat: createNewSession,
        updateFeedback,
        sessionId: sessionIdRef.current,
        // Session management
        sessions,
        currentSessionId,
        currentSessionTitle,
        loadSessions,
        loadSession,
        createNewSession,
        ensureSession,
        updateSessionMessageCount,
    };
}
