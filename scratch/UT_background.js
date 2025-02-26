/**
 * Background Script for Pulse Chrome Extension
 * Handles OAuth authentication, extension updates, and message passing
 * This script runs in the extension's service worker context
 */

console.log("Background script loaded");

// Import Supabase client for authentication and database operations
import { supabase } from "./supabaseClient";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";

/**
 * Extension Update Handler
 * Detects when the extension is updated or installed
 * Notifies all open tabs to refresh their state
 * This prevents stale extension contexts from operating
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[DEBUG] Extension installed/updated:', details.reason);
  if (details.reason === 'update') {
    // Notify all open tabs about the extension update
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        try {
          // Send EXTENSION_RELOADED message to each tab
          // Tabs will handle this by showing a reload prompt
          chrome.tabs.sendMessage(tab.id, 'EXTENSION_RELOADED').catch(error => {
            console.log('[DEBUG] Failed to notify tab:', tab.id, error);
          });
        } catch (error) {
          console.error('[DEBUG] Error notifying tab:', tab.id, error);
        }
      });
    });
  }
});

/**
 * Message Handler for Content Script Communication
 * Listens for messages from content.js and routes them appropriately
 * Currently handles:
 * - initiate_oauth: Starts the Google OAuth flow
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'initiate_oauth') {
    initiateOAuth().then(sendResponse);
    return true; // Indicates we will send response asynchronously
  }
});

/**
 * Google OAuth Flow Handler
 * Manages the complete OAuth process through Chrome's identity API
 * Flow:
 * 1. Gets OAuth URL from Supabase
 * 2. Launches Chrome's web auth flow
 * 3. Exchanges code for session
 * 4. Returns session/user data or error
 * 
 * @returns {Promise<Object>} Object containing either:
 *   - success: { session: Object, user: Object }
 *   - failure: { error: string }
 */
async function initiateOAuth() {
  try {
    // Get stored Supabase configuration
    const { supabase, oauth } = await chrome.storage.local.get(['supabase', 'oauth']);
    if (!supabase?.url || !supabase?.anonKey) throw new Error('Missing Supabase config');
    
    // Get extension ID for OAuth redirect URL
    const extensionId = chrome.runtime.id;
    const supabaseClient = createClient(supabase.url, supabase.anonKey);

    // Step 1: Get OAuth URL from Supabase
    // This URL will redirect to Google's consent screen
    const { data: { url: authUrl, verifier }, error: urlError } = 
      await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Redirect back to our extension after auth
          redirectTo: `https://${extensionId}.chromiumapp.org/oauth2`,
          // Force consent screen and request offline access
          queryParams: { prompt: 'consent', access_type: 'offline' }
        }
      });
    if (urlError) throw urlError;

    // Step 2: Launch Chrome's OAuth flow
    // This opens a popup window for user consent
    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true // Shows the Google consent screen
      }, (response) => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(response);
      });
    });

    // Step 3: Exchange OAuth code for Supabase session
    // This completes the OAuth flow and gets us a valid session
    const { data: sessionData, error: sessionError } = 
      await supabaseClient.auth.exchangeCodeForSession(responseUrl, verifier, supabase.anonKey);
    if (sessionError) throw sessionError;
    if (!sessionData?.session) throw new Error('No session data');

    // Return successful auth data
    return { session: sessionData.session, user: sessionData.session.user };
  } catch (error) {
    // Log and return any errors that occurred during the process
    console.error('[FINAL] OAuth Error:', error);
    return { error: error.message };
  }
}
