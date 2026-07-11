import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const converter = await readFile(new URL('../libs/VMD_to_BVH.js', import.meta.url), 'utf8');

// A paused action must not receive AnimationMixer time updates.
assert.match(index, /if\(isPlaying&&mixer\) mixer\.update\(dt\);/, 'mixer must update only while playback is active');
// This fixed-camera page must not animate hips translation; VMD root motion is stage locomotion.
assert.match(converter, /closedRoot\.x = 0;\s*closedRoot\.y = 0;\s*closedRoot\.z = 0;/s, 'all root translation axes must be locked');

console.log('playback/root-motion invariants passed');
