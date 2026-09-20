"""Start both agents locally (works on Windows, Mac, and Linux).

Run from inside the agents/ folder:
    python run_all.py
Stop with Ctrl+C.
"""
import os
import subprocess
import sys

AGENTS = {"dining": 8001, "transit": 8002}

procs = []
for agent_id, port in AGENTS.items():
    env = dict(os.environ, AGENT_ID=agent_id)
    cmd = [sys.executable, "-m", "uvicorn", "main:app", "--port", str(port)]
    procs.append(subprocess.Popen(cmd, env=env))
    print(f"started {agent_id} on http://localhost:{port}")

try:
    for p in procs:
        p.wait()
except KeyboardInterrupt:
    for p in procs:
        p.terminate()
