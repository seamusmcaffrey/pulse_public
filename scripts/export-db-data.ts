import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function exportTableData(tableName: string) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      return;
    }

    if (!data || data.length === 0) {
      console.log(`No data found in ${tableName}`);
      return;
    }

    // Write to file
    fs.writeFileSync(
      `${tableName}_export.json`,
      JSON.stringify(data, null, 2)
    );
    console.log(`${tableName} data exported to ${tableName}_export.json`);
    
    // Also log to console
    console.log(`\n${tableName} data:`);
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error(`Error exporting ${tableName}:`, error);
  }
}

async function exportAllData() {
  const tables = ['articles', 'comments', 'experts', 'email_tokens'];
  
  for (const table of tables) {
    console.log(`\nExporting ${table}...`);
    await exportTableData(table);
  }
}

exportAllData(); 