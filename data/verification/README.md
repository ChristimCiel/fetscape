# Paired reduced-thrust evidence

`weak-thrust-seed7.json` preserves two existing synthetic model runs referenced by the Fetscape 90-second script. The source hash identifies the original full research output. `apps/web/public/verification/weak-thrust-seed7.json` is its byte-identical browser copy.

The original model assumes commanded thrust; the revision uses simulator-provided degraded authority. Both inject a drop to 30% authority at 130 s. At 650 s, final separation is 59.52010643477721 m vs. 129.76978101130004 m, against the custom end criterion of 100 m. These values are final separation, not minimum distance, Pc or a guarantee of safe escape.

The independent research model and its tests are copied into `research/rpo` so this repo does not depend on a sibling checkout. It uses nonlinear point-mass inertial truth, HCW estimation, synthetic measurements and a simple controller. It is separate from the mechanism renderer and the kinematic 14 m scene. See the embedded `model.assumptions` and source header.

Optional rerun with Python and NumPy:

```bash
python3 -m pip install -r research/rpo/requirements.txt
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 scripts/verify-rpo-reference.py
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 -m unittest discover -s research/rpo
```

The app displays frozen replay data; it does not rerun this research model in the browser. No sensor or hardware fault diagnosis is established by the comparison.
