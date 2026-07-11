import * as THREE from 'three';

// VMD bone naming and root-motion policy shared by the browser converter and tests.
// Keep root selection explicit: this dance stores motion on グルーブ, while common VMDs use センター.
export const ROOT_MOTION_NAMES = ['グルーブ', 'センター'];

const ALIASES = new Map([
  ['操作中心', 'センター'],
  ['中心', 'センター'],
  ['センター', 'センター'],
  ['グルーブ', 'グルーブ'],
  ['全ての親', '全ての親'],
]);

export function normalizeMmdBoneName(name) {
  return ALIASES.get(name) ?? name;
}

export function chooseRootMotion(keyframesByMmdName) {
  for (const name of ROOT_MOTION_NAMES) {
    const keys = keyframesByMmdName.get(name);
    if (keys?.length) return { name, keys };
  }
  return { name: null, keys: [] };
}

export const MMD_TO_VRM = {
  '上半身': 'spine', '上半身2': 'chest', '上半身3': 'upperChest',
  '首': 'neck', '頭': 'head',
  '右肩': 'rightShoulder', '右腕': 'rightUpperArm', '右ひじ': 'rightLowerArm', '右手首': 'rightHand',
  '右親指０': 'rightThumbMetacarpal', '右親指１': 'rightThumbProximal', '右親指２': 'rightThumbDistal',
  '右小指１': 'rightLittleProximal', '右小指２': 'rightLittleIntermediate', '右小指３': 'rightLittleDistal',
  '右薬指１': 'rightRingProximal', '右薬指２': 'rightRingIntermediate', '右薬指３': 'rightRingDistal',
  '右中指１': 'rightMiddleProximal', '右中指２': 'rightMiddleIntermediate', '右中指３': 'rightMiddleDistal',
  '右人指１': 'rightIndexProximal', '右人指２': 'rightIndexIntermediate', '右人指３': 'rightIndexDistal',
  '左肩': 'leftShoulder', '左腕': 'leftUpperArm', '左ひじ': 'leftLowerArm', '左手首': 'leftHand',
  '左親指０': 'leftThumbMetacarpal', '左親指１': 'leftThumbProximal', '左親指２': 'leftThumbDistal',
  '左小指１': 'leftLittleProximal', '左小指２': 'leftLittleIntermediate', '左小指３': 'leftLittleDistal',
  '左薬指１': 'leftRingProximal', '左薬指２': 'leftRingIntermediate', '左薬指３': 'leftRingDistal',
  '左中指１': 'leftMiddleProximal', '左中指２': 'leftMiddleIntermediate', '左中指３': 'leftMiddleDistal',
  '左人指１': 'leftIndexProximal', '左人指２': 'leftIndexIntermediate', '左人指３': 'leftIndexDistal',
  '右目': 'rightEye', '左目': 'leftEye',
  '右足': 'rightUpperLeg', '右ひざ': 'rightLowerLeg', '右足首': 'rightFoot', '右足先EX': 'rightToes',
  '左足': 'leftUpperLeg', '左ひざ': 'leftLowerLeg', '左足首': 'leftFoot', '左足先EX': 'leftToes',
};

export const VRM_HIERARCHY = {
  hips: ['spine', 'leftUpperLeg', 'rightUpperLeg'],
  spine: ['chest'], chest: ['upperChest'], upperChest: ['neck', 'leftShoulder', 'rightShoulder'], neck: ['head'], head: ['leftEye', 'rightEye'],
  leftShoulder: ['leftUpperArm'], leftUpperArm: ['leftLowerArm'], leftLowerArm: ['leftHand'],
  rightShoulder: ['rightUpperArm'], rightUpperArm: ['rightLowerArm'], rightLowerArm: ['rightHand'],
  leftHand: ['leftThumbMetacarpal', 'leftIndexProximal', 'leftMiddleProximal', 'leftRingProximal', 'leftLittleProximal'],
  rightHand: ['rightThumbMetacarpal', 'rightIndexProximal', 'rightMiddleProximal', 'rightRingProximal', 'rightLittleProximal'],
  leftThumbMetacarpal: ['leftThumbProximal'], leftThumbProximal: ['leftThumbDistal'], leftThumbDistal: [],
  rightThumbMetacarpal: ['rightThumbProximal'], rightThumbProximal: ['rightThumbDistal'], rightThumbDistal: [],
  leftIndexProximal: ['leftIndexIntermediate'], leftIndexIntermediate: ['leftIndexDistal'], leftIndexDistal: [],
  leftMiddleProximal: ['leftMiddleIntermediate'], leftMiddleIntermediate: ['leftMiddleDistal'], leftMiddleDistal: [],
  leftRingProximal: ['leftRingIntermediate'], leftRingIntermediate: ['leftRingDistal'], leftRingDistal: [],
  leftLittleProximal: ['leftLittleIntermediate'], leftLittleIntermediate: ['leftLittleDistal'], leftLittleDistal: [],
  rightIndexProximal: ['rightIndexIntermediate'], rightIndexIntermediate: ['rightIndexDistal'], rightIndexDistal: [],
  rightMiddleProximal: ['rightMiddleIntermediate'], rightMiddleIntermediate: ['rightMiddleDistal'], rightMiddleDistal: [],
  rightRingProximal: ['rightRingIntermediate'], rightRingIntermediate: ['rightRingDistal'], rightRingDistal: [],
  rightLittleProximal: ['rightLittleIntermediate'], rightLittleIntermediate: ['rightLittleDistal'], rightLittleDistal: [],
  leftUpperLeg: ['leftLowerLeg'], leftLowerLeg: ['leftFoot'], leftFoot: ['leftToes'], leftToes: [],
  rightUpperLeg: ['rightLowerLeg'], rightLowerLeg: ['rightFoot'], rightFoot: ['rightToes'], rightToes: [],
  leftEye: [], rightEye: [],
};

export function collectVrmBoneNames() {
  const names = [];
  const walk = (name) => { names.push(name); for (const child of VRM_HIERARCHY[name] ?? []) walk(child); };
  walk('hips');
  return names;
}

export function inferRootScale(vrm) {
  const hips = vrm.humanoid.getRawBoneNode('hips');
  const leftUpperLeg = vrm.humanoid.getRawBoneNode('leftUpperLeg');
  const leftLowerLeg = vrm.humanoid.getRawBoneNode('leftLowerLeg');
  if (!hips || !leftUpperLeg || !leftLowerLeg) return 1;
  const a = leftUpperLeg.getWorldPosition(new THREE.Vector3());
  const b = leftLowerLeg.getWorldPosition(new THREE.Vector3());
  const targetLegLength = a.distanceTo(b) + Math.max(leftLowerLeg.position.length(), 0.0001);
  // The MMD rest leg is conventionally 10 units per meter in this converter's BVH space.
  return Math.max(targetLegLength * 10, 0.0001);
}

export function buildVmdKeyframes(vmdData) {
  const byMmd = new Map();
  const byVrm = new Map();
  for (const motion of vmdData.motions ?? []) {
    const mmdName = normalizeMmdBoneName(motion.boneName);
    const key = { frame: motion.frameNum, pos: motion.position, rot: motion.rotation };
    const list = byMmd.get(mmdName) ?? [];
    list.push(key); byMmd.set(mmdName, list);
    const vrmName = MMD_TO_VRM[mmdName];
    if (vrmName) { const vrmList = byVrm.get(vrmName) ?? []; vrmList.push(key); byVrm.set(vrmName, vrmList); }
  }
  for (const list of [...byMmd.values(), ...byVrm.values()]) list.sort((a, b) => a.frame - b.frame);
  return { byMmd, byVrm };
}
