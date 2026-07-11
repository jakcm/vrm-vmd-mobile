import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const converter = await readFile(new URL('../libs/convertBVHToVRMAnimation.js', import.meta.url), 'utf8');

// Pause must keep the existing action/time, then unpause it — never reset/recreate it.
assert.match(index, /action\.paused\s*=\s*true/, 'pause must pause the existing animation action');
assert.match(index, /action\.paused\s*=\s*false/, 'resume must unpause the existing animation action');
assert.doesNotMatch(index, /if\(action\) action\.stop\(\);\s*action=mixer\.clipAction\(vmdClip\);/s, 'resume must not stop and recreate the action');
// Hips-translation policy is dance-specific: 酒醉 stays planted, while the
// source-assisted default dance may preserve MMD root timing. The converter must
// receive the selected dance's explicit policy rather than a global constant.
assert.match(index, /includeHipsTranslation:dance\.retarget\?\.includeHipsTranslation \?\? false/, 'conversion must use each dance translation policy');
assert.match(index, /jiuzui:\s*\{[\s\S]*?audioPath:[\s\S]*?\}/, '酒醉 dance configuration must remain present');
assert.match(converter, /includeHipsTranslation/, 'converter must support omitting hips translation');

console.log('pause/resume and root-translation invariants passed');
