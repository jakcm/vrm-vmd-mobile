/**
 * VMD → BVH converter for VRM retargeting.
 *
 * The previous converter only copied MMD rotations into a synthetic skeleton.
 * This version ports the relevant SystemAnimatorOnline rules: target-skeleton
 * offsets, groove/center root selection, parent motion, lower-body and arm-twist
 * compensation, and a single Y-X-Z rotation convention.
 */
import * as THREE from 'three';
import {
  MMD_TO_VRM,
  VRM_HIERARCHY,
  buildVmdKeyframes,
  chooseRootMotion,
  collectVrmBoneNames,
  inferRootScale,
} from './vmd-retarget-data.js';

const _world = new THREE.Vector3();
const _tmpV = new THREE.Vector3();
const _rootTemp = new THREE.Vector3();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _q = new THREE.Quaternion();
const _euler = new THREE.Euler();

function getBoneNodes(vrm) {
  const nodes = new Map();
  for (const name of collectVrmBoneNames()) {
    const node = vrm.humanoid.getRawBoneNode(name);
    if (node) nodes.set(name, node);
  }
  return nodes;
}

function getOffsets(nodes) {
  const offsets = new Map();
  for (const [name, node] of nodes) {
    const parentName = [...nodes.entries()].find(([, n]) => n === node.parent)?.[0];
    if (!parentName) {
      offsets.set(name, [0, 0, 0]);
      continue;
    }
    const parent = nodes.get(parentName);
    const p = node.getWorldPosition(_world).clone();
    const q = parent.getWorldPosition(_tmpV).clone();
    const delta = p.sub(q);
    const len = delta.length();
    // The bvh2vrma mapper expects conventional axes, but the sign comes from the actual VRM pose.
    if (/Arm|Hand|Thumb|Index|Middle|Ring|Little|Shoulder/.test(name)) offsets.set(name, [Math.sign(delta.x || 1) * len, 0, 0]);
    else if (/Leg|Spine|Chest|Neck|Head|Foot|Toes/.test(name)) offsets.set(name, [0, Math.sign(delta.y || 1) * len, 0]);
    else offsets.set(name, delta.toArray());
  }
  return offsets;
}

function writeHierarchy(name, offsets, depth = 0) {
  const tab = '  '.repeat(depth);
  const children = (VRM_HIERARCHY[name] ?? []).filter((child) => offsets.has(child));
  const offset = offsets.get(name) ?? [0, 0, 0];
  const lines = [];
  if (depth === 0) lines.push('ROOT hips');
  else lines.push(`${tab}JOINT ${name}`);
  lines.push(`${tab}{`);
  lines.push(`${tab}  OFFSET ${offset.map((v) => v.toFixed(6)).join(' ')}`);
  // SystemAnimatorOnline uses Y-X-Z both in channel order and Euler generation.
  lines.push(`${tab}  CHANNELS ${depth === 0 ? 6 : 3} ${depth === 0 ? 'Xposition Yposition Zposition ' : ''}Yrotation Xrotation Zrotation`);
  if (children.length) {
    for (const child of children) lines.push(...writeHierarchy(child, offsets, depth + 1));
  } else {
    lines.push(`${tab}  End Site`);
    lines.push(`${tab}  {`);
    const end = /Foot|Toes/.test(name) ? [0, -Math.max(Math.abs(offset[1]), 0.03), 0] : [0, 0.02, 0];
    lines.push(`${tab}    OFFSET ${end.map((v) => v.toFixed(6)).join(' ')}`);
    lines.push(`${tab}  }`);
  }
  lines.push(`${tab}}`);
  return lines;
}

function interpolate(keys, frame) {
  if (!keys?.length) return null;
  if (frame <= keys[0].frame) return keys[0];
  if (frame >= keys.at(-1).frame) return keys.at(-1);
  let lo = 0, hi = keys.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (keys[mid].frame <= frame) lo = mid; else hi = mid; }
  const a = keys[lo], b = keys[hi];
  const t = (frame - a.frame) / (b.frame - a.frame);
  _qa.fromArray(a.rot); _qb.fromArray(b.rot);
  return {
    pos: [a.pos[0] + (b.pos[0] - a.pos[0]) * t, a.pos[1] + (b.pos[1] - a.pos[1]) * t, a.pos[2] + (b.pos[2] - a.pos[2]) * t],
    rot: _qa.slerp(_qb, t).toArray(),
  };
}

function toYxz(qArray) {
  _euler.setFromQuaternion(_q.fromArray(qArray), 'YXZ');
  return [
    THREE.MathUtils.radToDeg(_euler.y),
    THREE.MathUtils.radToDeg(_euler.x),
    THREE.MathUtils.radToDeg(_euler.z),
  ];
}

function mmdQuaternion(keys, frame) {
  const key = interpolate(keys, frame);
  return key ? _q.fromArray(key.rot) : _q.identity();
}

export function vmdToBVH(vmdData, vrm, options = {}) {
  const fps = options.fps ?? 30;
  const nodes = getBoneNodes(vrm);
  const offsets = getOffsets(nodes);
  if (!offsets.has('hips')) throw new Error('VRM 缺少 hips 骨骼，无法重定向 VMD');

  const { byMmd, byVrm } = buildVmdKeyframes(vmdData);
  const root = chooseRootMotion(byMmd);
  const allParent = byMmd.get('全ての親');
  const lowerBody = byMmd.get('下半身');
  const leftTwist = byMmd.get('左手捩');
  const rightTwist = byMmd.get('右手捩');
  const rootScale = options.rootScale ?? inferRootScale(vrm);
  const names = collectVrmBoneNames().filter((name) => offsets.has(name));
  let maxFrame = 0;
  for (const keys of byMmd.values()) if (keys.length) maxFrame = Math.max(maxFrame, keys.at(-1).frame);
  const totalFrames = options.maxFrames ?? maxFrame + 1;
  const hipsRest = nodes.get('hips').position.clone();
  // VMD root tracks often contain stage traversal, not a loop-safe dance offset.
  // Repeating that absolute track snaps the avatar from its final position back to
  // the first frame. Convert it to an in-place, closed trajectory by removing the
  // initial offset and the first→last linear drift; preserve the local sway.
  const rootFirst = interpolate(root.keys, 0)?.pos ?? [0, 0, 0];
  const rootLast = interpolate(root.keys, totalFrames - 1)?.pos ?? rootFirst;
  const rootDrift = new THREE.Vector3().fromArray(rootLast).sub(_tmpV.fromArray(rootFirst));

  const lines = ['HIERARCHY', ...writeHierarchy('hips', offsets), 'MOTION', `Frames: ${totalFrames}`, `Frame Time: ${(1 / fps).toFixed(6)}`];
  for (let frame = 0; frame < totalFrames; frame++) {
    const values = [];
    for (const name of names) {
      let q;
      if (name === 'hips') {
        const rootKey = interpolate(root.keys, frame);
        const parentKey = interpolate(allParent, frame);
        const pos = hipsRest.clone();
        if (rootKey) {
          const phase = totalFrames > 1 ? frame / (totalFrames - 1) : 0;
          const closedRoot = _tmpV.fromArray(rootKey.pos).sub(_rootTemp.fromArray(rootFirst)).sub(_world.copy(rootDrift).multiplyScalar(phase));
          // This fixed-camera player must not animate hips translation. The VMD
          // root track represents stage locomotion (including its Y component),
          // not a safe local-body bob. Keep dance motion in rotations only.
          closedRoot.x = 0;
          closedRoot.y = 0;
          closedRoot.z = 0;
          pos.add(closedRoot.multiplyScalar(rootScale));
        }
        if (parentKey) pos.add(_tmpV.fromArray(parentKey.pos).multiplyScalar(rootScale));
        values.push(pos.x.toFixed(6), pos.y.toFixed(6), pos.z.toFixed(6));
        q = mmdQuaternion(root.keys, frame).clone();
        if (lowerBody) q.multiply(mmdQuaternion(lowerBody, frame));
      } else {
        q = mmdQuaternion(byVrm.get(name), frame).clone();
        // In MMD, lower body sits between center and upper body; compensate it at spine.
        if (name === 'spine' && lowerBody) q.premultiply(mmdQuaternion(lowerBody, frame).invert());
        if (name === 'leftLowerArm' && leftTwist) q.multiply(mmdQuaternion(leftTwist, frame));
        if (name === 'rightLowerArm' && rightTwist) q.multiply(mmdQuaternion(rightTwist, frame));
      }
      values.push(...toYxz(q.toArray()).map((v) => v.toFixed(6)));
    }
    lines.push(values.join(' '));
  }
  console.info('[VMD retarget]', { root: root.name, rootScale, frames: totalFrames, mappedBones: byVrm.size });
  return lines.join('\n');
}

export { MMD_TO_VRM };
