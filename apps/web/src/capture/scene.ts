import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { CaptureState } from '@orbit/core/capture';
import { CAPTURE_RULES } from '@orbit/core/capture';
import { mechanismCycle, ARM_RIG } from '@orbit/core/mechanism';
import { articulateArm, articulateCollector } from './mechanism-rig';
import type { ArticulatedArm, CollectorMechanism } from './mechanism-rig';
import manifest from './asset-manifest.json';
import { assetUrl } from '../deployment';

export type AssetId = (typeof manifest.assets)[number]['id'];
export type SceneStatus = {
  slot: string;
  id: string;
  status: 'loading' | 'ready' | 'error';
  error?: string;
};
export interface CaptureScene {
  render: (state: CaptureState) => void;
  load: (slot: 'collector' | 'target', id: string) => void;
  preview: (id: string | null) => void;
  explode: (fraction: number) => void;
  resize: () => void;
  dispose: () => void;
  cameraMode: (mode: 'first-person' | 'mechanism') => void;
  evidence: () => MechanismEvidence;
}
export interface MechanismEvidence {
  stage: string;
  collectorSegments: string[];
  arms: {
    tip: number[];
    graspPoint: number[];
    errorM: number;
    trackingErrorM: number;
    reachable: boolean;
  }[];
  basis: string;
}
function release(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
    if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line) {
      if (o.geometry) geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (m) {
          materials.add(m);
          Object.values(m).forEach((v) => {
            if (v instanceof THREE.Texture) textures.add(v);
          });
        }
    }
  });
  geometries.forEach((g) => g.dispose());
  textures.forEach((t) => {
    t.dispose();
    const image = t.image as { close?: () => void } | undefined;
    image?.close?.();
  });
  materials.forEach((m) => m.dispose());
}
function earthTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(1024, 512);
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 1024; x++) {
      const u = (x / 1024) * Math.PI * 2,
        v = (y / 512) * Math.PI;
      const terrain =
        Math.sin(u * 2.1 + Math.sin(v * 3) * 1.8) +
        Math.cos(v * 5.2 + u * 0.7) * 0.55 +
        Math.sin(u * 9 - v * 7) * 0.17;
      const cloud =
        Math.max(0, Math.sin(u * 13 + Math.sin(v * 17) * 2) * Math.cos(v * 23 - u * 5) - 0.22) *
        0.55;
      const land = terrain > 0.63 && y > 35 && y < 480,
        ice = y < 15 || y > 494;
      const rgb = ice
        ? [155, 179, 181]
        : land
          ? [44 + terrain * 10, 83 + terrain * 10, 77]
          : [17, 48 + Math.sin(v) * 14, 78 + Math.sin(v) * 17];
      const index = (y * 1024 + x) * 4;
      for (let c = 0; c < 3; c++) image.data[index + c] = rgb[c] * (1 - cloud) + 220 * cloud;
      image.data[index + 3] = 255;
    }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function createCaptureScene(
  canvas: HTMLCanvasElement,
  onStatus: (s: SceneStatus) => void,
  onLost: () => void,
): CaptureScene {
  let disposed = false,
    previewId: string | null = null,
    previewRotation = 0,
    explosion = 0;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030a12');
  const camera = new THREE.PerspectiveCamera(55, 1, 0.035, 60000);
  camera.rotation.order = 'YXZ';
  const environment = new RoomEnvironment(),
    pmrem = new THREE.PMREMGenerator(renderer),
    env = pmrem.fromScene(environment, 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.45;
  environment.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xc7e4ff, 0x274b6b, 1.3));
  const sunlight = new THREE.DirectionalLight(0xfff2d9, 3.2);
  sunlight.position.set(-7, 10, 8);
  scene.add(sunlight);
  const rim = new THREE.DirectionalLight(0x73c9ff, 2);
  rim.position.set(7, 3, -8);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xe0f4ff, 1);
  fill.position.set(0, -1, 5);
  scene.add(fill);
  let seed = 317;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const stars = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) {
    const a = random() * Math.PI * 2,
      z = random() * 2 - 1,
      r = Math.sqrt(1 - z * z);
    stars.set([r * Math.cos(a) * 35000, z * 35000, r * Math.sin(a) * 35000], i * 3);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  const starfield = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0xc8dcf1,
      size: 1.1,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  );
  scene.add(starfield);
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(6378, 64, 40),
    new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 1, metalness: 0 }),
  );
  planet.position.set(2600, -7600, -7000);
  planet.rotation.set(0.4, 1.6, 0.1);
  scene.add(planet);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(6412, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x5bb8eb,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  atmosphere.position.copy(planet.position);
  scene.add(atmosphere);
  const pilot = new THREE.Group(),
    targetRoot = new THREE.Group(),
    previewRoot = new THREE.Group();
  scene.add(pilot, targetRoot, previewRoot);
  pilot.rotation.order = 'YXZ';
  targetRoot.rotation.order = 'XYZ';
  previewRoot.position.set(0, 0, -4.1);
  previewRoot.visible = false;
  const collectorMount = new THREE.Group();
  collectorMount.position.set(0, 0.35, 1.8);
  pilot.add(collectorMount);
  const armMount = new THREE.Group();
  pilot.add(armMount);
  let articulatedArms: ArticulatedArm[] = [],
    collectorMechanism: CollectorMechanism | null = null,
    cameraMode: 'first-person' | 'mechanism' = 'first-person';
  let evidence: MechanismEvidence = {
    stage: 'stowed',
    collectorSegments: [],
    arms: [],
    basis: ARM_RIG.basis,
  };
  const markers = [-1, 1].map((sign) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0x8ee4c5 }),
    );
    mesh.position.set(sign * 0.55, -0.1, 0.55);
    targetRoot.add(mesh);
    return mesh;
  });
  const loader = new GLTFLoader(),
    loads = new Map<string, { version: number; controller: AbortController }>(),
    attached = new Map<string, THREE.Object3D>();
  let version = 0;
  const disposeSlot = (slot: string) => {
    const old = attached.get(slot);
    if (old) {
      old.removeFromParent();
      release(old);
      attached.delete(slot);
    }
  };
  async function load(slot: 'collector' | 'target' | 'arms' | 'preview', id: string) {
    const asset = manifest.assets.find((a) => a.id === id);
    if (!asset) return;
    loads.get(slot)?.controller.abort();
    const controller = new AbortController(),
      current = ++version;
    loads.set(slot, { version: current, controller });
    onStatus({ slot, id, status: 'loading' });
    try {
      const response = await fetch(assetUrl(asset.uri), { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const gltf = await loader.parseAsync(await response.arrayBuffer(), assetUrl('models/'));
      if (disposed || loads.get(slot)?.version !== current) {
        release(gltf.scene);
        return;
      }
      disposeSlot(slot);
      const object = gltf.scene;
      object.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.frustumCulled = true;
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            if (m instanceof THREE.MeshStandardMaterial) {
              m.envMapIntensity = 0.65;
              m.roughness = Math.max(0.22, m.roughness);
            }
        }
      });
      if (slot === 'target') {
        object.scale.setScalar(CAPTURE_RULES.targetLongestSideM / 2);
        if (id === 'spacecraft-bus') object.rotation.x = Math.PI / 2;
        else object.rotation.z = Math.PI / 2;
        object.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
        markers.forEach((m, i) =>
          m.position.set((i === 0 ? -1 : 1) * bounds.x * 0.43, -0.1, bounds.z * 0.47),
        );
        targetRoot.add(object);
      } else if (slot === 'collector') {
        object.scale.setScalar(4);
        object.rotation.y = Math.PI;
        collectorMount.add(object);
        collectorMechanism = id === 'collector-split' ? articulateCollector(object) : null;
      } else if (slot === 'arms') {
        const assembly = new THREE.Group();
        articulatedArms = [-1, 1].map((sign) => {
          const arm = articulateArm(object);
          arm.root.scale.setScalar(2);
          arm.root.rotation.y = Math.PI;
          const shoulder = new THREE.Vector3(...ARM_RIG.shoulder)
            .multiplyScalar(2)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
          arm.root.position.copy(new THREE.Vector3(sign * 1.55, -0.55, -0.15).sub(shoulder));
          assembly.add(arm.root);
          return arm;
        });
        object.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        armMount.add(assembly);
        attached.set(slot, assembly);
        onStatus({ slot, id, status: 'ready' });
        return;
      } else {
        previewRoot.add(object);
        object.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.computeBoundingBox();
            const center = o.geometry.boundingBox!.getCenter(new THREE.Vector3());
            o.userData.basePosition = o.position.clone();
            o.userData.explodeDirection =
              center.length() > 0.01 ? center.normalize() : new THREE.Vector3(0, 1, 0);
          }
        });
      }
      attached.set(slot, object);
      onStatus({ slot, id, status: 'ready' });
    } catch (error) {
      if (disposed || controller.signal.aborted) return;
      onStatus({ slot, id, status: 'error', error: (error as Error).message });
    }
  }
  void load('arms', 'caging-arm');
  const resize = () => {
    if (disposed) return;
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const contextLost = (e: Event) => {
    e.preventDefault();
    onLost();
  };
  canvas.addEventListener('webglcontextlost', contextLost);
  return {
    cameraMode: (mode) => {
      cameraMode = mode;
    },
    evidence: () => evidence,
    load: (slot, id) => {
      void load(slot, id);
    },
    resize,
    preview: (id) => {
      previewId = id;
      previewRoot.visible = !!id;
      pilot.visible = !id;
      targetRoot.visible = !id;
      planet.visible = !id;
      atmosphere.visible = !id;
      if (id) void load('preview', id);
      else {
        loads.get('preview')?.controller.abort();
        disposeSlot('preview');
      }
    },
    explode: (fraction) => {
      explosion = fraction;
    },
    render: (state) => {
      if (disposed) return;
      if (previewId) {
        camera.position.set(0, 0.15, 0);
        camera.rotation.set(0, 0, 0);
        previewRotation += 0.0025;
        previewRoot.rotation.set(0.18, previewRotation, 0);
        previewRoot.traverse((o) => {
          if (o instanceof THREE.Mesh && o.userData.basePosition) {
            o.position
              .copy(o.userData.basePosition)
              .addScaledVector(o.userData.explodeDirection, explosion * 0.4);
          }
        });
      } else {
        pilot.position.fromArray(state.position);
        pilot.rotation.set(state.pitch, state.yaw, state.roll, 'YXZ');
        if (cameraMode === 'first-person') {
          camera.position.fromArray(state.position);
          camera.rotation.copy(pilot.rotation);
          camera.fov = 70;
        } else {
          camera.position.copy(pilot.localToWorld(new THREE.Vector3(7, 3.6, 5)));
          camera.lookAt(pilot.localToWorld(new THREE.Vector3(0, 0, -1.8)));
          camera.fov = 43;
        }
        camera.updateProjectionMatrix();
        targetRoot.position.fromArray(state.targetPosition);
        targetRoot.rotation.set(...state.targetEuler);
        targetRoot.updateMatrixWorld(true);
        pilot.updateMatrixWorld(true);
        const cycle = mechanismCycle(state.captureProgress),
          active = state.phase === 'capturing' || state.phase === 'secured';
        collectorMechanism?.apply(active ? cycle.deploy : 0, active ? cycle.collectorClosure : 0);
        const armEvidence = articulatedArms.map((arm, i) => {
          const grasp = markers[i].getWorldPosition(new THREE.Vector3());
          const stowed = pilot.localToWorld(
            new THREE.Vector3((i === 0 ? -1 : 1) * 1.9, -0.6, -1.6),
          );
          const amount = active ? cycle.tracking : state.phase === 'hold' ? 0.18 : 0;
          const goal = stowed.lerp(grasp, amount),
            result = arm.aim(goal, active ? cycle.fingerClosure : 0);
          return {
            tip: result.tip.toArray(),
            graspPoint: grasp.toArray(),
            errorM: result.errorM,
            trackingErrorM: result.tip.distanceTo(grasp),
            reachable: result.reachable,
          };
        });
        markers.forEach((m) => (m.visible = state.phase !== 'secured'));
        evidence = {
          stage: active ? cycle.stage : 'stowed',
          collectorSegments: collectorMechanism?.parts ?? [],
          arms: armEvidence,
          basis: ARM_RIG.basis,
        };
      }
      renderer.render(scene, camera);
    },
    dispose: () => {
      disposed = true;
      loads.forEach((l) => l.controller.abort());
      canvas.removeEventListener('webglcontextlost', contextLost);
      release(scene);
      env.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
