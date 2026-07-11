import assert from 'node:assert/strict';
import { chooseRootMotion, normalizeMmdBoneName, ROOT_MOTION_NAMES } from '../libs/vmd-retarget-data.js';

const keyed = new Map([
  ['センター', [{ frame: 0, pos: [0, 0, 0], rot: [0, 0, 0, 1] }]],
  ['グルーブ', [{ frame: 0, pos: [1, 2, 3], rot: [0, 0, 0, 1] }]],
  ['全ての親', [{ frame: 0, pos: [4, 5, 6], rot: [0, 0, 0, 1] }]],
]);

assert.equal(normalizeMmdBoneName('操作中心'), 'センター');
assert.equal(normalizeMmdBoneName('中心'), 'センター');
assert.deepEqual(ROOT_MOTION_NAMES, ['グルーブ', 'センター']);
assert.equal(chooseRootMotion(keyed).name, 'グルーブ');
assert.equal(chooseRootMotion(new Map([['センター', keyed.get('センター')]])).name, 'センター');
assert.equal(chooseRootMotion(new Map()).name, null);

console.log('vmd-retarget-data tests passed');
