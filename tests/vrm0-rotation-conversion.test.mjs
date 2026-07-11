import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { Parser } from '../libs/mmdparser.module.js';
import { convertMmdRotationToVrm } from '../libs/VMD_to_BVH.js';

const vmd = new Parser().parseVmd((await readFile(new URL('../vmd/兰若酒醉的蝴蝶mmd数据.vmd', import.meta.url))).buffer);
for (const boneName of ['右ひざ', '左ひざ']) {
  const key = vmd.motions.find((motion) => motion.boneName === boneName && motion.frameNum === 0);
  const source = new THREE.Quaternion(...key.rotation).normalize();
  const canonical = convertMmdRotationToVrm(source, '0');
  assert.ok(new THREE.Euler().setFromQuaternion(source, 'YXZ').x < 0, `${boneName} fixture must retain its VMD knee bend`);
  assert.ok(2 * Math.acos(Math.min(1, Math.abs(source.dot(canonical)))) < 1e-6, `${boneName} canonical BVH must not receive the direct-VRM axis flip`);
}
const q = new THREE.Quaternion(.2, .3, .4, .8).normalize();
assert.deepEqual(convertMmdRotationToVrm(q, '0').toArray(), q.toArray(), 'canonical VRM0 BVH must preserve local quaternion');
assert.deepEqual(convertMmdRotationToVrm(q, '1').toArray(), q.toArray(), 'canonical VRM1 BVH must preserve local quaternion');
console.log('canonical BVH rotation conversion passed');
