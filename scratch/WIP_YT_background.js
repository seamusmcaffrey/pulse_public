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
function initiateOAuth() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])
  
  if (!session) {
    return (<Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} />)
  }
  else {
    return (<div>Logged in!</div>)
  }
  }
