// Global configuration object
window.config = {
  // Demo mode - no actual backend connection
  demoMode: true,
  
  // Demo data
  demoComments: [
    {
      id: 1,
      author: {
        name: "Dr. Sarah Johnson",
        title: "Professor of Neuroscience, Stanford University",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah"
      },
      text: "This research presents a fascinating approach to understanding neural plasticity. The methodology is particularly robust, though I would suggest additional control experiments in future studies.",
      timestamp: "2024-03-20T10:30:00Z"
    },
    {
      id: 2,
      author: {
        name: "Prof. Michael Chen",
        title: "Research Director, MIT Brain Lab",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=michael"
      },
      text: "The findings align well with recent studies in the field. I particularly appreciate the detailed discussion of limitations and potential future directions.",
      timestamp: "2024-03-21T15:45:00Z"
    },
    {
      id: 3,
      author: {
        name: "Dr. Emily Martinez",
        title: "Lead Researcher, Brain-Computer Interfaces",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=emily"
      },
      text: "The statistical analysis is thorough and the conclusions are well-supported by the data. This work could have significant implications for BCI development.",
      timestamp: "2024-03-22T09:15:00Z"
    }
  ]
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