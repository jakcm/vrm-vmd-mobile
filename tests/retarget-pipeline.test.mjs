import assert from 'node:assert/strict';
import * as THREE from 'three';
import { vmdToBVH } from '../libs/VMD_to_BVH.js';
import { BVHLoader } from '../libs/BVHLoader.js';

function makeBone(name, x, y, z) {
  const bone = new THREE.Bone(); bone.name = name; bone.position.set(x, y, z); return bone;
}
const hips = makeBone('hips', 0, 1, 0);
const spine = makeBone('spine', 0, .2, 0); hips.add(spine);
const chest = makeBone('chest', 0, .2, 0); spine.add(chest);
const upperChest = makeBone('upperChest', 0, .1, 0); chest.add(upperChest);
const neck = makeBone('neck', 0, .15, 0); upperChest.add(neck);
const head = makeBone('head', 0, .15, 0); neck.add(head);
for (const side of ['left', 'right']) {
  const sign = side === 'left' ? .1 : -.1;
  const upperLeg = makeBone(`${side}UpperLeg`, sign, -.4, 0); hips.add(upperLeg);
  const lowerLeg = makeBone(`${side}LowerLeg`, 0, -.4, 0); upperLeg.add(lowerLeg);
  const foot = makeBone(`${side}Foot`, 0, -.1, .12); lowerLeg.add(foot);
  const toes = makeBone(`${side}Toes`, 0, 0, .1); foot.add(toes);
}
const root = new THREE.Object3D(); root.add(hips); root.updateWorldMatrix(true, true);
const nodes = new Map(); root.traverse((n) => { if (n.isBone) nodes.set(n.name, n); });
const vrm = { humanoid: { getRawBoneNode: (name) => nodes.get(name) ?? null } };
const k = (boneName, frameNum, position = [0, 0, 0], rotation = [0, 0, 0, 1]) => ({ boneName, frameNum, position, rotation });
const vmd = { motions: [
  k('グルーブ', 0, [0, 0, 0]), k('グルーブ', 1, [1, 0, 0]),
  k('センター', 0, [0, 0, 0]),
  k('右ひざ', 0, [0, 0, 0], [0.2, 0, 0, .98]),
  k('左ひざ', 0, [0, 0, 0], [0.2, 0, 0, .98]),
] };
const text = vmdToBVH(vmd, vrm, { fps: 30, rootScale: 1, maxFrames: 2 });
assert.match(text, /CHANNELS 6 Xposition Yposition Zposition Yrotation Xrotation Zrotation/);
assert.match(text, /JOINT rightLowerLeg/);
const bvh = new BVHLoader().parse(text);
assert.equal(bvh.clip.duration > 0, true);
const rootTrack = bvh.clip.tracks.find((track) => track.name.endsWith('hips.position'));
assert.equal(rootTrack.values[3], rootTrack.values[0], 'loop-safe root conversion must close the first/last root positions');
console.log('retarget pipeline tests passed');
