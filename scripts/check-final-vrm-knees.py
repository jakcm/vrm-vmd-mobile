#!/usr/bin/env python3
"""End-to-end regression check for the final VRM pose, not an intermediate BVH.

It opens the running viewer, samples the target VRM after
createVRMAnimationClip(), and tests the hip→knee→ankle bend vector against the
avatar's actual world-space forward axis. Positive means the knee points toward
the avatar front. The fixture uses 11 seconds, where both knees have a clear
bend in the supplied VMD.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = Path('/Users/admin/.hermes/profiles/agentplan/skills/software-development/dev/scripts/web-3d-screenshot.py')
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/?pose-test=1'

# Project the lower-leg direction off the upper-leg direction. This isolates the
# actual knee bend from the character's stance/lean. Dot with the world front.
EVAL = r'''(()=>{const sub=(a,b)=>a.map((x,i)=>x-b[i]);const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);const len=a=>Math.hypot(...a);const scale=(a,s)=>a.map(x=>x*s);const bend=(leg,f)=>{const u=sub(leg.knee,leg.hip),v=sub(leg.ankle,leg.knee),n=scale(u,1/len(u)),b=sub(v,scale(n,dot(v,n))),m=len(b);return {magnitude:m,forward:dot(b,f)/m}};const p=window.__vrmDanceDebug.samplePoseAt(11);return JSON.stringify({time:p.time,left:bend(p.left,p.forward),right:bend(p.right,p.forward)})})()'''

result = subprocess.run(
    ['python3', str(SCREENSHOT), '--url', URL, '--swiftshader', '--wait', '30', '--eval', EVAL, '--output', '/tmp/final-vrm-knees.png'],
    cwd=ROOT, text=True, capture_output=True, timeout=120,
)
print(result.stdout, end='')
if result.returncode:
    print(result.stderr, file=sys.stderr, end='')
    raise SystemExit(result.returncode)
match = re.search(r'🔍 Eval: (\{.*\})', result.stdout)
if not match:
    raise SystemExit('Could not read the live VRM knee probe result')
pose = json.loads(match.group(1))
print('Final VRM knee sample:', json.dumps(pose, indent=2))
for side in ('left', 'right'):
    knee = pose[side]
    if knee['magnitude'] < 0.10:
        raise SystemExit(f'{side} knee bend is too small for a meaningful orientation check: {knee}')
    if knee['forward'] <= 0.15:
        raise SystemExit(f'{side} knee bends backward in the final target VRM: {knee}')
print('PASS: both final VRM knees bend toward the character front')
