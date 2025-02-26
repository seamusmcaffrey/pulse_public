// Global configuration object
window.config = {
  supabase: {
    url: 'https://xuypxquhkubappzovinl.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1eXB4cXVoa3ViYXBwem92aW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkzMTEzMTUsImV4cCI6MjA1NDg4NzMxNX0.704l61wPoYoVQe7Iu5GvpBDPi8xfVh6eD8HYdfWkliE'
  }
};

// Log configuration load (for debugging)
console.log('[DEBUG] Configuration loaded:', window.config);

// Initialize chrome storage with config
if (typeof chrome !== 'undefined' && chrome.storage) {
  chrome.storage.local.set(window.config).then(() => {
    console.log('[DEBUG] Configuration stored in chrome.storage.local');
  }).catch(error => {
    console.error('[DEBUG] Failed to store configuration:', error);
  });
}

// For content script context
if (typeof window !== 'undefined') {
  window.config = window.config;
}

// For module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = window.config;
} 