"""Blender 2.93: locally convert copies of UE/ArtSource assets into compact GLB."""
import bpy,pathlib,math,json
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'WebGame/public/models';OUT.mkdir(parents=True,exist_ok=True)
UE=ROOT/'Saved/Automation/WebRewrite/web-assets'
report=[]

def reset():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def export(name):
 bpy.ops.object.select_all(action='DESELECT')
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 for o in meshes:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,
   export_animations=False,export_cameras=False,export_lights=False,export_yup=True)
 report.append({'name':name,'vertices':sum(len(o.data.vertices) for o in meshes),'bytes':(OUT/(name+'.glb')).stat().st_size})

for name in ['submarine','fish']:
 reset();bpy.ops.import_scene.fbx(filepath=str(UE/(name+'.fbx')))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();o=bpy.context.object
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 # Normalize length; imported Unreal forward X becomes Blender -Y for glTF +Z.
 box=[o.matrix_world@Vector(c) for c in o.bound_box]
 lo=Vector(tuple(min(p[k] for p in box) for k in range(3)));hi=Vector(tuple(max(p[k] for p in box) for k in range(3)))
 center=(lo+hi)*.5;longest=max(range(3),key=lambda k:hi[k]-lo[k])
 for v in o.data.vertices:v.co-=center
 if longest==0:o.rotation_euler.z=-math.pi/2
 elif longest==2:o.rotation_euler.x=math.pi/2
 target=4.8 if name=='submarine' else 3.4
 factor=target/(hi[longest]-lo[longest]);o.scale=(factor,)*3
 o.location=(0,0,0)
 for m in o.data.materials:
  if not m:continue
  m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF')
  if bs:
   bs.inputs['Base Color'].default_value=(.53,.29,.055,1) if name=='submarine' else (.07,.46,.40,1)
   bs.inputs['Metallic'].default_value=.65 if name=='submarine' else .05
   bs.inputs['Roughness'].default_value=.38 if name=='submarine' else .7
 export(name)

for blend,names in [('ArtSource/LowPolyTrees/LowPolyTrees.blend',['SM_Tree_Round','SM_Tree_Lime','SM_Tree_Sage']),('ArtSource/EcoSanctuary/EcoSanctuary.blend',['SM_Eco_Broadleaf','SM_Eco_FanPlant','SM_Eco_ShoreRock'])]:
 for name in names:
  reset()
  with bpy.data.libraries.load(str(ROOT/blend),link=False) as (src,dst):dst.objects=[name]
  for o in dst.objects:
   if o:bpy.context.collection.objects.link(o);o.hide_set(False);o.hide_viewport=False;o.location=(0,0,0)
  export(name)
(OUT/'manifest.json').write_text(json.dumps(report,indent=2))
print('GLB_EXPORTS',report)
