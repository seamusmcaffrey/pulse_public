// Global configuration object
window.config = {
  // Demo data for overlay display
  metadata: {
    sampleSize: "1000 students, K-5",
    duration: "2 years",
    effectSize: "d = 0.45",
    design: "RCT",
    rigor: "Tier 1"
  },
  
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
    }
  ],
  
  trendingArticles: [
    {
      title: "Impact of Early Literacy Interventions on Reading Comprehension",
      journal: "Educational Research Review"
    },
    {
      title: "Meta-Analysis of Physical Activity in Education",
      journal: "Journal of Educational Psychology"
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