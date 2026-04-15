const fs = require('fs');
const content = fs.readFileSync('app/context/SubscriptionContext.tsx', 'utf8');
console.log(content.includes('const deviceLimit ='));
