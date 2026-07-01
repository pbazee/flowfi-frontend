const fs = require('fs');
const path = require('path');

const tenantPagesDir = path.join(__dirname, '../frontend/src/pages/tenant');
const filesToUpdate = ['Billing.jsx', 'Loyalty.jsx', 'SessionCredits.jsx', 'Sessions.jsx', 'Settings.jsx'];

for (const file of filesToUpdate) {
  const filePath = path.join(tenantPagesDir, file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf-8');

  // Add import if not present
  if (!content.includes('import { useIsDemo }')) {
    content = content.replace(/(import .* from '.*'\n)/, `$1import { useIsDemo } from '@/hooks/useIsDemo'\n`);
  }

  // Add isDemo hook to component
  if (!content.includes('const isDemo = useIsDemo()')) {
    content = content.replace(/(export default function \w+\(\) \{\n)/, `$1  const isDemo = useIsDemo()\n`);
  }

  // Add check to handleSubmit
  if (content.includes('function handleSubmit(event) {') && !content.includes('if (isDemo) return toast')) {
    content = content.replace(
      /function handleSubmit\(event\) \{\n\s+event\.preventDefault\(\)/,
      `function handleSubmit(event) {\n    event.preventDefault()\n    if (isDemo) return toast('This is a live demo — sign up to save changes', { icon: '🔒' })`
    );
  }

  // Add opacity and (Demo) text to btn-primary types inside the render tree (rough regex)
  content = content.replace(
    /className="([^"]*btn-primary[^"]*)"/g,
    (match, p1) => {
      if (p1.includes('${isDemo')) return match;
      return `className={\`${p1} \${isDemo ? 'opacity-80' : ''}\`}`;
    }
  );

  // You can also add (Demo) conditionally. Here we use a simpler strategy of just modifying the class.
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated ${file}`);
}
