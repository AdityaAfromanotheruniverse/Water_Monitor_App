// config.js
// On a real phone, "localhost" points at the phone itself, so use your computer's
// LAN IP (e.g. http://192.168.1.20:8000) while running:
//   python -m uvicorn main:app --host 0.0.0.0 --port 8000
export const API_BASE = 'http://192.168.1.20:8000';

// How often the dashboard refreshes /state (the backend has no websocket).
export const POLL_MS = 2500;
