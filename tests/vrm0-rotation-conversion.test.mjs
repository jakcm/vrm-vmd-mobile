import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { Parser } from '../libs/mmdparser.module.js';
import { convertMmdRotationToVrm } from '../libs/VMD_to_BVH.js';

const vmd = new Parser().parseVmd((await readFile(new URL('../vmd/兰若酒醉的蝴蝶mmd数据.vmd', import.meta.url))).buffer);
for (const boneName of ['右ひざ', '左ひざ']) {
  const key = vmd.motions.find((motion) => motion.boneName === boneName && motion.frameNum === 0);
  const sourceX = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...key.rotation), 'YXZ').x;
  const convertedX = new THREE.Euler().setFromQuaternion(convertMmdRotationToVrm(new THREE.Quaternion(...key.rotation), '0'), 'YXZ').x;
  assert.ok(sourceX < 0, `${boneName} fixture must start with MMD negative-X bend`);
  assert.ok(convertedX > 0, `${boneName} must bend forward after VRM0 coordinate conversion`);
}
const q = new THREE.Quaternion(.2, .3, .4, .8).normalize();
assert.deepEqual(convertMmdRotationToVrm(q, '1').toArray(), q.toArray(), 'VRM1 must not receive VRM0 axis conversion');
console.log('VRM0 knee-axis conversion passed');
