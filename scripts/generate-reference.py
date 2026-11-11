"""Regenerate independent reference states with python-sgp4==2.27.

Optional maintenance tool, not the app runtime. Full-precision public GP epochs
are retained here to reveal satellite.js/JavaScript's millisecond quantization.
No network calls. Source elements are already frozen in this repository.
"""
from pathlib import Path
from datetime import datetime, timezone, timedelta
import hashlib
import json
from sgp4 import omm, __version__
from sgp4.api import Satrec, jday

ROOT = Path(__file__).resolve().parent.parent
raw = (ROOT / 'data/public-omm.json').read_bytes()
rows = json.loads(raw)
cases = []
for row in rows:
    if row['NORAD_CAT_ID'] not in {25544, 48274, 49271, 66906}:
        continue
    fields = dict(row)
    sat = Satrec()
    omm.initialize(sat, fields)
    epoch = datetime.fromisoformat(row['EPOCH']).replace(tzinfo=timezone.utc)
    # Evaluation instants exactly representable as JS milliseconds; the source
    # epoch still uses microseconds, exposing the input initialization difference.
    t0 = epoch.replace(microsecond=epoch.microsecond // 1000 * 1000)
    for offset in [0, 3600, 86400]:
        t = t0 + timedelta(seconds=offset)
        jd, fr = jday(t.year, t.month, t.day, t.hour, t.minute, t.second + t.microsecond/1e6)
        error, position, velocity = sat.sgp4(jd, fr)
        if error:
            raise RuntimeError((row['NORAD_CAT_ID'], t, error))
        cases.append({'type':'omm', 'catalogId':row['NORAD_CAT_ID'], 'utc':t.isoformat(timespec='milliseconds').replace('+00:00','Z'), 'positionKm':position, 'velocityKmS':velocity})

tle_pairs = [
    ['1 00005U 58002B   00179.78495062  .00000023  00000-0  28098-4 0  4753',
     '2 00005  34.2682 348.7242 1859667 331.7664  19.3264 10.82419157413667'],
    ['1 04632U 70093B   04031.91070959 -.00000084  00000-0  10000-3 0  9955',
     '2 04632  11.4628 273.1101 1450506 207.6000 143.9350  1.20231981 44145'],
]
for pair in tle_pairs:
    sat = Satrec.twoline2rv(*pair)
    epoch = datetime.fromtimestamp((sat.jdsatepoch + sat.jdsatepochF - 2440587.5)*86400, timezone.utc)
    t0 = epoch.replace(microsecond=epoch.microsecond // 1000 * 1000)
    for offset in [0, 3600, 86400]:
        t=t0+timedelta(seconds=offset)
        jd,fr=jday(t.year,t.month,t.day,t.hour,t.minute,t.second+t.microsecond/1e6)
        error,position,velocity=sat.sgp4(jd,fr)
        if error:raise RuntimeError((pair,t,error))
        cases.append({'type':'tle','catalogId':sat.satnum,'utc':t.isoformat(timespec='milliseconds').replace('+00:00','Z'),'positionKm':position,'velocityKmS':velocity})

output={'library':'python-sgp4','version':__version__,'gravity':'WGS72','mode':'i',
        'inputFileSha256':hashlib.sha256(raw).hexdigest(),
        'referenceSource':'https://celestrak.org/publications/AIAA/2006-6753/',
        'tlePairs':tle_pairs,'cases':cases,
        'limits':'Implementation comparison only, not orbit truth. OMM keeps microsecond source epochs here; satellite.js initializes those epochs with JS millisecond dates. Tolerances distinguish those cases.'}
(ROOT/'tests/fixtures/sgp4-reference.json').write_text(json.dumps(output,indent=2)+'\n')
print(f'Generated {len(cases)} independent near/deep-space and public GP states with python-sgp4 {__version__}')
