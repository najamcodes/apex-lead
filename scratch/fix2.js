const fs = require('fs');

function replaceFile(path, replacer) {
  let content = fs.readFileSync(path, 'utf8');
  content = replacer(content);
  fs.writeFileSync(path, content);
}

replaceFile('electron/email-finder/hunter.ts', c => c.replace('getSettings()', 'await getSettings()').replace('function findEmailWithHunter', 'async function findEmailWithHunter'));
replaceFile('electron/ipc/ai.ipc.ts', c => c.replace(/getSettings\(\)/g, 'await getSettings()').replace(/ipcMain\.handle\(.*?, \(_event, .*?\) => \{/g, match => match.replace('(', '(async ')));
replaceFile('electron/outreach/csv-export.ts', c => c.replace('getAllLeads()', 'await getAllLeads()'));
replaceFile('electron/outreach/index.ts', c => c.replace('getOutreachById(recordId)', 'await getOutreachById(recordId)'));
replaceFile('electron/scheduler/index.ts', c => c.replace('getSettings()', 'await getSettings()').replace('function initScheduler', 'async function initScheduler'));
replaceFile('electron/main.ts', c => c.replace('initScheduler(win)', 'await initScheduler(win)'));
replaceFile('electron/scraper/index.ts', c => c.replace('insertLead(', 'await insertLead(').replace('getSettings()', 'await getSettings()'));
replaceFile('src/db/queries/settings.queries.ts', c => c.replace('openai_api_key:', 'openrouter_api_key:'));
replaceFile('src/db/entities/LeadEntity.ts', c => c.replace(', CreateDateColumn, UpdateDateColumn', ''));
replaceFile('src/db/queries/leads.queries.ts', c => c.replace('type { Lead, LeadInsert', 'type { LeadInsert'));

// Also need to fix ipcMain.handle in ai.ipc.ts properly
let aiIpc = fs.readFileSync('electron/ipc/ai.ipc.ts', 'utf8');
aiIpc = aiIpc.replace(/ipcMain\.handle\(IPC\.AI_GENERATE_HOOK, \(_event, leadId: number\) => \{/, 'ipcMain.handle(IPC.AI_GENERATE_HOOK, async (_event, leadId: number) => {');
aiIpc = aiIpc.replace(/ipcMain\.handle\(IPC\.AI_DRAFT_OUTREACH, \(_event, leadId: number\) => \{/, 'ipcMain.handle(IPC.AI_DRAFT_OUTREACH, async (_event, leadId: number) => {');
fs.writeFileSync('electron/ipc/ai.ipc.ts', aiIpc);

