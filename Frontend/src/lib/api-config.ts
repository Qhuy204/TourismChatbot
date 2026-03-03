/**
 * Utility to handle dynamic API and WebSocket URL derivation.
 * Supports both local development (localhost) and production domains.
 */

const getBaseUrl = () => {
    // 1. Check if VITE_ADMIN_API_URL is explicitly defined (e.g., in .env)
    const envAdminUrl = import.meta.env.VITE_ADMIN_API_URL;
    if (envAdminUrl) return envAdminUrl;

    // 2. Check if VITE_LANGGRAPH_API_URL is defined (usually for production)
    const envLangGraphUrl = import.meta.env.VITE_LANGGRAPH_API_URL;
    if (envLangGraphUrl) return envLangGraphUrl;

    // 3. Fallback to current domain (automatic for production)
    // If we are on https://www.qhuy204.id.vn, the API is likely on the same domain or subdomain
    if (typeof window !== 'undefined') {
        const { hostname, protocol } = window.location;

        // If on a production domain, assume the API is at the same base
        if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
            // Check if we need to use a specific subdomain for API
            if (hostname.includes('qhuy204.id.vn')) {
                return `${protocol}//api.qhuy204.id.vn`;
            }
            return `${protocol}//${hostname}`;
        }
    }

    // 4. Ultimate fallback for local development
    return 'http://localhost:8000'; // Default backend port is 8000
};

export const getAdminApiBaseUrl = () => getBaseUrl();

export const getAdminWsUrl = (token: string) => {
    const baseUrl = getBaseUrl();
    const wsBase = baseUrl.replace(/^http/, 'ws');
    return `${wsBase}/admin/live?token=${token}`;
};
