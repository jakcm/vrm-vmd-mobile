import { readFile } from 'node:fs/promises';

function parseGlb(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not GLB');
  let offset = 12, json, bin;
  while (offset < buffer.length) {
    const length = view.getUint32(offset, true); const type = view.getUint32(offset + 4, true); offset += 8;
    const chunk = buffer.subarray(offset, offset + length); offset += length;
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString().trim());
    if (type === 0x004e4942) bin = chunk;
  }
  return { json, bin };
}
function accessorValues(doc, accessorIndex) {
  const accessor = doc.json.accessors[accessorIndex];
  const view = doc.json.bufferViews[accessor.bufferView];
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  if (accessor.componentType !== 5126) throw new Error('only FLOAT supported');
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return new Float32Array(doc.bin.buffer, doc.bin.byteOffset + start, accessor.count * components);
}
function stats(values, width) {
  const first = Array.from(values.subarray(0, width)); const last = Array.from(values.subarray(values.length - width));
  const min = Array(width).fill(Infinity), max = Array(width).fill(-Infinity); let maxStep = 0;
  for (let i = 0; i < values.length; i += width) {
    for (let j = 0; j < width; j++) { min[j] = Math.min(min[j], values[i + j]); max[j] = Math.max(max[j], values[i + j]); }
    if (i) { let d = 0; for (let j = 0; j < width; j++) d += (values[i + j] - values[i - width + j]) ** 2; maxStep = Math.max(maxStep, Math.sqrt(d)); }
  }
  return { count: values.length / width, first, last, range: max.map((x, i) => x - min[i]), seam: Math.hypot(...first.map((x, i) => x - last[i])), maxStep };
}
export async function inspectVrma(path) {
  const doc = parseGlb(await readFile(path));
  const animation = doc.json.animations?.[0];
  const bones = doc.json.extensions?.VRMC_vrm_animation?.humanoid?.humanBones ?? {};
  const hipsNode = bones.hips?.node;
  const channel = animation?.channels?.find((c) => c.target.node === hipsNode && c.target.path === 'translation');
  if (!channel) return { path, generator: doc.json.asset?.generator, hipsTranslation: null, channels: animation?.channels?.length ?? 0 };
  const sampler = animation.samplers[channel.sampler];
  const times = accessorValues(doc, sampler.input);
  const values = accessorValues(doc, sampler.output);
  return { path, generator: doc.json.asset?.generator, channels: animation.channels.length, duration: times.at(-1), hipsTranslation: stats(values, 3) };
}
if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(await inspectVrma(process.argv[2]), null, 2));
export { parseGlb, accessorValues };
