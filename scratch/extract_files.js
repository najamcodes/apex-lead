const fs = require('fs');
const path = require('path');

const mdContent = fs.readFileSync('artifacts/leadhunter-scraper-advanced.md', 'utf8');

const regex = /```typescript\n\/\/ (electron\/scraper\/(?:[\w-]+\/)?[\w-]+\.ts)\n([\s\S]*?)```/g;

let match;
while ((match = regex.exec(mdContent)) !== null) {
  const filePath = match[1];
  let content = `// ${filePath}\n` + match[2];
  
  const fullPath = path.join(process.cwd(), filePath);
  const dir = path.dirname(fullPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log(`Created ${filePath}`);
}
