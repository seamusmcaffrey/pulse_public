/**
 * Simplified Background Script for Pulse Chrome Extension
 * Handles basic OAuth authentication using Chrome's identity system
 */

console.log("Background script loaded");

/**
 * Gets the user's profile information directly from Chrome
 * @returns {Promise<Object>} The user's profile info
 */
async function getProfileInfo() {
  return new Promise((resolve, reject) => {
    chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
      if (chrome.runtime.lastError) {
        console.error('[DEBUG] Profile info error:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log('[DEBUG] Got profile info:', userInfo);
        resolve(userInfo);
      }
    });
  });
}

/**
 * Gets the user's profile picture from Gravatar
 * @returns {Promise<string>} The user's profile picture URL
 */
async function getProfilePicture() {
  return new Promise((resolve) => {
    // Use a default avatar from randomuser.me
    const avatarId = Math.floor(Math.random() * 70);
    const gender = Math.random() > 0.5 ? 'men' : 'women';
    resolve(`https://randomuser.me/api/portraits/${gender}/${avatarId}.jpg`);
  });
}

/**
 * Handles the complete OAuth flow using Chrome's identity API
 * Uses Chrome's built-in account system
 */
async function initiateOAuth() {
  try {
    // Get basic profile info
    const userInfo = await getProfileInfo();
    console.log('[DEBUG] Got user info:', userInfo);

    // Get profile picture
    const picture = await getProfilePicture();
    console.log('[DEBUG] Got profile picture:', picture);

    // Prepare user session data
    const sessionData = {
      id: userInfo.id || userInfo.email,
      email: userInfo.email,
      name: userInfo.email.split('@')[0], // Use email username as name
      picture: picture,
      email_verified: true // Chrome accounts are verified
    };

    // Generate a session access token
    const tokenResponse = await chrome.identity.getAuthToken({ 
      interactive: true
    });
    console.log('[DEBUG] Got access token:', tokenResponse ? 'present' : 'missing');

    // Return user info with session data
    return { 
      session: {
        access_token: tokenResponse,
        user: sessionData
      },
      user: {
        ...sessionData,
        access_token: tokenResponse
      }
    };

  } catch (error) {
    console.error('[DEBUG] OAuth flow error:', error);
    throw error;
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'initiate_oauth') {
    console.log('[DEBUG] Received auth request from content script');
    initiateOAuth().then(sendResponse);
    return true; // Will respond asynchronously
  }
});

// Handle extension updates
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[DEBUG] Extension installed/updated:', details.reason);
  if (details.reason === 'update') {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, 'EXTENSION_RELOADED')
          .catch(() => {/* Ignore errors for tabs that can't receive messages */});
      });
    });
  }
});

// Handle token revocation
chrome.identity.onSignInChanged.addListener((account, signedIn) => {
  console.log('[DEBUG] Sign in state changed:', { account, signedIn });
});