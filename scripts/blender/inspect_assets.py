"""Read user-supplied scenes without running embedded Python or saving originals.
Run: blender --background --disable-autoexec --python ... -- INPUT_DIR OUT_JSON
"""
import bpy
import sys
import json
import hashlib
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
source, destination = Path(args[0]), Path(args[1])
names = [
    'Meshy_AI_debris_collector_lowpoly_20261111_texture_remesh_tri.blend',
    'Meshy_AI_debris_collector_robot_20261111_image-to-3d-texture.blend',
    'Meshy_AI_debris_collector_split_20261111_part-segmentation_split.blend',
    'Meshy_AI_debris_target_upper_stage_20261111_image-to-3d-texture (1).blend',
    'Meshy_AI_debris_target_upper_stage_20261111_image-to-3d-texture.blend',
    'Meshy_AI_lowpoly_orbital_debris_20261111_image-to-3d-texture.blend',
    'Meshy_AI_modular_caging_robotic_arm_20261111_image-to-3d-texture.blend',
    'Meshy_AI_orbital_debris_spacecraft_bus_20261111_image-to-3d-texture.blend',
]
results=[]
for name in names:
    path=source/name
    digest=hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(path), load_ui=False, use_scripts=False)
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.hide_render]
    points=[o.matrix_world @ Vector(corner) for o in meshes for corner in o.bound_box]
    minimum=[min(v[i] for v in points) for i in range(3)] if points else [0,0,0]
    maximum=[max(v[i] for v in points) for i in range(3)] if points else [0,0,0]
    data={
        'file':name,'sha256':digest,'bytes':path.stat().st_size,
        'meshCount':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),
        'triangles':sum(sum(max(0,len(p.vertices)-2) for p in o.data.polygons) for o in meshes),
        'bounds':{'min':minimum,'max':maximum,'dimensions':[maximum[i]-minimum[i] for i in range(3)]},
        'objects':[{'name':o.name,'vertices':len(o.data.vertices),'materials':[m.name for m in o.data.materials if m],'dimensions':list(o.dimensions),'location':list(o.location),'rotation':list(o.rotation_euler)} for o in meshes],
        'images':[{'name':i.name,'size':list(i.size),'packed':bool(i.packed_file),'source':i.source} for i in bpy.data.images if i.type!='RENDER_RESULT'],
        'armatures':[o.name for o in bpy.context.scene.objects if o.type=='ARMATURE'],
        'actions':[a.name for a in bpy.data.actions],
        'embeddedTextBlocks':[t.name for t in bpy.data.texts],
        'unitSystem':bpy.context.scene.unit_settings.system,
        'unitScale':bpy.context.scene.unit_settings.scale_length,
    }
    results.append(data)
    destination.write_text(json.dumps(results,indent=2)+'\n')
    print('ASSET_INSPECTED '+json.dumps({k:data[k] for k in ['file','meshCount','vertices','triangles','armatures','actions']}),flush=True)
