import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { Parser } from '../libs/mmdparser.module.js';
import { BVHLoader } from '../libs/BVHLoader.js';
import { vmdToBVH } from '../libs/VMD_to_BVH.js';
import { buildVmdKeyframes, chooseRootMotion } from '../libs/vmd-retarget-data.js';

const MAX_CONVERTED_ROOT_STEP = 1.2;
const MAX_ROTATION_STEP_DEG = 35;
const required = ['上半身', '右足', '右ひざ', '右足首', '左足', '左ひざ', '左足首'];
const vmd = new Parser().parseVmd((await readFile(new URL('../vmd/兰若酒醉的蝴蝶mmd数据.vmd', import.meta.url))).buffer);
const { byMmd } = buildVmdKeyframes(vmd);
const root = chooseRootMotion(byMmd);
assert.equal(root.name, 'グルーブ', 'this dance must use groove for root motion');
assert.equal(root.keys.length, 2587, 'root track must contain every animation frame');
for (const name of required) assert.ok(byMmd.get(name)?.length > 2500, `${name} must have a continuous dance track`);

let rawMaxRootStep = 0;
for (let i = 1; i < root.keys.length; i++) {
  const a = root.keys[i - 1], b = root.keys[i];
  assert.equal(b.frame - a.frame, 1, `root frame gap at ${a.frame}→${b.frame}`);
  rawMaxRootStep = Math.max(rawMaxRootStep, Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]));
}
const first = root.keys[0].pos, last = root.keys.at(-1).pos;
const rawLoopSeam = Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2]);
assert.ok(rawLoopSeam > MAX_CONVERTED_ROOT_STEP, 'fixture must expose the real VMD loop teleport');

for (const name of required) {
  const keys = byMmd.get(name);
  let maxDeg = 0;
  for (let i = 1; i < keys.length; i++) {
    const qa = new THREE.Quaternion(...keys[i - 1].rot);
    const qb = new THREE.Quaternion(...keys[i].rot);
    maxDeg = Math.max(maxDeg, 2 * Math.acos(Math.min(1, Math.abs(qa.dot(qb)))) * 180 / Math.PI);
  }
  assert.ok(maxDeg <= MAX_ROTATION_STEP_DEG, `${name} changes ${maxDeg.toFixed(1)}° in one frame`);
}

function bone(name, position) { const b = new THREE.Bone(); b.name = name; b.position.fromArray(position); return b; }
const hips = bone('hips', [0, 1, 0]);
const spine = bone('spine', [0, .2, 0]); hips.add(spine);
const chest = bone('chest', [0, .2, 0]); spine.add(chest);
const upperChest = bone('upperChest', [0, .1, 0]); chest.add(upperChest);
const neck = bone('neck', [0, .15, 0]); upperChest.add(neck);
upperChest.add(bone('head', [0, .25, 0]));
for (const side of ['left', 'right']) {
  const sign = side === 'left' ? .1 : -.1;
  const upper = bone(`${side}UpperLeg`, [sign, -.4, 0]); hips.add(upper);
  const lower = bone(`${side}LowerLeg`, [0, -.4, 0]); upper.add(lower);
  const foot = bone(`${side}Foot`, [0, -.1, .12]); lower.add(foot);
  foot.add(bone(`${side}Toes`, [0, 0, .1]));
}
const scene = new THREE.Object3D(); scene.add(hips); scene.updateWorldMatrix(true, true);
const nodes = new Map(); scene.traverse((node) => { if (node.isBone) nodes.set(node.name, node); });
const vrm = { humanoid: { getRawBoneNode: (name) => nodes.get(name) ?? null } };
const bvh = new BVHLoader().parse(vmdToBVH(vmd, vrm, { rootScale: 1 }));
const hipsTrack = bvh.clip.tracks.find((track) => track.name.endsWith('hips.position'));
assert.ok(hipsTrack, 'converted animation must contain hips position track');
let convertedMaxRootStep = 0;
for (let i = 3; i < hipsTrack.values.length; i += 3) {
  convertedMaxRootStep = Math.max(convertedMaxRootStep, Math.hypot(
    hipsTrack.values[i] - hipsTrack.values[i - 3], hipsTrack.values[i + 1] - hipsTrack.values[i - 2], hipsTrack.values[i + 2] - hipsTrack.values[i - 1],
  ));
}
const lastIndex = hipsTrack.values.length - 3;
const convertedLoopSeam = Math.hypot(
  hipsTrack.values[0] - hipsTrack.values[lastIndex], hipsTrack.values[1] - hipsTrack.values[lastIndex + 1], hipsTrack.values[2] - hipsTrack.values[lastIndex + 2],
);
assert.ok(convertedMaxRootStep <= MAX_CONVERTED_ROOT_STEP, `converted root step ${convertedMaxRootStep} exceeds teleport threshold`);
assert.ok(convertedLoopSeam < 1e-5, `converted loop seam ${convertedLoopSeam} would teleport on repeat`);
console.log(JSON.stringify({ root: root.name, rawMaxRootStep, rawLoopSeam, convertedMaxRootStep, convertedLoopSeam, validatedBones: required.length }, null, 2));
