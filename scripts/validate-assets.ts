import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import manifest from '../apps/web/src/capture/asset-manifest.json';
export function validateAssets() {
  const root = fileURLToPath(new URL('../apps/web/public', import.meta.url));
  if (
    JSON.stringify(JSON.parse(readFileSync(root + '/models/manifest.json', 'utf8'))) !==
    JSON.stringify(manifest)
  )
    throw new Error('Runtime and published model manifests differ');
  const results = manifest.assets.map((asset) => {
    const bytes = readFileSync(root + asset.uri),
      sha256 = createHash('sha256').update(bytes).digest('hex');
    if (
      bytes.toString('ascii', 0, 4) !== 'glTF' ||
      bytes.readUInt32LE(4) !== 2 ||
      bytes.readUInt32LE(8) !== bytes.length
    )
      throw new Error(`Invalid GLB header: ${asset.id}`);
    const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    const triangles = json.meshes.reduce(
      (sum: number, m: { primitives: { indices: number }[] }) =>
        sum + m.primitives.reduce((n, p) => n + json.accessors[p.indices].count / 3, 0),
      0,
    );
    if (sha256 !== asset.sha256 || bytes.length !== asset.bytes || triangles !== asset.triangles)
      throw new Error(`Asset manifest mismatch: ${asset.id}`);
    if (
      triangles > 55000 ||
      bytes.length > 3000000 ||
      json.animations?.length ||
      json.skins?.length
    )
      throw new Error(`Unexpected asset budget/rig: ${asset.id}`);
    if (
      json.buffers.some((b: { uri?: string }) => b.uri) ||
      json.images?.some((i: { uri?: string }) => i.uri)
    )
      throw new Error(`External dependency in GLB: ${asset.id}`);
    return { id: asset.id, triangles, bytes: bytes.length, sha256 };
  });
  if (
    manifest.sourceFiles.length !== 8 ||
    new Set(manifest.sourceFiles.map((s) => s.sha256)).size !== 7 ||
    results.length !== 7
  )
    throw new Error('Expected eight supplied sources and seven unique web assets');
  if (manifest.assets.find((a) => a.id === 'upper-stage')?.sourceAliases.length !== 2)
    throw new Error('Upper-stage duplicate is not represented');
  if (manifest.assets.find((a) => a.id === 'collector-split')?.parts !== 7)
    throw new Error('Segmented collector parts were lost');
  return {
    status: 'passed',
    assets: results,
    totalBytes: results.reduce((sum, a) => sum + a.bytes, 0),
  };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  console.log(JSON.stringify(validateAssets(), null, 2));
