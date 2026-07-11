# VRM + VMD Dance

在浏览器中加载 VRM 模型和 VMD 动作，实现 3D 模型跳舞。

## 原理

参考 [SystemAnimatorOnline](https://github.com/ButzYung/SystemAnimatorOnline) 的骨骼映射机制：

1. **VMD 解析** — 使用 Three.js `MMDLoader.loadVMD` 解析 VMD 动作文件
2. **骨骼映射** — 通过 `bone_map_MMD_to_VRM` 将 MMD 日语骨骼名映射到 VRM Humanoid 标准骨骼名
3. **Cubic Bezier 插值** — 实现 VMD 原生的平滑关键帧插值
4. **表情映射** — MMD morph → VRM blendshape 映射
5. **音频同步** — 音频播放 + VMD 帧同步

## 使用

访问 https://jakcm.github.io/vrm-vmd-mobile/ 即可体验。