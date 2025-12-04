import { NextRequest, NextResponse } from 'next/server';

// Get the app URL from environment - defaults to localhost for development
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';

/**
 * Spotify OAuth callback handler
 *
 * Receives the authorization code from Spotify and redirects to the home page
 * with the code as a query parameter. The client-side will handle the token exchange.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Redirect to the app URL (production or localhost)
  const redirectUrl = new URL(APP_URL);

  if (error) {
    // User denied access or other error
    redirectUrl.searchParams.set('spotify_error', error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    redirectUrl.searchParams.set('spotify_error', 'no_code');
    return NextResponse.redirect(redirectUrl);
  }

  // Pass code and state to client for PKCE token exchange
  redirectUrl.searchParams.set('spotify_code', code);
  if (state) {
    redirectUrl.searchParams.set('spotify_state', state);
  }

  return NextResponse.redirect(redirectUrl);
}
