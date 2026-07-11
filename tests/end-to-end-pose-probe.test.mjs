import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.match(
  html,
  /window\.__vrmDanceDebug\s*=/,
  'the live viewer must expose an end-to-end pose probe so tests inspect the actual VRM after createVRMAnimationClip, not only the intermediate BVH',
);
assert.match(
  html,
  /samplePoseAt\s*:/,
  'the pose probe must provide deterministic samplePoseAt(time) for knee/limb regression checks',
);
console.log('live VRM pose probe is available');
