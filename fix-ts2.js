const fs = require('fs');
let code = fs.readFileSync('src/screens/Settings/index.tsx', 'utf-8');

code = code.replace(/formData\.get\('([^']+)'\)/g, '(formData.get(\'$1\') as string)');

fs.writeFileSync('src/screens/Settings/index.tsx', code);
