import { readFileSync } from 'node:fs';
import * as THREE from 'three';
/** Actual supplied positions only; no texture decoding or WebGL needed in numerical tests. */
export function glbGeometry(id: string) {
  const blob = readFileSync(`apps/web/public/models/${id}.glb`),
    jsonLength = blob.readUInt32LE(12),
    data = JSON.parse(blob.toString('utf8', 20, 20 + jsonLength)),
    binary = 28 + jsonLength,
    root = new THREE.Group();
  for (const node of data.nodes) {
    if (node.mesh === undefined) continue;
    const primitive = data.meshes[node.mesh].primitives[0],
      accessor = data.accessors[primitive.attributes.POSITION],
      view = data.bufferViews[accessor.bufferView];
    if (accessor.componentType !== 5126) throw new Error('Expected float positions');
    const start = binary + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0),
      values = new Float32Array(accessor.count * 3);
    for (let i = 0; i < values.length; i++) values[i] = blob.readFloatLE(start + i * 4);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.name = node.name;
    root.add(mesh);
  }
  return root;
}
