/**
 * Content script for Pulse Chrome Extension
 * Injects overlay UI for expert comments on research articles
 */

console.log('Content script loaded');

// Global state
let isOverlayVisible = true;
let currentUser = null;
let demoComments = [];

// Load demo comments from config
async function loadDemoComments() {
  try {
    const response = await fetch(chrome.runtime.getURL('config.js'));
    const text = await response.text();
    const configScript = document.createElement('script');
    configScript.textContent = text;
    document.head.appendChild(configScript);
    
    if (window.config && window.config.demoComments) {
      demoComments = window.config.demoComments;
    }
  } catch (error) {
    console.error('Error loading demo comments:', error);
  }
}

// Create and show the overlay UI
function createOverlay() {
  // Create header
  const header = document.createElement('div');
  header.className = 'pulse-header';
  header.innerHTML = `
    <div class="pulse-header-content">
      <div class="pulse-logo">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right: 8px;">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2"/>
          <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2"/>
          <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
        </svg>
        <h1>Pulse</h1>
      </div>
      <div class="pulse-metadata">
        <span class="metadata-tag" style="background: #FF4444;">
          <span>🧪 Sample:</span> 1000 students, K-5
        </span>
        <span class="metadata-tag" style="background: #FF9500;">
          <span>⌛ Duration:</span> 2 years
        </span>
        <span class="metadata-tag" style="background: #34C759;">
          <span>📐 Effect Size:</span> d = 0.45
        </span>
        <span class="metadata-tag" style="background: #007AFF;">
          <span>📝 Design:</span> RCT
        </span>
        <span class="metadata-tag" style="background: #5856D6;">
          <span>💪 Rigor:</span> Tier 1
        </span>
      </div>
      <div class="pulse-auth">
        <button class="pulse-sign-in">Sign in with Google</button>
      </div>
    </div>
  `;
  document.body.appendChild(header);

  // Create left sidebar for expert comments
  const leftSidebar = document.createElement('div');
  leftSidebar.className = 'pulse-sidebar pulse-left-sidebar';
  leftSidebar.innerHTML = `
    <div class="sidebar-header">
      <h2>Expert Commentary</h2>
      <p class="sidebar-subtitle">Verified researchers and educators discuss this paper</p>
    </div>
    <div id="pulse-expert-comments"></div>
  `;
  document.body.appendChild(leftSidebar);

  // Create right sidebar for social discussion and trending
  const rightSidebar = document.createElement('div');
  rightSidebar.className = 'pulse-sidebar pulse-right-sidebar';
  rightSidebar.innerHTML = `
    <div class="sidebar-section">
      <div class="sidebar-header">
        <h2>Social Discussion</h2>
        <p class="sidebar-subtitle">Join the conversation about this research</p>
      </div>
      <div id="pulse-social-comments"></div>
      <div class="comment-form">
        <textarea placeholder="Share your thoughts..." id="comment-input"></textarea>
        <button id="post-comment-btn" disabled>Post Comment</button>
      </div>
    </div>
    <div class="sidebar-section trending-section">
      <div class="sidebar-header">
        <h2>Trending Research</h2>
      </div>
      <div id="trending-articles">
        <div class="trending-article">
          <span class="trending-number">1</span>
          <div class="trending-content">
            <h3>Impact of Early Literacy Interventions on Reading Comprehension</h3>
            <p>Published in Educational Research Review</p>
          </div>
        </div>
        <div class="trending-article">
          <span class="trending-number">2</span>
          <div class="trending-content">
            <h3>Meta-Analysis of Physical Activity in Education</h3>
            <p>Journal of Educational Psychology</p>
          </div>
        </div>
        <div class="trending-article">
          <span class="trending-number">3</span>
          <div class="trending-content">
            <h3>Technology Integration in K-12 Classrooms</h3>
            <p>Learning and Instruction</p>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(rightSidebar);

  // Add event listener for sign in
  const signInButton = header.querySelector('.pulse-sign-in');
  signInButton.addEventListener('click', handleSignIn);

  // Update UI state
  updateUIState();
}

// Handle sign in click
async function handleSignIn() {
  try {
    // Send message to background script to initiate OAuth
    const response = await chrome.runtime.sendMessage({ type: 'INITIATE_OAUTH' });
    if (response.success) {
      currentUser = response.user;
      updateUIState();
    }
  } catch (error) {
    console.error('Sign in failed:', error);
  }
}

// Update UI based on auth state
function updateUIState() {
  const signInButton = document.querySelector('.pulse-sign-in');
  const authSection = document.querySelector('.pulse-auth');
  
  if (currentUser) {
    authSection.innerHTML = `
      <div class="pulse-user-info">
        <img src="${currentUser.picture}" alt="${currentUser.name}" />
        <span>${currentUser.name}</span>
      </div>
    `;
  } else if (signInButton) {
    signInButton.style.display = 'block';
  }

  // Load comments
  loadComments();
}

// Load and display comments
function loadComments() {
  const expertCommentsContainer = document.getElementById('pulse-expert-comments');
  const socialCommentsContainer = document.getElementById('pulse-social-comments');
  
  if (expertCommentsContainer) {
    const expertCommentsList = demoComments.map(comment => `
      <div class="pulse-comment expert-comment">
        <div class="pulse-comment-header">
          <img src="${comment.author.avatar}" alt="${comment.author.name}" />
          <div class="pulse-comment-author">
            <h3>${comment.author.name}</h3>
            <p>${comment.author.title}</p>
          </div>
          <div class="verified-badge">✓</div>
        </div>
        <div class="pulse-comment-body">
          <p>${comment.text}</p>
        </div>
        <div class="pulse-comment-footer">
          <span>${new Date(comment.timestamp).toLocaleDateString()}</span>
          <div class="comment-actions">
            <button class="action-button">👍 24</button>
            <button class="action-button">💬 Reply</button>
          </div>
        </div>
      </div>
    `).join('');

    expertCommentsContainer.innerHTML = expertCommentsList;
  }

  if (socialCommentsContainer) {
    // Add some demo social comments
    const socialComments = [
      {
        author: "Emily Parker",
        handle: "@LiteracyCoach",
        text: "Just read this fascinating meta-analysis on physical activity and early literacy. Game-changer for classroom instruction! #edchat #literacy",
        likes: 45,
        replies: 12,
        timestamp: "2024-03-25T14:30:00Z"
      },
      {
        author: "Dr. Michael Chen",
        handle: "@EduResearcher",
        text: "Important findings about integration levels in physical activity interventions. Clear implications for curriculum design.",
        likes: 32,
        replies: 8,
        timestamp: "2024-03-25T15:45:00Z"
      }
    ];

    const socialCommentsList = socialComments.map(comment => `
      <div class="pulse-comment social-comment">
        <div class="pulse-comment-header">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.author}" alt="${comment.author}" />
          <div class="pulse-comment-author">
            <h3>${comment.author}</h3>
            <p>${comment.handle}</p>
          </div>
        </div>
        <div class="pulse-comment-body">
          <p>${comment.text}</p>
        </div>
        <div class="pulse-comment-footer">
          <span>${new Date(comment.timestamp).toLocaleDateString()}</span>
          <div class="comment-actions">
            <button class="action-button">👍 ${comment.likes}</button>
            <button class="action-button">💬 ${comment.replies}</button>
          </div>
        </div>
      </div>
    `).join('');

    socialCommentsContainer.innerHTML = socialCommentsList;
  }
}

// Initialize
async function initialize() {
  await loadDemoComments();
  createOverlay();
}

// Start the extension
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Listen for extension updates
chrome.runtime.onMessage.addListener((message) => {
  if (message === 'EXTENSION_RELOADED') {
    window.location.reload();
  }
});

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
