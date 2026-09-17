import express from 'express';
import {mkdtemp, readdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import {afterEach, describe, expect, it} from 'vitest';
import {createComponentAssets, type ComponentAssetProbe} from './component-assets';

const temporaryDirectories: string[] = [];
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codex-workbench-assets-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})));
});

function imageProbe(): ComponentAssetProbe {
  return {
    streams: [{codec_type: 'video', codec_name: 'png', width: 1, height: 1}],
    format: {format_name: 'png_pipe'},
  };
}

function videoProbe(codec_name: string, format_name: string): ComponentAssetProbe {
  return {
    streams: [{codec_type: 'video', codec_name, width: 640, height: 360, duration: '2'}],
    format: {format_name, duration: '2'},
  };
}

describe('component assets', () => {
  it('stores a signature-validated image and serves only its registered id', async () => {
    const directory = await makeTemporaryDirectory();
    const assets = await createComponentAssets(directory, {probeMedia: async () => imageProbe()});
    const app = express();
    app.use('/api/production/component-assets', assets.router);

    const uploaded = await request(app)
      .post('/api/production/component-assets')
      .query({name: '透明图.png'})
      .set('content-type', 'application/octet-stream')
      .send(ONE_PIXEL_PNG)
      .expect(201);
    expect(uploaded.body).toMatchObject({
      name: '透明图.png',
      kind: 'image',
      url: expect.stringMatching(/^\/api\/production\/component-assets\/file\/[0-9a-f-]+$/u),
    });

    const listed = await assets.list();
    expect(listed).toEqual([uploaded.body]);
    const id = uploaded.body.id as string;
    const resolved = await assets.resolve(id);
    expect(resolved).toMatchObject({id, name: '透明图.png', kind: 'image', extension: '.png', mimeType: 'image/png'});
    expect(path.isAbsolute(resolved.path)).toBe(true);
    expect(await readFile(resolved.path)).toEqual(ONE_PIXEL_PNG);
    await expect(assets.resolve('../' + id)).rejects.toMatchObject({code: 'NOT_FOUND'});
    await expect(assets.resolve('00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({code: 'NOT_FOUND'});

    await request(app).get(`/api/production/component-assets/file/${id}`).expect(200).expect('content-type', /image\/png/u);
    await request(app).get('/api/production/component-assets/file/../secret').expect(404);
    await request(app).get('/api/production/component-assets/file/00000000-0000-4000-8000-000000000000').expect(404);
  });

  it('removes a failed upload without leaving a dangling metadata record', async () => {
    const directory = await makeTemporaryDirectory();
    const assets = await createComponentAssets(directory, {
      probeMedia: async () => {
        throw new Error('fixture is not media');
      },
    });
    const app = express();
    app.use('/api/production/component-assets', assets.router);

    await request(app)
      .post('/api/production/component-assets')
      .query({name: 'bad.mp4'})
      .set('content-type', 'application/octet-stream')
      .send(Buffer.from('not a media file'))
      .expect(400);

    const files = await readdir(directory);
    expect(files).toEqual([]);
    await expect(assets.list()).resolves.toEqual([]);
  });

  it('normalizes a non-H.264 video to an MP4 asset and recomputes 30fps frames', async () => {
    const directory = await makeTemporaryDirectory();
    let probeCount = 0;
    const assets = await createComponentAssets(directory, {
      probeMedia: async (filePath) => {
        probeCount += 1;
        if (probeCount === 1) return videoProbe('vp9', 'webm');
        expect(path.extname(filePath)).toBe('.mp4');
        return videoProbe('h264', 'mp4');
      },
      runFfmpeg: async (args) => {
        const outputPath = args.at(-1);
        if (typeof outputPath !== 'string') throw new Error('missing output path');
        await writeFile(outputPath, Buffer.from('normalized mp4'));
      },
    });
    const app = express();
    app.use('/api/production/component-assets', assets.router);

    const uploaded = await request(app)
      .post('/api/production/component-assets')
      .query({name: '原片.webm'})
      .set('content-type', 'video/webm')
      .send(Buffer.from('video fixture'))
      .expect(201);
    expect(uploaded.body).toMatchObject({kind: 'video', durationFrames: 60});
    const resolved = await assets.resolve(uploaded.body.id);
    expect(resolved.extension).toBe('.mp4');
    expect(resolved.mimeType).toBe('video/mp4');
    expect(path.basename(resolved.path)).toMatch(/\.mp4$/u);
    await expect(stat(resolved.path)).resolves.toMatchObject({size: 14});
    expect(await assets.list()).toEqual([uploaded.body]);
  });
});
