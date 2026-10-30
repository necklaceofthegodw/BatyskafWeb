"""Convert measured original Blueprint socket positions to connected center lines."""
import json,pathlib,math
root=pathlib.Path(__file__).resolve().parents[2]
data=json.loads((root/'Saved/Automation/WebRewrite/crossroad-geometry.json').read_text(encoding='utf-8-sig'))
def middle(a,b):return {k:(a[k]+b[k])/2 for k in 'xyz'}
def compact(points):
 result=[]
 for p in points:
  if not result or math.dist(tuple(p.values()),tuple(result[-1].values()))>500:result.append(p)
 return result
result={}
for key,meshes in data.items():
 start=meshes[0]['sockets']; end_index=next(i for i,m in enumerate(meshes) if 'SM_PipeCrossroad.' in m['mesh']);end=meshes[end_index]['sockets']
 left=[start['Socket3'],middle(start['Socket1'],start['Socket2']),start['Socket2']]
 for m in meshes[1:end_index]:left.extend([m['sockets']['Socket1'],m['sockets']['Socket2']])
 left.extend([end['Socket1'],middle(end['Socket1'],end['Socket2']),end['Socket3']])
 right=[start['Socket3'],middle(start['Socket1'],start['Socket2']),start['Socket1']]
 for m in reversed(meshes[end_index+1:]):right.extend([m['sockets']['Socket2'],m['sockets']['Socket1']])
 right.extend([end['Socket2'],middle(end['Socket1'],end['Socket2']),end['Socket3']])
 result[key]={'left':compact(left),'right':compact(right),'entry':start['Socket3'],'exit':end['Socket3']}
(root/'WebGame/src/data/crossroads.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
print('Prepared seven original crossroad center lines')
