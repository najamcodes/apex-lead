const fs = require('fs');
const files = [
  'electron/outreach/index.ts',
  'electron/local-server/index.ts',
  'electron/ipc/outreach.ipc.ts',
  'electron/ipc/bulk.ipc.ts',
  'electron/email-finder/index.ts',
  'electron/analysis/index.ts',
  'electron/ai/tasks/score-site.ts',
  'electron/ai/tasks/draft-outreach.ts'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import\s+\{\s*getDb\s*\}\s+from\s+['"].*?src\/db['"]/g, match => match.replace('getDb', 'getRawDb as getDb'));
  fs.writeFileSync(file, content);
}

const seq = 'electron/outreach/sequence-engine.ts';
let seqContent = fs.readFileSync(seq, 'utf8');
seqContent = seqContent.replace(/getDb\(\)/g, 'getRawDb()');
fs.writeFileSync(seq, seqContent);
