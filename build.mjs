import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('www', { recursive: true });
await cp('index.html', 'www/index.html');
await build({
  entryPoints: ['notifications.js'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  outfile: 'www/notifications.js',
});

const htmlPath = 'www/index.html';
let html = await readFile(htmlPath, 'utf8');
if (!html.includes('src="notifications.js"')) {
  html = html.replace('</body>', '  <script src="notifications.js"></script>\n</body>');
}
await writeFile(htmlPath, html);
