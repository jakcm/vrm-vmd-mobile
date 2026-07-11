import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { Parser } from '../libs/mmdparser.module.js';
import { convertMmdRotationToVrm } from '../libs/VMD_to_BVH.js';

const vmd = new Parser().parseVmd((await readFile(new URL('../vmd/兰若酒醉的蝴蝶mmd数据.vmd', import.meta.url))).buffer);
for (const boneName of ['右ひざ', '左ひざ']) {
  const key = vmd.motions.find((motion) => motion.boneName === boneName && motion.frameNum === 0);
  const source = new THREE.Quaternion(...key.rotation).normalize();
  const preconverted = convertMmdRotationToVrm(source, '0');
  assert.ok(new THREE.Euler().setFromQuaternion(source, 'YXZ').x < 0, `${boneName} fixture must start with the MMD knee bend`);
  assert.ok(new THREE.Euler().setFromQuaternion(preconverted, 'YXZ').x > 0, `${boneName} must be preconverted before VRM0 playback applies its final handedness transform`);
}
const q = new THREE.Quaternion(.2, .3, .4, .8).normalize();
assert.deepEqual(convertMmdRotationToVrm(q, '0').toArray(), [-q.x, q.y, -q.z, q.w], 'VRM0 canonical input must flip X/Z once before final clip binding');
assert.deepEqual(convertMmdRotationToVrm(q, '1').toArray(), q.toArray(), 'VRM1 must not receive VRM0 axis conversion');
console.log('VRM0 pre-conversion passed');
