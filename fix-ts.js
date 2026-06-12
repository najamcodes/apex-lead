const fs = require('fs');
let code = fs.readFileSync('src/screens/Settings/index.tsx', 'utf-8');

const helper = `const getStr = (key: string) => (formData.get(key) as string) || '';
        const getBool = (key: string) => formData.get(key) === 'on';
        const getInt = (key: string, def: string) => parseInt((formData.get(key) as string) || def);`;

code = code.replace('const formData = new FormData(e.currentTarget);', 'const formData = new FormData(e.currentTarget);\n        ' + helper);

code = code.replace(/\(formData\.get\("(.*?)"\) as string\) \|\| ""/g, 'getStr("$1")');
code = code.replace(/formData\.get\("(.*?)"\) === "on"/g, 'getBool("$1")');
code = code.replace(/parseInt\(\(formData\.get\("(.*?)"\) as string\) \|\| "(.*?)"\)/g, 'getInt("$1", "$2")');

fs.writeFileSync('src/screens/Settings/index.tsx', code);
