import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { Parser } from '../libs/mmdparser.module.js';
import { vmdToBVH } from '../libs/VMD_to_BVH.js';
import { BVHLoader } from '../libs/BVHLoader.js';
import { inspectVrma } from '../scripts/inspect-vrma.mjs';

function bone(name, p) { const b = new THREE.Bone(); b.name = name; b.position.fromArray(p); return b; }
function makeVrm() {
  const hips = bone('hips', [0, 1, 0]);
  const spine = bone('spine', [0, .2, 0]); hips.add(spine);
  const chest = bone('chest', [0, .2, 0]); spine.add(chest);
  const upper = bone('upperChest', [0, .1, 0]); chest.add(upper);
  upper.add(bone('neck', [0, .15, 0])); upper.add(bone('head', [0, .25, 0]));
  for (const side of ['left', 'right']) {
    const x = side === 'left' ? .1 : -.1; const upperLeg = bone(`${side}UpperLeg`, [x, -.4, 0]); hips.add(upperLeg);
    const lower = bone(`${side}LowerLeg`, [0, -.4, 0]); upperLeg.add(lower);
    const foot = bone(`${side}Foot`, [0, -.1, .12]); lower.add(foot); foot.add(bone(`${side}Toes`, [0, 0, .1]));
  }
  const root = new THREE.Object3D(); root.add(hips); root.updateWorldMatrix(true, true);
  const nodes = new Map(); root.traverse((n) => n.isBone && nodes.set(n.name, n));
  return { humanoid: { getRawBoneNode: (name) => nodes.get(name) ?? null } };
}
function trackStats(track) {
  const out = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], first: [], last: [] };
  for (let i = 0; i < track.values.length; i += 3) for (let j = 0; j < 3; j++) { out.min[j] = Math.min(out.min[j], track.values[i + j]); out.max[j] = Math.max(out.max[j], track.values[i + j]); }
  out.range = out.max.map((v, i) => v - out.min[i]); out.first = [...track.values.slice(0, 3)]; out.last = [...track.values.slice(-3)];
  out.horizontalRange = Math.hypot(out.range[0], out.range[2]); return out;
}

const reference = await inspectVrma('/Users/admin/projects/vrm-viewer-mobile/VRMA/Bling-Bang-Bang-Born.vrma');
const vmd = new Parser().parseVmd((await readFile(new URL('../vmd/兰若酒醉的蝴蝶mmd数据.vmd', import.meta.url))).buffer);
const bvh = new BVHLoader().parse(vmdToBVH(vmd, makeVrm()));
const hips = bvh.clip.tracks.find((track) => track.name.endsWith('hips.position'));
const candidateBvh = trackStats(hips);
// convertBVHToVRMAnimation applies this fixed BVH → VRMA meter conversion.
const VRMA_SCALE = 0.01;
const candidate = { ...candidateBvh, range: candidateBvh.range.map((v) => v * VRMA_SCALE), horizontalRange: candidateBvh.horizontalRange * VRMA_SCALE };
const referenceHorizontalRange = Math.hypot(reference.hipsTranslation.range[0], reference.hipsTranslation.range[2]);
console.log(JSON.stringify({ reference: { generator: reference.generator, horizontalRange: referenceHorizontalRange, ...reference.hipsTranslation }, candidate: { horizontalRange: candidate.horizontalRange, ...candidate } }, null, 2));
assert.ok(candidate.horizontalRange <= referenceHorizontalRange * 2.5, `VMD-derived VRMA horizontal range ${candidate.horizontalRange.toFixed(3)}m exceeds Bling reference ${referenceHorizontalRange.toFixed(3)}m by more than 2.5×; avatar will drift`);
console.log('VMD-vs-Bling VRMA root-motion comparison passed');
