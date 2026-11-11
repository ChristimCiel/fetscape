"""Optional independent rerun of the script's paired seed-7 study, not the 3D engine."""
from pathlib import Path
import json
import sys
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'research/rpo'))
from simulate import run, Config

data = json.loads((ROOT / 'data/verification/weak-thrust-seed7.json').read_text())
results = []
for label, health in [('baseline', False), ('revised', True)]:
    output = run('weak_thrust', 7, Config(health_aware=health))
    error = abs(output['final_range_m'] - data[label]['final_range_m'])
    if error > 1e-4 or output['outcome'] != data[label]['outcome']:
        raise AssertionError((label, output['final_range_m'], error, output['outcome']))
    results.append({'model':label, 'finalRangeM':output['final_range_m'], 'outcome':output['outcome'], 'deltaM':error})
print(json.dumps({'status':'passed', 'scenario':'weak_thrust', 'seed':7, 'results':results}, indent=2))
