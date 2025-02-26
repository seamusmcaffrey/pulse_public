import fs from 'fs';
import path from 'path';

// Source files
const pdfSource = path.resolve('node_modules/pdfjs-dist/build/pdf.min.mjs');
const workerSource = path.resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs');

// Destination files
const pdfDest = path.resolve('public/pdf.min.js');
const workerDest = path.resolve('public/pdf.worker.min.js');

// Read the source files
let pdfContent = fs.readFileSync(pdfSource, 'utf8');
let workerContent = fs.readFileSync(workerSource, 'utf8');

// Convert ES modules to IIFE format
pdfContent = `
(function () {
  const exports = {};
  const module = { exports };
  ${pdfContent.replace('import.meta', '({})').replace('export {', '// export {')}
  window.pdfjsLib = module.exports.default || module.exports;
})();
`;

workerContent = `
(function () {
  const exports = {};
  const module = { exports };
  ${workerContent.replace('import.meta', '({})').replace('export {', '// export {')}
  window.pdfjsWorker = module.exports.default || module.exports;
})();
`;

// Write the converted files
fs.writeFileSync(pdfDest, pdfContent);
fs.writeFileSync(workerDest, workerContent);

console.log('PDF.js files copied and converted successfully!'); 