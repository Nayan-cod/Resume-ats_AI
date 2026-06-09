/**
 * Centralised API configuration.
 * All base URLs are read from Vite environment variables so zero
 * hard-coded values appear in the source tree.
 */

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001';
export const WS_URL  = import.meta.env.VITE_WS_URL  ?? 'ws://localhost:8001/ws';
