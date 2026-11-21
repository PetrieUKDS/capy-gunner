// CrazyGames asks for each preview video to open on the static cover, so the thumbnail flows into the
// video. The covers are key art (keyart.py), not gameplay frames, so this puts the cover in front of
// each recorded clip: the cover holds for 0.6 s and cross-fades over 0.5 s into the gameplay. The
// recording's own title fade (its first 1.3 s) is trimmed off, so the title isn't shown twice.
//
//   node platform/crazygames/covers/coverintro.mjs
//
// Reads dist/covers/out/preview-*.mp4 (from encode.mjs) and the covers in store/, and writes the
// finished videos to store/. Needs ffmpeg, like encode.mjs.
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', '..', 'dist', 'covers', 'out'), STORE = join(HERE, '..', 'store');
const ffmpeg = [process.env.FFMPEG, 'C:/pinokio/bin/ffmpeg-env/Library/bin/ffmpeg.exe'].find(p => p && existsSync(p)) || 'ffmpeg';
const HOLD = 0.6, FADE = 0.5, TRIM = 1.3;

for (const [video, cover, w, h] of [
  ['preview-landscape-1920x1080.mp4', 'cover-landscape-1920x1080.png', 1920, 1080],
  ['preview-portrait-1080x1620.mp4', 'cover-portrait-800x1200.png', 1080, 1620],
]) {
  const src = join(OUT, video), dst = join(STORE, video);
  if (!existsSync(src)) { console.error('missing ' + src + ' (record and encode it first)'); process.exit(1); }
  const r = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error',
    '-loop', '1', '-t', String(HOLD + FADE), '-i', join(STORE, cover),
    '-ss', String(TRIM), '-i', src,
    '-filter_complex', `[0]scale=${w}:${h}:flags=lanczos,fps=30,format=yuv420p,settb=AVTB[c];[1]fps=30,format=yuv420p,settb=AVTB[v];[c][v]xfade=transition=fade:duration=${FADE}:offset=${HOLD}[o]`,
    '-map', '[o]', '-t', '20', '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.CRF || '21', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', dst], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
  const probe = spawnSync(ffmpeg.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dst], { encoding: 'utf8' });
  const mb = statSync(dst).size / 1048576;
  console.log(`${video}: ${parseFloat(probe.stdout || '0').toFixed(2)} s, ${mb.toFixed(1)} MB${mb > 50 ? '  (over the 50 MB limit: raise CRF)' : ''}`);
}
