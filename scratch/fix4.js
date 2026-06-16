const fs = require('fs');

const tasks = [
  'd:/Work/Personal/lead-gen-desk/electron/ai/tasks/triage-reply.ts',
  'd:/Work/Personal/lead-gen-desk/electron/ai/tasks/score-site.ts',
  'd:/Work/Personal/lead-gen-desk/electron/ai/tasks/extract-decision-maker.ts',
  'd:/Work/Personal/lead-gen-desk/electron/ai/tasks/draft-outreach.ts'
];

for (const file of tasks) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('import type { AppSettings }')) {
    content = `import type { AppSettings } from '../../../src/types'\n` + content;
  }
  
  // replace the first parameter
  content = content.replace(/apiKey: string,/g, 'settings: AppSettings,');
  // replace getAiClient(apiKey) -> getAiClient(settings)
  content = content.replace(/const client = getAiClient\(apiKey\)/g, 'const client = getAiClient(settings)');

  fs.writeFileSync(file, content);
}
