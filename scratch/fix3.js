const fs = require('fs');

const tasks = [
  'd:/Work/Personal/lead-gen-desk/electron/ai/tasks/triage-reply.ts',
  'd:/Work/Personal/lead-gen-desk/electron/ai/tasks/score-site.ts',
  'd:/Work/Personal/lead-gen-desk/electron/ai/tasks/extract-decision-maker.ts',
  'd:/Work/Personal/lead-gen-desk/electron/ai/tasks/draft-outreach.ts',
  'd:/Work/Personal/lead-gen-desk/electron/ai/tasks/generate-queries.ts'
];

for (const file of tasks) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/apiKey: string,/g, 'settings: AppSettings,');
  content = content.replace(/const client = getAiClient\(apiKey\)/g, 'const client = getAiClient(settings)');
  
  // Need to ensure AppSettings is imported
  if (!content.includes('AppSettings')) {
    content = `import type { AppSettings } from '../../../src/types'\n` + content;
  }
  
  // also fix imports for ai-client since some might still use openrouter-client
  content = content.replace(/openrouter-client/g, 'ai-client');

  fs.writeFileSync(file, content);
}

const callers = [
  'd:/Work/Personal/lead-gen-desk/electron/ipc/bulk.ipc.ts',
  'd:/Work/Personal/lead-gen-desk/electron/ipc/ai.ipc.ts',
  'd:/Work/Personal/lead-gen-desk/electron/analysis/index.ts',
  'd:/Work/Personal/lead-gen-desk/electron/pipeline/index.ts',
  'd:/Work/Personal/lead-gen-desk/electron/outreach/imap-listener.ts',
  'd:/Work/Personal/lead-gen-desk/electron/outreach/warmup-engine.ts' // already fixed but just in case
];

for (const file of callers) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  // replace `settings.openrouter_api_key` with `settings` when it's the first argument to tasks
  content = content.replace(/scoreSite\(settings\.openrouter_api_key,/g, 'scoreSite(settings,');
  content = content.replace(/triageReply\(settings\.openrouter_api_key,/g, 'triageReply(settings,');
  content = content.replace(/extractDecisionMaker\(settings\.openrouter_api_key,/g, 'extractDecisionMaker(settings,');
  content = content.replace(/draftOutreach\(settings\.openrouter_api_key,/g, 'draftOutreach(settings,');
  content = content.replace(/generateQueriesFromProfile\(settings\.openrouter_api_key,/g, 'generateQueriesFromProfile(settings,');
  
  // update `if` checks to not rely on openrouter_api_key
  content = content.replace(/&& settings\.openrouter_api_key/g, '');
  content = content.replace(/!settings\.openrouter_api_key/g, '!settings.ai_enabled'); // simplified fallback

  fs.writeFileSync(file, content);
}
