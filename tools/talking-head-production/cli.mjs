#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {basename, extname, resolve} from 'node:path';

const [command, file, ...args] = process.argv.slice(2);
if (command !== 'probe' || !file || (args.length && (args.length !== 2 || args[0] !== '--fps'))) {
  console.error('Usage: node tools/talking-head-production/cli.mjs probe /path/to/media --fps 30');
  process.exit(1);
}
const fps = args.length ? Number(args[1]) : 30;
if (!Number.isFinite(fps) || fps <= 0 || fps > 240) throw new Error('Composition FPS must be in (0, 240]');
const path = resolve(file);
const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', path], {encoding: 'utf8', maxBuffer: 4 * 1024 * 1024}));
const stream = info.streams.find((s) => s.codec_type === 'video');
if (!stream) throw new Error('No video/image stream');
const image = ['.png', '.jpg', '.jpeg', '.webp'].includes(extname(path).toLowerCase());
const rotation = Number(stream.side_data_list?.find((s) => 'rotation' in s)?.rotation ?? stream.tags?.rotate ?? 0);
const swap = Math.abs(rotation % 180) === 90;
const width = swap ? stream.height : stream.width;
const height = swap ? stream.width : stream.height;
const durationSeconds = Number(stream.duration ?? info.format.duration);
if (!image && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)) throw new Error('Video requires a measurable duration');
const hash = createHash('sha256');
for await (const chunk of createReadStream(path)) hash.update(chunk);
const durationFrames = image ? undefined : Math.floor(durationSeconds * fps + 1e-6);
console.log(JSON.stringify({
  file: basename(path), sha256: hash.digest('hex'), kind: image ? 'image' : 'video', width, height,
  compositionFps: fps, ...(image ? {} : {durationSeconds, durationFrames, hasAudio: info.streams.some((s) => s.codec_type === 'audio')}),
  parameters: {materialWidth: width, materialHeight: height, ...(!image ? {materialDurationFrames: durationFrames, materialTrimBefore: 0} : {})},
  note: 'Copy durationFrames to personDurationFrames when probing the main rough cut. Frame values use composition FPS; keep source and use records in the private project.',
}, null, 2));
