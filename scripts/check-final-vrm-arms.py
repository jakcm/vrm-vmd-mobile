#!/usr/bin/env python3
"""Verify final target-VRM arms at a known VMD pose.

Unlike BVH quaternion checks, this tests world positions after the complete
VMD → BVH → VRMA → createVRMAnimationClip pipeline. At 11 seconds both source
MMD arms are visibly down: elbow must be at least 5 cm lower than shoulder and
wrist must be lower than elbow for both sides.
"""
from __future__ import annotations
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = Path('/Users/admin/.hermes/profiles/agentplan/skills/software-development/dev/scripts/web-3d-screenshot.py')
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/?arm-test=1'
EVAL = "JSON.stringify(window.__vrmDanceDebug.samplePoseAt(11))"
result = subprocess.run(['python3', str(SCREENSHOT), '--url', URL, '--swiftshader', '--wait', '30', '--eval', EVAL, '--output', '/tmp/final-vrm-arms.png'], cwd=ROOT, text=True, capture_output=True, timeout=120)
print(result.stdout, end='')
if result.returncode:
    print(result.stderr, file=sys.stderr, end='')
    raise SystemExit(result.returncode)
match = re.search(r'🔍 Eval: (\{.*\})', result.stdout)
if not match:
    raise SystemExit('Could not read the final VRM arm probe')
pose = json.loads(match.group(1))
for side in ('left', 'right'):
    arm = pose[side]
    shoulder_y, elbow_y, wrist_y = arm['shoulder'][1], arm['elbow'][1], arm['wrist'][1]
    if elbow_y >= shoulder_y - 0.05:
        raise SystemExit(f'{side} upper arm points upward/backward in final VRM: shoulder={shoulder_y:.3f}, elbow={elbow_y:.3f}')
    if wrist_y >= elbow_y - 0.05:
        raise SystemExit(f'{side} forearm points upward in final VRM: elbow={elbow_y:.3f}, wrist={wrist_y:.3f}')
print('PASS: final VRM upper/lower arms point down at the known source pose')
