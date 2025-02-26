/**
 * Background Script for Pulse Chrome Extension
 * Handles OAuth authentication using Chrome's native identity system
 * Maintains Supabase integration for data persistence
 */

console.log("Background script loaded");

// Initialize Supabase client directly
const supabaseConfig = {
  url: 'https://xuypxquhkubappzovinl.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1eXB4cXVoa3ViYXBwem92aW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkzMTEzMTUsImV4cCI6MjA1NDg4NzMxNX0.704l61wPoYoVQe7Iu5GvpBDPi8xfVh6eD8HYdfWkliE'
};

/**
 * Verifies that the Supabase endpoint is accessible
 * @returns {Promise<boolean>}
 */
async function verifySupabaseEndpoint() {
  try {
    const response = await fetch(`${supabaseConfig.url}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`
      }
    });
    
    if (!response.ok) {
      console.error('[DEBUG] Supabase endpoint verification failed:', {
        status: response.status,
        statusText: response.statusText
      });
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[DEBUG] Supabase endpoint verification error:', error);
    return false;
  }
}

/**
 * Updates or creates a user session in Supabase
 * Improved error handling and logging
 */
async function updateUserSession(sessionData) {
  console.log('[DEBUG] Attempting to update session with data:', {
    user_id: sessionData.id,
    email: sessionData.email,
    provider: 'google'
  });

  try {
    // Validate required fields
    if (!sessionData.id || !sessionData.email) {
      throw new Error('Missing required session data fields');
    }

    // Verify Supabase endpoint is accessible
    const isEndpointAccessible = await verifySupabaseEndpoint();
    if (!isEndpointAccessible) {
      throw new Error('Supabase endpoint is not accessible');
    }

    // First try to get existing session
    const checkResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/user_sessions?user_id=eq.${encodeURIComponent(sessionData.id)}`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    // Log full response details for debugging
    console.log('[DEBUG] Check existing session response:', {
      status: checkResponse.status,
      statusText: checkResponse.statusText,
      headers: Object.fromEntries(checkResponse.headers.entries())
    });

    const sessionPayload = {
      user_id: sessionData.id,
      email: sessionData.email,
      name: sessionData.name,
      picture_url: sessionData.picture,
      last_sign_in: new Date().toISOString(),
      provider: 'google',
      email_verified: sessionData.email_verified
    };

    let response;
    
    if (checkResponse.ok) {
      const existingSessions = await checkResponse.json();
      console.log('[DEBUG] Existing sessions found:', existingSessions?.length || 0);
      
      if (existingSessions?.length > 0) {
        console.log('[DEBUG] Updating existing session');
        response = await fetch(
          `${supabaseConfig.url}/rest/v1/user_sessions?user_id=eq.${encodeURIComponent(sessionData.id)}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${supabaseConfig.anonKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(sessionPayload)
          }
        );
      } else {
        console.log('[DEBUG] Creating new session');
        response = await fetch(
          `${supabaseConfig.url}/rest/v1/user_sessions`,
          {
            method: 'POST',
            headers: {
              'apikey': supabaseConfig.anonKey,
              'Authorization': `Bearer ${supabaseConfig.anonKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(sessionPayload)
          }
        );
      }
    } else {
      // If check fails, try to create new session anyway
      console.log('[DEBUG] Session check failed, attempting to create new session');
      response = await fetch(
        `${supabaseConfig.url}/rest/v1/user_sessions`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseConfig.anonKey,
            'Authorization': `Bearer ${supabaseConfig.anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(sessionPayload)
        }
      );
    }

    // Log full response details
    console.log('[DEBUG] Session operation response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[DEBUG] Session update failed:', {
        status: response.status,
        statusText: response.statusText,
        data: errorData
      });
      throw new Error(`Failed to update session: ${response.statusText || response.status}`);
    }

    console.log('[DEBUG] Session updated successfully');
    return { data: sessionPayload, error: null };
  } catch (error) {
    console.error('[DEBUG] Session tracking error:', {
      message: error.message,
      stack: error.stack
    });
    return { data: null, error };
  }
}

/**
 * Creates an MD5 hash of a string
 * @param {string} str - The string to hash
 * @returns {string} The MD5 hash
 */
function md5(str) {
  function rotateLeft(lValue, iShiftBits) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }

  function addUnsigned(lX, lY) {
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xC0000000 ^ lX8 ^ lY8;
      else return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    } else return lResult ^ lX8 ^ lY8;
  }

  function F(x, y, z) { return (x & y) | ((~x) & z); }
  function G(x, y, z) { return (x & z) | (y & (~z)); }
  function H(x, y, z) { return x ^ y ^ z; }
  function I(x, y, z) { return y ^ (x | (~z)); }

  function FF(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function GG(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function HH(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function II(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(str) {
    let lWordCount;
    const lMessageLength = str.length;
    const lNumberOfWordsTemp1 = lMessageLength + 8;
    const lNumberOfWordsTemp2 = (lNumberOfWordsTemp1 - (lNumberOfWordsTemp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWordsTemp2 + 1) * 16;
    const lWordArray = Array(lNumberOfWords - 1);
    let lBytePosition = 0;
    let lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }

  function wordToHex(lValue) {
    let WordToHexValue = "", WordToHexValueTemp = "", lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      WordToHexValueTemp = "0" + lByte.toString(16);
      WordToHexValue = WordToHexValue + WordToHexValueTemp.substr(WordToHexValueTemp.length - 2, 2);
    }
    return WordToHexValue;
  }

  const x = convertToWordArray(str);
  let k, AA, BB, CC, DD, a, b, c, d;
  const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

  a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;

  for (k = 0; k < x.length; k += 16) {
    AA = a; BB = b; CC = c; DD = d;
    a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
    d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
    b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
    a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
    d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
    c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
    b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
    d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
    c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
    b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
    a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
    d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
    c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
    b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
    a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
    d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
    c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
    b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
    a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
    d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
    c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
    b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
    a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
    d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
    c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
    b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
    a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
    d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
    c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
    b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
    a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
    d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
    c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
    b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
    a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
    d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
    c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
    b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
    a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
    d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
    c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
    b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
    a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
    d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
    c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
    b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
    a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
    d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
    c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
    b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
    a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
    d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
    c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
    b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
    a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
    d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
    c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
    b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
    a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
    d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
    c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
    b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }

  const temp = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
  return temp.toLowerCase();
}

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
 * Gets the user's profile picture from Chrome
 * @returns {Promise<string>} The user's profile picture URL
 */
async function getProfilePicture() {
  return new Promise((resolve, reject) => {
    chrome.identity.getProfileUserInfo((info) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        // Generate a proper MD5 hash of the email for Gravatar
        const emailHash = md5(info.email.toLowerCase().trim());
        const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?d=identicon&s=200`;
        resolve(gravatarUrl);
      }
    });
  });
}

/**
 * Handles the complete OAuth flow using Chrome's identity API
 * Uses Chrome's built-in account system and updates Supabase session
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

    // Update session in Supabase
    const { data: sessionResponse, error: sessionError } = await updateUserSession(sessionData);
    
    if (sessionError) {
      console.warn('[DEBUG] Session update warning:', sessionError);
      // Don't throw error, continue with local session
    } else {
      console.log('[DEBUG] Session updated in Supabase:', sessionResponse);
    }

    // Generate a session access token
    const tokenResponse = await chrome.identity.getAuthToken({ 
      interactive: true
    });
    console.log('[DEBUG] Got access token:', tokenResponse ? 'present' : 'missing');

    // Return user info with session data
    return { 
      session: {
        access_token: tokenResponse,
        user: sessionData,
        ...sessionResponse
      },
      user: {
        ...sessionData,
        access_token: tokenResponse,
        // Include any additional data from Supabase if available
        ...(sessionResponse?.user || {})
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
  if (!signedIn) {
    chrome.identity.getProfileUserInfo((info) => {
      console.log('[DEBUG] Profile info after sign out:', info);
    });
  }
});