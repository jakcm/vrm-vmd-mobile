#!/usr/bin/env python3
"""End-to-end check that curled fingers bend toward the palm, not the hand back."""
from __future__ import annotations
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT = Path('/Users/admin/.hermes/profiles/agentplan/skills/software-development/dev/scripts/web-3d-screenshot.py')
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/?finger-test=1'
# Frame 2081 / 30: both index fingers have their largest authored curl.
EVAL = 'JSON.stringify(window.__vrmDanceDebug.samplePoseAt(69.3667))'
result = subprocess.run(['python3', str(SCREENSHOT), '--url', URL, '--swiftshader', '--wait', '30', '--eval', EVAL, '--output', '/tmp/final-vrm-fingers.png'], cwd=ROOT, text=True, capture_output=True, timeout=120)
print(result.stdout, end='')
if result.returncode:
    print(result.stderr, file=sys.stderr, end='')
    raise SystemExit(result.returncode)
match = re.search(r'🔍 Eval: (\{.*\})', result.stdout)
if not match:
    raise SystemExit('Could not read final VRM finger pose')
pose = json.loads(match.group(1))
# At the known VMD curl frame, each proximal→intermediate link must lead toward
# the palm (lower Y) instead of lifting toward the hand back (higher Y).
for side in ('left', 'right'):
    for finger in ('index', 'middle'):
        chain = pose[side][finger]
        dy = chain['intermediate'][1] - chain['proximal'][1]
        if dy >= -0.002:
            raise SystemExit(f'{side} {finger} curls toward the hand back in final VRM: proximal.y={chain["proximal"][1]:.3f}, intermediate.y={chain["intermediate"][1]:.3f}')
print('PASS: final VRM index/middle fingers curl toward the palm')
