import { it, expect } from 'vitest';
import * as THREE from 'three';
import { glbGeometry } from './helpers/glb-geometry';
import { articulateArm, articulateCollector } from '../apps/web/src/capture/mechanism-rig';
it('deforms the actual supplied robotic-arm vertices through authored bones', () => {
  const source = glbGeometry('caging-arm'),
    rig = articulateArm(source),
    position = rig.mesh.geometry.getAttribute('position'),
    skin = rig.mesh.geometry.getAttribute('skinIndex');
  expect(rig.mesh.skeleton.bones.map((b) => b.name)).toContain('elbow_pitch');
  expect(position.count).toBe(
    (source.children[0] as THREE.Mesh).geometry.getAttribute('position').count,
  );
  let index = 0;
  while (index < position.count && skin.getX(index) !== 2) index++;
  expect(index).toBeLessThan(position.count);
  rig.aim(new THREE.Vector3(0, 0.2, 0.9), 0);
  const before = rig.mesh.applyBoneTransform(
    index,
    new THREE.Vector3().fromBufferAttribute(position, index),
  );
  const report = rig.aim(new THREE.Vector3(0, 0.2, 1.4), 1),
    after = rig.mesh.applyBoneTransform(
      index,
      new THREE.Vector3().fromBufferAttribute(position, index),
    );
  expect(before.distanceTo(after)).toBeGreaterThan(0.03);
  expect(report.errorM).toBeLessThan(0.04);
  expect(report.reachable).toBe(true);
});
it('opens, deploys and closes the two real segmented collector meshes', () => {
  const root = glbGeometry('collector-split'),
    rig = articulateCollector(root);
  const centers = () =>
    rig.parts.map((name) => {
      root.updateMatrixWorld(true);
      return new THREE.Box3()
        .setFromObject(root.getObjectByName(name)!)
        .getCenter(new THREE.Vector3());
    });
  rig.apply(0, 0);
  const open = centers();
  rig.apply(0, 1);
  const closed = centers();
  expect(Math.abs(open[1].x - open[0].x)).toBeGreaterThan(Math.abs(closed[1].x - closed[0].x));
  rig.apply(1, 1);
  const deployed = centers();
  expect(deployed[0].z - closed[0].z).toBeCloseTo(0.675, 6);
  expect(rig.parts).toEqual(['model_part3', 'model_part4']);
});
