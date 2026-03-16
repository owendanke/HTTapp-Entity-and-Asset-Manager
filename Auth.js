/**
 * Auth.gs
 * -------
 * Handles Google OAuth2 authentication for the HTTapp Asset Manager.
 *
 * WHY THE PREVIOUS APPROACH FAILED:
 * ----------------------------------
 * The client-side loginWithGoogle() called a ServerBridge stub that never
 * reached the real google.script.run pathway. In a deployed GAS Web App,
 * OAuth2 cannot be initiated from the client — the auth URL must be
 * generated server-side and then opened by the browser.
 *
 * CORRECT FLOW:
 * -------------
 *   1. Client calls google.script.run.serverGetAuthUrl()
 *   2. Server generates and returns the Google OAuth2 authorization URL
 *   3. Client opens that URL in a popup window
 *   4. User approves → Google redirects to the GAS /exec endpoint with ?code=...
 *   5. doGet() detects the auth code, calls authCallback(request)
 *   6. authCallback exchanges the code for tokens (via OAuth2 library)
 *   7. The popup posts AUTH_SUCCESS to the opener and closes
 *   8. The main window receives the message and calls serverCheckSession()
 *      to load the verified user object and enter the app
 *
 * NOTE (Iteration 1): Token exchange and storage calls are stubbed with
 * console.log print statements as instructed. The URL generation and
 * callback routing are real GAS patterns ready for the OAuth2 library.
 *
 * SETUP REQUIREMENT:
 *   Add the Apps Script OAuth2 library to your project:
 *   Library ID: 1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF
 *   Then uncomment _getService() in this file and set your Client ID/Secret
 *   in Script Properties (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).
 */

// ─────────────────────────────────────────────────────────────────────────────
//  AuthService class
// ─────────────────────────────────────────────────────────────────────────────
class AuthService {

  /**
   * Builds and returns the Google OAuth2 authorization URL.
   * The client opens this URL in a popup to begin the login flow.
   *
   * Uses the OAuth2 library's createService() to build the URL.
   * @returns {string} The authorization URL to open in a popup.
   */
  static getAuthorizationUrl() {
    console.log('[Auth.gs][getAuthorizationUrl]');
    
    return AuthService._getCloudService().getAuthorizationUrl();

    // Stub: return the web app's own URL with a flag so the popup opens
    // something valid and can post AUTH_SUCCESS back to the opener.
    //const scriptUrl = ScriptApp.getService().getUrl();
    //console.log(`[Auth.gs] Stub returning script URL as auth URL: ${scriptUrl}?stub_auth=1`);
    //return scriptUrl + '?stub_auth=1';
  }

  /**
   * Handles the OAuth2 callback from Google.
   * Called by _getCloudService().
   *
   * @param {Object} request - The GAS request event object.
   * @returns {HtmlOutput}
   */
  static handleCallback(request) {
    console.log('[Auth.gs][authCallback]');

    var service = AuthService._getCloudService();
    var authorized = service.handleCallback(request);

    if (authorized) {
      // log successful callback
      console.log('[Auth.gs][authCallback] SUCCESS');

      // return success html popup
      return _buildSuccessPopup();
    } else {
      // log unsuccessful callback
      console.log('[Auth.gs][authCallback] FAILED');

      // return error html popup
      return _buildErrorPopup('Authentication failed. Please try again.');
    }
  }

  /**
   * Checks whether the current user has an active authenticated session.
   * Called by the client via google.script.run after the popup closes.
   *
   * In production: reads the stored token from PropertiesService and validates it.
   * @returns {{ authenticated: boolean, user: Object|null }}
   */
  static checkSession() {
    console.log('[Auth.gs] CHECK SESSION');
    
    const service = AuthService._getCloudService();

    if (!service.hasAccess()) {
      console.log('[Auth.gs] No valid OAuth session');
      return { authenticated: false, user: null };
    }

    const token = service.getAccessToken();
    const userInfo = AuthService._getUserInfo(token);

    console.log(`[Auth.gs] Authenticated user: ${userInfo.email}`);

    return {
      authenticated: true,
      user: userInfo,
    };
  }

  /**
   * Signs the current user out.
   * In production: revokes the OAuth2 access token and clears script properties.
   * @returns {{ success: boolean }}
   */
  static signOut() {
    console.log('[Auth.gs][signOut]');
    var service = AuthService._getCloudService();
    service.reset();
    console.log('[Auth.gs][signOut] called service.reset()');
    return { success: true };
  }

  /**
   * Returns the configured OAuth2 service instance.
   *  - requires the OAuth2 library and Script Properties to be set.
   * @private
   */
  static _getCloudService() {
     return OAuth2.createService('Google')

      // set endpoint URLs
      .setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/v2/auth')
      .setTokenUrl('https://oauth2.googleapis.com/token')

      // set client ID and secret
      .setClientId(CONFIG.CLIENT_ID)
      .setClientSecret(CONFIG.CLIENT_SECRET)

      // set the callback function name to complete the OAuth flow
      .setCallbackFunction('AuthService.handleCallback')
      
      // set property store to user properties to store OAuth auth tokens
      .setPropertyStore(PropertiesService.getUserProperties())

      // enable caching service as to not exhaust PropertiesService quotas
      .setCache(CacheService.getUserCache())

      // un-comment to enable locking to prevent race conditions
      //.setLock(LockService.getUserLock())

      // set the scope and additional parameters
      .setScope('https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email')
      .setParam('access_type', 'offline')
      .setParam('prompt', 'consent');
  }

  /**
   * 
   */
  static _getUserInfo(accessToken) {
    const response = UrlFetchApp.fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: 'Bearer ' + accessToken
        },
        muteHttpExceptions: true
      }
    );

    if (response.getResponseCode() !== 200) {
      throw new Error('Failed to fetch user info');
    }

    const profile = JSON.parse(response.getContentText());

    return {
      email: profile.email,
      name: profile.name,
      picture: profile.picture
    };
  }
}

/** Builds the self-closing success popup page. */
function _buildSuccessPopup() {
  return HtmlService.createHtmlOutput(`<!DOCTYPE html>
<html><head><style>
  body { font-family: 'IBM Plex Sans', sans-serif; text-align: center;
         padding: 48px 32px; background: #f8fafc; margin: 0; }
  .icon { font-size: 36px; margin-bottom: 12px; }
  .msg  { color: #16a34a; font-size: 15px; font-weight: 600; margin-bottom: 6px; }
  .sub  { color: #64748b; font-size: 13px; }
</style></head><body>
  <div class="msg">Almost done ...</div>
  <div class="sub">Close this popup to finish logging in to HTTapp Asset Manager</div>
  <script>
    if (window.opener) { window.opener.postMessage('AUTH_SUCCESS', '*'); }
    setTimeout(function() { window.close(); }, 800);
  </script>
</body></html>`).setTitle('Signing in…');
}

/** Builds the error popup page. */
function _buildErrorPopup(message) {
  return HtmlService.createHtmlOutput(`<!DOCTYPE html>
<html><head><style>
  body { font-family: 'IBM Plex Sans', sans-serif; text-align: center;
         padding: 48px 32px; background: #f8fafc; margin: 0; }
  .icon { font-size: 36px; margin-bottom: 12px; }
  .msg  { color: #dc2626; font-size: 15px; font-weight: 600; margin-bottom: 6px; }
  .sub  { color: #64748b; font-size: 13px; }
</style></head><body>
  <div class="icon">✕</div>
  <div class="msg">Authentication failed</div>
  <div class="sub">${message}</div>
  <div class="sub" style="margin-top:16px">You may close this window.</div>
</body></html>`).setTitle('Sign-in failed');
}

/**
 * Logs the redict URI to register in the Google Developers Console.
 */
function logRedirectUri() {
  console.log('[logRedirectUri] getRedirectUri:');
  console.log(OAuth2.getRedirectUri());
  //Logger.log(OAuth2.getRedirectUri());
}

// ─────────────────────────────────────────────────────────────────────────────
//  Exposed server functions (called via google.script.run from the client)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the OAuth2 authorization URL for the client to open in a popup. */
function serverGetAuthUrl() {
  console.log('[Auth.gs][serverGetAuthUrl] calling logRedirectUri');
  logRedirectUri();
  console.log('[Auth.gs][serverGetAuthUrl] returning AuthService.getAuthorizationUrl()');
  return AuthService.getAuthorizationUrl();
}

/** Polls session state — called by the client after the popup closes. */
function serverCheckSession() {
  console.log('[Auth.gs][serverCheckSession] returning AuthService.checkSession()');
  return AuthService.checkSession();
}

/** Signs the current user out. */
function serverSignOut() {
  console.log('[Auth.gs][serverSignOut] returning AuthService.signOut()');
  return AuthService.signOut();
}