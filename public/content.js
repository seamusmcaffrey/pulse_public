// Add debug logging at the start of the file
console.log('[DEBUG] Content script loaded');
console.log('[DEBUG] Supabase config:', window.config?.supabase);

// Global state variables for managing authentication and extension context
let isSignedIn = false;
let userInfo = null;
let extensionContextValid = true;
let currentArticle = null;  // Add global currentArticle variable

// Listen for extension reload events
chrome.runtime.onMessage.addListener((message) => {
  if (message === 'EXTENSION_RELOADED') {
    console.log('[DEBUG] Extension reload detected');
    extensionContextValid = false;
    showError('Extension updated. Please reload the page.');
  }
});

/**
 * Loads the Alexandria font and adds it to the document
 * Used to maintain consistent typography across the extension UI
 * Adds a CSS class 'pulse-font' that can be used to apply the font to elements
 */
function loadFonts() {
  const fontLink = document.createElement('link');
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700&display=swap';
  fontLink.rel = 'stylesheet';
  document.head.appendChild(fontLink);
  
  // Add a CSS class for font-family fallbacks
  const style = document.createElement('style');
  style.textContent = `
    .pulse-font {
      font-family: 'Alexandria', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Detects if the current page is displaying a PDF document
 * Checks both URL patterns and DOM elements for PDF content
 * Used to determine appropriate rendering strategy
 * @returns {boolean} True if page contains PDF content
 */
function isPDFPage() {
  // Check for common PDF viewer elements or URLs
  const isPDFURL = window.location.href.toLowerCase().includes('.pdf');
  const hasPDFViewer = document.querySelector('embed[type="application/pdf"], object[type="application/pdf"], .pdf-viewer');
  return isPDFURL || hasPDFViewer;
}

/**
 * Returns layout dimensions and spacing for the overlay UI
 * Adjusts layout based on content type (PDF vs regular page)
 * Used to maintain consistent spacing across different page types
 * @returns {Object} Layout configuration object with dimensions
 */
function getLayoutAdjustments() {
  const isPDF = isPDFPage();
  console.log('[DEBUG] Content type detection - isPDF:', isPDF);
  
  return {
    headerHeight: '64px',
    contentTopMargin: '64px',
    sidebarTopMargin: '64px',
    sidebarPadding: '24px',
    sidebarWidth: '320px'
  };
}

/**
 * Creates the main container that will hold the page content
 * Positions content between the header and sidebars
 * Handles scrolling behavior for the main content area
 * @returns {HTMLElement} The main content container element
 */
function createMainContentContainer() {
  const layout = getLayoutAdjustments();
  const container = document.createElement('div');
  container.className = 'pulse-main-content';
  container.style = `
    position: fixed;
    top: ${layout.headerHeight};
    left: ${layout.sidebarWidth};
    right: ${layout.sidebarWidth};
    bottom: 0;
    overflow-y: auto;
    background: white;
    z-index: 9997;
  `;
  return container;
}

/**
 * Loads PDF.js library and its worker
 * Required for custom PDF rendering functionality
 * Sets up PDF.js worker configuration
 * @returns {Promise} Resolves when PDF.js is fully loaded
 */
function loadPDFJS() {
  return new Promise((resolve) => {
    const pdfScript = document.createElement('script');
    pdfScript.type = 'text/javascript';
    pdfScript.src = chrome.runtime.getURL('pdf.min.js');
    pdfScript.onload = function() {
      const workerScript = document.createElement('script');
      workerScript.type = 'text/javascript';
      workerScript.src = chrome.runtime.getURL('pdf.worker.min.js');
      workerScript.onload = function() {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.js');
        resolve();
      };
      document.head.appendChild(workerScript);
    };
    document.head.appendChild(pdfScript);
  });
}

/**
 * Moves existing page content into our custom container
 * Handles both regular content and PDF documents differently
 * For PDFs: Creates custom viewer with PDF.js
 * For regular content: Wraps existing content
 * @param {HTMLElement} container The target container element
 * @returns {Promise<void>}
 */
async function moveContentToContainer(container) {
  const isPDF = isPDFPage();
  console.log('[DEBUG] Moving content - isPDF:', isPDF);

  if (isPDF) {
    // For PDF content, create our own viewer
    const pdfViewer = document.querySelector('embed[type="application/pdf"], object[type="application/pdf"], .pdf-viewer');
    if (pdfViewer) {
      console.log('[DEBUG] Found PDF viewer, creating custom viewer');
      
      // Load PDF.js first
      await loadPDFJS();
      
      // Create wrapper for our custom viewer
      const wrapper = document.createElement('div');
      wrapper.className = 'pulse-pdf-wrapper';
      wrapper.style = `
        position: fixed;
        top: 64px;
        left: 320px;
        right: 320px;
        bottom: 0;
        background: white;
        z-index: 9996;
      `;
      
      // Create canvas for PDF rendering
      const canvas = document.createElement('canvas');
      canvas.style.cssText = `
        width: 100%;
        height: 100%;
        display: block;
      `;
      wrapper.appendChild(canvas);
      
      // Add toolbar for PDF controls
      const toolbar = document.createElement('div');
      toolbar.className = 'pulse-pdf-toolbar';
      toolbar.style = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 40px;
        background: #f3f4f6;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        padding: 0 16px;
        gap: 16px;
        z-index: 9997;
      `;
      toolbar.innerHTML = `
        <button id="prev-page" style="padding: 4px 8px;">Previous</button>
        <span id="page-info">Page: <span id="page-num">1</span> / <span id="page-count">?</span></span>
        <button id="next-page" style="padding: 4px 8px;">Next</button>
        <button id="zoom-in" style="padding: 4px 8px;">Zoom In</button>
        <button id="zoom-out" style="padding: 4px 8px;">Zoom Out</button>
      `;
      wrapper.appendChild(toolbar);
      
      // Get PDF URL
      const pdfUrl = pdfViewer.src || pdfViewer.data;
      
      try {
        // Load and render PDF
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        loadingTask.promise.then(pdf => {
          console.log('[DEBUG] PDF loaded successfully');
          let currentPage = 1;
          let currentScale = 1.0;
          
          // Update page count
          document.getElementById('page-count').textContent = pdf.numPages;
          
          // Function to render current page
          const renderPage = (pageNum, scale = currentScale) => {
            pdf.getPage(pageNum).then(page => {
              const viewport = page.getViewport({ scale });
              const context = canvas.getContext('2d');
              
              // Make canvas full size while maintaining aspect ratio
              const containerWidth = wrapper.clientWidth;
              const containerHeight = wrapper.clientHeight - 40; // Subtract toolbar height
              const ratio = Math.min(containerWidth / viewport.width, containerHeight / viewport.height);
              
              canvas.width = viewport.width * ratio;
              canvas.height = viewport.height * ratio;
              
              const renderContext = {
                canvasContext: context,
                viewport: page.getViewport({ scale: scale * ratio })
              };
              
              page.render(renderContext);
            });
          };
          
          // Initial render
          renderPage(currentPage);
          
          // Add event listeners for controls
          document.getElementById('prev-page').addEventListener('click', () => {
            if (currentPage > 1) {
              currentPage--;
              document.getElementById('page-num').textContent = currentPage;
              renderPage(currentPage);
            }
          });
          
          document.getElementById('next-page').addEventListener('click', () => {
            if (currentPage < pdf.numPages) {
              currentPage++;
              document.getElementById('page-num').textContent = currentPage;
              renderPage(currentPage);
            }
          });
          
          document.getElementById('zoom-in').addEventListener('click', () => {
            currentScale *= 1.2;
            renderPage(currentPage);
          });
          
          document.getElementById('zoom-out').addEventListener('click', () => {
            currentScale *= 0.8;
            renderPage(currentPage);
          });
          
          // Handle window resize
          window.addEventListener('resize', () => {
            renderPage(currentPage);
          });
        });
      } catch (error) {
        console.error('[DEBUG] Error loading PDF:', error);
        wrapper.innerHTML = '<div style="padding: 20px; color: #ef4444;">Error loading PDF. Please try refreshing the page.</div>';
      }
      
      // Hide original PDF viewer
      pdfViewer.style.display = 'none';
      
      // Add our wrapper to the container
      container.appendChild(wrapper);
    }
  } else {
    // For non-PDF content, use the original wrapping approach
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'pulse-content-wrapper';
    contentWrapper.style = 'padding: 20px; min-height: 100%;';
    
    Array.from(document.body.children).forEach(child => {
      if (!['overlay-header', 'left-sidebar', 'right-sidebar', 'pulse-main-content'].includes(child.className)) {
        contentWrapper.appendChild(child);
      }
    });
    
    container.appendChild(contentWrapper);
  }
  
  document.body.appendChild(container);
}

/**
 * Fetches whitelist domains from Supabase
 * Used to determine which sites the extension should activate on
 * Connects to Supabase 'whitelist' table
 * @returns {Promise<string[]>} Array of allowed domain names
 */
async function fetchWhitelist() {
  const supabaseConfig = window.config?.supabase;
  if (!supabaseConfig?.url || !supabaseConfig?.anonKey) {
    console.error('[DEBUG] Missing Supabase configuration:', supabaseConfig);
    return [];
  }

  try {
    const response = await fetch(
      `${supabaseConfig.url}/rest/v1/whitelist?select=domain`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseConfig.anonKey,
          'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        }
      }
    );

    if (response.ok) {
      const domains = await response.json();
      console.log('[DEBUG] Fetched whitelist domains:', domains);
      return domains.map(d => d.domain.toLowerCase());
    }
  } catch (error) {
    console.error('[DEBUG] Error fetching whitelist:', error);
  }
  return [];
}

/**
 * Attaches click handler to the Google Sign-in button
 * Initializes OAuth flow through Chrome extension API
 * Connected to background.js for auth handling
 */
function attachSignInHandler() {
  const signInButton = document.querySelector(".sign-in-button");
  if (signInButton) {
    signInButton.addEventListener("click", signIn);
  }
}

/**
 * Displays error messages in the sign-in button
 * Temporarily changes button color and text
 * Auto-resets after 3 seconds
 * @param {string} message Error message to display
 */
function showError(message) {
  console.error('[DEBUG] Pulse Error:', message);
  const signInButton = document.querySelector(".sign-in-button");
  if (signInButton) {
    signInButton.style.backgroundColor = '#ef4444';
    signInButton.textContent = 'Error: ' + message;
    setTimeout(() => {
      signInButton.style.backgroundColor = '#888888';
      signInButton.textContent = 'Sign in with Google';
    }, 3000);
  }
}

/**
 * Updates UI state after successful authentication
 * Updates global auth state
 * Triggers UI refresh to show user info
 * @param {Object} user User data from Google OAuth
 */
function updateAuthState(user) {
  if (user) {
    console.log('[DEBUG] Updating auth state with user:', {
      id: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0]
    });
    
    isSignedIn = true;
    userInfo = {
      id: user.id || user.sub || user.email,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      picture: user.picture,
      emailVerified: user.email_verified,
      // Get token from session if available
      accessToken: user.session?.access_token || user.access_token || user.accessToken
    };

    console.log('[DEBUG] Auth state updated with token:', userInfo.accessToken ? 'present' : 'missing');
    
    // Store auth state in extension storage
    chrome.storage.local.set({ 
      authState: { 
        isSignedIn, 
        userInfo,
        lastUpdated: new Date().toISOString()
      }
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[DEBUG] Failed to store auth state:', chrome.runtime.lastError);
      } else {
        console.log('[DEBUG] Auth state stored in extension storage');
      }
    });
    
    updateUIForSignedInUser();

    // Initialize social features now that we're signed in
    console.log('[DEBUG] Initializing social features after sign in');
    loadSocialComments().catch(error => {
      console.error('[DEBUG] Error loading social comments after sign in:', error);
    });
    setupCommentForm();
  } else {
    console.log('[DEBUG] Clearing auth state');
    isSignedIn = false;
    userInfo = null;
    
    // Clear stored auth state
    chrome.storage.local.remove('authState', () => {
      if (chrome.runtime.lastError) {
        console.error('[DEBUG] Failed to clear auth state:', chrome.runtime.lastError);
      } else {
        console.log('[DEBUG] Auth state cleared from extension storage');
      }
    });
    
    updateUIForSignedOutUser();

    // Show sign-in prompt in social container
    const socialContainer = document.getElementById('social-container');
    if (socialContainer) {
      socialContainer.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <p style="color: #666; margin-bottom: 12px;">Sign in to view and post comments</p>
          <button class="sign-in-button" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 500; cursor: pointer;">
            Sign in with Google
          </button>
        </div>
      `;
      const signInButton = socialContainer.querySelector('.sign-in-button');
      if (signInButton) {
        signInButton.addEventListener('click', signIn);
      }
    }
  }
}

/**
 * Handles Google Sign-in button click
 * Initiates OAuth flow through Chrome extension API
 * Updates UI based on auth result
 */
function signIn() {
  console.log("[DEBUG] Sign in clicked");
  
  // Check if extension context is valid
  if (!chrome.runtime?.id) {
    console.error('[DEBUG] Extension context invalid - reloading page');
    showError('Extension needs to be reloaded. Reloading page...');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
    return;
  }
  
  // Add availability check
  if (typeof chrome.runtime?.sendMessage !== 'function') {
    console.error('[FATAL] Chrome runtime not available');
    showError('Extension not loaded properly. Please reload the page.');
    return;
  }

  chrome.runtime.sendMessage({ type: 'initiate_oauth' }, (response) => {
    // Check for extension context invalidation
    if (chrome.runtime.lastError && chrome.runtime.lastError.message.includes('Extension context invalidated')) {
      console.error('[DEBUG] Extension context invalidated during auth');
      showError('Extension updated. Reloading page...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      return;
    }
    
    if (chrome.runtime.lastError) {
      console.error('[DEBUG] Sign in error:', chrome.runtime.lastError.message);
      showError('Authentication failed. Please try again.');
    } else if (response?.error) {
      console.error('[DEBUG] Sign in error:', response.error);
      showError('Authentication failed: ' + response.error);
    } else if (response?.user) {
      console.log('[DEBUG] Sign in successful:', {
        id: response.user.id,
        email: response.user.email,
        hasSession: !!response.session
      });
      // Pass both user and session data
      updateAuthState({
        ...response.user,
        session: response.session
      });
    } else {
      console.error('[DEBUG] Invalid response format:', response);
      showError('Invalid response from authentication service');
    }
  });
}

/**
 * Updates UI elements after successful sign-in
 * Replaces sign-in button with user info
 * Enables comment functionality
 * Displays user avatar and name
 */
function updateUIForSignedInUser() {
  const header = document.querySelector(".overlay-header");
  if (!header) return;

  const userSection = header.querySelector(".user-section");
  if (userSection) {
    userSection.innerHTML = `
      <div class="user-info">
        <img src="${userInfo.picture}" alt="${userInfo.name}" class="user-avatar">
        <span class="user-name">${userInfo.name}</span>
      </div>
    `;
  }

  // Enable comment actions
  document.querySelectorAll(".action-button").forEach((button) => {
    button.disabled = false;
  });

  // Enable comment form if signed in
  const postButton = document.getElementById('post-comment-btn');
  const commentInput = document.getElementById('comment-input');
  if (postButton && commentInput) {
    postButton.disabled = !commentInput.value.trim();
    commentInput.placeholder = "Share your thoughts...";
  }
}

/**
 * Validates and normalizes image URLs
 * Supports Imgur and direct image URLs
 * Used for user avatars and expert profile images
 * @param {string} url The image URL to validate
 * @returns {string|null} Validated URL or null if invalid
 */
function getValidImageUrl(url) {
  if (!url) return null;
  // Check if it's a valid image URL (Imgur, general image URL, etc)
  const validImagePattern = /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp)$/i;
  const validImgurPattern = /^https?:\/\/(?:i\.)?imgur\.com\/.*$/i;
  
  if (validImagePattern.test(url) || validImgurPattern.test(url)) {
    return url;
  }
  return null;
}

/**
 * Formats metadata values for display
 * Handles null/undefined/empty values
 * Used for article metadata tags
 * @param {Object} article Article data object
 * @param {string} field Field name to format
 * @returns {string} Formatted metadata value
 */
function formatMetadata(article, field) {
  if (!article) return "N/A";
  
  const value = article[field];
  if (value === null || value === undefined || value === "") return "N/A";
  
  // Clean and format the value
  const cleanValue = String(value).trim();
  return cleanValue || "N/A";
}

/**
 * Normalizes article URLs for consistent matching
 * Handles various publisher URL patterns
 * Supports ScienceDirect and T&F Online
 * @param {string} url URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // For ScienceDirect articles
    if (urlObj.hostname.includes('sciencedirect.com')) {
      // Try to extract PII from different URL patterns
      const piiMatch = urlObj.pathname.match(/pii\/(S\d+)/i);
      if (piiMatch) {
        return `https://www.sciencedirect.com/science/article/pii/${piiMatch[1]}`.toLowerCase();
      }
    }
    
    // For Taylor & Francis Online (tandfonline.com)
    if (urlObj.hostname.includes('tandfonline.com')) {
      // Extract DOI from the URL path, handling more URL patterns
      const doiMatch = urlObj.pathname.match(/doi\/(?:abs|full|figure|pdf|epub)?\/(10\.\d{4,}\/[-._;()\/:A-Z0-9]+)/i);
      if (doiMatch) {
        // Always return the canonical /doi/abs/ format for T&F URLs
        return `https://www.tandfonline.com/doi/abs/${doiMatch[1]}`.toLowerCase();
      }
    }

    // For other URLs, create a clean normalized version
    const cleanUrl = new URL(url);
    
    // Remove all query parameters except those that are essential for article identification
    const essentialParams = new Set(['doi', 'pii', 'pmid', 'id']);
    const params = Array.from(cleanUrl.searchParams.entries());
    cleanUrl.search = '';  // Clear all params
    
    // Only keep essential parameters
    params.forEach(([key, value]) => {
      if (essentialParams.has(key.toLowerCase())) {
        cleanUrl.searchParams.set(key.toLowerCase(), value);
      }
    });
    
    // Remove hash fragments unless they're meaningful for the article
    cleanUrl.hash = '';
    
    // Remove trailing slashes and convert to lowercase
    return cleanUrl.toString().replace(/\/$/, '').toLowerCase();
  } catch (error) {
    console.error('[DEBUG] Error normalizing URL:', error);
    return url.toLowerCase();  // At least convert to lowercase if URL parsing fails
  }
}

/**
 * Extracts article identifiers from URLs
 * Supports DOI, PII, and article numbers
 * Used for article matching in database
 * @param {string} url Article URL to parse
 * @returns {Object} Extracted identifiers
 */
function extractArticleIdentifiers(url) {
  try {
    const urlObj = new URL(url);
    const identifiers = {
      doi: null,
      pii: null,
      articleNumber: null,
      normalizedUrl: url.toLowerCase()
    };

    // Extract DOI from various patterns
    const doiPatterns = [
      /\/(10\.\d{4,}\/[-._;()\/:A-Z0-9]+)/i,  // Standard DOI pattern
      /doi\/(?:abs|full|figure|pdf|epub)?\/(10\.\d{4,}\/[-._;()\/:A-Z0-9]+)/i,  // T&F pattern
      /doi\/(10\.\d{4,}\/[-._;()\/:A-Z0-9]+)/i  // SAGE pattern
    ];

    for (const pattern of doiPatterns) {
      const match = urlObj.pathname.match(pattern);
      if (match) {
        identifiers.doi = match[1].toLowerCase();
        break;
      }
    }

    // Extract PII (ScienceDirect)
    const piiMatch = urlObj.pathname.match(/pii\/(S\d+)/i);
    if (piiMatch) {
      identifiers.pii = piiMatch[1].toLowerCase();
    }

    // Extract article numbers from various patterns
    const articlePatterns = [
      /article[=\/](\d+)/i,  // Generic article number
      /viewcontent\.cgi\?article=(\d+)/i,  // Digital Commons pattern
    ];

    for (const pattern of articlePatterns) {
      const match = url.match(pattern);
      if (match) {
        identifiers.articleNumber = match[1];
        break;
      }
    }

    return identifiers;
  } catch (error) {
    console.error('[DEBUG] Error extracting identifiers:', error);
    return null;
  }
}

/**
 * Fetches article data from Supabase
 * Uses multiple matching strategies (DOI, PII, URL)
 * Connected to Supabase 'articles' table
 * @param {string} currentUrl Current page URL
 * @returns {Promise<Object|null>} Article data or null if not found
 */
async function fetchArticleData(currentUrl) {
  const supabaseConfig = window.config?.supabase;
  if (!supabaseConfig?.url || !supabaseConfig?.anonKey) {
    console.error('[DEBUG] Missing Supabase configuration:', supabaseConfig);
    return null;
  }

  console.log('[DEBUG] Checking article match for URL:', currentUrl);

  const headers = {
    'apikey': supabaseConfig.anonKey,
    'Authorization': `Bearer ${supabaseConfig.anonKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  try {
    const identifiers = extractArticleIdentifiers(currentUrl);
    console.log('[DEBUG] Extracted identifiers:', identifiers);

    if (!identifiers) {
      return null;
    }

    // Try multiple matching strategies in order of specificity
    let matches;

    // 1. Try DOI match if available
    if (identifiers.doi) {
      console.log('[DEBUG] Trying DOI match:', identifiers.doi);
      const doiResponse = await fetch(
        `${supabaseConfig.url}/rest/v1/articles?doi=ilike.${encodeURIComponent(identifiers.doi)}&select=*`,
        { method: 'GET', headers }
      );

      if (doiResponse.ok) {
        matches = await doiResponse.json();
        if (matches?.length > 0) {
          console.log('[DEBUG] Found match by DOI:', matches[0]);
          return matches[0];
        }
      }
    }

    // 2. Try PII match if available
    if (identifiers.pii) {
      console.log('[DEBUG] Trying PII match:', identifiers.pii);
      const piiResponse = await fetch(
        `${supabaseConfig.url}/rest/v1/articles?link=ilike.${encodeURIComponent(`%${identifiers.pii}%`)}&select=*`,
        { method: 'GET', headers }
      );

      if (piiResponse.ok) {
        matches = await piiResponse.json();
        if (matches?.length > 0) {
          console.log('[DEBUG] Found match by PII:', matches[0]);
          return matches[0];
        }
      }
    }

    // 3. Try article number match if available
    if (identifiers.articleNumber) {
      console.log('[DEBUG] Trying article number match:', identifiers.articleNumber);
      const articleResponse = await fetch(
        `${supabaseConfig.url}/rest/v1/articles?link=ilike.${encodeURIComponent(`%article=${identifiers.articleNumber}%`)}&select=*`,
        { method: 'GET', headers }
      );

      if (articleResponse.ok) {
        matches = await articleResponse.json();
        if (matches?.length > 0) {
          console.log('[DEBUG] Found match by article number:', matches[0]);
          return matches[0];
        }
      }
    }

    // 4. Try fuzzy URL match as last resort
    const baseUrl = identifiers.normalizedUrl.split('?')[0];
    console.log('[DEBUG] Trying fuzzy URL match:', baseUrl);
    
    const fuzzyResponse = await fetch(
      `${supabaseConfig.url}/rest/v1/articles?link=ilike.${encodeURIComponent('%' + baseUrl + '%')}&select=*`,
      { method: 'GET', headers }
    );

    if (fuzzyResponse.ok) {
      matches = await fuzzyResponse.json();
      if (matches?.length > 0) {
        console.log('[DEBUG] Found fuzzy match:', matches[0]);
        return matches[0];
      }
    }

    console.log('[DEBUG] No matching article found after all attempts');
    return null;
  } catch (error) {
    console.error('[DEBUG] Error in fetchArticleData:', error);
    return null;
  }
}

/**
 * Fetches comments for an article from Supabase
 * Includes expert information through table joins
 * Connected to Supabase 'comments' and 'experts' tables
 * @param {string} articleId UUID of the article
 * @returns {Promise<Array>} Array of comments with expert data
 */
async function fetchComments(articleId) {
  const supabaseUrl = window.config.supabase.url;
  const supabaseKey = window.config.supabase.anonKey;

  if (!articleId) {
    console.error('[DEBUG] No article ID provided to fetchComments');
    return [];
  }

  console.log('[DEBUG] Fetching comments for article ID:', articleId);
  
  try {
    // Verify articleId is a valid UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(articleId)) {
      console.error('[DEBUG] Invalid article ID format:', articleId);
      return [];
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/comments?article_id=eq.${articleId}&select=*,experts:expert_email(name,title,image_url)&order=created_at.desc`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('[DEBUG] Comments response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] Failed to fetch comments:', response.status, response.statusText, errorText);
      throw new Error(`Failed to fetch comments: ${response.status} ${response.statusText}`);
    }

    const comments = await response.json();
    console.log('[DEBUG] Fetched comments:', comments);
    
    if (!Array.isArray(comments)) {
      console.error('[DEBUG] Comments response is not an array:', comments);
      return [];
    }
    
    return comments;
  } catch (error) {
    console.error('[DEBUG] Error fetching comments:', error);
    return [];
  }
}

/**
 * Fetches trending articles from Supabase
 * Limited to top 5 trending articles
 * Connected to Supabase 'articles' table
 * @returns {Promise<Array>} Array of trending articles
 */
async function fetchTrendingArticles() {
  const supabaseUrl = window.config.supabase.url;
  const supabaseKey = window.config.supabase.anonKey;

  console.log('[DEBUG] Fetching trending articles');

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/articles?is_trending=eq.true&select=*&order=trending_rank.asc.nullslast&limit=5`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('[DEBUG] Trending articles response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] Failed to fetch trending articles:', response.status, response.statusText, errorText);
      throw new Error(`Failed to fetch trending articles: ${response.status} ${response.statusText}`);
    }

    const trendingArticles = await response.json();
    console.log('[DEBUG] Fetched trending articles:', trendingArticles);
    
    if (!Array.isArray(trendingArticles)) {
      console.error('[DEBUG] Trending articles response is not an array:', trendingArticles);
      return [];
    }

    // Verify each article has required fields
    const validArticles = trendingArticles.filter(article => {
      const isValid = article && article.id && article.title && article.link;
      if (!isValid) {
        console.error('[DEBUG] Invalid trending article:', article);
      }
      return isValid;
    });

    console.log('[DEBUG] Valid trending articles:', validArticles.length);
    return validArticles;
  } catch (error) {
    console.error('[DEBUG] Error fetching trending articles:', error);
    return [];
  }
}

// Remove whitelist-related functions and simplify domain check
function isSupportedDomain() {
  return true; // Always return true to show overlay on all pages
}

/**
 * Creates the main extension overlay UI
 * Renders header, sidebars, and content container
 * Manages layout and content positioning
 * Fetches and displays article data, comments, and trending articles
 * @param {string[]} whitelistDomains Array of allowed domains
 * @returns {Promise<void>}
 */
async function createOverlay() {
  console.log('[DEBUG] Starting overlay creation');
  
  if (!extensionContextValid) {
    console.warn('[DEBUG] Extension context invalid, skipping overlay creation');
    return;
  }

  // Load fonts first
  loadFonts();
  
  // Get layout adjustments based on content type
  const layout = getLayoutAdjustments();
  
  // Create main content container first
  const mainContent = createMainContentContainer();
  
  // Fetch article data first
  currentArticle = await fetchArticleData(window.location.href);
  if (!currentArticle) {
    console.log('[DEBUG] No matching article found. Extension will not load.');
    return;
  }
  console.log('[DEBUG] Article found:', currentArticle);

  // Check for existing auth state in storage
  try {
    const storage = await new Promise((resolve) => {
      chrome.storage.local.get('authState', resolve);
    });
    
    if (storage.authState?.isSignedIn && storage.authState?.userInfo) {
      console.log('[DEBUG] Found existing auth state:', storage.authState);
      updateAuthState(storage.authState.userInfo);
    } else {
      console.log('[DEBUG] No existing auth state found');
    }
  } catch (error) {
    console.error('[DEBUG] Error checking auth state:', error);
  }

  // Create header with updated styling
  const header = document.createElement("div");
  header.className = "overlay-header pulse-font";
  header.style = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: ${layout.headerHeight};
    z-index: 9999;
    background: #FFF0F7;
    color: #333;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  `;
  
  // Create metadata buttons HTML with pulse-font class
  const metadataHTML = [
    `<span class="metadata-tag pulse-font" style="background: #FF4444; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; white-space: nowrap;">
      <span style="opacity: 0.8; margin-right: 4px;">🧪 Sample:</span> ${formatMetadata(currentArticle, 'sample_size')}
    </span>`,
    `<span class="metadata-tag pulse-font" style="background: #FF9500; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; white-space: nowrap;">
      <span style="opacity: 0.8; margin-right: 4px;">⌛ Duration:</span> ${formatMetadata(currentArticle, 'duration')}
    </span>`,
    `<span class="metadata-tag pulse-font" style="background: #34C759; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; white-space: nowrap;">
      <span style="opacity: 0.8; margin-right: 4px;">📐 Effect Size:</span> ${formatMetadata(currentArticle, 'effect_size')}
    </span>`,
    `<span class="metadata-tag pulse-font" style="background: #007AFF; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; white-space: nowrap;">
      <span style="opacity: 0.8; margin-right: 4px;">📝 Design:</span> ${formatMetadata(currentArticle, 'design')}
    </span>`,
    `<span class="metadata-tag pulse-font" style="background: #5856D6; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; white-space: nowrap;">
      <span style="opacity: 0.8; margin-right: 4px;">💪 Rigor:</span> ${formatMetadata(currentArticle, 'rigor')}
    </span>`
  ];

  console.log('[DEBUG] Generated metadata buttons:', metadataHTML.length);
  
  header.innerHTML = `
    <div style="position: relative; height: 100%; padding: 16px 0; display: flex; align-items: center;">
      <div style="display: flex; align-items: center; gap: 12px; margin-left: 20px; width: 300px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: rgb(219, 39, 119);">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
        </svg>
        <h1 style="font-size: 32px; font-weight: 600; color: rgb(219, 39, 119); margin: 0;">Pulse</h1>
      </div>
      
      <div class="metadata-buttons" style="display: flex; gap: 8px; align-items: center; padding-left: 20px; flex-grow: 1;">
        ${metadataHTML.join('')}
      </div>

      <div style="margin-right: 24px; width: 300px; display: flex; justify-content: flex-end;">
        ${isSignedIn ? `
          <div class="user-info" style="display: flex; align-items: center; gap: 8px;">
            <img src="${userInfo?.picture}" alt="${userInfo?.name}" class="user-avatar" style="width: 32px; height: 32px; border-radius: 16px;">
            <span class="user-name" style="font-size: 14px; color: #333;">${userInfo?.name}</span>
          </div>
        ` : `
          <button class="sign-in-button" style="background: #888888; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 500; cursor: pointer; font-family: Alexandria;">Sign in with Google</button>
        `}
      </div>
    </div>
  `;
  
  console.log('[DEBUG] Appending header to document.body');
  document.body.appendChild(header);
  
  // Attach sign-in handler
  attachSignInHandler();
  
  // Verify metadata buttons are rendered
  const renderedMetadataTags = header.querySelectorAll('.metadata-tag');
  console.log('[DEBUG] Rendered metadata tags count:', renderedMetadataTags.length);
  console.log('[DEBUG] First metadata tag content:', renderedMetadataTags[0]?.textContent);

  // Create left sidebar with updated styling
  const leftSidebar = document.createElement("div");
  leftSidebar.className = "left-sidebar pulse-font";
  leftSidebar.style = `
    position: fixed;
    top: ${layout.sidebarTopMargin};
    left: 0;
    bottom: 0;
    width: ${layout.sidebarWidth};
    z-index: 9998;
    background: white;
    box-shadow: 2px 0 5px rgba(0,0,0,0.1);
    padding: ${layout.sidebarPadding};
    overflow-y: auto;
  `;
  leftSidebar.innerHTML = `
    <h3 style="font-weight: 700; color: white; font-size: 24px; background: #2563eb; padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Expert Commentary</h3>
    <div id="comments-container"></div>
  `;
  console.log('[DEBUG] Appending left sidebar to document.body');
  document.body.appendChild(leftSidebar);
  
  // Verify left sidebar is visible
  const leftSidebarComputedStyle = window.getComputedStyle(leftSidebar);
  console.log('[DEBUG] Left sidebar visibility:', {
    display: leftSidebarComputedStyle.display,
    visibility: leftSidebarComputedStyle.visibility,
    opacity: leftSidebarComputedStyle.opacity,
    zIndex: leftSidebarComputedStyle.zIndex
  });

  // Create right sidebar with updated styling
  const rightSidebar = document.createElement("div");
  rightSidebar.className = "right-sidebar pulse-font";
  rightSidebar.style = `
    position: fixed;
    top: ${layout.sidebarTopMargin};
    right: 0;
    bottom: 0;
    width: ${layout.sidebarWidth};
    z-index: 9998;
    background: white;
    box-shadow: -2px 0 5px rgba(0,0,0,0.1);
    padding: ${layout.sidebarPadding};
    overflow-y: auto;
  `;
  rightSidebar.innerHTML = `
    <div class="trending-research-section">
      <h3 style="font-weight: 700; color: white; font-size: 24px; background: #2563eb; padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Trending Research</h3>
      <div id="trending-articles-container"></div>
    </div>
    <div class="social-discussion" style="margin-top: 40px; padding-top: 40px; border-top: 1px solid #e5e7eb;">
      <h3 style="font-weight: 700; color: white; font-size: 24px; background: #2563eb; padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Social Discussion</h3>
      <div id="social-container">
        <div id="social-comments-list" style="margin-bottom: 16px;"></div>
        <div id="comment-form" style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <textarea id="comment-input" placeholder="Share your thoughts..." style="width: 100%; min-height: 80px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px; margin-bottom: 8px; resize: vertical;"></textarea>
          <button id="post-comment-btn" class="action-button" style="background: #2563eb; color: white; padding: 8px 16px; border-radius: 4px; font-weight: 500; width: 100%;" disabled>Post Comment</button>
        </div>
      </div>
    </div>
  `;
  console.log('[DEBUG] Appending right sidebar to document.body');
  document.body.appendChild(rightSidebar);
  console.log('[DEBUG] Right sidebar appended');

  // Fetch and display comments
  console.log('[DEBUG] Fetching comments for article:', currentArticle.id);
  const commentsContainer = document.getElementById('comments-container');
  if (commentsContainer) {
    commentsContainer.innerHTML = '<p>Loading comments...</p>';
    try {
      const comments = await fetchComments(currentArticle.id);
      console.log('[DEBUG] Comments fetched successfully:', comments);
      
      if (!comments || comments.length === 0) {
        commentsContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No comments yet. Be the first to comment!</p>';
      } else {
        commentsContainer.innerHTML = comments.map(comment => {
          const expertEmail = comment.expert_email || 'anonymous';
          const expertName = comment.experts?.name || expertEmail.split('@')[0];
          const expertTitle = comment.experts?.title || 'Expert Contributor';
          const avatarUrl = getValidImageUrl(comment.experts?.image_url) || 
                           `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(expertEmail)}`;
          
          return `
            <div class="professor-comment" style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #E5E7EB;">
              <div class="professor-header" style="display: flex; gap: 12px; margin-bottom: 16px;">
                <img class="professor-avatar" src="${avatarUrl}" alt="Expert Avatar" style="width: 48px; height: 48px; border-radius: 24px;">
                <div class="professor-info" style="flex-grow: 1;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 class="professor-name" style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">${expertName}</h3>
                    ${comment.verified ? '<span style="color: rgb(219, 39, 119); font-size: 12px;">✓ Verified</span>' : ''}
                  </div>
                  <p class="professor-title" style="margin: 4px 0; color: #6B7280; font-size: 14px;">${expertTitle}</p>
                </div>
              </div>
              <p class="comment-text" style="margin: 0 0 16px 0; line-height: 1.6; color: #374151;">${comment.content}</p>
              <div style="display: flex; gap: 16px; align-items: center;">
                <button style="display: flex; align-items: center; gap: 4px; background: none; border: none; color: #6B7280; font-size: 14px; cursor: pointer;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                  </svg>
                  24
                </button>
                <button style="display: flex; align-items: center; gap: 4px; background: none; border: none; color: #6B7280; font-size: 14px; cursor: pointer;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  Reply
                </button>
              </div>
            </div>
          `;
        }).join('');
        
        // Verify comments are rendered
        const renderedComments = commentsContainer.querySelectorAll('.professor-comment');
        console.log('[DEBUG] Rendered comments count:', renderedComments.length);
        console.log('[DEBUG] First comment content:', renderedComments[0]?.textContent);
      }
    } catch (error) {
      console.error('[DEBUG] Error displaying comments:', error);
      commentsContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #ef4444;">
          <p>Error loading comments. Please try again later.</p>
          <p style="font-size: 12px; color: #666;">${error.message}</p>
        </div>
      `;
    }
  }

  // Fetch and display trending articles
  console.log('[DEBUG] Fetching trending articles');
  const trendingContainer = document.getElementById('trending-articles-container');
  if (trendingContainer) {
    try {
      const articles = await fetchTrendingArticles();
      console.log('[DEBUG] Trending articles fetched successfully:', articles);
      
      if (!articles || articles.length === 0) {
        trendingContainer.innerHTML = `<p style="color: #666; text-align: center; padding: 20px;">No trending articles at the moment.</p>`;
      } else {
        trendingContainer.innerHTML = articles.map((article, index) => {
          const title = article.title || 'Untitled Article';
          const authors = Array.isArray(article.authors) ? article.authors.join(', ') : article.authors || '';
          
          return `
            <a href="${article.link}" class="trending-article-card" target="_blank" style="display: block; background: white; border-radius: 8px; padding: 16px; margin-bottom: 16px; text-decoration: none; color: inherit; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: relative;">
              <div class="number-badge" style="position: absolute; top: -8px; left: -8px; width: 24px; height: 24px; background: rgb(219, 39, 119); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 2px solid white;">
                ${index + 1}
              </div>
              <div class="trending-article-header" style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
                <h4 style="margin: 0; font-size: 14px; line-height: 1.4;">${title}</h4>
                <span class="arrow-icon" style="font-size: 18px;">→</span>
              </div>
              ${authors ? `<p class="trending-article-authors" style="margin: 8px 0 0; font-size: 12px; color: #666;">${authors}</p>` : ''}
            </a>
          `;
        }).join('');
        
        // Verify trending articles are rendered
        const renderedArticles = trendingContainer.querySelectorAll('.trending-article-card');
        console.log('[DEBUG] Rendered trending articles count:', renderedArticles.length);
        console.log('[DEBUG] First trending article content:', renderedArticles[0]?.textContent);
      }
    } catch (error) {
      console.error('[DEBUG] Error loading trending articles:', error);
      trendingContainer.innerHTML = `<p style="text-align: center; color: #ef4444;">Failed to load trending articles.</p>`;
    }
  }

  // Move existing content into our container
  moveContentToContainer(mainContent);

  // Add styles for the new layout
  const style = document.createElement("style");
  style.textContent = `
    body {
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    
    .pulse-main-content {
      position: fixed;
      top: 64px;
      left: 320px;
      right: 320px;
      bottom: 0;
      overflow: hidden;
      background: white;
    }
    
    .pulse-content-wrapper {
      height: 100%;
      overflow-y: auto;
      padding: 20px;
    }
    
    .pulse-pdf-wrapper {
      height: 100%;
      width: 100%;
    }
    
    .pulse-pdf-wrapper embed,
    .pulse-pdf-wrapper object,
    .pulse-pdf-wrapper .pdf-viewer {
      width: 100% !important;
      height: 100% !important;
    }
    
    /* Custom scrollbar styles */
    .pulse-content-wrapper::-webkit-scrollbar,
    .left-sidebar::-webkit-scrollbar,
    .right-sidebar::-webkit-scrollbar {
      width: 8px;
    }
    
    .pulse-content-wrapper::-webkit-scrollbar-thumb,
    .left-sidebar::-webkit-scrollbar-thumb,
    .right-sidebar::-webkit-scrollbar-thumb {
      background-color: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
    }
    
    .pulse-content-wrapper::-webkit-scrollbar-track,
    .left-sidebar::-webkit-scrollbar-track,
    .right-sidebar::-webkit-scrollbar-track {
      background-color: rgba(0, 0, 0, 0.05);
    }
  `;
  document.head.appendChild(style);
  
  // Verify styles are applied
  const bodyComputedStyle = window.getComputedStyle(document.body);
  console.log('[DEBUG] Body margins:', {
    marginTop: bodyComputedStyle.marginTop,
    marginLeft: bodyComputedStyle.marginLeft,
    marginRight: bodyComputedStyle.marginRight
  });

  console.log('[DEBUG] Overlay creation complete');

  // Initialize social features only if we have auth
  if (isSignedIn && userInfo?.id) {
    console.log('[DEBUG] User is signed in, loading social features');
    await loadSocialComments();
    setupCommentForm();
  } else {
    console.log('[DEBUG] User not signed in, social features will be initialized after sign in');
    // Show sign-in prompt in social container
    const socialContainer = document.getElementById('social-container');
    if (socialContainer) {
      socialContainer.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <p style="color: #666; margin-bottom: 12px;">Sign in to view and post comments</p>
          <button class="sign-in-button" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 500; cursor: pointer;">
            Sign in with Google
          </button>
        </div>
      `;
      const signInButton = socialContainer.querySelector('.sign-in-button');
      if (signInButton) {
        signInButton.addEventListener('click', signIn);
      }
    }
  }
}

/**
 * Main initialization function
 * Verifies Supabase configuration
 * Fetches whitelist and initializes overlay
 * Entry point for extension content script
 * @returns {Promise<void>}
 */
async function initialize() {
  console.log('[DEBUG] Starting initialization');
  
  try {
    // Load fonts first
    loadFonts();
    
    // Create and show overlay immediately
    await createOverlay();
    
    // Add dummy expert comments
    const dummyExpertComments = [
      {
        id: 'exp1',
        expert_email: 'dr.smith@university.edu',
        content: 'This research presents a fascinating approach to the problem. The methodology is sound and the results are promising.',
        created_at: '2024-03-25T10:00:00Z',
        expert_name: 'Dr. Jane Smith',
        expert_title: 'Professor of Computer Science',
        expert_institution: 'University of Technology'
      },
      {
        id: 'exp2',
        expert_email: 'prof.jones@institute.org',
        content: 'While the findings are interesting, I would suggest additional control experiments to validate the conclusions.',
        created_at: '2024-03-26T15:30:00Z',
        expert_name: 'Prof. Michael Jones',
        expert_title: 'Research Director',
        expert_institution: 'Institute of Advanced Studies'
      }
    ];
    
    // Add dummy social comments
    const dummySocialComments = [
      {
        id: 'soc1',
        user_name: 'ResearchEnthusiast',
        content: 'Great paper! The implications for future research are exciting.',
        created_at: '2024-03-27T09:15:00Z',
        likes: 12
      },
      {
        id: 'soc2',
        user_name: 'ScienceStudent',
        content: 'Could someone explain Figure 3 in more detail? I\'m having trouble understanding the correlation matrix.',
        created_at: '2024-03-27T11:45:00Z',
        likes: 8
      },
      {
        id: 'soc3',
        user_name: 'AcademicReader',
        content: 'The literature review section is particularly comprehensive. Well done!',
        created_at: '2024-03-28T14:20:00Z',
        likes: 15
      }
    ];
    
    // Update the comments in the UI
    const expertCommentsContainer = document.querySelector('.expert-comments-container');
    if (expertCommentsContainer) {
      expertCommentsContainer.innerHTML = dummyExpertComments.map(comment => `
        <div class="comment-card pulse-font">
          <div class="comment-header">
            <strong>${comment.expert_name}</strong>
            <span class="expert-title">${comment.expert_title}</span>
            <span class="expert-institution">${comment.expert_institution}</span>
          </div>
          <div class="comment-content">${comment.content}</div>
          <div class="comment-footer">
            <span class="comment-date">${new Date(comment.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      `).join('');
    }
    
    const socialCommentsContainer = document.querySelector('.social-comments-container');
    if (socialCommentsContainer) {
      socialCommentsContainer.innerHTML = dummySocialComments.map(comment => `
        <div class="comment-card pulse-font">
          <div class="comment-header">
            <strong>${comment.user_name}</strong>
          </div>
          <div class="comment-content">${comment.content}</div>
          <div class="comment-footer">
            <span class="comment-date">${new Date(comment.created_at).toLocaleDateString()}</span>
            <span class="likes-count">❤️ ${comment.likes}</span>
          </div>
        </div>
      `).join('');
    }
    
  } catch (error) {
    console.error('[DEBUG] Initialization error:', error);
    showError('Failed to initialize extension');
  }
}

// Wait for DOM and config to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Update loadSocialComments to handle undefined currentArticle
async function loadSocialComments() {
  const commentsContainer = document.getElementById('social-comments-list');
  if (!commentsContainer) return;

  if (!currentArticle?.id) {
    console.log('[DEBUG] No article ID available for social comments');
    commentsContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Comments not available for this article.</p>';
    return;
  }

  // Check if we're signed in and have a valid session
  if (!isSignedIn || !userInfo?.id) {
    console.log('[DEBUG] User not signed in, showing sign-in prompt for social comments');
    commentsContainer.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <p style="color: #666; margin-bottom: 12px;">Sign in to view and post comments</p>
        <button class="sign-in-button" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 500; cursor: pointer;">
          Sign in with Google
        </button>
      </div>
    `;
    const signInButton = commentsContainer.querySelector('.sign-in-button');
    if (signInButton) {
      signInButton.addEventListener('click', signIn);
    }
    return;
  }

  const supabaseUrl = window.config?.supabase?.url;
  const supabaseKey = window.config?.supabase?.anonKey;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[DEBUG] Missing Supabase configuration');
    commentsContainer.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Error: Missing configuration</p>';
    return;
  }

  try {
    console.log('[DEBUG] Fetching social comments for article:', currentArticle.id);
    console.log('[DEBUG] Auth token status:', {
      hasToken: !!userInfo.accessToken,
      tokenType: typeof userInfo.accessToken,
      tokenLength: userInfo.accessToken?.length
    });

    const encodedArticleId = encodeURIComponent(currentArticle.id);
    
    // First try to fetch comments without auth token
    const response = await fetch(
      `${supabaseUrl}/rest/v1/social_comments?article_id=eq.${encodedArticleId}&select=*&order=created_at.desc`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] Social comments fetch error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error(`Failed to fetch social comments: ${response.status} - ${errorText}`);
    }

    const comments = await response.json();
    console.log('[DEBUG] Social comments fetched:', comments);

    if (!comments || comments.length === 0) {
      commentsContainer.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No comments yet. Be the first to comment!</p>';
      return;
    }

    // Get unique user IDs from comments
    const userIds = [...new Set(comments.map(c => c.user_id))];
    console.log('[DEBUG] Found user IDs:', userIds);
    
    // Fetch user profiles using anon key
    const usersResponse = await fetch(
      `${supabaseUrl}/rest/v1/auth/users?id=in.(${userIds.join(',')})&select=id,email,raw_user_meta_data`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    let userProfiles = {};
    if (usersResponse.ok) {
      const profiles = await usersResponse.json();
      console.log('[DEBUG] Fetched user profiles:', profiles);
      userProfiles = profiles.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {});
    } else {
      console.error('[DEBUG] Failed to fetch user profiles:', await usersResponse.text());
    }

    commentsContainer.innerHTML = comments.map(comment => {
      const profile = userProfiles[comment.user_id] || {};
      const userName = profile.raw_user_meta_data?.name || profile.email?.split('@')[0] || 'Anonymous';
      const userAvatar = profile.raw_user_meta_data?.avatar_url || 
                        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(comment.user_id)}`;
      
      return `
        <div class="social-comment" style="background: white; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
          <div style="display: flex; gap: 12px; margin-bottom: 8px;">
            <img src="${userAvatar}" alt="${userName}" style="width: 40px; height: 40px; border-radius: 20px;">
            <div>
              <div style="font-weight: 600; color: #111827;">${userName}</div>
              <div style="color: #6B7280; font-size: 12px;">${new Date(comment.created_at).toLocaleString()}</div>
            </div>
          </div>
          <p style="margin: 0; color: #374151;">${comment.content}</p>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('[DEBUG] Error loading social comments:', error);
    commentsContainer.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 20px;">Error loading comments</p>';
  }
}

// Update setupCommentForm to use proper auth token
function setupCommentForm() {
  const commentInput = document.getElementById('comment-input');
  const postButton = document.getElementById('post-comment-btn');
  
  if (!commentInput || !postButton) return;

  // Enable/disable post button based on input
  commentInput.addEventListener('input', () => {
    const hasContent = commentInput.value.trim().length > 0;
    const canPost = hasContent && isSignedIn && userInfo?.accessToken;
    postButton.disabled = !canPost;
    
    // Update button state visually
    if (canPost) {
      postButton.style.opacity = '1';
      postButton.style.cursor = 'pointer';
    } else {
      postButton.style.opacity = '0.5';
      postButton.style.cursor = 'not-allowed';
    }
  });

  // Handle comment submission
  postButton.addEventListener('click', async () => {
    const content = commentInput.value.trim();
    if (!content) {
      console.log('[DEBUG] Empty comment content');
      return;
    }

    if (!isSignedIn || !userInfo?.accessToken) {
      console.log('[DEBUG] User not signed in or missing token');
      return;
    }

    if (!currentArticle?.id) {
      console.log('[DEBUG] No article ID available');
      return;
    }

    console.log('[DEBUG] Attempting to post comment:', {
      articleId: currentArticle.id,
      userId: userInfo.id,
      hasToken: !!userInfo.accessToken,
      tokenLength: userInfo.accessToken?.length
    });

    postButton.disabled = true;
    postButton.textContent = 'Posting...';
    postButton.style.opacity = '0.7';

    const supabaseUrl = window.config?.supabase?.url;
    const supabaseKey = window.config?.supabase?.anonKey;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[DEBUG] Missing Supabase configuration');
      postButton.textContent = 'Error: Configuration missing';
      setTimeout(() => {
        postButton.textContent = 'Post Comment';
        postButton.disabled = false;
        postButton.style.opacity = '1';
      }, 2000);
      return;
    }

    try {
      // First verify the user exists
      const userCheckResponse = await fetch(
        `${supabaseUrl}/rest/v1/auth/users?id=eq.${encodeURIComponent(userInfo.id)}`,
        {
          method: 'GET',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!userCheckResponse.ok) {
        console.error('[DEBUG] Failed to verify user:', await userCheckResponse.text());
        throw new Error('Failed to verify user');
      }

      const users = await userCheckResponse.json();
      if (!users || users.length === 0) {
        console.error('[DEBUG] User not found in database');
        throw new Error('User not found');
      }

      console.log('[DEBUG] User verified, posting comment');

      const response = await fetch(`${supabaseUrl}/rest/v1/social_comments`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          article_id: currentArticle.id,
          content: content,
          user_id: userInfo.id
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DEBUG] Failed to post comment:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          headers: Object.fromEntries(response.headers.entries())
        });
        throw new Error(`Failed to post comment: ${response.status} - ${errorText}`);
      }

      console.log('[DEBUG] Comment posted successfully');
      
      // Clear input and reload comments
      commentInput.value = '';
      postButton.textContent = 'Posted!';
      postButton.style.backgroundColor = '#10B981';
      
      // Reset button after animation
      setTimeout(() => {
        postButton.textContent = 'Post Comment';
        postButton.style.backgroundColor = '#2563eb';
        postButton.disabled = true;
        postButton.style.opacity = '0.5';
      }, 2000);

      // Reload comments
      await loadSocialComments();
    } catch (error) {
      console.error('[DEBUG] Error posting comment:', error);
      postButton.textContent = 'Error posting comment';
      postButton.style.backgroundColor = '#EF4444';
      
      setTimeout(() => {
        postButton.textContent = 'Post Comment';
        postButton.style.backgroundColor = '#2563eb';
        postButton.disabled = false;
        postButton.style.opacity = '1';
      }, 2000);
    }
  });
}
