import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
for (const asset of ['default_wavefile_dance.vmd', 'default_wavefile_music.mp3', '兰若酒醉的蝴蝶mmd数据.vmd', '酒醉的蝴蝶音频.wav']) {
  assert.match(index, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `dance catalog must reference ${asset}`);
}
assert.match(index, /id="danceSelect"/, 'viewer must expose a dance selector');
assert.match(index, /danceSelect\.addEventListener\('change'/, 'viewer must handle dance selector changes');
assert.match(index, /await loadDance\(/, 'dance changes must convert/load a new VMD clip');
assert.match(index, /loadAudio\(/, 'dance changes must load its paired audio');
assert.match(index, /action\.time/, 'resume must preserve the selected dance progress');
for (const path of ['../vmd/default_wavefile_dance.vmd', '../audio/default_wavefile_music.mp3']) {
  assert.ok((await stat(new URL(path, import.meta.url))).size > 0, `copied ${path} must not be empty`);
}
console.log('dance switching catalog and assets passed');
