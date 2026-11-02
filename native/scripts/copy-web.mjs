// Copies the web app (repo root) into native/www so Capacitor can bundle it into the APK.
// The service worker, headers file and README are website-only and are left out.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd(), '..');
const out = resolve(process.cwd(), 'www');

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['index.html', 'styles.css', 'manifest.json', 'icon-192.png', 'icon-512.png']) {
  cpSync(resolve(root, f), resolve(out, f));
}
cpSync(resolve(root, 'src'), resolve(out, 'src'), { recursive: true });
console.log('native/www ready');
