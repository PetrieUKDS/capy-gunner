// Turns the numbered JPEG frames from VIDEO.record() into the CrazyGames preview MP4:
// H.264, 30 fps, no audio track, index at the front.
//
//   node platform/crazygames/covers/encode.mjs vlandscape preview-landscape-1920x1080.mp4
//
// Needs ffmpeg: FFMPEG=path/to/ffmpeg, or the copy Pinokio installs, or one on PATH.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'dist', 'covers', 'out');
const [prefix, name] = process.argv.slice(2);
if (!prefix || !name) { console.error('usage: node encode.mjs <frame prefix> <output.mp4>'); process.exit(1); }
const ffmpeg = [process.env.FFMPEG, 'C:/pinokio/bin/ffmpeg-env/Library/bin/ffmpeg.exe'].find(p => p && existsSync(p)) || 'ffmpeg';
const frames = readdirSync(OUT).filter(f => f.startsWith(prefix + '-') && f.endsWith('.jpg'));
if (!frames.length) { console.error('no frames for ' + prefix); process.exit(1); }

const r = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', '30', '-i', join(OUT, `${prefix}-%05d.jpg`),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.CRF || '21', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', join(OUT, name)], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);
for (const f of frames) rmSync(join(OUT, f));
const mb = statSync(join(OUT, name)).size / 1048576;
console.log(`${name}: ${frames.length} frames, ${(frames.length / 30).toFixed(2)} s, ${mb.toFixed(1)} MB${mb > 50 ? '  (over the 50 MB limit: raise -crf)' : ''}`);
