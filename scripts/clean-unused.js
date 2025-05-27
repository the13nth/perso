const fs = require('fs');
const path = require('path');

const filesToCheck = [
  'app/api/chat/retrieval_agents/route.ts',
  'app/lib/pinecone.ts',
  'app/page.tsx',
  'app/api/retrieval/save-response/route.ts',
  'components/ChatWindow.tsx',
  'components/UploadComprehensiveActivityForm.tsx'
];

const unusedVars = {
  'app/api/chat/retrieval_agents/route.ts': ['z', 'returnIntermediateSteps', 'embeddings'],
  'app/lib/pinecone.ts': ['QueryOptions'],
  'app/page.tsx': ['Building2', 'PieChart'],
  'app/api/retrieval/save-response/route.ts': ['uuidv4'],
  'components/ChatWindow.tsx': ['setShowIntermediateSteps'],
  'components/UploadComprehensiveActivityForm.tsx': ['data']
};

// Fix each file
filesToCheck.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${filePath} - file not found`);
    return;
  }
  
  console.log(`Processing ${filePath}...`);
  let content = fs.readFileSync(filePath, 'utf8');
  const varsToRemove = unusedVars[filePath] || [];
  
  // Remove unused imports
  varsToRemove.forEach(varName => {
    // Remove from import statements
    const importRegex = new RegExp(`(import[^{]*{[^}]*?)\\b${varName}\\b\\s*,?([^}]*}[^;]*;)`, 'g');
    content = content.replace(importRegex, (match, before, after) => {
      // Clean up any trailing commas and spaces
      return before.trim() + after.replace(/,\s*,/g, ',').replace(/,\s*}/g, '}');
    });
    
    // Remove variable declarations
    const varRegex = new RegExp(`\\bconst\\s+${varName}\\s*=\\s*[^;]+;`, 'g');
    content = content.replace(varRegex, '');
  });
  
  // Clean up empty import statements
  content = content.replace(/import\s*{\s*}\s*from\s*['"][^'"]+['"];?\n?/g, '');
  
  // Clean up multiple blank lines
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  fs.writeFileSync(filePath, content);
  console.log(`Cleaned ${varsToRemove.length} unused variables from ${filePath}`);
}); 