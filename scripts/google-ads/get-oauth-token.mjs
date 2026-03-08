/**
 * Google Ads OAuth2 Token Helper
 *
 * Gets a refresh token for the Google Ads API. You only need to run this once.
 *
 * Prerequisites:
 *   1. Create a Google Cloud project: https://console.cloud.google.com
 *   2. Enable the Google Ads API
 *   3. Create OAuth2 credentials (Web application type)
 *   4. Add http://localhost:3456/callback as an authorized redirect URI
 *
 * Usage:
 *   GOOGLE_ADS_CLIENT_ID=your-client-id \
 *   GOOGLE_ADS_CLIENT_SECRET=your-client-secret \
 *   node scripts/google-ads/get-oauth-token.mjs
 *
 * Then visit the URL printed in the terminal to authorize.
 */

import http from 'node:http';
import { URL } from 'node:url';

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3456/callback';
const SCOPES = 'https://www.googleapis.com/auth/adwords';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET env vars.');
  process.exit(1);
}

// Build the authorization URL
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

console.log('\n=== Google Ads OAuth2 Setup ===\n');
console.log('1. Open this URL in your browser:\n');
console.log(`   ${authUrl.toString()}\n`);
console.log('2. Sign in with the Google account linked to your Google Ads account');
console.log('3. Authorize the application\n');
console.log('Waiting for callback...\n');

// Start a local server to catch the OAuth callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:3456`);

  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h1>Authorization Failed</h1><p>${error}</p>`);
    console.error('Authorization failed:', error);
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>No code received</h1>');
    return;
  }

  // Exchange authorization code for tokens
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
      throw new Error(`${tokens.error}: ${tokens.error_description}`);
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Success!</h1><p>You can close this tab. Check your terminal for the refresh token.</p>');

    console.log('=== Success! ===\n');
    console.log('Add these to your .env.local:\n');
    console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log(`\nAccess token (expires in ${tokens.expires_in}s, you don't need to save this):`);
    console.log(`${tokens.access_token?.substring(0, 30)}...`);

    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h1>Error</h1><p>${err.message}</p>`);
    console.error('Token exchange failed:', err.message);
    process.exit(1);
  }
});

server.listen(3456, () => {
  console.log('OAuth callback server running on http://localhost:3456');
});
