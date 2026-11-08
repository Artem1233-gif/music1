import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('www', { recursive: true });
await cp('index.html', 'www/index.html');

for (const entry of ['notifications.js', 'lyrics.js']) {
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    outfile: `www/${entry}`,
  });
}

const htmlPath = 'www/index.html';
let html = await readFile(htmlPath, 'utf8');
for (const script of ['notifications.js', 'lyrics.js']) {
  if (!html.includes(`src="${script}"`)) {
    html = html.replace('</body>', `  <script src="${script}"></script>\n</body>`);
  }
}
await writeFile(htmlPath, html);
