const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all TypeScript files
function getAllTypeScriptFiles(dir) {
  let results = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.next')) {
      results = results.concat(getAllTypeScriptFiles(filePath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(filePath);
    }
  }
  
  return results;
}

// Common type mappings
const typeReplacements = {
  'error: any': 'error: Error | unknown',
  'data: any': 'data: Record<string, unknown>',
  'result: any': 'result: Record<string, unknown>',
  'response: any': 'response: Record<string, unknown>',
  'props: any': 'props: Record<string, unknown>',
  'state: any': 'state: Record<string, unknown>',
  'value: any': 'value: unknown',
  'item: any': 'item: unknown',
  'data: Array<any>': 'data: Array<unknown>',
  'Array<any>': 'Array<unknown>',
  'Promise<any>': 'Promise<unknown>',
  'Record<string, any>': 'Record<string, unknown>',
  'as any': 'as unknown',
  ': any[]': ': unknown[]',
  ': any,': ': unknown,',
  ': any;': ': unknown;',
  ': any =': ': unknown =',
  ': any)': ': unknown)',
  'function(any)': 'function(unknown)',
  '<any,': '<unknown,',
  'any>': 'unknown>',
};

// Process a single file
function processFile(filePath) {
  if (filePath.endsWith('.d.ts')) return; // Skip declaration files
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Replace type patterns
  for (const [pattern, replacement] of Object.entries(typeReplacements)) {
    if (content.includes(pattern)) {
      content = content.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

// Main execution
const rootDir = process.cwd();
const files = getAllTypeScriptFiles(rootDir);

console.log(`Processing ${files.length} TypeScript files...`);
files.forEach(processFile);
console.log('Done!'); 