import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'VITE_SUPABASE_URL', 
  'VITE_SUPABASE_ANON_KEY',
  'VITE_GOOGLE_OAUTH_CLIENT_ID'
];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('Error: Missing required environment variables:');
  missingEnvVars.forEach(varName => console.error(`- ${varName}`));
  console.error('\nPlease ensure these variables are set in your .env file');
  process.exit(1);
}

const BUILD_DIR = 'dist';

// Ensure build directory exists
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR);
}

// Ensure icons directory exists
const iconsDir = path.join(BUILD_DIR, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

// First run the regular build
console.log('Running Vite build...');
const buildResult = await import('child_process').then(({ execSync }) => {
  try {
    return execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error('Vite build failed:', error);
    process.exit(1);
  }
});

// Read config template
console.log('Processing config file...');
const configTemplate = fs.readFileSync('public/config.js', 'utf8');

// Replace placeholders with actual values
const configContent = configTemplate
  .replace(/'__SUPABASE_URL__'/g, `'${process.env.VITE_SUPABASE_URL}'`)
  .replace(/'__SUPABASE_ANON_KEY__'/g, `'${process.env.VITE_SUPABASE_ANON_KEY}'`)
  .replace(/'__OAUTH_CLIENT_ID__'/g, `'${process.env.VITE_GOOGLE_OAUTH_CLIENT_ID}'`);

// Write the processed config
fs.writeFileSync(path.join(BUILD_DIR, 'config.js'), configContent);

// Also update any direct references in content.js
console.log('Processing content.js...');
const contentJsPath = path.join(BUILD_DIR, 'content.js');
if (fs.existsSync(contentJsPath)) {
  let contentJs = fs.readFileSync(contentJsPath, 'utf8');
  contentJs = contentJs
    .replace(/'__SUPABASE_URL__'/g, `'${process.env.VITE_SUPABASE_URL}'`)
    .replace(/'__SUPABASE_ANON_KEY__'/g, `'${process.env.VITE_SUPABASE_ANON_KEY}'`);
  fs.writeFileSync(contentJsPath, contentJs);
}

// Define files to copy
const mainFiles = [
  'manifest.json',
  'content.css',
  'background.js'
];

const iconFiles = [
  'icon16.png',
  'icon48.png',
  'icon128.png'
];

// Copy main files
console.log('Copying main extension files...');
mainFiles.forEach(file => {
  const sourcePath = path.join('public', file);
  const targetPath = path.join(BUILD_DIR, file);
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Copied ${file}`);
  } else {
    console.warn(`Warning: ${file} not found in public directory`);
  }
});

// Copy icon files to icons directory
console.log('Copying icon files...');
iconFiles.forEach(file => {
  const sourcePath = path.join('public', 'icons', file);
  const targetPath = path.join(iconsDir, file);
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Copied ${file} to icons directory`);
  } else {
    console.warn(`Warning: ${file} not found in public/icons directory`);
  }
});

console.log('Extension build complete!'); 