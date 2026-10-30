"""Original faceted marine collection. Deterministic, dependency-free GLB authoring.

One indexed vertex-colour primitive per asset: shared geometry/material on instances,
no texture downloads. Coordinates: metres, Y up, +Z nose. Runtime corrects glTF handedness.
"""
import json, math, struct
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / 'public' / 'models'
TAU = math.tau
GOLD, LIGHT, TEAL, INK, WHITE = '#dca44c', '#ffe1a0', '#207d89', '#173d50', '#e3eee5'
REPORT = []

def add(a,b): return tuple(x+y for x,y in zip(a,b))
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def mul(a,s): return tuple(x*s for x in a)
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def unit(a): return mul(a,1/max(1e-9,math.sqrt(sum(x*x for x in a))))
def rgb(h): return tuple(int(h[i:i+2],16)/255 for i in (1,3,5))

class Model:
    def __init__(self): self.vertices=[]; self.normals=[]; self.colors=[]; self.indices=[]; self.lookup={}
    def tri(self,a,b,c,col):
        n=unit(cross(sub(b,a),sub(c,a)))
        if sum(x*x for x in n)<.5: return
        for p in (a,b,c):
            key=tuple(round(x,6) for x in (*p,*n,*rgb(col)))
            if key not in self.lookup:
                self.lookup[key]=len(self.vertices); self.vertices.append(p); self.normals.append(n); self.colors.append((*rgb(col),1))
            self.indices.append(self.lookup[key])
    def quad(self,a,b,c,d,col): self.tri(a,b,c,col); self.tri(a,c,d,col)
    def ball(self,p,s,col,n=12,rings=7):
        def pt(i,j):
            a=TAU*i/n; b=math.pi*j/rings
            return add(p,(s[0]*math.sin(b)*math.cos(a),s[1]*math.cos(b),s[2]*math.sin(b)*math.sin(a)))
        for j in range(rings):
            for i in range(n): self.quad(pt(i,j),pt(i+1,j),pt(i+1,j+1),pt(i,j+1),col)
    def box(self,p,s,col):
        v=[add(p,(x*s[0]/2,y*s[1]/2,z*s[2]/2)) for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
        for ids in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)]: self.quad(*(v[i] for i in ids),col)
    def rod(self,a,b,r1,r2,col,n=8):
        axis=unit(sub(b,a)); u=unit(cross(axis,(1,0,0) if abs(axis[0])<.8 else (0,1,0))); v=cross(axis,u)
        def pt(p,r,i): return add(p,add(mul(u,r*math.cos(i*TAU/n)),mul(v,r*math.sin(i*TAU/n))))
        for i in range(n):
            self.quad(pt(a,r1,i),pt(a,r1,i+1),pt(b,r2,i+1),pt(b,r2,i),col)
            self.tri(a,pt(a,r1,i+1),pt(a,r1,i),col); self.tri(b,pt(b,r2,i),pt(b,r2,i+1),col)
    def ring(self,p,r,t,col,axis='z',n=24):
        def pt(i,j):
            a=i*TAU/n; b=j*TAU/6; q=((r+t*math.cos(b))*math.cos(a),(r+t*math.cos(b))*math.sin(a),t*math.sin(b))
            if axis=='y': q=(q[0],q[2],q[1])
            if axis=='x': q=(q[2],q[0],q[1])
            return add(p,q)
        for i in range(n):
            for j in range(6): self.quad(pt(i,j),pt(i+1,j),pt(i+1,j+1),pt(i,j+1),col)
    def fin(self,points,col,thickness=.045):
        a,b,c=points; n=mul(unit(cross(sub(b,a),sub(c,a))),thickness)
        front=[add(p,n) for p in points]; back=[sub(p,n) for p in points]
        self.tri(*front,col); self.tri(*back[::-1],col)
        for i in range(3): self.quad(front[i],back[i],back[(i+1)%3],front[(i+1)%3],col)
    def path(self,pts,radii,col):
        for i in range(len(pts)-1): self.rod(pts[i],pts[i+1],radii[i],radii[i+1],col)
    def crystal(self,p,r,h,col):
        for i in range(6):
            a=i*TAU/6; b=(i+1)*TAU/6
            q=add(p,(r*math.cos(a),h*.65,r*math.sin(a))); w=add(p,(r*math.cos(b),h*.65,r*math.sin(b)))
            self.tri(q,w,add(p,(r*.15,h,0)),col)
            self.quad(add(p,(r*math.cos(a),0,r*math.sin(a))),add(p,(r*math.cos(b),0,r*math.sin(b))),w,q,col)
    def save(self,name):
        chunks=[]; views=[]; access=[]; offset=0
        def accessor(values,fmt,typ,component,normalized=False,bounds=False):
            nonlocal offset
            flat=[x for row in values for x in (row if isinstance(row,tuple) else (row,))]
            raw=struct.pack('<'+fmt*len(flat),*flat); raw+=b'\0'*((-len(raw))%4)
            views.append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)}); offset+=len(raw); chunks.append(raw)
            a={'bufferView':len(views)-1,'componentType':component,'count':len(values),'type':typ}
            if normalized:a['normalized']=True
            if bounds:a.update(min=[min(p[i] for p in values) for i in range(3)],max=[max(p[i] for p in values) for i in range(3)])
            access.append(a); return len(access)-1
        pos=accessor(self.vertices,'f','VEC3',5126,bounds=True); normal=accessor(self.normals,'f','VEC3',5126)
        colors=accessor([tuple(round(c*255) for c in p) for p in self.colors],'B','VEC4',5121,True)
        idx=accessor(self.indices,'I','SCALAR',5125)
        doc={'asset':{'version':'2.0','generator':'Batyskaf Marine Collection 0.4 — original procedural sculpture'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':name,'mesh':0}], 'meshes':[{'name':name,'primitives':[{'attributes':{'POSITION':pos,'NORMAL':normal,'COLOR_0':colors},'indices':idx,'material':0}]}], 'materials':[{'name':'marine-painted','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':.08,'roughnessFactor':.68},'doubleSided':True}], 'buffers':[{'byteLength':offset}],'bufferViews':views,'accessors':access}
        js=json.dumps(doc,separators=(',',':')).encode(); js+=b' '*((-len(js))%4); binary=b''.join(chunks)
        data=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
        (OUT/(name+'.glb')).write_bytes(data)
        REPORT.append({'name':name,'triangles':len(self.indices)//3,'bytes':len(data)})

def submarine():
    m=Model(); m.ball((0,0,0),(.91,.86,1.95),GOLD,20,10)
    m.ball((0,-.22,0),(.88,.62,1.83),TEAL,16,8)
    # Pressure bands, large forward observation dome and three side portholes.
    for z in [-1.1,.85]: m.ring((0,0,z),.79,.075,LIGHT,n=20)
    m.ball((0,.05,1.55),(.67,.65,.64),'#58bcc5',16,8); m.ring((0,.05,1.72),.63,.09,LIGHT,n=20)
    for side in [-1,1]:
        for z in [-.85,0,.75]:
            m.ball((side*.84,.12,z),(.08,.24,.24),INK,10,6); m.ring((side*.86,.12,z),.25,.05,LIGHT,'x',12)
            m.ball((side*.92,.20,z+.06),(.02,.05,.07),'#baf6ed',6,4)
        m.rod((side*.92,-.52,-1.5),(side*.92,-.52,.65),.21,.21,TEAL,10)
        m.ring((side*.92,-.52,-1.5),.21,.045,GOLD,n=12)
        m.rod((side*.65,-.85,-1.2),(side*.65,-.85,1.2),.06,.06,LIGHT)
        for z in [-.8,.7]: m.rod((side*.6,-.5,z),(side*.65,-.85,z),.04,.04,GOLD)
        m.fin([(side*.65,-.1,-1.0),(side*1.65,-.12,-1.8),(side*.65,-.1,-1.9)],GOLD)
        m.ball((side*.68,-.3,1.25),(.16,.16,.18),LIGHT,8,5)
    m.ball((0,.8,-.2),(.43,.39,.58),GOLD,12,7)
    m.ring((0,1.03,-.2),.31,.055,LIGHT,'y',12)
    m.rod((0,1.05,-.38),(0,1.55,-.38),.09,.09,TEAL)
    m.rod((0,1.55,-.38),(0,1.55,-.06),.09,.12,LIGHT)
    m.fin([(0,.3,-1.3),(0,1.15,-2),(0,.05,-2.1)],TEAL)
    m.ring((0,0,-2.2),.72,.09,TEAL,n=20)
    for s in [-1,1]:m.rod((s*.6,0,-1.6),(s*.6,0,-2.2),.045,.045,LIGHT)
    m.save('submarine')

def fish():
    m=Model(); m.ball((0,0,0),(.7,.92,1.4),'#e7a449',16,9)
    m.ball((0,-.3,.3),(.66,.6,1.06),'#ffe2a0',12,7)
    for s in [-1,1]:
        m.ball((s*.54,.28,.83),(.20,.28,.27),WHITE,10,6)
        m.ball((s*.69,.29,.9),(.085,.16,.16),INK,10,6)
        m.ball((s*.73,.36,.96),(.025,.05,.05),'#ffffff',6,4)
        m.ring((s*.57,.28,.83),.29,.045,GOLD,'x',14)
        m.fin([(s*.45,-.1,.2),(s*1.25,-.25,-.45),(s*.48,-.5,-.5)],TEAL)
        for z in [-.6,-.25,.1]:m.rod((s*.64,.25,z),(s*.64,-.12,z-.1),.025,.025,'#b57838',5)
    m.fin([(0,0,-1.0),(0,.9,-2.15),(0,-.85,-2.15)],TEAL,.1)
    m.fin([(0,.65,.5),(0,1.4,-.35),(0,.65,-.85)],TEAL,.07)
    m.ball((0,-.15,1.35),(.27,.13,.11),'#9d603e',10,5)
    # Mechanic's cap, band, and a little brass tool pack.
    m.ball((0,.76,.3),(.61,.35,.65),TEAL,12,6)
    m.box((0,.8,.83),(.95,.09,.4),TEAL)
    m.ball((0,.99,.43),(.14,.07,.14),LIGHT,8,5)
    m.box((0,-.05,-.99),(.9,.65,.35),'#765146'); m.box((0,-.05,-1.18),(.15,.7,.03),GOLD)
    m.save('fish')

def creatures():
    m=Model(); pts=[(math.sin(i*.7)*.24,math.sin(i*.4)*.1,1.25-i*.32) for i in range(11)]
    m.path(pts,[.25*(1-i/12) for i in range(11)],'#327e82')
    m.ball((0,0,1.25),(.29,.26,.42),'#54bdb5',12,7)
    for s in [-1,1]:
        m.ball((s*.23,.12,1.42),(.07,.075,.07),LIGHT,8,5)
        m.ball((s*.25,.13,1.46),(.025,.04,.025),INK,6,4)
    for i in range(1,9):
        a,b=pts[i],pts[i+1]; m.fin([add(a,(0,.12,0)),add(a,(0,.43,0)),add(b,(0,.08,0))],'#a5f5c7')
        m.ball(add(a,(.12,.03,0)),(.045,.05,.05),'#b6f4c5',6,4)
    m.save('marine-eel')
    m=Model(); m.ball((0,0,0),(1.55,1.22,1.28),'#74649e',16,8)
    m.ball((0,.2,1.0),(.93,.89,.4),'#eddbb3',14,8)
    m.ball((0,.2,1.32),(.53,.56,.15),'#e19c61',12,7)
    m.ball((0,.2,1.46),(.19,.39,.07),INK,10,6)
    m.ball((-.18,.45,1.5),(.13,.13,.04),WHITE,8,5)
    for i in range(7):
        a=i*TAU/7; x,z=math.cos(a),math.sin(a)
        pts=[(x*.95,-.7,z*.7),(x*1.55,-1.35,z*1.15),(x*1.7,-2,z*1.4),(x*2.0,-2.15,z*1.7),(x*2.15,-1.95,z*1.8)]
        m.path(pts,[.23,.21,.15,.09,.025],'#8878b2')
        for p in pts[1:3]:m.ball(add(p,(0,.08,.09)),(.09,.06,.1),'#d4a8ca',6,4)
    for s in [-1,1]:m.fin([(s*.9,.6,0),(s*2.0,1.3,-.3),(s*1.2,-.1,-.5)],'#539aa6',.08)
    m.save('marine-monster')
    m=Model()
    for i in range(7):
        a=i*2.399; base=(math.cos(a)*1.0,-1,math.sin(a)); top=(math.cos(a)*1.5,1+i%3*.35,math.sin(a)*1.4)
        mid=add(mul(add(base,top),.5),(0,0,0)); m.path([base,mid,top],[.26,.18,.1],['#d8818e','#e9a18d','#ba789f'][i%3])
        fork=add(mid,(math.cos(a+.9)*.75,.65,math.sin(a+.9)*.7)); m.rod(mid,fork,.14,.07,'#e8a1a8')
        for p in [top,fork]:m.ball(p,(.17,.21,.17),'#ffceaf',8,5)
    m.ball((0,-1,0),(1.5,.33,1.3),'#567e84',10,5); m.save('marine-coral')

def props():
    for variant in range(8):
        m=Model(); c=['#9cae9b','#aaaeb6','#b5d7d9','#75a9d7','#cce3eb','#89e4e0','#f7dfb2','#6eddac'][variant]
        if variant<3:
            m.box((0,0,0),(.9,.65,.72),c)
            for x in [-.32,.32]:m.box((x,0,0),(.08,.71,.78),GOLD)
            m.box((0,.1,.38),(.2,.17,.05),INK)
            for x in [-.3,.3]:m.ball((x,.24,.4),(.035,.035,.025),LIGHT,6,4)
        elif variant==6:
            m.ball((0,-.22,0),(.62,.25,.5),TEAL,10,6); m.ball((0,.15,0),(.36,.36,.36),c,12,8)
            for i in range(7):
                a=i*TAU/7;m.rod((0,-.25,0),(math.cos(a)*.57,-.05,math.sin(a)*.46),.025,.025,LIGHT,5)
        else:
            m.ball((0,-.35,0),(.5,.2,.46),INK,8,5)
            m.crystal((0,-.25,0),.32,1.05,c);m.crystal((.32,-.3,.12),.18,.6,c);m.crystal((-.28,-.3,-.1),.2,.7,LIGHT)
        m.save('marine-loot-'+str(variant))
    for variant in range(5):
        m=Model(); m.ring((0,0,0),1.05,.10,TEAL,n=24)
        for i in range(8):
            a=i*TAU/8;m.ball((math.cos(a)*1.05,math.sin(a)*1.05,0),(.09,.09,.1),LIGHT,6,4)
        if variant==3:
            m.box((0,0,0),(.65,1.1,.55),TEAL);m.box((0,.63,0),(.28,.14,.35),GOLD)
            for y in [-.3,0,.3]:m.box((0,y,.3),(.48,.17,.06),'#a8f3c6')
        elif variant==4:
            for r in [.2,.4,.6]:m.ring((0,0,0),r,.035,LIGHT,n=16)
            m.rod((0,0,0),(.47,.47,.05),.04,.04,'#9ef3d7')
        elif variant==2:
            m.ball((0,0,0),(.52,.65,.22),GOLD,10,7);m.fin([(-.3,.35,.23),(.3,.35,.23),(0,-.4,.3)],TEAL)
        else:
            m.ball((0,0,0),(.17,.17,.2),LIGHT,8,5)
            for i in range(3):
                a=i*TAU/3; m.fin([(math.cos(a)*.12,math.sin(a)*.12,0),(math.cos(a+.7)*.75,math.sin(a+.7)*.75,.05),(math.cos(a-.1)*.55,math.sin(a-.1)*.55,-.08)],GOLD)
        m.save('marine-power-'+str(variant))
    for variant,c in enumerate(['#6caaa9','#bd786b']):
        m=Model();m.ball((0,0,0),(1.1,.94,1.07),c,9,6)
        for i in range(5):
            a=i*2.4;m.crystal((math.cos(a)*.65,.2,math.sin(a)*.65),.21,.65,LIGHT if variant else '#a5e4d4')
        m.save('marine-meteor-'+str(variant))
    m=Model();m.ball((0,-1,0),(1.4,.5,1.2),'#607c72',10,6)
    for i in range(4):
        a=i*2.4;p=(math.cos(a)*.7,-.65,math.sin(a)*.7)
        m.rod(p,add(p,(0,1.1+i*.2,0)),.28,.22,'#a3b66f');m.ring(add(p,(0,1.1+i*.2,0)),.22,.07,'#e4da9c','y',10)
    m.save('marine-vent')
    m=Model()
    for r,t,c in [(9.42,.17,TEAL),(9.12,.08,LIGHT)]:m.ring((0,0,0),r,t,c,n=40)
    for i in range(12):
        a=i*TAU/12;m.ball((math.cos(a)*9.38,math.sin(a)*9.38,.17),(.12,.12,.09),GOLD,6,4)
    m.save('marine-gate')
    # A 60-degree shutter sector, animated as a single instanced asset.
    m=Model(); r=9.25
    for i in range(8):
        a=.025+i*(math.pi/3-.05)/8;b=.025+(i+1)*(math.pi/3-.05)/8
        for z in [-.10,.10]:
            points=[(0,0,z),(math.cos(a)*r,math.sin(a)*r,z),(math.cos(b)*r,math.sin(b)*r,z)]
            m.tri(*(points if z>0 else points[::-1]),'#adc1bb')
        m.quad((math.cos(a)*r,math.sin(a)*r,-.1),(math.cos(b)*r,math.sin(b)*r,-.1),(math.cos(b)*r,math.sin(b)*r,.1),(math.cos(a)*r,math.sin(a)*r,.1),INK)
    for a in [.035,math.pi/3-.035]:m.rod((0,0,.15),(math.cos(a)*9.1,math.sin(a)*9.1,.15),.045,.045,LIGHT)
    m.rod((2.8,1.6,.15),(7,4,.15),.07,.07,TEAL);m.save('marine-shutter')
    m=Model();m.ball((0,0,0),(.18,.18,.2),GOLD,10,6)
    for i in range(5):
        a=i*TAU/5
        def p(r,t,z):return (r*math.cos(a+t),r*math.sin(a+t),z)
        m.fin([p(.12,0,0),p(.62,.52,.03),p(.55,-.05,-.07)],LIGHT,.045)
    m.save('marine-propeller')
    for enemy in [False,True]:
        m=Model();c='#ea987d' if enemy else LIGHT
        m.ball((0,0,0),(.13,.13,.42),c,8,6)
        m.ring((0,0,-.25),.13,.025,TEAL,n=8)
        for i in range(3):
            a=i*TAU/3
            m.fin([(math.cos(a)*.1,math.sin(a)*.1,-.1),(math.cos(a)*.28,math.sin(a)*.28,-.4),(math.cos(a)*.1,math.sin(a)*.1,-.38)],TEAL,.015)
        m.ball((0,0,-.45),(.08,.08,.12),'#b5f5d7',8,5)
        m.save('marine-projectile-enemy' if enemy else 'marine-projectile')

def scenery():
    m=Model();m.ball((0,0,0),(1,.3,.8),'#698984',9,5)
    for i in range(6):
        a=i*2.4; x,z=math.cos(a)*.6,math.sin(a)*.6; h=1.4+i*.22
        m.path([(x,0,z),(x+.15,h*.5,z),(x+.4,h,z+.2)],[.07,.045,.015],'#477e6a')
        for j in range(3):
            y=.3+j*h/3;s=1 if j%2 else -1
            m.fin([(x,y,z),(x+s*.65,y+.45,z+.17),(x+.15,y+.65,z)],['#70b788','#9bd4a0'][j%2],.025)
    m.save('marine-kelp')
    m=Model()
    for i in range(3):m.box((i*.65-.65,.2+i*.15,0),(.8,.5+i*.3,.85),['#a2b5b7','#b5bfb3','#7e979e'][i])
    m.rod((0,.6,0),(0,1.6,0),.35,.31,'#b8c9c6',8);m.box((0,1.65,0),(.9,.15,.8),GOLD)
    m.ring((0,1.2,0),.33,.05,TEAL,'y',8);m.save('marine-ruin')
    m=Model();m.ball((0,0,0),(1,.25,.8),'#517a89',9,5)
    for i in range(5):
        a=i*2.4;m.crystal((math.cos(a)*.55,0,math.sin(a)*.5),.22,1+i*.23,['#83d9d0','#b6eee1','#9abbd9'][i%3])
    m.save('marine-crystal')
    m=Model();m.ball((0,0,0),(1.2,.45,.8),'#7e9a9a',9,5)
    for i in range(3):m.ball((i*.45-.4,.3,0),(.35,.22,.3),'#9ab3a8',7,4)
    m.save('marine-rock')

if __name__=='__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    submarine();fish();creatures();props();scenery()
    (OUT/'marine-manifest.json').write_text(json.dumps({'collection':'Marine Expedition 0.4','assets':REPORT,'totalBytes':sum(a['bytes'] for a in REPORT)},indent=2)+'\n')
    manifest=OUT/'manifest.json'
    retained=[a for a in json.loads(manifest.read_text()) if a['name'].startswith('SM_')]
    manifest.write_text(json.dumps(retained+REPORT,indent=2)+'\n')
    print(json.dumps({'assets':len(REPORT),'bytes':sum(a['bytes'] for a in REPORT),'maxTriangles':max(a['triangles'] for a in REPORT)}))
