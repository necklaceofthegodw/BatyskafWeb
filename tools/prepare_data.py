"""Convert the audited campaign and spline control points to small browser JSON."""
import pathlib,json,re
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'WebGame/src/data';OUT.mkdir(parents=True,exist_ok=True)
source=json.loads((ROOT/'Docs/WebRewrite/dane-zrodlowe.json').read_text(encoding='utf-8'))
inventory=json.loads((ROOT/'Saved/Automation/WebRewrite/inventory.json').read_text(encoding='utf-8'))
splines={}
for a in inventory:
 if a['class']=='PipeSplineDataAsset':
  name=a['path'].split('/')[-1]
  splines[name]=a.get('properties',{}).get('values',{})
def ref_name(p):return p.split('/')[-1].split('.')[0]
levels=[]
for i,row in enumerate(source['campaign_catalog']):
 levels.append({'id':row['Name'],'pairs':[{'crossroad':int(re.search(r'(\d+)$',ref_name(c))[1]),'spline':ref_name(s)} for c,s in zip(row['CrossroadPipesystems'],row['SplinePipeSystems'])]})
data={'levels':levels,'splines':splines,'crossroads':source['crossroad_variants'],
 'upgrades':[{k:r[k] for k in ('UpgradeType','Cost','Value')} for r in source['upgrades']],
 'collectables':[{k:r[k] for k in ('Name','Type','MarketPrice','MinDepth')} for r in source['collectables']],
 'discs':[{k:r[k] for k in ('MinDepth','RequiredSpeed')} for r in source['discs']]}
(OUT/'source.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Prepared',len(levels),'levels,',len(splines),'source splines')
