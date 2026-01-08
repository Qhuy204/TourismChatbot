/**
 * Real Crawl Service connecting to Python FastAPI Backend
 * Uses REST API + WebSocket for real-time updates
 */

// API Server URL (FastAPI backend)
const API_BASE_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001/ws';

export interface CrawlResult {
    id: string;
    name: string;
    address: string;
    phone: string;
    link: string;
    category: string;
    description?: string;
    open_time?: string;
    close_time?: string;
    image_urls?: string[];
    crawled_at?: string;
}

export interface CrawlProgress {
    is_running: boolean;
    current_category: string | null;
    current_page: number;
    total_pages: number;
    items_crawled: number;
    total_items: number;
    message: string;
    errors: string[];
}

export interface CategoryConfig {
    maxPages: number;
    url: string;
}

// API endpoints
const TOURISM_ENDPOINTS = {
    hotels: { url: 'https://csdl.vietnamtourism.gov.vn/cslt', maxPage: 955 },
    restaurants: { url: 'https://csdl.vietnamtourism.gov.vn/rest', maxPage: 172 },
    shops: { url: 'https://csdl.vietnamtourism.gov.vn/shop', maxPage: 46 },
    entertainment: { url: 'https://csdl.vietnamtourism.gov.vn/vcgt', maxPage: 25 },
    destinations: { url: 'https://csdl.vietnamtourism.gov.vn/dest', maxPage: 65 },
};

/**
 * Check if the Python API server is running
 */
export async function checkApiHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get available categories from the API
 */
export async function getCategories(): Promise<Record<string, CategoryConfig>> {
    try {
        const response = await fetch(`${API_BASE_URL}/categories`);
        if (!response.ok) throw new Error('Failed to get categories');
        return await response.json();
    } catch {
        // Fallback to local config
        return Object.fromEntries(
            Object.entries(TOURISM_ENDPOINTS).map(([key, val]) => [
                key,
                { maxPages: val.maxPage, url: val.url }
            ])
        );
    }
}

/**
 * Get current crawl status
 */
export async function getCrawlStatus(): Promise<CrawlProgress> {
    const response = await fetch(`${API_BASE_URL}/status`);
    if (!response.ok) throw new Error('Failed to get status');
    return await response.json();
}

/**
 * Get all crawled items
 */
export async function getCrawledItems(): Promise<{ items: CrawlResult[]; count: number }> {
    const response = await fetch(`${API_BASE_URL}/items`);
    if (!response.ok) throw new Error('Failed to get items');
    return await response.json();
}

/**
 * Start a crawl job
 */
export async function startCrawl(
    categories: string[],
    maxPagesPerCategory?: number,  // undefined = no limit (use max from category)
    crawlDetails: boolean = false  // If true, crawl detail pages + download images
): Promise<{ message: string; categories: string[] }> {
    const response = await fetch(`${API_BASE_URL}/crawl/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            categories,
            max_pages_per_category: maxPagesPerCategory || null,  // null = no limit
            crawl_details: crawlDetails
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to start crawl');
    }

    return await response.json();
}

/**
 * Stop the current crawl
 */
export async function stopCrawl(): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/crawl/stop`, {
        method: 'POST'
    });

    if (!response.ok) throw new Error('Failed to stop crawl');
    return await response.json();
}

/**
 * Clear all crawled items
 */
export async function clearItems(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/items`, {
        method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to clear items');
}

/**
 * WebSocket connection manager for real-time updates
 */
export class CrawlWebSocket {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 2000;

    private onStatusCallback?: (status: CrawlProgress) => void;
    private onItemCallback?: (item: CrawlResult) => void;
    private onErrorCallback?: (error: string) => void;
    private onConnectedCallback?: () => void;
    private onDisconnectedCallback?: () => void;

    constructor() { }

    /**
     * Connect to WebSocket server
     */
    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            this.ws = new WebSocket(WS_URL);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.onConnectedCallback?.();

                // Start ping interval
                this.startPing();
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    if (msg.type === 'status' && this.onStatusCallback) {
                        this.onStatusCallback(msg.data);
                    } else if (msg.type === 'item' && this.onItemCallback) {
                        this.onItemCallback(msg.data);
                    }
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.onDisconnectedCallback?.();
                this.tryReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.onErrorCallback?.('WebSocket connection error');
            };

        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.onErrorCallback?.('Failed to connect to server');
        }
    }

    private pingInterval?: NodeJS.Timeout;

    private startPing(): void {
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    }

    private tryReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);
    }

    /**
     * Disconnect WebSocket
     */
    disconnect(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Register callback for status updates
     */
    onStatus(callback: (status: CrawlProgress) => void): void {
        this.onStatusCallback = callback;
    }

    /**
     * Register callback for new crawled items
     */
    onItem(callback: (item: CrawlResult) => void): void {
        this.onItemCallback = callback;
    }

    /**
     * Register callback for errors
     */
    onError(callback: (error: string) => void): void {
        this.onErrorCallback = callback;
    }

    /**
     * Register callback for connection status
     */
    onConnected(callback: () => void): void {
        this.onConnectedCallback = callback;
    }

    onDisconnected(callback: () => void): void {
        this.onDisconnectedCallback = callback;
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

// Singleton WebSocket instance
export const crawlWebSocket = new CrawlWebSocket();

export { TOURISM_ENDPOINTS };
export type TourismCategory = keyof typeof TOURISM_ENDPOINTS;
