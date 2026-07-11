/**
 * VMD → BVH 转换器
 * 将 MMD 动作数据(VMD)转为 BVH 格式，适配 @pixiv/three-vrm v3 API
 * 
 * 参考 SystemAnimatorOnline 的 BVH_filewriter.js 逻辑，
 * 但解除了对 MMD_SA.THREEX 的耦合。
 */

import * as THREE from 'three';

// ===== MMD → VRM 骨骼名称映射表 =====
// 复制自 SystemAnimatorOnline MMD_SA.js
const MMD_TO_VRM = {
  'センター': 'hips',
  '下半身': 'hips',     // 下半身映射到 hips
  '上半身': 'spine',
  '上半身2': 'chest',
  '上半身3': 'upperChest',
  '首': 'neck',
  '頭': 'head',
  '右肩': 'rightShoulder',
  '右腕': 'rightUpperArm',
  '右ひじ': 'rightLowerArm',
  '右手首': 'rightHand',
  '右親指０': 'rightThumbMetacarpal',
  '右親指１': 'rightThumbProximal',
  '右親指２': 'rightThumbDistal',
  '右小指１': 'rightLittleProximal',
  '右小指２': 'rightLittleIntermediate',
  '右小指３': 'rightLittleDistal',
  '右薬指１': 'rightRingProximal',
  '右薬指２': 'rightRingIntermediate',
  '右薬指３': 'rightRingDistal',
  '右中指１': 'rightMiddleProximal',
  '右中指２': 'rightMiddleIntermediate',
  '右中指３': 'rightMiddleDistal',
  '右人指１': 'rightIndexProximal',
  '右人指２': 'rightIndexIntermediate',
  '右人指３': 'rightIndexDistal',
  '左肩': 'leftShoulder',
  '左腕': 'leftUpperArm',
  '左ひじ': 'leftLowerArm',
  '左手首': 'leftHand',
  '左親指０': 'leftThumbMetacarpal',
  '左親指１': 'leftThumbProximal',
  '左親指２': 'leftThumbDistal',
  '左小指１': 'leftLittleProximal',
  '左小指２': 'leftLittleIntermediate',
  '左小指３': 'leftLittleDistal',
  '左薬指１': 'leftRingProximal',
  '左薬指２': 'leftRingIntermediate',
  '左薬指３': 'leftRingDistal',
  '左中指１': 'leftMiddleProximal',
  '左中指２': 'leftMiddleIntermediate',
  '左中指３': 'leftMiddleDistal',
  '左人指１': 'leftIndexProximal',
  '左人指２': 'leftIndexIntermediate',
  '左人指３': 'leftIndexDistal',
  '右目': 'rightEye',
  '左目': 'leftEye',
  '右足': 'rightUpperLeg',
  '右ひざ': 'rightLowerLeg',
  '右足首': 'rightFoot',
  '右足先EX': 'rightToes',
  '左足': 'leftUpperLeg',
  '左ひざ': 'leftLowerLeg',
  '左足首': 'leftFoot',
  '左足先EX': 'leftToes',
};

// 标准 VRM Humanoid 骨骼层级顺序 (广度优先)
const VRM_HIERARCHY = {
  'hips': {
    children: ['spine', 'leftUpperLeg', 'rightUpperLeg'],
    axis: null,
  },
  'spine': {
    children: ['chest'],
    axis: 'y',
  },
  'chest': {
    children: ['upperChest'],
    axis: 'y',
  },
  'upperChest': {
    children: ['neck', 'leftShoulder', 'rightShoulder'],
    axis: 'y',
  },
  'neck': {
    children: ['head'],
    axis: 'y',
  },
  'head': {
    children: ['leftEye', 'rightEye'],
    axis: null,
  },
  'leftShoulder': {
    children: ['leftUpperArm'],
    axis: null,
  },
  'leftUpperArm': {
    children: ['leftLowerArm'],
    axis: 'x',
  },
  'leftLowerArm': {
    children: ['leftHand'],
    axis: 'x',
  },
  'leftHand': {
    children: [
      'leftThumbMetacarpal',
      'leftIndexProximal', 'leftMiddleProximal',
      'leftRingProximal', 'leftLittleProximal',
    ],
    axis: null,
  },
  'leftThumbMetacarpal': { children: ['leftThumbProximal'], axis: 'x' },
  'leftThumbProximal': { children: ['leftThumbDistal'], axis: 'x' },
  'leftThumbDistal': { children: [], axis: null },
  'leftIndexProximal': { children: ['leftIndexIntermediate'], axis: 'x' },
  'leftIndexIntermediate': { children: ['leftIndexDistal'], axis: 'x' },
  'leftIndexDistal': { children: [], axis: null },
  'leftMiddleProximal': { children: ['leftMiddleIntermediate'], axis: 'x' },
  'leftMiddleIntermediate': { children: ['leftMiddleDistal'], axis: 'x' },
  'leftMiddleDistal': { children: [], axis: null },
  'leftRingProximal': { children: ['leftRingIntermediate'], axis: 'x' },
  'leftRingIntermediate': { children: ['leftRingDistal'], axis: 'x' },
  'leftRingDistal': { children: [], axis: null },
  'leftLittleProximal': { children: ['leftLittleIntermediate'], axis: 'x' },
  'leftLittleIntermediate': { children: ['leftLittleDistal'], axis: 'x' },
  'leftLittleDistal': { children: [], axis: null },
  'rightShoulder': {
    children: ['rightUpperArm'],
    axis: null,
  },
  'rightUpperArm': {
    children: ['rightLowerArm'],
    axis: 'x',
  },
  'rightLowerArm': {
    children: ['rightHand'],
    axis: 'x',
  },
  'rightHand': {
    children: [
      'rightThumbMetacarpal',
      'rightIndexProximal', 'rightMiddleProximal',
      'rightRingProximal', 'rightLittleProximal',
    ],
    axis: null,
  },
  'rightThumbMetacarpal': { children: ['rightThumbProximal'], axis: 'x' },
  'rightThumbProximal': { children: ['rightThumbDistal'], axis: 'x' },
  'rightThumbDistal': { children: [], axis: null },
  'rightIndexProximal': { children: ['rightIndexIntermediate'], axis: 'x' },
  'rightIndexIntermediate': { children: ['rightIndexDistal'], axis: 'x' },
  'rightIndexDistal': { children: [], axis: null },
  'rightMiddleProximal': { children: ['rightMiddleIntermediate'], axis: 'x' },
  'rightMiddleIntermediate': { children: ['rightMiddleDistal'], axis: 'x' },
  'rightMiddleDistal': { children: [], axis: null },
  'rightRingProximal': { children: ['rightRingIntermediate'], axis: 'x' },
  'rightRingIntermediate': { children: ['rightRingDistal'], axis: 'x' },
  'rightRingDistal': { children: [], axis: null },
  'rightLittleProximal': { children: ['rightLittleIntermediate'], axis: 'x' },
  'rightLittleIntermediate': { children: ['rightLittleDistal'], axis: 'x' },
  'rightLittleDistal': { children: [], axis: null },
  'leftUpperLeg': {
    children: ['leftLowerLeg'],
    axis: 'y',
  },
  'leftLowerLeg': {
    children: ['leftFoot'],
    axis: 'y',
  },
  'leftFoot': {
    children: ['leftToes'],
    axis: 'y',
  },
  'leftToes': { children: [], axis: null },
  'rightUpperLeg': {
    children: ['rightLowerLeg'],
    axis: 'y',
  },
  'rightLowerLeg': {
    children: ['rightFoot'],
    axis: 'y',
  },
  'rightFoot': {
    children: ['rightToes'],
    axis: 'y',
  },
  'rightToes': { children: [], axis: null },
  'leftEye': { children: [], axis: null },
  'rightEye': { children: [], axis: null },
};

/**
 * 从 VRM 模型获取骨骼的世界坐标位置
 */
function getBoneWorldPositions(vrm) {
  const positions = {};
  const humanBoneNames = [
    'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
    'leftEye', 'rightEye',
    'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
    'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
    'leftThumbMetacarpal', 'leftThumbProximal', 'leftThumbDistal',
    'leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal',
    'leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal',
    'leftRingProximal', 'leftRingIntermediate', 'leftRingDistal',
    'leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal',
    'rightThumbMetacarpal', 'rightThumbProximal', 'rightThumbDistal',
    'rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal',
    'rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal',
    'rightRingProximal', 'rightRingIntermediate', 'rightRingDistal',
    'rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal',
  ];
  const v3 = new THREE.Vector3();
  
  for (const name of humanBoneNames) {
    try {
      const node = vrm.humanoid.getRawBoneNode(name);
      if (node) {
        node.getWorldPosition(v3);
        positions[name] = v3.toArray();
      }
    } catch (e) {
      // 某些骨骼可能不存在，跳过
    }
  }
  
  // 必须要有 hips
  if (!positions['hips']) {
    console.warn('VMD_to_BVH: VRM model has no hips bone');
  }
  
  return positions;
}

/**
 * 计算骨骼偏移量（从父骨骼到子骨骼的向量）
 * 参照原 BVH_filewriter 的逻辑：
 * - arm 类骨骼：偏移沿 x 轴，值为骨骼长度（带符号）
 * - leg/spine 类骨骼：偏移沿 y 轴，值为骨骼长度（带符号）
 * - 其他骨骼：直接使用父子世界坐标差
 */
function calcBoneOffset(name, parentName, worldPositions) {
  const pos = worldPositions[name];
  if (!pos) return [0, 0, 0];
  
  if (!parentName) {
    // 根骨骼 (hips) 使用模型高度的一半作为 Y 偏移
    // 或使用 hips 的世界坐标
    return [0, 0, 0];
  }
  
  const ppos = worldPositions[parentName];
  if (!ppos) return [0, 0, 0];
  
  // 父子世界坐标差
  const dx = pos[0] - ppos[0];
  const dy = pos[1] - ppos[1];
  const dz = pos[2] - ppos[2];
  
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  // arm: 沿 x 轴
  if (/arm|hand|thumb|index|middle|ring|little|shoulder/i.test(name)) {
    const sign = Math.sign(dx) || 1;
    return [sign * len, 0, 0];
  }
  // leg/spine/neck/head: 沿 y 轴
  if (/leg|spine|chest|neck|head|toes|foot|upperChest/i.test(name)) {
    const sign = Math.sign(dy) || 1;
    return [0, sign * len, 0];
  }
  // eye: 使用原始差
  if (/eye/i.test(name)) {
    return [dx, dy, dz];
  }
  
  return [dx, dy, dz];
}

/**
 * 递归生成 BVH HIERARCHY 文本
 */
function buildHierarchy(name, parentName, worldPositions, depth) {
  const tabs = '  '.repeat(depth);
  const offset = calcBoneOffset(name, parentName, worldPositions);
  const info = VRM_HIERARCHY[name];
  let lines = [];
  
  if (depth === 0) {
    // 根骨骼
    lines.push(`${tabs}ROOT ${name}`);
    lines.push(`${tabs}{`);
    lines.push(`${tabs}  OFFSET ${offset[0].toFixed(6)} ${offset[1].toFixed(6)} ${offset[2].toFixed(6)}`);
    lines.push(`${tabs}  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation`);
  } else {
    lines.push(`${tabs}JOINT ${name}`);
    lines.push(`${tabs}{`);
    lines.push(`${tabs}  OFFSET ${offset[0].toFixed(6)} ${offset[1].toFixed(6)} ${offset[2].toFixed(6)}`);
    lines.push(`${tabs}  CHANNELS 3 Zrotation Xrotation Yrotation`);
  }
  
  if (info && info.children.length > 0) {
    for (const childName of info.children) {
      const childLines = buildHierarchy(childName, name, worldPositions, depth + 1);
      lines.push(...childLines);
    }
  }
  
  lines.push(`${tabs}}`);
  return lines;
}

/**
 * 收集 BVH 层级中的所有骨骼名称（广度优先顺序）
 */
function collectBoneNames() {
  const names = [];
  function walk(name) {
    names.push(name);
    const info = VRM_HIERARCHY[name];
    if (info) {
      for (const child of info.children) {
        walk(child);
      }
    }
  }
  walk('hips');
  return names;
}

/**
 * 将 THREE.Quaternion 转换为 Euler 角度 (ZYX 顺序)
 * BVH 使用 Zrotation Xrotation Yrotation
 */
function quatToBvhEuler(q, axis) {
  // BVH 使用 ZYX 欧拉角顺序
  const euler = new THREE.Euler().setFromQuaternion(q, 'ZYX');
  // 弧度转角度
  const rx = THREE.MathUtils.radToDeg(euler.x);
  const ry = THREE.MathUtils.radToDeg(euler.y);
  const rz = THREE.MathUtils.radToDeg(euler.z);
  return [rz, rx, ry];
}

/**
 * VMD → BVH 转换主函数
 * 
 * @param {Object} vmdData - mmdparser 解析的 VMD 数据
 * @param {Object} vrm - @pixiv/three-vrm 的 VRM 实例
 * @param {Object} [options]
 * @param {number} [options.fps=30] - BVH 帧率
 * @param {number} [options.scale=0.1] - BVH 缩放（默认 0.1 适合 VRM 模型）
 * @param {number} [options.maxFrames] - 最大帧数限制
 * @returns {string} BVH 格式文本
 */
export function vmdToBVH(vmdData, vrm, options = {}) {
  const fps = options.fps || 30;
  const scale = options.scale || 0.1;
  
  // 1. 获取 VRM 模型骨骼位置
  const worldPositions = getBoneWorldPositions(vrm);
  
  // 2. 收集骨骼列表（按 BVH 层级顺序）
  const boneNames = collectBoneNames();
  
  // 3. 建立 MMD 骨骼名 → 关键帧数据 的查询表
  const vmdBones = {};
  if (vmdData.motions) {
    for (const motion of vmdData.motions) {
      const vrmName = MMD_TO_VRM[motion.boneName];
      if (!vrmName) continue; // 跳过无映射的骨骼（如 IK 骨骼）
      if (!vmdBones[vrmName]) {
        vmdBones[vrmName] = [];
      }
      vmdBones[vrmName].push({
        frame: motion.frameNum,
        pos: motion.position,
        rot: motion.rotation,
      });
    }
  }
  
  // 对每个骨骼的关键帧按帧号排序
  for (const name in vmdBones) {
    vmdBones[name].sort((a, b) => a.frame - b.frame);
  }
  
  // 4. 确定总帧数
  let maxFrame = 0;
  for (const name in vmdBones) {
    const keys = vmdBones[name];
    if (keys.length > 0) {
      maxFrame = Math.max(maxFrame, keys[keys.length - 1].frame);
    }
  }
  // 加一些缓冲帧
  maxFrame = Math.max(maxFrame, 1);
  const totalFrames = options.maxFrames || (maxFrame + 5);
  
  // 5. 插值函数：在关键帧之间进行线性插值
  function interpolateKeyframes(keyframes, frame) {
    if (!keyframes || keyframes.length === 0) return null;
    if (frame <= keyframes[0].frame) return keyframes[0];
    if (frame >= keyframes[keyframes.length - 1].frame) return keyframes[keyframes.length - 1];
    
    // 二分查找
    let lo = 0, hi = keyframes.length - 1;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (keyframes[mid].frame <= frame) lo = mid;
      else hi = mid;
    }
    
    const a = keyframes[lo];
    const b = keyframes[hi];
    
    if (a.frame === b.frame) return a;
    
    const t = (frame - a.frame) / (b.frame - a.frame);
    
    // 线性插值位置
    const pos = [
      a.pos[0] + (b.pos[0] - a.pos[0]) * t,
      a.pos[1] + (b.pos[1] - a.pos[1]) * t,
      a.pos[2] + (b.pos[2] - a.pos[2]) * t,
    ];
    
    // 四元数球面插值
    const qa = new THREE.Quaternion(a.rot[0], a.rot[1], a.rot[2], a.rot[3]);
    const qb = new THREE.Quaternion(b.rot[0], b.rot[1], b.rot[2], b.rot[3]);
    qa.slerp(qb, t);
    
    return {
      pos: pos,
      rot: [qa.x, qa.y, qa.z, qa.w],
    };
  }
  
  // 6. 生成 BVH 文本
  const lines = [];
  const frameTime = 1.0 / fps;
  
  // HIERARCHY 部分
  lines.push('HIERARCHY');
  const hierLines = buildHierarchy('hips', null, worldPositions, 0);
  lines.push(...hierLines);
  
  // MOTION 部分
  lines.push('MOTION');
  lines.push(`Frames: ${totalFrames}`);
  lines.push(`Frame Time: ${frameTime.toFixed(6)}`);
  
  // 逐帧生成动作数据
  const qTmp = new THREE.Quaternion();
  const qHips = new THREE.Quaternion();
  const v3Pos = new THREE.Vector3();
  
  for (let f = 0; f < totalFrames; f++) {
    const frameValues = [];
    
    for (let b = 0; b < boneNames.length; b++) {
      const vrmName = boneNames[b];
      const keyframes = vmdBones[vrmName];
      const interpolated = interpolateKeyframes(keyframes, f);
      
      if (b === 0) {
        // hips: 6 channels (XYZ position + ZXY rotation)
        if (interpolated) {
          // VMD位置是相对位移，需要缩放
          const px = (interpolated.pos[0] || 0) * scale;
          const py = (interpolated.pos[1] || 0) * scale;
          const pz = (interpolated.pos[2] || 0) * scale;
          frameValues.push(px.toFixed(6), py.toFixed(6), pz.toFixed(6));
          
          qHips.set(interpolated.rot[0], interpolated.rot[1], interpolated.rot[2], interpolated.rot[3]);
          const [rz, rx, ry] = quatToBvhEuler(qHips);
          frameValues.push(rz.toFixed(6), rx.toFixed(6), ry.toFixed(6));
        } else {
          frameValues.push('0', '0', '0', '0', '0', '0');
        }
      } else {
        // 其他骨骼: 3 channels (ZXY rotation only)
        if (interpolated) {
          qTmp.set(interpolated.rot[0], interpolated.rot[1], interpolated.rot[2], interpolated.rot[3]);
          const [rz, rx, ry] = quatToBvhEuler(qTmp);
          frameValues.push(rz.toFixed(6), rx.toFixed(6), ry.toFixed(6));
        } else {
          frameValues.push('0', '0', '0');
        }
      }
    }
    
    lines.push(frameValues.join(' '));
  }
  
  return lines.join('\n');
}