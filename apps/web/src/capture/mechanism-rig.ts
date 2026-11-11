import * as THREE from 'three';
import { ARM_RIG, COLLECTOR_RIG, solvePlanarArm } from '@orbit/core/mechanism';

export interface ArticulatedArm {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  aim: (
    contactWorld: THREE.Vector3,
    closure: number,
  ) => { tip: THREE.Vector3; errorM: number; reachable: boolean };
}
const vector = (p: [number, number, number]) => new THREE.Vector3(...p);
const pointSegment = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
  const ab = b.clone().sub(a),
    t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return p.distanceTo(a.clone().addScaledVector(ab, t));
};
export function articulateArm(source: THREE.Object3D): ArticulatedArm {
  let original: THREE.Mesh | undefined;
  source.traverse((o) => {
    if (!original && o instanceof THREE.Mesh) original = o;
  });
  if (!original) throw new Error('Robotic arm mesh is missing');
  const geometry = original.geometry.clone(),
    positions = geometry.getAttribute('position');
  const B = vector(ARM_RIG.base),
    S = vector(ARM_RIG.shoulder),
    E = vector(ARM_RIG.elbow),
    W = vector(ARM_RIG.wrist),
    C = vector(ARM_RIG.contact);
  const indices = new Uint16Array(positions.count * 4),
    weights = new Float32Array(positions.count * 4),
    p = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    p.fromBufferAttribute(positions, i);
    let bone = 1,
      other = -1,
      blend = 0;
    if (p.z > 0.76) {
      bone = p.y > 0.3 ? 4 : 5;
    } else if (p.z > 0.49 && p.y < 0.58) {
      bone = 3;
    } else if (p.y < -0.43 && p.z < -0.35) {
      bone = 0;
    } else {
      bone = pointSegment(p, S, E) < pointSegment(p, E, W) ? 1 : 2;
      if (p.distanceTo(E) < 0.17) {
        other = bone === 1 ? 2 : 1;
        blend = 0.24;
      } else if (p.distanceTo(S) < 0.15) {
        other = 0;
        blend = 0.2;
      }
    }
    indices[i * 4] = bone;
    weights[i * 4] = 1 - blend;
    if (other >= 0) {
      indices[i * 4 + 1] = other;
      weights[i * 4 + 1] = blend;
    }
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const bones = Array.from({ length: 6 }, (_, i) => {
    const b = new THREE.Bone();
    b.name = [
      'base_yaw',
      'shoulder_pitch',
      'elbow_pitch',
      'wrist_pitch',
      'upper_finger',
      'lower_finger',
    ][i];
    return b;
  });
  bones[0].position.copy(B);
  bones[1].position.copy(S.clone().sub(B));
  bones[2].position.copy(E.clone().sub(S));
  bones[3].position.copy(W.clone().sub(E));
  bones[4].position.copy(vector(ARM_RIG.upperJaw).sub(W));
  bones[5].position.copy(vector(ARM_RIG.lowerJaw).sub(W));
  bones[0].add(bones[1]);
  bones[1].add(bones[2]);
  bones[2].add(bones[3]);
  bones[3].add(bones[4], bones[5]);
  const mesh = new THREE.SkinnedMesh(geometry, original.material);
  mesh.name = 'Articulated_Meshy_arm';
  mesh.frustumCulled = false;
  mesh.add(bones[0]);
  const root = new THREE.Group();
  root.name = 'Authored_Meshy_arm_rig';
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  const tip = new THREE.Object3D();
  tip.name = 'authored_grasp_anchor';
  tip.position.copy(C.clone().sub(W));
  bones[3].add(tip);
  const upper = E.distanceTo(S),
    lower = W.distanceTo(E),
    restUpper = Math.atan2(E.y - S.y, E.z - S.z),
    restElbow = Math.atan2(W.y - E.y, W.z - E.z) - restUpper;
  return {
    root,
    mesh,
    aim: (world, closure) => {
      root.updateMatrixWorld(true);
      const local = root.worldToLocal(world.clone()),
        delta = local.clone().sub(S),
        yaw = Math.atan2(delta.x, delta.z);
      bones[0].rotation.y = yaw;
      const shoulderLocal = B.clone().add(
        S.clone()
          .sub(B)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
      );
      const relative = local
        .clone()
        .sub(shoulderLocal)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
      const handAngle = Math.atan2(relative.y, relative.z) * 0.25,
        contactLength = C.distanceTo(W);
      const solution = solvePlanarArm(
        relative.y - Math.sin(handAngle) * contactLength,
        relative.z - Math.cos(handAngle) * contactLength,
        upper,
        lower,
      );
      const a = restUpper - solution.shoulder,
        b = restElbow - solution.elbow;
      bones[1].rotation.x = a;
      bones[2].rotation.x = b;
      bones[3].rotation.x = -handAngle - a - b;
      bones[4].rotation.x = THREE.MathUtils.lerp(-0.13, 0.2, closure);
      bones[5].rotation.x = THREE.MathUtils.lerp(0.13, -0.2, closure);
      root.updateMatrixWorld(true);
      const result = tip.getWorldPosition(new THREE.Vector3());
      return { tip: result, errorM: result.distanceTo(world), reachable: solution.reachable };
    },
  };
}
export interface CollectorMechanism {
  apply: (deployment: number, closure: number) => void;
  parts: string[];
}
export function articulateCollector(root: THREE.Object3D): CollectorMechanism {
  const joints = COLLECTOR_RIG.map((spec) => {
    const part = root.getObjectByName(spec.name);
    if (!part) throw new Error(`Collector segment missing: ${spec.name}`);
    const parent = part.parent!;
    const pivot = new THREE.Group();
    pivot.name = `hinge_${spec.name}`;
    pivot.position.fromArray(spec.pivot);
    parent.add(pivot);
    pivot.add(part);
    part.position.sub(pivot.position);
    return { pivot, spec };
  });
  return {
    parts: joints.map((j) => j.spec.name),
    apply: (deployment, closure) => {
      for (const { pivot, spec } of joints) {
        pivot.position.set(...spec.pivot);
        pivot.position.z += deployment * 0.675;
        pivot.rotation.y = spec.sign * THREE.MathUtils.lerp(0.7, 0.035, closure);
      }
    },
  };
}
