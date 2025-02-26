import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function exportArticles() {
  try {
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!articles || articles.length === 0) {
      console.log('No articles found');
      return;
    }

    // Convert to CSV
    const headers = Object.keys(articles[0]).join(',');
    const rows = articles.map(article => 
      Object.values(article)
        .map(value => 
          typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
        )
        .join(',')
    );
    
    const csv = [headers, ...rows].join('\n');

    // Write to file
    fs.writeFileSync('articles_export.csv', csv);
    console.log('Articles exported to articles_export.csv');

  } catch (error) {
    console.error('Error exporting articles:', error);
  }
}

exportArticles(); 