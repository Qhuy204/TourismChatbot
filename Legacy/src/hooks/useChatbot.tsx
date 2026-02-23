// import { useState, useCallback, useRef, useEffect } from 'react';
// import { supabase } from '@/integrations/supabase/client';
// import { useAuth } from '@/hooks/useAuth';

// export interface ChatMessage {
//     id: string;
//     role: 'user' | 'assistant';
//     content: string;
//     timestamp: Date;
//     feedbackScore?: number | null;
//     isLoading?: boolean;
//     attachments?: Array<{ url: string; type: string; name: string }>;
// }

// export interface ChatSession {
//     id: string;
//     title: string;
//     first_message?: string;
//     message_count: number;
//     created_at: string;
//     updated_at: string;
//     is_pinned?: boolean;
// }

// interface LocationData {
//     id: string;
//     landmark_name: string;
//     city: string;
//     district: string;
//     qa_pairs: Array<{ q: string; a: string; type: string }>;
//     image_path?: string;
//     relevanceScore?: number;
//     gps?: { lat: number; lon: number };
// }

// interface UserContext {
//     recentViews: Array<{ object_id: string; object_type: string; score: number }>;
//     topInterests: Array<{ object_id: string; total_score: number }>;
//     recentSearches: string[];
// }

// // ===== AFFIRMATION GUARDRAIL =====
// // Short follow-up words that should NOT trigger new RAG search
// // Instead, continue with previous context
// const AFFIRMATIVE_WORDS = [
//     // Vietnamese affirmations
//     'có', 'ok', 'ừ', 'ừm', 'ưm', 'vâng', 'được', 'đồng ý', 'tiếp', 'tiếp tục',
//     'gợi ý đi', 'cho xem', 'cho tôi xem', 'nói tiếp', 'kể thêm', 'nói đi',
//     'rồi', 'đúng', 'đúng rồi', 'phải', 'chính xác', 'hay', 'hay đấy',
//     // English affirmations
//     'yes', 'yeah', 'yep', 'sure', 'go ahead', 'continue', 'ok', 'okay',
//     // Short requests
//     'tiếp đi', 'nói thêm', 'chi tiết hơn', 'thêm', 'còn gì nữa'
// ];

// // Check if query is an affirmative/short follow-up
// function isAffirmativeQuery(query: string): boolean {
//     const normalized = query.toLowerCase().trim();
//     // Exact match or starts with affirmative word
//     return AFFIRMATIVE_WORDS.some(w =>
//         normalized === w ||
//         normalized.startsWith(w + ' ') ||
//         normalized.endsWith(' ' + w)
//     ) || normalized.length <= 4; // Very short queries like "Có", "Ok"
// }

// export function useChatbot() {
//     const { user, session } = useAuth();
//     const [messages, setMessages] = useState<ChatMessage[]>([]);
//     const [isLoading, setIsLoading] = useState(false);
//     const [sessions, setSessions] = useState<ChatSession[]>([]);
//     const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
//     const [currentSessionTitle, setCurrentSessionTitle] = useState<string>('Cuộc hội thoại mới');
//     const sessionIdRef = useRef<string>(crypto.randomUUID());

//     // Lightweight location index for fast search
//     interface LocationIndex {
//         id: string;
//         landmark_name: string;
//         city: string;
//         district: string;
//     }

//     // Cache for location index - stored in localStorage for persistence
//     const CACHE_KEY = 'rag_location_index';
//     const CACHE_EXPIRY_KEY = 'rag_location_index_expiry';
//     const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

//     const locationIndexRef = useRef<LocationIndex[] | null>(null);
//     const fullRecordsMapRef = useRef<Map<string, unknown>>(new Map());
//     const isLoadingRef = useRef(false);

//     // Load location index (lightweight, cached in localStorage)
//     const loadLocationIndex = useCallback(async (): Promise<LocationIndex[]> => {
//         // Check memory cache first
//         if (locationIndexRef.current) {
//             return locationIndexRef.current;
//         }

//         // Check localStorage cache
//         try {
//             const cachedExpiry = localStorage.getItem(CACHE_EXPIRY_KEY);
//             const cachedData = localStorage.getItem(CACHE_KEY);

//             if (cachedExpiry && cachedData) {
//                 const expiry = parseInt(cachedExpiry, 10);
//                 if (Date.now() < expiry) {
//                     const index = JSON.parse(cachedData) as LocationIndex[];
//                     console.log(`Loaded ${index.length} locations from localStorage cache`);
//                     locationIndexRef.current = index;
//                     return index;
//                 }
//             }
//         } catch (e) {
//             console.warn('Failed to load from localStorage cache:', e);
//         }

//         // Wait if already loading
//         if (isLoadingRef.current) {
//             while (isLoadingRef.current) {
//                 await new Promise(resolve => setTimeout(resolve, 100));
//             }
//             return locationIndexRef.current || [];
//         }

//         // Try to restore full records from IndexedDB if localStorage cache is valid
//         if (locationIndexRef.current && fullRecordsMapRef.current.size === 0) {
//             try {
//                 const dbRequest = indexedDB.open('chatbot_cache', 1);
//                 await new Promise<void>((resolve) => {
//                     dbRequest.onsuccess = () => {
//                         const db = dbRequest.result;
//                         if (db.objectStoreNames.contains('records')) {
//                             const tx = db.transaction('records', 'readonly');
//                             const store = tx.objectStore('records');
//                             const recordsReq = store.get('full_records');
//                             recordsReq.onsuccess = () => {
//                                 const records = recordsReq.result as Array<[string, unknown]> | undefined;
//                                 if (records && records.length > 0) {
//                                     for (const [id, data] of records) {
//                                         fullRecordsMapRef.current.set(id, data);
//                                     }
//                                     console.log(`Restored ${records.length} full records from IndexedDB cache`);
//                                 }
//                                 resolve();
//                             };
//                             recordsReq.onerror = () => resolve();
//                         } else {
//                             resolve();
//                         }
//                     };
//                     dbRequest.onerror = () => resolve();
//                 });
//             } catch { /* ignore */ }
//         }

//         isLoadingRef.current = true;

//         try {
//             console.log('Building location index from database...');
//             const allIndex: LocationIndex[] = [];
//             let offset = 0;
//             const batchSize = 1000;
//             let hasMore = true;

//             while (hasMore) {
//                 const { data, error } = await supabase
//                     .from('dataset_records')
//                     .select('id, data')
//                     .eq('is_deleted', false)
//                     .range(offset, offset + batchSize - 1);

//                 if (error) {
//                     console.error('Error loading records batch:', error);
//                     break;
//                 }

//                 if (data && data.length > 0) {
//                     // Extract only lightweight index data
//                     for (const record of data) {
//                         const recordData = record.data as Record<string, unknown>;
//                         const metadata = recordData.metadata as Record<string, unknown> | undefined;
//                         if (!metadata) continue;

//                         const location = metadata.location as Record<string, unknown> | undefined;
//                         allIndex.push({
//                             id: record.id,
//                             landmark_name: (metadata.landmark_name as string) || '',
//                             city: (location?.city as string) || '',
//                             district: (location?.district as string) || '',
//                         });

//                         // Also cache full record for later use
//                         fullRecordsMapRef.current.set(record.id, record.data);
//                     }
//                     offset += batchSize;
//                     hasMore = data.length === batchSize;
//                 } else {
//                     hasMore = false;
//                 }
//             }

//             console.log(`Built index of ${allIndex.length} locations`);
//             locationIndexRef.current = allIndex;

//             // Save to localStorage (index only - lightweight)
//             try {
//                 localStorage.setItem(CACHE_KEY, JSON.stringify(allIndex));
//                 localStorage.setItem(CACHE_EXPIRY_KEY, String(Date.now() + CACHE_DURATION_MS));
//                 console.log('Saved location index to localStorage cache');
//             } catch (e) {
//                 console.warn('Failed to save to localStorage:', e);
//             }

//             // Save full records to IndexedDB (larger storage, persisted)
//             try {
//                 const recordsArray = Array.from(fullRecordsMapRef.current.entries());
//                 const dbRequest = indexedDB.open('chatbot_cache', 1);
//                 dbRequest.onupgradeneeded = () => {
//                     const db = dbRequest.result;
//                     if (!db.objectStoreNames.contains('records')) {
//                         db.createObjectStore('records');
//                     }
//                 };
//                 dbRequest.onsuccess = () => {
//                     const db = dbRequest.result;
//                     const tx = db.transaction('records', 'readwrite');
//                     const store = tx.objectStore('records');
//                     store.put(recordsArray, 'full_records');
//                     store.put(Date.now() + CACHE_DURATION_MS, 'expiry');
//                     console.log(`Saved ${recordsArray.length} full records to IndexedDB cache`);
//                 };
//             } catch (e) {
//                 console.warn('Failed to save to IndexedDB:', e);
//             }

//             return allIndex;
//         } finally {
//             isLoadingRef.current = false;
//         }
//     }, [CACHE_DURATION_MS]);

//     // Search relevant locations from cached index based on query AND conversation history
//     const searchLocations = useCallback(async (query: string, conversationHistory: ChatMessage[] = []): Promise<LocationData[]> => {
//         try {
//             // Load location index (cached in localStorage)
//             const locationIndex = await loadLocationIndex();

//             // Extract keywords from query (remove common words)
//             // Extended stop words to include image-related terms, question words, and short generic words
//             const stopWords = [
//                 // Common Vietnamese words
//                 'là', 'có', 'của', 'và', 'ở', 'tại', 'cho', 'tôi', 'bạn', 'về', 'thông', 'tin',
//                 'địa', 'điểm', 'du', 'lịch', 'gì', 'nào', 'như', 'thế', 'sao', 'muốn', 'biết',
//                 'hỏi', 'xin', 'chào', 'không', 'vâng', 'được', 'đồng', 'ước', 'thêm', 'còn',
//                 // Travel terms
//                 'đường', 'đi', 'cách', 'lối', 'giá', 'vé', 'ăn', 'uống', 'ngủ', 'nghỉ', 'tour',
//                 // IMAGE-RELATED TERMS (CRITICAL - prevents 'ảnh' matching 'Cảnh')
//                 'ảnh', 'hình', 'xem', 'gửi', 'cho', 'pic', 'photo', 'hiện', 'thị', 'show',
//                 // Question/confirmation words
//                 'đúng', 'rồi', 'vậy', 'nhé', 'nha', 'hen', 'luôn', 'đây', 'kia', 'này', 'đó',
//                 // Short generic words that cause false matches
//                 'một', 'hai', 'các', 'những', 'người', 'nhiều', 'hơn', 'nhất', 'rất', 'quá'
//             ];
//             const queryLower = query.toLowerCase();
//             let keywords = queryLower
//                 .split(/\s+/)
//                 .filter(k => k.length > 2 && !stopWords.includes(k));

//             // If current query has very few keywords OR contains ONLY generic travel terms (which were filtered out)
//             // Extract location names from recent conversation history
//             // Changed condition: keywords.length < 2 (was < 2) OR if original query was meaningful but filtered down to nothing
//             if (keywords.length < 2 && conversationHistory.length > 0) {
//                 console.log('Generic/Short query detected, extracting context from conversation history');

//                 // Get the last few messages (prioritize user messages with explicit location names)
//                 const recentMessages = [...conversationHistory].reverse().slice(0, 6);
//                 const locationNames = new Set<string>();
//                 let foundPrimaryContext = false;

//                 // STEP 1: First, check if the MOST RECENT assistant message mentioned a specific location
//                 // This is usually the location being discussed
//                 const lastAssistantMsg = recentMessages.find(m => m.role === 'assistant');
//                 const lastUserMsgWithLocation = recentMessages.find(m => {
//                     if (m.role !== 'user' || m.content === query) return false;
//                     // Check if this user message has a location name
//                     const contentLower = m.content.toLowerCase();
//                     for (const loc of locationIndex) {
//                         if (loc.landmark_name.length > 4 && contentLower.includes(loc.landmark_name.toLowerCase())) {
//                             return true;
//                         }
//                     }
//                     return false;
//                 });

//                 // STEP 2: Prioritize the user's last explicit location mention
//                 if (lastUserMsgWithLocation) {
//                     const contentLower = lastUserMsgWithLocation.content.toLowerCase();
//                     for (const loc of locationIndex) {
//                         const landmarkLower = loc.landmark_name.toLowerCase();
//                         if (landmarkLower.length > 4 && contentLower.includes(landmarkLower)) {
//                             locationNames.add(landmarkLower);
//                             foundPrimaryContext = true;
//                         }
//                     }
//                     if (foundPrimaryContext) {
//                         console.log('Found location from user message:', Array.from(locationNames));
//                     }
//                 }

//                 // STEP 3: If no user location found, check the last assistant response
//                 if (!foundPrimaryContext && lastAssistantMsg) {
//                     const contentLower = lastAssistantMsg.content.toLowerCase();
//                     // Only take the FIRST location mentioned (most likely the main topic)
//                     for (const loc of locationIndex) {
//                         const landmarkLower = loc.landmark_name.toLowerCase();
//                         if (landmarkLower.length > 4 && contentLower.includes(landmarkLower)) {
//                             locationNames.add(landmarkLower);
//                             // Take only ONE location from assistant to avoid confusion
//                             break;
//                         }
//                     }
//                     if (locationNames.size > 0) {
//                         console.log('Found location from assistant message:', Array.from(locationNames));
//                     }
//                 }

//                 if (locationNames.size > 0) {
//                     // Reset keywords to ONLY the extracted context to ensure focused search
//                     // This prevents mixing "Đường đi" (generic) with "Hạ Long" (specific context)
//                     keywords = Array.from(locationNames);
//                     console.log('Extracted location keywords from history:', Array.from(locationNames));
//                 }
//             }

//             console.log('RAG search keywords:', keywords, 'Searching', locationIndex.length, 'locations');

//             // Search in lightweight index
//             const matchedLocations: Array<{ index: typeof locationIndex[0]; score: number }> = [];

//             for (const loc of locationIndex) {
//                 const textToSearch = [loc.landmark_name, loc.city, loc.district].join(' ').toLowerCase();
//                 const matchCount = keywords.filter(k => textToSearch.includes(k)).length;

//                 if (matchCount > 0) {
//                     matchedLocations.push({ index: loc, score: matchCount });
//                 }
//             }

//             // Sort by score and take top 10
//             matchedLocations.sort((a, b) => b.score - a.score);
//             const topMatches = matchedLocations.slice(0, 10);

//             console.log(`Found ${matchedLocations.length} matches, returning top ${topMatches.length}`);

//             // Fetch full record data for matched locations
//             const results: LocationData[] = [];
//             for (const match of topMatches) {
//                 // Try memory cache first
//                 let fullData = fullRecordsMapRef.current.get(match.index.id);

//                 // If not in cache, fetch from DB
//                 if (!fullData) {
//                     const { data } = await supabase
//                         .from('dataset_records')
//                         .select('data')
//                         .eq('id', match.index.id)
//                         .single();

//                     if (data) {
//                         fullData = data.data;
//                         fullRecordsMapRef.current.set(match.index.id, fullData);
//                     }
//                 }

//                 if (fullData) {
//                     const recordData = fullData as Record<string, unknown>;
//                     const metadata = recordData.metadata as Record<string, unknown> | undefined;
//                     const location = metadata?.location as Record<string, unknown> | undefined;

//                     const qaPairs = recordData.qa_pairs as Array<{ q: string; a: string; type: string }> | undefined;
//                     const paths = recordData.paths as Record<string, unknown> | undefined;

//                     // Extract GPS if available
//                     const gps = location?.gps as { lat: number; lon: number } | undefined;

//                     // Extract and construct full image URL - CHECK MULTIPLE POSSIBLE PATHS
//                     let imageUrl: string | undefined;

//                     // Get image_spec from metadata (this is where original_url lives)
//                     const imageSpec = metadata?.image_spec as Record<string, unknown> | undefined;

//                     // Priority order for finding image URL - BASED ON ACTUAL DATA STRUCTURE
//                     const possibleImagePaths = [
//                         imageSpec?.original_url,     // metadata.image_spec.original_url (PRIMARY - confirmed in data)
//                         metadata?.original_url,      // metadata.original_url fallback
//                         paths?.image,                // paths.image (often empty but check)
//                         paths?.original_url,         // paths.original_url
//                         recordData.image_url,        // root level image_url
//                         recordData.image_path,       // root level image_path
//                     ];

//                     const rawImagePath = possibleImagePaths.find(p => typeof p === 'string' && p.length > 0) as string | undefined;

//                     if (rawImagePath) {
//                         // If already a full URL, use as-is
//                         if (rawImagePath.startsWith('http://') || rawImagePath.startsWith('https://')) {
//                             imageUrl = rawImagePath;
//                         } else if (rawImagePath.startsWith('//')) {
//                             // Protocol-relative URL
//                             imageUrl = `https:${rawImagePath}`;
//                         } else {
//                             // Construct Supabase Storage URL (assuming bucket is 'images')
//                             const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
//                             if (supabaseUrl) {
//                                 imageUrl = `${supabaseUrl}/storage/v1/object/public/images/${rawImagePath}`;
//                             }
//                         }
//                         console.log('🖼️ Image found for', match.index.landmark_name, ':', rawImagePath.slice(0, 80));
//                     } else {
//                         // Debug: log what fields are available to help troubleshoot
//                         console.log('❌ No image for', match.index.landmark_name,
//                             'Has image_spec:', !!imageSpec,
//                             'image_spec keys:', imageSpec ? Object.keys(imageSpec) : 'none',
//                             'paths.image:', paths?.image || 'empty');
//                     }

//                     results.push({
//                         id: match.index.id,
//                         landmark_name: match.index.landmark_name,
//                         city: match.index.city,
//                         district: match.index.district,
//                         qa_pairs: (qaPairs || []).filter(qa => qa.type !== 'ask_audio').slice(0, 5),
//                         image_path: imageUrl,
//                         relevanceScore: match.score,
//                         gps: gps,
//                     });
//                 }
//             }

//             // DEDUPLICATE: Same landmark_name + city = same location (different photos/samples)
//             // Merge QA pairs and take the first available image
//             const deduplicatedMap = new Map<string, LocationData>();
//             for (const loc of results) {
//                 const key = `${loc.landmark_name}|${loc.city}`.toLowerCase();
//                 const existing = deduplicatedMap.get(key);

//                 if (existing) {
//                     // Merge: take image if we don't have one, merge QA pairs (limit to 5)
//                     if (!existing.image_path && loc.image_path) {
//                         existing.image_path = loc.image_path;
//                     }
//                     // Add new QA pairs that don't duplicate questions
//                     const existingQuestions = new Set(existing.qa_pairs.map(qa => qa.q));
//                     for (const qa of loc.qa_pairs) {
//                         if (!existingQuestions.has(qa.q) && existing.qa_pairs.length < 5) {
//                             existing.qa_pairs.push(qa);
//                         }
//                     }
//                     // Take GPS if missing
//                     if (!existing.gps && loc.gps) {
//                         existing.gps = loc.gps;
//                     }
//                 } else {
//                     deduplicatedMap.set(key, { ...loc });
//                 }
//             }

//             const dedupedResults = Array.from(deduplicatedMap.values());
//             console.log(`📍 Deduplicated: ${results.length} → ${dedupedResults.length} unique locations`);

//             // FALLBACK: If local DB returns no results, try external search via Gemini
//             if (dedupedResults.length === 0 && query.trim().length > 3) {
//                 console.log('🔍 No local results, trying external search...');
//                 try {
//                     // Get API key for external search
//                     let apiKey: string | null = null;
//                     try {
//                         const { data: keyData } = await supabase.functions.invoke('manage-api-keys', {
//                             body: { action: 'get_active', provider: 'gemini' }
//                         });
//                         if (keyData?.api_key) apiKey = keyData.api_key;
//                     } catch { /* fallback to server-side key */ }

//                     const response = await fetch('http://localhost:3001/search/external', {
//                         method: 'POST',
//                         headers: { 'Content-Type': 'application/json' },
//                         body: JSON.stringify({ query, api_key: apiKey })
//                     });

//                     if (response.ok) {
//                         const data = await response.json();
//                         if (data.locations && data.locations.length > 0) {
//                             console.log(`🌐 External search found ${data.locations.length} results`);
//                             // Transform external results to LocationData format
//                             return data.locations.map((loc: {
//                                 landmark_name?: string;
//                                 city?: string;
//                                 district?: string;
//                                 description?: string;
//                                 qa_pairs?: Array<{ q: string; a: string }>;
//                                 is_external?: boolean;
//                             }) => ({
//                                 id: `external_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
//                                 landmark_name: loc.landmark_name || 'Unknown',
//                                 city: loc.city || '',
//                                 district: loc.district || '',
//                                 qa_pairs: loc.qa_pairs?.map(qa => ({ ...qa, type: 'generated' })) || [],
//                                 image_path: undefined, // External results don't have images
//                                 relevanceScore: 0.5,
//                                 isExternal: true, // Flag for UI to know this is from external source
//                             })) as LocationData[];
//                         }
//                     }
//                 } catch (err) {
//                     console.warn('External search failed:', err);
//                 }
//             }

//             return dedupedResults;
//         } catch (err) {
//             console.error('Location search error:', err);
//             return [];
//         }
//     }, [loadLocationIndex]);

//     // Get user context from event history (enhanced for recommendations)
//     const getUserContext = useCallback(async (): Promise<UserContext> => {
//         if (!user?.id) {
//             return { recentViews: [], topInterests: [], recentSearches: [] };
//         }

//         try {
//             // Get recent views (increased limit for better context)
//             const { data: recentViewsData } = await supabase
//                 .from('user_events')
//                 .select('object_id, object_type, score, created_at')
//                 .eq('user_id', user.id)
//                 .in('event_type', ['view_item', 'click'])
//                 .order('created_at', { ascending: false })
//                 .limit(30);

//             // Apply time-weighted scoring (more recent = higher weight)
//             const now = Date.now();
//             const weightedViews = (recentViewsData || []).map((item, index) => {
//                 const ageHours = (now - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
//                 const timeWeight = Math.max(0.3, 1 - (ageHours / 168)); // Decay over 1 week
//                 return {
//                     ...item,
//                     score: (item.score || 1) * timeWeight * (1 - index * 0.02), // Also weight by recency order
//                 };
//             });

//             // Get top interests (aggregated scores with time weighting)
//             const interestMap = new Map<string, number>();
//             for (const item of weightedViews) {
//                 if (item.object_id) {
//                     const current = interestMap.get(item.object_id) || 0;
//                     interestMap.set(item.object_id, current + (item.score || 0));
//                 }
//             }
//             const topInterests = Array.from(interestMap.entries())
//                 .map(([object_id, total_score]) => ({ object_id, total_score }))
//                 .sort((a, b) => b.total_score - a.total_score)
//                 .slice(0, 5);

//             // Get recent searches from user_events
//             const { data: searchData } = await supabase
//                 .from('user_events')
//                 .select('payload')
//                 .eq('user_id', user.id)
//                 .eq('event_type', 'search')
//                 .order('created_at', { ascending: false })
//                 .limit(10);

//             const recentSearches = (searchData || [])
//                 .map(s => (s.payload as Record<string, unknown>)?.keyword as string)
//                 .filter(Boolean);

//             // Get recent chat queries from chat_logs for better context
//             const { data: chatData } = await supabase
//                 .from('chat_logs')
//                 .select('message')
//                 .eq('user_id', user.id)
//                 .eq('role', 'user')
//                 .order('created_at', { ascending: false })
//                 .limit(10);

//             const recentQueries = (chatData || [])
//                 .map(c => c.message as string)
//                 .filter(q => q && q.length > 5); // Filter out very short messages

//             // Extract preferred cities from viewed locations
//             const cityMap = new Map<string, number>();
//             for (const item of weightedViews) {
//                 if (item.object_type === 'city' || item.object_id?.includes('_')) {
//                     // Try to extract city from object_id format like "location_hanoi"
//                     const city = item.object_id?.split('_').pop() || '';
//                     if (city) {
//                         cityMap.set(city, (cityMap.get(city) || 0) + (item.score || 1));
//                     }
//                 }
//             }
//             const preferredCities = Array.from(cityMap.entries())
//                 .sort((a, b) => b[1] - a[1])
//                 .slice(0, 3)
//                 .map(([city]) => city);

//             return {
//                 recentViews: weightedViews.slice(0, 10),
//                 topInterests,
//                 recentSearches: [...new Set([...recentSearches, ...recentQueries.slice(0, 5)])].slice(0, 10),
//             };
//         } catch (err) {
//             console.error('Failed to get user context:', err);
//             return { recentViews: [], topInterests: [], recentSearches: [] };
//         }
//     }, [user?.id]);

//     // Build RAG prompt with context and conversation history
//     const buildRAGPrompt = useCallback((
//         query: string,
//         locations: LocationData[],
//         userContext: UserContext,
//         conversationHistory: ChatMessage[] = []
//     ): string => {
//         const contextParts: string[] = [];

//         // Add conversation history (last 10 messages for context continuity)
//         if (conversationHistory.length > 0) {
//             const recentMessages = conversationHistory.slice(-10);
//             const historyText = recentMessages
//                 .filter(m => !m.isLoading)
//                 .map(m => `${m.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${m.content.slice(0, 500)}`)
//                 .join('\n');

//             if (historyText.length > 0) {
//                 contextParts.push('--- LỊCH SỬ HỘI THOẠI GẦN ĐÂY ---');
//                 contextParts.push(historyText);
//                 contextParts.push('--- KẾT THÚC LỊCH SỬ ---\n');
//             }
//         }

//         // Add user context
//         if (userContext.recentViews.length > 0) {
//             const viewedPlaces = userContext.recentViews
//                 .filter(v => v.object_type === 'place' || v.object_type === 'landmark')
//                 .map(v => v.object_id)
//                 .slice(0, 5);
//             if (viewedPlaces.length > 0) {
//                 contextParts.push(`Người dùng gần đây đã xem các địa điểm: ${viewedPlaces.join(', ')}`);
//             }
//         }

//         if (userContext.topInterests.length > 0) {
//             const interests = userContext.topInterests.map(i => i.object_id).slice(0, 3);
//             contextParts.push(`Sở thích chính: ${interests.join(', ')}`);
//         }

//         if (userContext.recentSearches.length > 0) {
//             contextParts.push(`Tìm kiếm gần đây: ${userContext.recentSearches.join(', ')}`);
//         }

//         // Add location knowledge
//         if (locations.length > 0) {
//             contextParts.push('\n--- DỮ LIỆU ĐỊA ĐIỂM DU LỊCH ---');
//             for (const loc of locations) {
//                 let locInfo = `\n📍 ${loc.landmark_name} (${loc.district}, ${loc.city})`;

//                 // Add GPS if available (important for map queries)
//                 if (loc.gps) {
//                     locInfo += `\n   Tọa độ: ${loc.gps.lat}, ${loc.gps.lon}`;
//                 }

//                 // Add image URL if available (for image requests)
//                 if (loc.image_path) {
//                     locInfo += `\n   Hình ảnh: ${loc.image_path}`;
//                 }

//                 if (loc.qa_pairs.length > 0) {
//                     locInfo += '\nThông tin chi tiết:';
//                     for (const qa of loc.qa_pairs) {
//                         locInfo += `\n  Q: ${qa.q}\n  A: ${qa.a}`;
//                     }
//                 }
//                 contextParts.push(locInfo);
//             }
//         }

//         const systemContext = contextParts.length > 0
//             ? `\n\n[CONTEXT CHO CHATBOT - DÙNG ĐỂ TRẢ LỜI CHÍNH XÁC HƠN]\n${contextParts.join('\n')}\n[KẾT THÚC CONTEXT]\n`
//             : '';

//         // Log context to console for debugging/transparency
//         if (systemContext) {
//             console.log('🔍 [RAG Context Generated]:', systemContext);
//         }

//         const formatInstructions = `
// ## HƯỚNG DẪN PHONG CÁCH TRẢ LỜI:

// ### 🔴 QUY TẮC QUAN TRỌNG VỀ CÂU TRẢ LỜI NGẮN (Có/Ok/Tiếp/Ừ/Vâng):
// - Khi user trả lời "Có", "Ok", "Tiếp", "Ừ", "Vâng", "Đúng rồi" → **TIẾP TỤC chủ đề trước đó**
// - Nếu trước đó đang nói về Hạ Long → tiếp tục nói về Hạ Long
// - Nếu trước đó đang nói về Đà Nẵng → tiếp tục nói về Đà Nẵng
// - **TUYỆT ĐỐI KHÔNG** chuyển sang chủ đề mới không liên quan
// - **TUYỆT ĐỐI KHÔNG** bắt đầu nói về địa điểm khác khi user chỉ xác nhận "Có"

// ### Quy tắc về ngữ cảnh hội thoại:
// - Câu hỏi ĐẦU TIÊN của user: Có thể chào hỏi ngắn gọn, tự nhiên (VD: "Chào bạn! 👋" hoặc bắt đầu luôn)
// - Câu hỏi TIẾP THEO trong cùng hội thoại: KHÔNG lặp lại chào hỏi, trả lời trực tiếp vào vấn đề
// - Câu trả lời ngắn (Có/Không/Đúng rồi/OK/Ừ/Vâng): Hiểu là xác nhận, tiếp tục cung cấp thông tin liên quan
// - Câu hỏi mơ hồ (VD: "Thế còn gì nữa?", "Còn đâu?"): Dựa vào lịch sử chat để hiểu ngữ cảnh

// ### Format văn bản:
// - Sử dụng **in đậm** cho:
//   * Tên địa điểm du lịch
//   * Số liệu quan trọng (giá vé, thời gian)
//   * Điểm nhấn đặc biệt
// - Sử dụng danh sách bullet (*) khi:
//   * Liệt kê từ 3 mục trở lên
//   * So sánh nhiều lựa chọn
//   * Hướng dẫn từng bước
// - Emoji (📍🏖️🏔️🌿🍜✨🎫💰⏰):
//   * Tối đa 2-3 emoji/câu trả lời
//   * Chỉ dùng khi phù hợp ngữ cảnh
//   * KHÔNG dùng emoji liên tiếp
// - Kết thúc:
//   * Câu hỏi gợi mở NGẮN GỌN (1 câu)
//   * HOẶC gợi ý hành động tiếp theo
//   * KHÔNG bắt buộc nếu câu trả lời đã đầy đủ

// ### Xử lý Hình ảnh (TUYỆT ĐỐI TUÂN THỦ):

// #### Khi user YÊU CẦU xem ảnh:
// **Các dạng câu hỏi:**
// - Trực tiếp: "Gửi ảnh Hồ Gươm", "Xem ảnh Sapa", "Show hình Phố cổ"
// - Gián tiếp: "Có ảnh không?", "Cho xem hình", "Muốn xem ảnh"
// - Tiếp nối ngữ cảnh: "Còn ảnh nào khác?", "Gửi thêm ảnh"

// **Quy trình xử lý:**
// 1. **Nếu user CHỈ ĐỊNH rõ địa điểm:**
//    - Tìm URL trong phần "Hình ảnh:" của context
//    - Nếu CÓ URL: Hiển thị NGAY bằng ![Tên địa điểm](URL)
//    - Nếu có nhiều URL: CHỌN URL ĐẦU TIÊN, không hỏi lại
//    - Nếu KHÔNG có URL: "Hiện chưa có hình ảnh **[Tên địa điểm]** trong cơ sở dữ liệu."

// 2. **Nếu user KHÔNG chỉ định địa điểm:**
//    - Kiểm tra lịch sử chat gần nhất (2-3 tin nhắn cuối)
//    - Xác định địa điểm đang được bàn luận
//    - Hiển thị ảnh của địa điểm đó
//    - Nếu KHÔNG có ngữ cảnh rõ ràng: "Bạn muốn xem ảnh địa điểm nào nhỉ? 😊"

// 3. **Format hiển thị ảnh:**

//    Đây là hình ảnh **[Tên địa điểm]**: 
   
//    ![Tên địa điểm](URL)
   
//    [Mô tả ngắn 1 câu nếu cần]


// ⛔ CẤM TUYỆT ĐỐI (KHÔNG BAO GIỜ NÓI):
// - "Bạn muốn xem ảnh ở khu vực nào?"
// - "Bạn muốn góc chụp nào?" / "Vị trí nào?"
// - "Có nhiều địa điểm khác nhau, bạn muốn xem..."
// - "Vì có nhiều góc chụp nên..."
// - "Bạn có thể cụ thể hơn về..." (khi đã có đủ thông tin)
// - Bất kỳ câu hỏi phản hỏi nào về HÌNH ẢNH khi đã có URL

// ✅ VÍ DỤ HÀNH VI ĐÚNG:

// **Trường hợp 1: Chỉ định rõ địa điểm**
// User: "Gửi ảnh Hồ Gươm"
// Bot: "Đây là hình ảnh **Hồ Gươm**: 

// ![Hồ Gươm, Hà Nội](https://example.com/hoguom.jpg)

// Hồ Gươm đẹp nhất vào buổi sáng sớm hoặc chiều tà đấy! ✨"

// **Trường hợp 2: Không chỉ định nhưng có ngữ cảnh**
// User: "Mình muốn đi Sapa"
// Bot: "Sapa là lựa chọn tuyệt vời!..."
// User: "Có ảnh không?"
// Bot: "Đây là hình ảnh **Sapa**:

// ![Sapa, Lào Cai](https://example.com/sapa.jpg)"

// **Trường hợp 3: Nhiều URL - chọn đầu tiên**
// Data: 
// Hình ảnh: 
// - https://example.com/hoguom1.jpg
// - https://example.com/hoguom2.jpg

// User: "Xem ảnh Hồ Gươm"
// Bot: "Đây là hình ảnh **Hồ Gươm**:

// ![Hồ Gươm](https://example.com/hoguom1.jpg)"

// **Trường hợp 4: Không có ảnh**
// User: "Gửi ảnh Chùa Một Cột"
// Bot: "Hiện chưa có hình ảnh **Chùa Một Cột** trong cơ sở dữ liệu. Mình có thể cung cấp thông tin chi tiết về địa điểm này nhé!"

// ### Xử lý các trường hợp đặc biệt:

// #### 1. Câu hỏi ngoài phạm vi du lịch:
// - Lịch sự từ chối: "Mình chuyên tư vấn du lịch Việt Nam, có thể giúp bạn vấn đề này không nhỉ? 😊"
// - Gợi ý quay lại chủ đề: "Bạn muốn khám phá địa điểm nào ở Việt Nam không?"

// #### 2. Thông tin không có trong database:
// - **ƯU TIÊN database** nếu có thông tin liên quan
// - **NẾU database KHÔNG CÓ câu trả lời cụ thể** (ví dụ: quán ăn, khách sạn, thời tiết, giá cả mới nhất):
//   → **SỬ DỤNG kiến thức của bạn (Gemini)** để trả lời
//   → Trả lời tự nhiên, KHÔNG nói "không có trong database" hoặc "chưa có thông tin"
//   → Chỉ ghi chú nếu thông tin có thể đã cũ: "Bạn nên kiểm tra lại giá mới nhất nhé!"
// - **CHỈ CÓ HÌNH ẢNH** mới bị giới hạn bởi database (vì cần URL cụ thể)

// #### 3. Câu hỏi mơ hồ:
// User: "Còn gì nữa?"
// → Xem lịch sử: Đang nói về Hà Nội → Gợi ý thêm địa điểm Hà Nội
// → Đang nói về biển → Gợi ý bãi biển khác

// #### 4. So sánh địa điểm:
// - Dùng bảng hoặc format rõ ràng
// - Đưa ra ưu/nhược điểm cụ thể
// - Gợi ý dựa trên sở thích user (nếu có)

// #### 5. Lịch trình nhiều ngày:
// - Chia theo ngày rõ ràng
// - Đề xuất thời gian hợp lý
// - Tính khả thi di chuyển

// ### Ví dụ phong cách tự nhiên:

// ✅ **Tốt:**
// User: "Hà Nội có gì hay?"
// Bot: "Hà Nội có rất nhiều điểm đến thú vị! Một số gợi ý:

// * **Phố Cổ** - Khám phá 36 phố phường sầm uất 🏮
// * **Hồ Gươm** - Dạo quanh hồ buổi sáng sớm 🌅
// * **Văn Miếu** - Tìm hiểu di sản văn hóa 📚

// Bạn thích văn hóa lịch sử hay thiên nhiên hơn?"

// ❌ **Tránh:**
// "Chào bạn! 👋 Rất vui được hỗ trợ bạn! 😊 Hà Nội có nhiều địa điểm tuyệt vời! ✨ 
// Bạn muốn tìm hiểu về loại hình du lịch nào? Văn hóa? Lịch sử? Thiên nhiên? 
// Hay ẩm thực? Hoặc mua sắm? Hãy cho mình biết sở thích của bạn nhé! 🎉"

// ### Checklist trước khi trả lời:
// - [ ] Đã kiểm tra lịch sử chat?
// - [ ] Câu trả lời có trực tiếp giải quyết câu hỏi?
// - [ ] Có lặp lại chào hỏi không cần thiết không?
// - [ ] Format văn bản dễ đọc?
// - [ ] Nếu có yêu cầu ảnh: Đã kiểm tra URL và hiển thị đúng?
// - [ ] Thông tin chính xác dựa trên context?
// `;

//         return `Bạn là trợ lý du lịch Việt Nam thông minh, thân thiện và chuyên nghiệp.

// ## NHIỆM VỤ:
// - Tư vấn địa điểm du lịch dựa trên dữ liệu được cung cấp VÀ lịch sử hội thoại
// - Cung cấp thông tin chính xác về các địa danh Việt Nam
// - Gợi ý lịch trình, ẩm thực và hoạt động phù hợp với sở thích user
// - DUY TRÌ NGỮ CẢNH: Nếu user hỏi tiếp về địa điểm đã đề cập, trả lời liên quan đến địa điểm đó

// ## QUY TẮC SỬ DỤNG THÔNG TIN:
// 1. **ƯU TIÊN database context** nếu có thông tin liên quan trực tiếp
// 2. **NẾU database KHÔNG CÓ thông tin cụ thể** (quán ăn, khách sạn, thời tiết, giá cả, hướng dẫn di chuyển...):
//    → Hãy **SỬ DỤNG KIẾN THỨC CỦA BẠN** để trả lời một cách hữu ích
//    → **KHÔNG NÓI** "không có thông tin", "chưa có trong database", "mình không biết"
//    → Trả lời tự nhiên như một hướng dẫn viên du lịch am hiểu
// 3. **CHỈ HÌNH ẢNH** mới giới hạn bởi database URL - nếu không có URL thì nói "chưa có hình ảnh trong cơ sở dữ liệu"

// ## DỮ LIỆU CONTEXT:
// ${systemContext}

// ## LỊCH SỬ HỘI THOẠI:
// [Hệ thống sẽ tự động cung cấp]

// ## CÂU HỎI HIỆN TẠI:
// ${query}

// ${formatInstructions}

// ---
// LƯU Ý QUAN TRỌNG:
// - Ưu tiên CHẤT LƯỢNG hơn SỐ LƯỢNG thông tin
// - Câu trả lời NGẮN GỌN, SÚNG TỈ (2-4 câu cho câu hỏi đơn giản)
// - Với ảnh: LUÔN LUÔN hiển thị ngay nếu có URL, KHÔNG hỏi lại
// - Đọc kỹ lịch sử chat trước khi trả lời
// - **QUAN TRỌNG: Nếu database không có → DÙNG KIẾN THỨC CỦA BẠN, đừng nói "không có thông tin"**`;
//     }, []);

//     // Save chat log to database (with optional attachments for image persistence)
//     const saveChatLog = useCallback(async (
//         role: 'user' | 'assistant',
//         message: string,
//         context?: unknown,
//         modelUsed?: string,
//         responseTimeMs?: number,
//         attachments?: Array<{ url: string; type: string; name?: string }>
//     ) => {
//         if (!user?.id) return;

//         try {
//             // Note: attachments column requires migration 20260120_chat_ui_enhancements.sql
//             // If migration not applied, insert without attachments
//             await supabase.from('chat_logs').insert({
//                 user_id: user.id,
//                 session_id: sessionIdRef.current,
//                 role,
//                 message,
//                 context: context as Record<string, unknown>,
//                 model_used: modelUsed,
//                 response_time_ms: responseTimeMs,
//                 // attachments: attachments || [], // Uncomment after migration
//             });
//         } catch (err) {
//             console.error('Failed to save chat log:', err);
//         }
//     }, [user?.id]);

//     // Update feedback score for a message
//     const updateFeedback = useCallback(async (messageId: string, feedbackScore: number) => {
//         if (!user?.id) return;

//         // Update local state
//         setMessages(prev => prev.map(msg =>
//             msg.id === messageId ? { ...msg, feedbackScore } : msg
//         ));

//         // Update in database (find by content match in recent logs)
//         try {
//             const message = messages.find(m => m.id === messageId);
//             if (message) {
//                 await supabase
//                     .from('chat_logs')
//                     .update({ feedback_score: feedbackScore })
//                     .eq('user_id', user.id)
//                     .eq('session_id', sessionIdRef.current)
//                     .eq('role', message.role)
//                     .ilike('message', message.content.slice(0, 100) + '%')
//                     .order('created_at', { ascending: false })
//                     .limit(1);
//             }
//         } catch (err) {
//             console.error('Failed to update feedback:', err);
//         }
//     }, [user?.id, messages]);

//     // Send message with RAG
//     const sendMessage = useCallback(async (
//         content: string,
//         attachments?: Array<{ url: string; type: string; name?: string }>
//     ) => {
//         if ((!content.trim() && !attachments?.length) || !user?.id) return;

//         // Store attachments as structured data (not text) for visual rendering
//         const userMessage: ChatMessage = {
//             id: crypto.randomUUID(),
//             role: 'user',
//             content: content.trim(),
//             timestamp: new Date(),
//             attachments: attachments?.map(a => ({
//                 url: a.url,
//                 type: a.type,
//                 name: a.name || 'file',
//             })),
//         };
//         setMessages(prev => [...prev, userMessage]);

//         // Add loading message
//         const loadingMessage: ChatMessage = {
//             id: crypto.randomUUID(),
//             role: 'assistant',
//             content: '',
//             timestamp: new Date(),
//             isLoading: true,
//         };
//         setMessages(prev => [...prev, loadingMessage]);
//         setIsLoading(true);

//         const startTime = Date.now();

//         try {
//             // Ensure session exists (creates on first message with auto-generated title)
//             // Check if we need to create a new session (sessionIdRef is empty or null)
//             if (!currentSessionId && !sessionIdRef.current) {
//                 await ensureSession(content);
//             } else if (!currentSessionId && sessionIdRef.current === '') {
//                 // New session mode: sessionIdRef is explicitly empty string
//                 await ensureSession(content);
//             }

//             // ===== NEW RAG PIPELINE =====
//             // Step 1: Call backend to rewrite query if needed
//             let searchQuery = content;
//             let locations: LocationData[] = [];
//             let skipRetrieval = false;
//             let rewriteDebug = {};

//             try {
//                 const ragResponse = await fetch('http://localhost:3001/rag/process', {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({
//                         query: content,
//                         session_id: sessionIdRef.current, // For session-based memory
//                         history: messages.slice(-6).map(m => ({
//                             role: m.role,
//                             content: m.content.slice(0, 300) // Truncate for efficiency
//                         })),
//                     }),
//                 });

//                 if (ragResponse.ok) {
//                     const ragResult = await ragResponse.json();
//                     searchQuery = ragResult.rewritten_query || content;
//                     skipRetrieval = ragResult.skip_retrieval || false;
//                     rewriteDebug = ragResult.debug || {};

//                     if (ragResult.rewritten_query !== content) {
//                         console.log(`🔄 Query rewritten: "${content}" → "${ragResult.rewritten_query}"`);
//                     }
//                     if (ragResult.current_topic) {
//                         console.log(`📍 Memory topic: ${ragResult.current_topic}`);
//                     }
//                     if (ragResult.entities?.length > 0) {
//                         console.log(`🏷️ Entities tracked: ${ragResult.entities.join(', ')}`);
//                     }
//                     if (skipRetrieval) {
//                         console.log('⏭️ Skipping retrieval per RAG pipeline');
//                     }
//                 }
//             } catch (e) {
//                 console.warn('RAG process failed, using original query:', e);
//             }

//             // Step 2: Search with rewritten query (unless skip_retrieval)
//             if (!skipRetrieval) {
//                 locations = await searchLocations(searchQuery, messages);
//             } else {
//                 console.log('🛡️ Using previous context (retrieval skipped)');
//             }

//             const userContext = await getUserContext();

//             // Build prompt with context AND conversation history
//             // If affirmative, buildRAGPrompt will use conversation history to maintain context
//             let ragPrompt = buildRAGPrompt(content, locations, userContext, messages);

//             // Handle image attachments - CRITICAL: Don't bias image identification with context
//             const imageAttachments = attachments?.filter(a => a.type.startsWith('image/')) || [];

//             if (imageAttachments.length > 0) {
//                 // Check if user is asking for image identification (not just sending with context)
//                 const isIdentificationQuery = /đây\s*(là)?\s*(ở)?\s*đâu|này\s*là\s*(gì|đâu)|ảnh\s*này|hình\s*này|nhận\s*diện|identify|what.*this|where.*this/i.test(content);

//                 if (isIdentificationQuery) {
//                     // For image identification: DON'T include RAG context - let Vision analyze freely
//                     console.log('📸 Image identification mode - sending to Vision API without context bias');
//                     ragPrompt = `Bạn là chuyên gia nhận diện địa điểm du lịch Việt Nam.

// QUAN TRỌNG: Hãy NHÌN KỸ vào hình ảnh được gửi kèm và xác định địa điểm DỰA TRÊN những gì bạn THỰC SỰ THẤY trong ảnh.

// Câu hỏi của người dùng: ${content}

// Hãy:
// 1. Mô tả ngắn gọn những gì bạn thấy trong ảnh (kiến trúc, cảnh quan, biển hiệu, v.v.)
// 2. Xác định tên địa điểm (nếu nhận ra)
// 3. Cho biết thành phố/tỉnh nếu biết
// 4. Nếu KHÔNG chắc chắn, hãy nói rõ là bạn không chắc và đưa ra các gợi ý có thể

// KHÔNG đoán bừa dựa trên context khác. CHỈ trả lời dựa trên hình ảnh.`;
//                 } else {
//                     // For other image queries (e.g. "cho tôi thêm thông tin về ảnh này")
//                     ragPrompt = `${ragPrompt}

// [HÌNH ẢNH ĐÍNH KÈM]
// Người dùng đã gửi ${imageAttachments.length} hình ảnh. Hãy phân tích hình ảnh và trả lời câu hỏi của họ.`;
//                 }
//             }

//             // Save user message to chat log (with attachments for persistence)
//             await saveChatLog('user', content, undefined, undefined, undefined, attachments);

//             // Fetch API key from Supabase
//             let apiKey: string | null = null;
//             try {
//                 const { data: keyData, error: keyError } = await supabase.functions.invoke('manage-api-keys', {
//                     body: { action: 'get_active', provider: 'gemini' }
//                 });

//                 if (!keyError && keyData?.api_key) {
//                     apiKey = keyData.api_key;
//                 }
//             } catch (e) {
//                 console.warn('Failed to get API key from Supabase, trying Python server fallback:', e);
//             }

//             // Call Gemini API via Python server
//             const response = await fetch('http://localhost:3001/chat/generate', {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify({
//                     prompt: ragPrompt,
//                     model: 'gemini-2.5-flash',
//                     temperature: 0.7,
//                     max_tokens: 2048,
//                     api_key: apiKey,
//                     image_urls: imageAttachments.map(a => a.url), // Pass image URLs for Vision API
//                 }),
//             });

//             const responseTimeMs = Date.now() - startTime;

//             if (!response.ok) {
//                 const errorData = await response.json().catch(() => ({}));
//                 throw new Error(errorData.error || `HTTP ${response.status}`);
//             }

//             const data = await response.json();

//             // Check for error in response body
//             if (data.error) {
//                 console.error('Gemini API error:', data.error);
//                 throw new Error(data.error);
//             }

//             const assistantContent = data?.text || 'Xin lỗi, tôi không thể xử lý yêu cầu này. Vui lòng thử lại.';

//             // POST-PROCESSING: Detect and log forbidden clarification questions
//             const forbiddenPatterns = [
//                 /bạn muốn xem ảnh.*(khu vực|góc|địa điểm) nào/i,
//                 /có nhiều (địa điểm|góc chụp|khu vực) khác nhau/i,
//                 /vì có nhiều (góc|địa điểm|khu vực)/i,
//                 /góc chụp nào/i,
//                 /bạn quan tâm đến (vị trí|khu vực|góc) nào/i,
//             ];

//             let finalContent = assistantContent;
//             const isImageRequest = content.toLowerCase().match(/(ảnh|hình|pic|photo|gửi|xem)/);

//             for (const pattern of forbiddenPatterns) {
//                 if (pattern.test(assistantContent)) {
//                     console.warn('⚠️ AI violated image rule! Response contains:', assistantContent.match(pattern)?.[0]);

//                     // If this was an image request and AI asked clarification, try to provide helpful fallback
//                     if (isImageRequest && locations.length > 0) {
//                         const firstLocWithImage = locations.find(l => l.image_path);
//                         if (firstLocWithImage) {
//                             finalContent = `Đây là hình ảnh **${firstLocWithImage.landmark_name}**:\n\n![${firstLocWithImage.landmark_name}](${firstLocWithImage.image_path})\n\nBạn có muốn biết thêm thông tin về địa điểm này không?`;
//                             console.log('🔄 Auto-corrected with image from:', firstLocWithImage.landmark_name);
//                         } else {
//                             finalContent = 'Hiện chưa có hình ảnh cho địa điểm này trong cơ sở dữ liệu. Bạn có muốn biết thông tin khác không?';
//                             console.log('🔄 No image available, providing fallback message');
//                         }
//                     }
//                     break;
//                 }
//             }

//             // Update loading message with actual content
//             setMessages(prev => prev.map(msg =>
//                 msg.id === loadingMessage.id
//                     ? { ...msg, content: finalContent, isLoading: false }
//                     : msg
//             ));

//             // Save assistant response to chat log
//             await saveChatLog(
//                 'assistant',
//                 assistantContent,
//                 { locations: locations.map(l => l.landmark_name), userContext },
//                 'gemini-2.5-flash',
//                 responseTimeMs
//             );

//         } catch (err) {
//             console.error('Chat error:', err);

//             // Update loading message with error
//             setMessages(prev => prev.map(msg =>
//                 msg.id === loadingMessage.id
//                     ? {
//                         ...msg,
//                         content: 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.',
//                         isLoading: false
//                     }
//                     : msg
//             ));
//         } finally {
//             setIsLoading(false);
//         }
//     }, [user?.id, searchLocations, getUserContext, buildRAGPrompt, saveChatLog]);

//     // Load a specific session and its messages
//     const loadSession = useCallback(async (sessionId: string) => {
//         if (!user?.id) return;

//         try {
//             // Load session info
//             const { data: sessionData } = await supabase
//                 .from('chat_sessions')
//                 .select('*')
//                 .eq('id', sessionId)
//                 .single();

//             if (sessionData) {
//                 setCurrentSessionId(sessionId);
//                 setCurrentSessionTitle(sessionData.title);
//                 sessionIdRef.current = sessionId;
//             }

//             // Load messages
//             const { data: messagesData, error } = await supabase
//                 .from('chat_logs')
//                 .select('*')
//                 .eq('user_id', user.id)
//                 .eq('session_id', sessionId)
//                 .order('created_at', { ascending: true });

//             if (error) {
//                 console.error('Failed to load messages:', error);
//                 return;
//             }

//             if (messagesData && messagesData.length > 0) {
//                 setMessages(messagesData.map(log => ({
//                     id: log.id.toString(),
//                     role: log.role as 'user' | 'assistant',
//                     content: log.message,
//                     timestamp: new Date(log.created_at),
//                     feedbackScore: log.feedback_score,
//                     attachments: (log.attachments as Array<{ url: string; type: string; name: string }>) || [],
//                 })));
//             } else {
//                 setMessages([]);
//             }
//         } catch (err) {
//             console.error('Load session error:', err);
//         }
//     }, [user?.id]);

//     // Load all sessions for the user
//     const loadSessions = useCallback(async (autoSelectRecent = false) => {
//         if (!user?.id) return;

//         try {
//             const { data, error } = await supabase
//                 .from('chat_sessions')
//                 .select('*')
//                 .eq('user_id', user.id)
//                 .eq('is_active', true)
//                 .order('updated_at', { ascending: false });

//             if (error) {
//                 console.error('Failed to load sessions:', error);
//                 return;
//             }

//             if (data) {
//                 // Sort: pinned first, then by updated_at
//                 const sortedData = data.sort((a, b) => {
//                     if (a.is_pinned && !b.is_pinned) return -1;
//                     if (!a.is_pinned && b.is_pinned) return 1;
//                     return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
//                 });
//                 setSessions(sortedData.map(s => ({
//                     id: s.id,
//                     title: s.title,
//                     first_message: s.first_message,
//                     message_count: s.message_count || 0,
//                     created_at: s.created_at,
//                     updated_at: s.updated_at,
//                     is_pinned: s.is_pinned || false,
//                 })));

//                 // Auto-select most recent session if requested (e.g. on page load)
//                 if (autoSelectRecent && data.length > 0) {
//                     const mostRecent = data[0];
//                     console.log('Restoring most recent session:', mostRecent.title);
//                     loadSession(mostRecent.id);
//                 }
//             }
//         } catch (err) {
//             console.error('Load sessions error:', err);
//         }
//     }, [user?.id, loadSession]); // Added loadSession dependency

//     // Create a new session
//     const createNewSession = useCallback(async () => {
//         setMessages([]);
//         // Set to empty string to indicate we need a new session on first message
//         sessionIdRef.current = '';
//         setCurrentSessionId(null); // Will be created on first message
//         setCurrentSessionTitle('Cuộc hội thoại mới');
//     }, []);

//     // Create or update session on first message of a new conversation
//     const ensureSession = useCallback(async (firstMessage: string) => {
//         // Use ref for reliable check (state can be stale in closures)
//         if (!user?.id) return null;
//         // Only return early if we have a valid session (not empty string)
//         if (currentSessionId) return currentSessionId;
//         if (sessionIdRef.current && sessionIdRef.current !== '') return sessionIdRef.current;

//         try {
//             // Generate a fresh session ID to avoid conflicts
//             const newSessionId = crypto.randomUUID();
//             sessionIdRef.current = newSessionId;

//             // Generate short title using Gemini API (4-5 words max)
//             let title = '';
//             try {
//                 const response = await fetch('http://localhost:3001/chat/generate', {
//                     method: 'POST',
//                     headers: { 'Content-Type': 'application/json' },
//                     body: JSON.stringify({
//                         prompt: `Tạo tiêu đề ngắn gọn (tối đa 4-5 từ) cho cuộc hội thoại bắt đầu bằng câu: "${firstMessage.slice(0, 100)}". CHỈ trả lời TIÊU ĐỀ, không giải thích.`,
//                         model: 'gemini-2.5-flash',
//                         temperature: 0.3,
//                         max_tokens: 50,
//                     }),
//                 });
//                 if (response.ok) {
//                     const data = await response.json();
//                     if (data.text) {
//                         // Clean up: remove quotes, trim, max 30 chars
//                         title = data.text.replace(/["""'']/g, '').trim().slice(0, 30);
//                     }
//                 }
//             } catch (e) {
//                 console.warn('Failed to generate title via Gemini:', e);
//             }

//             // Fallback: truncate first message to 4-5 words
//             if (!title) {
//                 const words = firstMessage.split(/\s+/).slice(0, 5).join(' ');
//                 title = words.length > 30 ? words.slice(0, 27) + '...' : words;
//             }

//             const { data, error } = await supabase
//                 .from('chat_sessions')
//                 .insert({
//                     id: newSessionId,
//                     user_id: user.id,
//                     title,
//                     first_message: firstMessage,
//                     message_count: 1,
//                 })
//                 .select()
//                 .single();

//             if (error) {
//                 // If duplicate key error, try again with new ID
//                 if (error.code === '23505') {
//                     const retryId = crypto.randomUUID();
//                     sessionIdRef.current = retryId;

//                     const { data: retryData } = await supabase
//                         .from('chat_sessions')
//                         .insert({
//                             id: retryId,
//                             user_id: user.id,
//                             title,
//                             first_message: firstMessage,
//                             message_count: 1,
//                         })
//                         .select()
//                         .single();

//                     if (retryData) {
//                         setCurrentSessionId(retryData.id);
//                         setCurrentSessionTitle(retryData.title);
//                         loadSessions();
//                         return retryData.id;
//                     }
//                 }
//                 console.error('Failed to create session:', error);
//                 return null;
//             }

//             if (data) {
//                 setCurrentSessionId(data.id);
//                 setCurrentSessionTitle(data.title);
//                 // Refresh session list
//                 loadSessions();
//                 return data.id;
//             }
//         } catch (err) {
//             console.error('Create session error:', err);
//         }
//         return null;
//     }, [user?.id, currentSessionId, loadSessions]);

//     // Update session message count
//     const updateSessionMessageCount = useCallback(async () => {
//         if (!currentSessionId) return;

//         try {
//             await supabase
//                 .from('chat_sessions')
//                 .update({
//                     message_count: messages.length + 1,
//                     updated_at: new Date().toISOString()
//                 })
//                 .eq('id', currentSessionId);
//         } catch (err) {
//             console.error('Update session error:', err);
//         }
//     }, [currentSessionId, messages.length]);

//     // Delete a session (soft delete - set is_active to false)
//     const deleteSession = useCallback(async (sessionId: string) => {
//         if (!user?.id) return;

//         try {
//             await supabase
//                 .from('chat_sessions')
//                 .update({ is_active: false })
//                 .eq('id', sessionId)
//                 .eq('user_id', user.id);

//             // If we deleted the current session, clear chat and prepare for new session
//             if (sessionId === currentSessionId || sessionId === sessionIdRef.current) {
//                 setMessages([]);
//                 setCurrentSessionId(null);
//                 setCurrentSessionTitle('Cuộc hội thoại mới');
//                 // Set to empty string to indicate new session needed on first message
//                 sessionIdRef.current = '';
//             }

//             // Refresh session list
//             await loadSessions();
//         } catch (err) {
//             console.error('Delete session error:', err);
//         }
//     }, [user?.id, currentSessionId, loadSessions]);

//     // Pin/unpin a session
//     const pinSession = useCallback(async (sessionId: string) => {
//         if (!user?.id) return;

//         try {
//             // Get current pin state
//             const session = sessions.find(s => s.id === sessionId);
//             const newPinState = !session?.is_pinned;

//             await supabase
//                 .from('chat_sessions')
//                 .update({ is_pinned: newPinState })
//                 .eq('id', sessionId)
//                 .eq('user_id', user.id);

//             // Refresh session list
//             await loadSessions();
//         } catch (err) {
//             console.error('Pin session error:', err);
//         }
//     }, [user?.id, sessions, loadSessions]);

//     // Rename a session
//     const renameSession = useCallback(async (sessionId: string, newTitle: string) => {
//         if (!user?.id || !newTitle.trim()) return;

//         try {
//             await supabase
//                 .from('chat_sessions')
//                 .update({ title: newTitle.trim() })
//                 .eq('id', sessionId)
//                 .eq('user_id', user.id);

//             // Update local state immediately
//             setSessions(prev => prev.map(s =>
//                 s.id === sessionId ? { ...s, title: newTitle.trim() } : s
//             ));

//             // Update current title if renaming active session
//             if (sessionId === currentSessionId) {
//                 setCurrentSessionTitle(newTitle.trim());
//             }
//         } catch (err) {
//             console.error('Rename session error:', err);
//         }
//     }, [user?.id, currentSessionId]);

//     // Load sessions on mount
//     useEffect(() => {
//         if (user?.id) {
//             // Pass true to auto-restore the last session on load
//             loadSessions(true);
//         }
//     }, [user?.id, loadSessions]);

//     return {
//         messages,
//         isLoading,
//         sendMessage,
//         clearChat: createNewSession,
//         updateFeedback,
//         sessionId: sessionIdRef.current,
//         // Session management
//         sessions,
//         currentSessionId,
//         currentSessionTitle,
//         loadSessions,
//         loadSession,
//         createNewSession,
//         deleteSession,
//         pinSession,
//         renameSession,
//         ensureSession,
//         updateSessionMessageCount,
//     };
// }
