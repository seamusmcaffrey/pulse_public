async function handleAuth() {
  try {
    // Get the hash parameters from the URL
    const hashParams = window.location.hash
      .substring(1)
      .split('&')
      .reduce((params, param) => {
        const [key, value] = param.split('=');
        params[key] = decodeURIComponent(value);
        return params;
      }, {});

    // Check for both id_token and access_token
    if (hashParams.id_token && hashParams.access_token) {
      // Initialize Supabase client
      const { createClient } = supabase;
      const supabaseClient = createClient(
        window.opener.config.supabase.url,
        window.opener.config.supabase.anonKey
      );

      // Sign in with ID token
      const { data: { session }, error } = await supabaseClient.auth.signInWithIdToken({
        provider: 'google',
        token: hashParams.id_token,
        access_token: hashParams.access_token,
        nonce: localStorage.getItem('oauth_nonce')
      });

      if (error) throw error;

      // Send success message back to extension
      chrome.runtime.sendMessage({
        type: 'signInSuccess',
        session: session,
        user: session.user
      });

      // Close the popup window
      window.close();
    } else {
      throw new Error('Missing required tokens in response');
    }
  } catch (error) {
    console.error('Auth error:', error);
    chrome.runtime.sendMessage({
      type: 'signInError',
      error: error.message
    });
    window.close();
  }
}

// Run auth handler when page loads
window.addEventListener('load', handleAuth); 