import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Copy of the normalizeUrl function from content.js
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // For ScienceDirect articles
    if (urlObj.hostname.includes('sciencedirect.com')) {
      const piiMatch = urlObj.pathname.match(/pii\/(S\d+)/i);
      if (piiMatch) {
        return `https://www.sciencedirect.com/science/article/pii/${piiMatch[1]}`.toLowerCase();
      }
    }
    
    // For Taylor & Francis Online (tandfonline.com)
    if (urlObj.hostname.includes('tandfonline.com')) {
      const doiMatch = urlObj.pathname.match(/doi\/(?:abs|full|figure|pdf|epub)?\/(10\.\d{4,}\/[-._;()\/:A-Z0-9]+)/i);
      if (doiMatch) {
        return `https://www.tandfonline.com/doi/abs/${doiMatch[1]}`.toLowerCase();
      }
    }

    // For other URLs, create a clean normalized version
    const cleanUrl = new URL(url);
    
    // Remove all query parameters except those that are essential
    const essentialParams = new Set(['doi', 'pii', 'pmid', 'id']);
    const params = Array.from(cleanUrl.searchParams.entries());
    cleanUrl.search = '';  // Clear all params
    
    // Only keep essential parameters
    params.forEach(([key, value]) => {
      if (essentialParams.has(key.toLowerCase())) {
        cleanUrl.searchParams.set(key.toLowerCase(), value);
      }
    });
    
    // Remove hash fragments
    cleanUrl.hash = '';
    
    // Remove trailing slashes and convert to lowercase
    return cleanUrl.toString().replace(/\/$/, '').toLowerCase();
  } catch (error) {
    console.error('Error normalizing URL:', error);
    return url.toLowerCase();
  }
}

async function normalizeArticles() {
  // Initialize Supabase client
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  console.log('Fetching all articles...');
  
  // Fetch all articles
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, link')
    .order('id');

  if (error) {
    console.error('Error fetching articles:', error);
    return;
  }

  console.log(`Found ${articles.length} articles to process`);

  // Track statistics
  const stats = {
    total: articles.length,
    normalized: 0,
    unchanged: 0,
    failed: 0,
    problems: []
  };

  // Process each article
  for (const article of articles) {
    try {
      if (!article.link) {
        stats.problems.push({
          id: article.id,
          originalUrl: '',
          error: 'Missing link'
        });
        stats.failed++;
        continue;
      }

      const normalizedUrl = normalizeUrl(article.link);
      
      if (normalizedUrl === article.link) {
        console.log(`Article ${article.id}: URL already normalized`);
        stats.unchanged++;
        continue;
      }

      // Update the article with normalized URL
      const { error: updateError } = await supabase
        .from('articles')
        .update({ link: normalizedUrl })
        .eq('id', article.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`Article ${article.id}: Normalized URL from ${article.link} to ${normalizedUrl}`);
      stats.normalized++;

    } catch (error) {
      console.error(`Error processing article ${article.id}:`, error);
      stats.problems.push({
        id: article.id,
        originalUrl: article.link || '',
        error: error.message || 'Unknown error'
      });
      stats.failed++;
    }
  }

  // Print summary
  console.log('\nNormalization Summary:');
  console.log('--------------------');
  console.log(`Total articles processed: ${stats.total}`);
  console.log(`Successfully normalized: ${stats.normalized}`);
  console.log(`Already normalized: ${stats.unchanged}`);
  console.log(`Failed to normalize: ${stats.failed}`);

  if (stats.problems.length > 0) {
    console.log('\nProblematic Articles:');
    console.log('-------------------');
    stats.problems.forEach(problem => {
      console.log(`ID: ${problem.id}`);
      console.log(`Original URL: ${problem.originalUrl}`);
      console.log(`Error: ${problem.error}`);
      console.log('-------------------');
    });
  }
}

// Run the script
normalizeArticles().catch(console.error); 