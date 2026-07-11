import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { Parser } from '../libs/mmdparser.module.js';
import { BVHLoader } from '../libs/BVHLoader.js';
import { vmdToBVH } from '../libs/VMD_to_BVH.js';

function bone(name, position) {
  const result = new THREE.Bone();
  result.name = name;
  result.position.fromArray(position);
  return result;
}

// bvh2vrma consumes a canonical humanoid BVH. It is not the direct-VRM runtime
// path in SystemAnimatorOnline, so a VRM0 coordinate flip must not be injected
// into this intermediate representation.
const hips = bone('hips', [0, 1, 0]);
for (const side of ['left', 'right']) {
  const sign = side === 'left' ? 0.1 : -0.1;
  const upper = bone(`${side}UpperLeg`, [sign, -0.4, 0]); hips.add(upper);
  const lower = bone(`${side}LowerLeg`, [0, -0.4, 0]); upper.add(lower);
  const foot = bone(`${side}Foot`, [0, -0.1, 0.12]); lower.add(foot);
  foot.add(bone(`${side}Toes`, [0, 0, 0.1]));
}
const scene = new THREE.Object3D();
scene.add(hips);
scene.updateWorldMatrix(true, true);
const nodes = new Map();
scene.traverse((node) => { if (node.isBone) nodes.set(node.name, node); });
const vrm0 = {
  meta: { metaVersion: '0' },
  humanoid: { getRawBoneNode: (name) => nodes.get(name) ?? null },
};

const vmd = new Parser().parseVmd((await readFile(new URL('../vmd/兰若酒醉的蝴蝶mmd数据.vmd', import.meta.url))).buffer);
const source = vmd.motions.find((motion) => motion.boneName === '右ひざ' && motion.frameNum === 0);
assert.ok(source, 'fixture must contain right knee frame 0');
const bvh = new BVHLoader().parse(vmdToBVH(vmd, vrm0, { rootScale: 1 }));
const track = bvh.clip.tracks.find((candidate) => candidate.name.endsWith('rightLowerLeg.quaternion'));
assert.ok(track, 'canonical BVH must contain the right-knee quaternion track');

const sourceQ = new THREE.Quaternion(...source.rotation).normalize();
const bvhQ = new THREE.Quaternion(...track.values.slice(0, 4)).normalize();
const angularError = 2 * Math.acos(Math.min(1, Math.abs(sourceQ.dot(bvhQ))));
assert.ok(
  angularError < 1e-5,
  `canonical BVH must preserve raw VMD local rotation; got ${(angularError * 180 / Math.PI).toFixed(2)}° error`,
);
console.log('canonical BVH keeps VMD local knee rotation');
