"""Create bounded web GLBs from the inspected Meshy scenes; never save sources.

blender --background --disable-autoexec --threads 2 --python \
  scripts/blender/export_assets.py -- SOURCE_DIR INSPECTION_JSON REPO_ROOT
The GLBs normalize the longest side to 2 viewer units, not measured metres.
"""
import bpy
import sys
import json
import math
import struct
import hashlib
from pathlib import Path
from mathutils import Vector, Matrix

source, inspection, root = [Path(a) for a in sys.argv[sys.argv.index('--')+1:]]
inspected=json.loads(inspection.read_text())
specs=[
    ('collector-lowpoly','Low-poly collector','collector','Meshy_AI_debris_collector_lowpoly_20261111_texture_remesh_tri.blend'),
    ('collector-detailed','Detailed collector','collector','Meshy_AI_debris_collector_robot_20261111_image-to-3d-texture.blend'),
    ('collector-split','Segmented collector','collector','Meshy_AI_debris_collector_split_20261111_part-segmentation_split.blend'),
    ('upper-stage','Upper-stage target','target','Meshy_AI_debris_target_upper_stage_20261111_image-to-3d-texture.blend'),
    ('irregular-debris','Irregular debris','target','Meshy_AI_lowpoly_orbital_debris_20261111_image-to-3d-texture.blend'),
    ('caging-arm','Caging robotic arm','equipment','Meshy_AI_modular_caging_robotic_arm_20261111_image-to-3d-texture.blend'),
    ('spacecraft-bus','Spacecraft bus target','target','Meshy_AI_orbital_debris_spacecraft_bus_20261111_image-to-3d-texture.blend'),
]
out=root/'apps/web/public/models'
out.mkdir(parents=True,exist_ok=True)
manifest={'version':1,'generator':f'Blender {bpy.app.version_string}',
          'classification':'user_supplied_concept_art',
          'normalization':'Longest side = 2 viewer units; runtime spans are explicit synthetic assumptions, not physical dimensions.',
          'animation':'Source files contain no rigs or actions. Rehearsal motion and gripper articulation are software-authored conceptual animation.',
          'sourceFiles':[{k:d[k] for k in ['file','sha256','bytes','meshCount','triangles','armatures','actions']} for d in inspected],
          'assets':[]}
for asset_id,label,role,name in specs:
    path=source/name
    original=next(d for d in inspected if d['file']==name)
    if hashlib.file_digest(path.open('rb'),'sha256').hexdigest()!=original['sha256']:
        raise RuntimeError(f'Source changed after inspection: {name}')
    bpy.ops.wm.open_mainfile(filepath=str(path),load_ui=False,use_scripts=False)
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render]
    corners=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
    low=Vector([min(v[i] for v in corners) for i in range(3)])
    high=Vector([max(v[i] for v in corners) for i in range(3)])
    center=(low+high)*0.5
    factor=2/max(high-low)
    transform=Matrix.Scale(factor,4)@Matrix.Translation(-center)
    total=original['triangles']
    for o in meshes:
        world=o.matrix_world.copy()
        o.data=o.data.copy()
        o.data.transform(transform@world)
        o.parent=None
        o.matrix_world=Matrix.Identity(4)
        o.hide_set(False)
        bpy.context.view_layer.objects.active=o
        if total>55000:
            modifier=o.modifiers.new('Web triangle budget','DECIMATE')
            modifier.ratio=55000/total
            modifier.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    for image in bpy.data.images:
        if image.type=='RENDER_RESULT' or not image.size[0]:continue
        w,h=image.size
        if max(w,h)>1024:
            ratio=1024/max(w,h)
            image.scale(max(1,round(w*ratio)),max(1,round(h*ratio)))
    bpy.context.scene.unit_settings.system='NONE'
    bpy.context.scene.unit_settings.scale_length=1
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    filepath=out/f'{asset_id}.glb'
    bpy.ops.export_scene.gltf(filepath=str(filepath),export_format='GLB',use_selection=True,
        export_animations=False,export_image_format='WEBP',export_image_quality=85,
        export_image_webp_fallback=False,export_draco_mesh_compression_enable=False,
        export_cameras=False,export_lights=False,export_extras=False)
    blob=filepath.read_bytes()
    length,chunk_type=struct.unpack_from('<I4s',blob,12)
    gltf=json.loads(blob[20:20+length])
    triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'] if 'indices' in p)
    asset={'id':asset_id,'label':label,'role':role,'uri':f'/models/{asset_id}.glb',
           'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),
           'triangles':triangles,'parts':len(meshes),'textureMaxSize':1024,
           'sourceAliases':[d['file'] for d in inspected if d['sha256']==original['sha256']],
           'sourceSha256':original['sha256'],'sourceTriangles':total,
           'sourceHasRig':False,'sourceHasAnimation':False,
           'extensions':gltf.get('extensionsUsed',[])}
    manifest['assets'].append(asset)
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('ASSET_EXPORTED '+json.dumps(asset),flush=True)
dest=root/'apps/web/src/capture'
dest.mkdir(parents=True,exist_ok=True)
(dest/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('EXPORT_COMPLETE '+json.dumps({'assets':len(manifest['assets']),'totalBytes':sum(a['bytes'] for a in manifest['assets'])}),flush=True)
