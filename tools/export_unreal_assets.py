"""Run using UnrealEditor-Cmd -run=pythonscript. Exports copies, never saves UE assets."""
import unreal,pathlib,json
ROOT=pathlib.Path(unreal.Paths.project_dir())
OUT=ROOT/'Saved/Automation/WebRewrite/web-assets';OUT.mkdir(parents=True,exist_ok=True)
assets={
 'submarine':'/Game/Batyscaphe/Models/BatyskafParts/batyskaf_base1',
 'propeller':'/Game/Batyscaphe/Models/BatyskafParts/batyskaf_smiglo1',
 'fish':'/Game/Batyscaphe/Models/LowPolyFish/SM_LP_Grouper_VA',
}
# Find original mesh paths through the existing read-only audit if folder names differ.
audit=ROOT/'Saved/Automation/WebRewrite/blueprints'
for name,token,key in [('BP_SubmarinePawn','SM_Submarine','submarine'),('BP_SubmarinePawn','SM_Propeller','propeller'),('BP_UpgradeController','Cube','fish')]:
 r=json.loads((audit/(name+'.json')).read_text(encoding='utf-8'))
 for c in r.get('components',[]):
  if token.lower() in c['name'].lower():
   mesh=c.get('properties',{}).get('values',{}).get('staticMesh')
   if isinstance(mesh,dict):assets[key]=mesh['refPath']
report=[]
for key,path in assets.items():
 mesh=unreal.load_asset(path)
 if not isinstance(mesh,unreal.StaticMesh):report.append({'name':key,'path':path,'exported':False});continue
 task=unreal.AssetExportTask();task.object=mesh;task.filename=str(OUT/(key+'.fbx'))
 task.automated=True;task.prompt=False;task.replace_identical=True
 task.exporter=unreal.StaticMeshExporterFBX()
 opt=unreal.FbxExportOption();opt.ascii=False;opt.collision=False;opt.level_of_detail=False
 task.options=opt
 ok=unreal.Exporter.run_asset_export_task(task)
 report.append({'name':key,'path':path,'exported':ok})
(OUT/'manifest.json').write_text(json.dumps(report,indent=2))
print('WEB_ASSETS_EXPORTED',report)
