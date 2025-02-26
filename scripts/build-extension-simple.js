import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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
try {
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('Vite build failed:', error);
  process.exit(1);
}

// Define files to copy
const mainFiles = [
  'manifest.json',
  'content.css',
  'background.js',
  'content.js',
  'config.js'
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