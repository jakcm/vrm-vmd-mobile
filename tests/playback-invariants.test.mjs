import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const converter = await readFile(new URL('../libs/convertBVHToVRMAnimation.js', import.meta.url), 'utf8');

// Pause must keep the existing action/time, then unpause it — never reset/recreate it.
assert.match(index, /action\.paused\s*=\s*true/, 'pause must pause the existing animation action');
assert.match(index, /action\.paused\s*=\s*false/, 'resume must unpause the existing animation action');
assert.doesNotMatch(index, /if\(action\) action\.stop\(\);\s*action=mixer\.clipAction\(vmdClip\);/s, 'resume must not stop and recreate the action');
// Fixed-camera mode must omit hips translation from VRMA entirely: a constant hips
// track is still normalized by three-vrm and can produce an apparent vertical bob.
assert.match(index, /convertBVHToVRMAnimation\(bvh,\{scale:0\.01,includeHipsTranslation:false\}\)/, 'fixed-camera conversion must omit hips translation');
assert.match(converter, /includeHipsTranslation/, 'converter must support omitting hips translation');

console.log('pause/resume and root-translation invariants passed');
