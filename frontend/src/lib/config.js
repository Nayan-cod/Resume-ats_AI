/**
 * Centralised runtime configuration for the frontend.
 *
 * All environment-dependent values are read here and exported as named constants.
 * This prevents hardcoded localhost URLs from leaking into component files.
 *
 * [ACTION NEEDED]: In production, ensure API_URL resolves to an HTTPS endpoint
 * (e.g., https://your-backend.onrender.com). Never use http:// in production as
 * it exposes JWT tokens and user data to network interception.
 *
 * Configure via .env.local in development:
 *   VITE_API_URL=http://localhost:8001
 *   VITE_WS_URL=ws://localhost:8001/ws
 *
 * Configure via Vercel Environment Variables in production:
 *   VITE_API_URL=https://your-backend.onrender.com
 *   VITE_WS_URL=wss://your-backend.onrender.com/ws
 */

/**
 * Base URL of the backend REST API.
 * @type {string}
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

/**
 * WebSocket endpoint URL for real-time notifications.
 * @type {string}
 */
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8001/ws';
