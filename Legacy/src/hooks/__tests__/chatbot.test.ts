/**
 * Chatbot Logic Unit Tests
 * Tests for useChatbot hook's core logic functions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// STOP WORDS & KEYWORD EXTRACTION TESTS
// ============================================================================

describe('Stop Words Filtering', () => {
    // Simulate the stop words list from useChatbot
    const stopWords = [
        // Common Vietnamese words
        'là', 'có', 'của', 'và', 'ở', 'tại', 'cho', 'tôi', 'bạn', 'về', 'thông', 'tin',
        'địa', 'điểm', 'du', 'lịch', 'gì', 'nào', 'như', 'thế', 'sao', 'muốn', 'biết',
        'hỏi', 'xin', 'chào', 'không', 'vâng', 'được', 'đồng', 'ước', 'thêm', 'còn',
        // Travel terms
        'đường', 'đi', 'cách', 'lối', 'giá', 'vé', 'ăn', 'uống', 'ngủ', 'nghỉ', 'tour',
        // IMAGE-RELATED TERMS (CRITICAL)
        'ảnh', 'hình', 'xem', 'gửi', 'cho', 'pic', 'photo', 'hiện', 'thị', 'show',
        // Question/confirmation words
        'đúng', 'rồi', 'vậy', 'nhé', 'nha', 'hen', 'luôn', 'đây', 'kia', 'này', 'đó',
        // Short generic words
        'một', 'hai', 'các', 'những', 'người', 'nhiều', 'hơn', 'nhất', 'rất', 'quá'
    ]

    function extractKeywords(query: string): string[] {
        const queryLower = query.toLowerCase()
        return queryLower
            .split(/\s+/)
            .filter(k => k.length > 2 && !stopWords.includes(k))
    }

    it('TC07: Should filter out image-related terms "ảnh", "hình", "xem"', () => {
        const keywords = extractKeywords('Có ảnh không')
        expect(keywords).not.toContain('ảnh')
        expect(keywords).not.toContain('có')
        expect(keywords).not.toContain('không')
        expect(keywords.length).toBe(0) // All words should be filtered
    })

    it('Should extract location names from queries', () => {
        const keywords = extractKeywords('Gửi ảnh Hồ Gươm Hà Nội')
        expect(keywords).toContain('gươm')
        expect(keywords).toContain('nội')
        expect(keywords).not.toContain('gửi')
        expect(keywords).not.toContain('ảnh')
    })

    it('Should extract location keywords from long queries', () => {
        const keywords = extractKeywords('Cho tôi biết thông tin về chùa Chuông ở Hưng Yên')
        expect(keywords).toContain('chùa')
        expect(keywords).toContain('chuông')
        expect(keywords).toContain('hưng')
        expect(keywords).toContain('yên')
        expect(keywords).not.toContain('cho')
        expect(keywords).not.toContain('tôi')
    })

    it('Should handle short confirmation queries', () => {
        const keywords1 = extractKeywords('Có')
        const keywords2 = extractKeywords('Đúng rồi')
        const keywords3 = extractKeywords('Vâng')

        expect(keywords1.length).toBe(0)
        expect(keywords2.length).toBe(0)
        expect(keywords3.length).toBe(0)
    })

    it('Should filter travel-related generic terms', () => {
        const keywords = extractKeywords('Đường đi như thế nào')
        expect(keywords).not.toContain('đường')
        expect(keywords).not.toContain('đi')
        expect(keywords).not.toContain('như')
        expect(keywords).not.toContain('thế')
        expect(keywords).not.toContain('nào')
    })
})

// ============================================================================
// DEDUPLICATION LOGIC TESTS  
// ============================================================================

describe('Location Deduplication', () => {
    interface LocationData {
        id: string
        landmark_name: string
        city: string
        district: string
        qa_pairs: Array<{ q: string; a: string }>
        image_path?: string
        gps?: { lat: number; lon: number }
    }

    function deduplicateLocations(results: LocationData[]): LocationData[] {
        const deduplicatedMap = new Map<string, LocationData>()

        for (const loc of results) {
            const key = `${loc.landmark_name}|${loc.city}`.toLowerCase()
            const existing = deduplicatedMap.get(key)

            if (existing) {
                // Merge: take image if we don't have one
                if (!existing.image_path && loc.image_path) {
                    existing.image_path = loc.image_path
                }
                // Add new QA pairs that don't duplicate questions
                const existingQuestions = new Set(existing.qa_pairs.map(qa => qa.q))
                for (const qa of loc.qa_pairs) {
                    if (!existingQuestions.has(qa.q) && existing.qa_pairs.length < 5) {
                        existing.qa_pairs.push(qa)
                    }
                }
                // Take GPS if missing
                if (!existing.gps && loc.gps) {
                    existing.gps = loc.gps
                }
            } else {
                deduplicatedMap.set(key, { ...loc })
            }
        }

        return Array.from(deduplicatedMap.values())
    }

    it('TC11: Should merge locations with same name + city', () => {
        const locations: LocationData[] = [
            { id: '1', landmark_name: 'Biển Vô Cực', city: 'Thái Bình', district: '', qa_pairs: [], image_path: 'url1' },
            { id: '2', landmark_name: 'Biển Vô Cực', city: 'Thái Bình', district: '', qa_pairs: [], image_path: 'url2' },
            { id: '3', landmark_name: 'Biển Vô Cực', city: 'Ninh Thuận', district: '', qa_pairs: [], image_path: 'url3' },
        ]

        const result = deduplicateLocations(locations)

        expect(result.length).toBe(2) // Thái Bình merged, Ninh Thuận separate
        expect(result.find(l => l.city === 'Thái Bình')?.image_path).toBe('url1') // First image kept
    })

    it('TC12: Should merge QA pairs without duplicates', () => {
        const locations: LocationData[] = [
            {
                id: '1',
                landmark_name: 'Hồ Gươm',
                city: 'Hà Nội',
                district: '',
                qa_pairs: [
                    { q: 'Question 1', a: 'Answer 1' },
                    { q: 'Question 2', a: 'Answer 2' },
                ]
            },
            {
                id: '2',
                landmark_name: 'Hồ Gươm',
                city: 'Hà Nội',
                district: '',
                qa_pairs: [
                    { q: 'Question 1', a: 'Answer 1' }, // Duplicate
                    { q: 'Question 3', a: 'Answer 3' }, // New
                ]
            },
        ]

        const result = deduplicateLocations(locations)

        expect(result.length).toBe(1)
        expect(result[0].qa_pairs.length).toBe(3) // 2 original + 1 new (duplicate not added)
    })

    it('Should take first available image when merging', () => {
        const locations: LocationData[] = [
            { id: '1', landmark_name: 'Test', city: 'City', district: '', qa_pairs: [] }, // No image
            { id: '2', landmark_name: 'Test', city: 'City', district: '', qa_pairs: [], image_path: 'url2' },
            { id: '3', landmark_name: 'Test', city: 'City', district: '', qa_pairs: [], image_path: 'url3' },
        ]

        const result = deduplicateLocations(locations)

        expect(result.length).toBe(1)
        expect(result[0].image_path).toBe('url2') // First non-null image
    })

    it('Should limit QA pairs to 5 max', () => {
        const locations: LocationData[] = [
            {
                id: '1',
                landmark_name: 'Test',
                city: 'City',
                district: '',
                qa_pairs: Array.from({ length: 4 }, (_, i) => ({ q: `Q${i}`, a: `A${i}` }))
            },
            {
                id: '2',
                landmark_name: 'Test',
                city: 'City',
                district: '',
                qa_pairs: Array.from({ length: 4 }, (_, i) => ({ q: `Q${i + 4}`, a: `A${i + 4}` }))
            },
        ]

        const result = deduplicateLocations(locations)

        expect(result[0].qa_pairs.length).toBe(5) // Max 5
    })
})

// ============================================================================
// POST-PROCESSING FILTER TESTS
// ============================================================================

describe('Response Post-Processing Filter', () => {
    const forbiddenPatterns = [
        /bạn muốn xem ảnh.*(khu vực|góc|địa điểm) nào/i,
        /có nhiều (địa điểm|góc chụp|khu vực) khác nhau/i,
        /vì có nhiều (góc|địa điểm|khu vực)/i,
        /góc chụp nào/i,
        /bạn quan tâm đến (vị trí|khu vực|góc) nào/i,
    ]

    function detectForbiddenPhrase(response: string): string | null {
        for (const pattern of forbiddenPatterns) {
            const match = response.match(pattern)
            if (match) {
                return match[0]
            }
        }
        return null
    }

    it('Should detect "Bạn muốn xem ảnh ở khu vực nào?"', () => {
        const response = 'Bạn muốn xem ảnh ở khu vực nào của Hà Nội?'
        expect(detectForbiddenPhrase(response)).toBeTruthy()
    })

    it('Should detect "Vì có nhiều góc chụp"', () => {
        const response = 'Vì có nhiều góc chụp khác nhau, bạn muốn xem góc nào?'
        expect(detectForbiddenPhrase(response)).toBeTruthy()
    })

    it('Should detect "góc chụp nào"', () => {
        const response = 'Bạn thích góc chụp nào?'
        expect(detectForbiddenPhrase(response)).toBeTruthy()
    })

    it('Should detect "có nhiều địa điểm khác nhau"', () => {
        const response = 'Có nhiều địa điểm khác nhau với tên này'
        expect(detectForbiddenPhrase(response)).toBeTruthy()
    })

    it('Should NOT flag valid responses with images', () => {
        const validResponse = 'Đây là hình ảnh **Hồ Gươm**:\n\n![Hồ Gươm](https://example.com/image.jpg)'
        expect(detectForbiddenPhrase(validResponse)).toBeNull()
    })

    it('Should NOT flag valid responses about locations', () => {
        const validResponse = 'Đà Nẵng có nhiều điểm đến tuyệt vời như Bà Nà Hills, Bãi biển Mỹ Khê...'
        expect(detectForbiddenPhrase(validResponse)).toBeNull()
    })

    it('Should NOT flag "no image available" response', () => {
        const validResponse = 'Hiện chưa có hình ảnh cho địa điểm này trong cơ sở dữ liệu.'
        expect(detectForbiddenPhrase(validResponse)).toBeNull()
    })
})

// ============================================================================
// IMAGE URL CONSTRUCTION TESTS
// ============================================================================

describe('Image URL Construction', () => {
    const SUPABASE_URL = 'https://test.supabase.co'

    function constructImageUrl(rawPath: string | undefined): string | undefined {
        if (!rawPath) return undefined

        if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
            return rawPath
        }
        return `${SUPABASE_URL}/storage/v1/object/public/images/${rawPath}`
    }

    it('Should return full URL as-is', () => {
        const fullUrl = 'https://example.com/image.jpg'
        expect(constructImageUrl(fullUrl)).toBe(fullUrl)
    })

    it('Should construct Supabase Storage URL for relative paths', () => {
        const relativePath = 'landmarks/hoguom.jpg'
        const result = constructImageUrl(relativePath)
        expect(result).toBe(`${SUPABASE_URL}/storage/v1/object/public/images/${relativePath}`)
    })

    it('Should handle undefined image path', () => {
        expect(constructImageUrl(undefined)).toBeUndefined()
    })

    it('Should handle Google Photos URLs', () => {
        const googleUrl = 'https://lh3.googleusercontent.com/pw/xxxxx'
        expect(constructImageUrl(googleUrl)).toBe(googleUrl)
    })
})

// ============================================================================
// CONTEXT EXTRACTION TESTS
// ============================================================================

describe('Context Extraction from History', () => {
    interface ChatMessage {
        role: 'user' | 'assistant'
        content: string
    }

    // Simplified location extraction (mimics the actual logic)
    function extractLocationFromHistory(messages: ChatMessage[]): string[] {
        const locationNames = new Set<string>()

        // Sample location index for testing
        const sampleLocations = [
            'Hồ Gươm', 'Chùa Chuông', 'Biển Vô Cực', 'Bà Nà Hills',
            'Đà Nẵng', 'Hà Nội', 'Thái Bình', 'Hưng Yên'
        ]

        // Check last assistant message
        const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')

        if (lastAssistantMsg) {
            const content = lastAssistantMsg.content.toLowerCase()
            for (const loc of sampleLocations) {
                if (content.includes(loc.toLowerCase())) {
                    locationNames.add(loc)
                }
            }
        }

        return Array.from(locationNames)
    }

    it('TC05: Should extract location from previous bot response', () => {
        const history: ChatMessage[] = [
            { role: 'user', content: 'Chùa gì ở Hưng Yên?' },
            { role: 'assistant', content: 'Hưng Yên có Chùa Chuông rất nổi tiếng...' },
        ]

        const locations = extractLocationFromHistory(history)
        expect(locations).toContain('Chùa Chuông')
        expect(locations).toContain('Hưng Yên')
    })

    it('TC06: Should use context for follow-up image request', () => {
        const history: ChatMessage[] = [
            { role: 'user', content: 'Đà Nẵng có gì hay?' },
            { role: 'assistant', content: 'Đà Nẵng có Bà Nà Hills, bãi biển đẹp...' },
            { role: 'user', content: 'Có ảnh không?' }, // Current query - not in history yet
        ]

        const locations = extractLocationFromHistory(history.slice(0, -1))
        expect(locations).toContain('Đà Nẵng')
        expect(locations).toContain('Bà Nà Hills')
    })
})

// ============================================================================
// INPUT VALIDATION TESTS
// ============================================================================

describe('Input Validation', () => {
    function validateInput(content: string): boolean {
        return content.trim().length > 0
    }

    it('Should accept normal text input', () => {
        expect(validateInput('Xin chào')).toBe(true)
        expect(validateInput('Cho tôi biết về Hà Nội')).toBe(true)
    })

    it('Should reject empty input', () => {
        expect(validateInput('')).toBe(false)
        expect(validateInput('   ')).toBe(false)
    })

    it('Should handle very long input', () => {
        const longInput = 'a'.repeat(1000)
        expect(validateInput(longInput)).toBe(true)
    })

    it('Should handle special characters', () => {
        expect(validateInput('Đà Nẵng có gì? 🏖️')).toBe(true)
        expect(validateInput('Hỏi về chùa Chuông!')).toBe(true)
    })
})
