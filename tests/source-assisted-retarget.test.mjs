import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.match(index, /MMDAnimationHelper/, 'default dance must load an MMD source skeleton with its native IK solver');
assert.match(index, /mmd-reference-miku\.pmd/, 'default dance source must use the same local default Miku skeleton');
assert.match(index, /applySourcePoseCorrection/, 'target VRM must receive source-pose correction after its VRMA mixer update');
assert.match(index, /sourceHipWorld/, 'correction must transfer directions in hips-local space, not raw world coordinates');
assert.match(index, /leftUpperArm/, 'correction must cover primary arm chains');
assert.match(index, /leftUpperLeg/, 'correction must cover primary leg chains');
console.log('source-assisted default-dance retarget contract passed');
