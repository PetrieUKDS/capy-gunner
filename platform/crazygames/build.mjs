// Builds the CrazyGames version of Capybara with a Gun into dist/crazygames/ and
// dist/capybara-crazygames.zip. It reads the normal game (index.html at the repo root) and never
// changes it: every CrazyGames difference is a patch applied to a copy here.
//
//   node platform/crazygames/build.mjs
//
// Each patch must match exactly as many times as expected, or the build stops, so a change to the
// game that moves things around shows up here instead of silently shipping a broken build.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const DIST = join(ROOT, 'dist');
const OUT = join(DIST, 'crazygames');

// The CrazyGames page for the game. Update once CrazyGames confirms the slug.
const GAME_URL = 'https://www.crazygames.com/game/capybara-with-a-gun';

function patch(text, find, replace, label, times = 1) {
  const n = typeof find === 'string' ? text.split(find).length - 1 : (text.match(new RegExp(find.source, find.flags.includes('g') ? find.flags : find.flags + 'g')) || []).length;
  if (n !== times) throw new Error(`patch "${label}": expected ${times} match(es), found ${n}`);
  return typeof find === 'string' ? text.split(find).join(replace) : text.replace(find, replace);
}

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

// 1. split the game's one inline script out into game.js, so it can start after the SDK is ready
const open = html.indexOf('<script>'), close = html.lastIndexOf('</script>');
if (open < 0 || close < open || html.indexOf('<script', open + 1) !== -1) throw new Error('expected exactly one inline <script> in index.html');
let game = html.slice(open + '<script>'.length, close);
let page = html.slice(0, open) + '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n<script src="crazygames.js"></script>' + html.slice(close + '</script>'.length);

// 2. game.js patches
game = patch(game, /const GAME_URL = '[^']*';/, `const GAME_URL = '${GAME_URL}';`, 'share link points at CrazyGames');
game = patch(game, "'https://github.com/PetrieUKDS/capy-gunner/issues/new?title='", "'#?title='", 'bug-report URL goes nowhere (its links are hidden anyway)');
game = patch(game, /\r?\nrequestAnimationFrame\(frame\);\r?\n\}\)\(\);\s*$/,
  `
// CrazyGames build only: hand the adapter (crazygames.js) what it needs to see and steer
if (window.__capyHook) window.__capyHook({
  get state() { return state; },
  get muted() { return muted; }, set muted(v) { muted = v; const b = $('muteBtn'); if (b) b.textContent = v ? 'SOUND OFF' : 'SOUND ON'; },
  get AC() { return AC; },
  pause,
});
requestAnimationFrame(frame);
})();
`, 'adapter hook at the end of the game closure');

// 3. page patches: no outgoing links (donation strip, bug reports), no install-as-app bits
page = patch(page, 'href="https://buymeacoffee.com/petrieuk"', 'href="#"', 'donation link removed');
page = patch(page, '<a class="ibtn wbtn" id="bugPause" target="_blank" rel="noopener">', '<a class="ibtn wbtn" id="bugPause" hidden>', 'pause-screen bug link hidden');
page = patch(page, /<a class="ibtn wbtn" id="bugOver"[^>]*>/, '<a class="ibtn wbtn" id="bugOver" hidden>', 'game-over bug link hidden');
page = patch(page, /<\/style>\r?\n<style>/, '</style>\n<style>/* CrazyGames build */ .coffee, #bugPause, #bugOver { display: none !important; }\n', 'hide removed bits');
page = page.replace(/<link rel="manifest"[^>]*>\s*/g, '').replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, '');

// 4. write the build
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'fonts'), { recursive: true });
writeFileSync(join(OUT, 'index.html'), page);
writeFileSync(join(OUT, 'game.js'), game);
copyFileSync(join(HERE, 'crazygames.js'), join(OUT, 'crazygames.js'));
copyFileSync(join(ROOT, 'LICENSE'), join(OUT, 'LICENSE'));
for (const f of readdirSync(join(ROOT, 'fonts'))) copyFileSync(join(ROOT, 'fonts', f), join(OUT, 'fonts', f));

// leftover outgoing links are a QA rejection reason, so list any that remain
const left = [...(page + game).matchAll(/https?:\/\/[a-z0-9.-]+[^\s'"`)]*/gi)].map(m => m[0])
  .filter(u => !u.startsWith('https://sdk.crazygames.com/') && !u.startsWith(GAME_URL) && !u.startsWith('http://www.w3.org/'));
if (left.length) console.log('Outgoing URLs still in the build (check each is only reachable on petrieuk.co.uk):\n  ' + [...new Set(left)].join('\n  '));

// 5. zip it (forward-slash paths, index.html at the root, as CrazyGames wants)
function files(dir) { return readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : [p]; }); }
const entries = [], central = [];
let offset = 0;
for (const f of files(OUT)) {
  const name = Buffer.from(relative(OUT, f).split('\\').join('/'));
  const data = readFileSync(f), comp = deflateRawSync(data, { level: 9 }), crc = crc32(data);
  const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
  h.writeUInt32LE(0, 10); h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
  entries.push(h, name, comp);
  const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
  c.writeUInt32LE(0, 12); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
  central.push(c, name);
  offset += 30 + name.length + comp.length;
}
const cd = Buffer.concat(central), count = central.length / 2;
const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
const zip = Buffer.concat([...entries, cd, end]);
writeFileSync(join(DIST, 'capybara-crazygames.zip'), zip);

const total = files(OUT).reduce((s, f) => s + statSync(f).size, 0);
console.log(`Built ${relative(ROOT, OUT)}: ${count} files, ${(total / 1048576).toFixed(2)} MB (zip ${(zip.length / 1048576).toFixed(2)} MB) -> dist/capybara-crazygames.zip`);
