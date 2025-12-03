// Spotify OAuth 2.0 with PKCE flow

import { SPOTIFY_CONFIG, SPOTIFY_STORAGE_KEYS } from './config';
import type { SpotifyTokenData, SpotifyTokenResponse } from './types';

// Generate a cryptographically random string
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], '');
}

// Generate SHA-256 hash and encode as base64url
async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);

  // crypto.subtle requires secure context (HTTPS or localhost)
  if (!crypto.subtle) {
    throw new Error(
      'Crypto API not available. Please access via localhost:3000 or HTTPS. ' +
      'Current URL may be using 127.0.0.1 or HTTP which lacks crypto.subtle support.'
    );
  }

  return crypto.subtle.digest('SHA-256', data);
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  bytes.forEach(b => str += String.fromCharCode(b));
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Generate PKCE code verifier and challenge
export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(64);
  const hashed = await sha256(verifier);
  const challenge = base64urlEncode(hashed);
  return { verifier, challenge };
}

// Build the authorization URL
export async function buildAuthUrl(): Promise<string> {
  const { verifier, challenge } = await generatePKCE();
  const state = generateRandomString(16);

  // Store verifier and state for callback validation
  localStorage.setItem(SPOTIFY_STORAGE_KEYS.codeVerifier, verifier);
  localStorage.setItem(SPOTIFY_STORAGE_KEYS.state, state);

  const params = new URLSearchParams({
    client_id: SPOTIFY_CONFIG.clientId,
    response_type: 'code',
    redirect_uri: SPOTIFY_CONFIG.redirectUri,
    scope: SPOTIFY_CONFIG.scopes.join(' '),
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  return `${SPOTIFY_CONFIG.authEndpoint}?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForToken(code: string): Promise<SpotifyTokenData> {
  const verifier = localStorage.getItem(SPOTIFY_STORAGE_KEYS.codeVerifier);

  if (!verifier) {
    throw new Error('No code verifier found. Please restart the authorization flow.');
  }

  const response = await fetch(SPOTIFY_CONFIG.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: SPOTIFY_CONFIG.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_CONFIG.redirectUri,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to exchange code for token');
  }

  const data: SpotifyTokenResponse = await response.json();

  // Clean up verifier
  localStorage.removeItem(SPOTIFY_STORAGE_KEYS.codeVerifier);
  localStorage.removeItem(SPOTIFY_STORAGE_KEYS.state);

  const tokenData: SpotifyTokenData = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    refreshToken: data.refresh_token,
  };

  // Store token data
  localStorage.setItem(SPOTIFY_STORAGE_KEYS.token, JSON.stringify(tokenData));

  return tokenData;
}

// Refresh access token using refresh token
export async function refreshAccessToken(): Promise<SpotifyTokenData | null> {
  const stored = localStorage.getItem(SPOTIFY_STORAGE_KEYS.token);
  if (!stored) return null;

  const tokenData: SpotifyTokenData = JSON.parse(stored);
  if (!tokenData.refreshToken) return null;

  const response = await fetch(SPOTIFY_CONFIG.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: SPOTIFY_CONFIG.clientId,
      grant_type: 'refresh_token',
      refresh_token: tokenData.refreshToken,
    }),
  });

  if (!response.ok) {
    // Refresh failed, clear token data
    localStorage.removeItem(SPOTIFY_STORAGE_KEYS.token);
    return null;
  }

  const data: SpotifyTokenResponse = await response.json();

  const newTokenData: SpotifyTokenData = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    refreshToken: data.refresh_token || tokenData.refreshToken,
  };

  localStorage.setItem(SPOTIFY_STORAGE_KEYS.token, JSON.stringify(newTokenData));

  return newTokenData;
}

// Get current valid access token (refreshing if needed)
export async function getAccessToken(): Promise<string | null> {
  const stored = localStorage.getItem(SPOTIFY_STORAGE_KEYS.token);
  if (!stored) return null;

  let tokenData: SpotifyTokenData = JSON.parse(stored);

  // Check if token is expired or will expire in the next minute
  const expirationBuffer = 60 * 1000; // 1 minute
  if (tokenData.expiresAt - expirationBuffer < Date.now()) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) return null;
    tokenData = refreshed;
  }

  return tokenData.accessToken;
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  const stored = localStorage.getItem(SPOTIFY_STORAGE_KEYS.token);
  if (!stored) return false;

  try {
    const tokenData: SpotifyTokenData = JSON.parse(stored);
    // Consider authenticated if we have an access token (even if expired, we might refresh)
    return !!tokenData.accessToken;
  } catch {
    return false;
  }
}

// Log out / disconnect Spotify
export function disconnectSpotify(): void {
  localStorage.removeItem(SPOTIFY_STORAGE_KEYS.token);
  localStorage.removeItem(SPOTIFY_STORAGE_KEYS.codeVerifier);
  localStorage.removeItem(SPOTIFY_STORAGE_KEYS.state);
}

// Validate state parameter on callback
export function validateState(state: string): boolean {
  const storedState = localStorage.getItem(SPOTIFY_STORAGE_KEYS.state);
  return storedState === state;
}
