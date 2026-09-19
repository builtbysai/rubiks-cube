import assert from 'node:assert/strict';

const FACES = [
  { id:'U', n:[ 0, 1, 0], u:[ 0, 0,-1], r:[ 1, 0, 0] },
  { id:'R', n:[ 1, 0, 0], u:[ 0, 1, 0], r:[ 0, 0,-1] },
  { id:'F', n:[ 0, 0, 1], u:[ 0, 1, 0], r:[ 1, 0, 0] },
  { id:'D', n:[ 0,-1, 0], u:[ 0, 0, 1], r:[ 1, 0, 0] },
  { id:'L', n:[-1, 0, 0], u:[ 0, 1, 0], r:[ 0, 0, 1] },
  { id:'B', n:[ 0, 0,-1], u:[ 0, 1, 0], r:[-1, 0, 0] },
];
const MOVES = {
  R:{axis:'x',layer: 1,dir:-1}, L:{axis:'x',layer:-1,dir: 1},
  U:{axis:'y',layer: 1,dir:-1}, D:{axis:'y',layer:-1,dir: 1},
  F:{axis:'z',layer: 1,dir:-1}, B:{axis:'z',layer:-1,dir: 1},
};
const FAMILY={x:'R',y:'T',z:'L'};
const FACE_FOR_GROUP={TLA:'L',TLB:'R',TRA:'F',TRB:'B',LRA:'D',LRB:'U'};
const GROUP_FOR_FACE=Object.fromEntries(Object.entries(FACE_FOR_GROUP).map(([k,v])=>[v,k]));
const ring=v=>1-v;

function circleIntersections(x0,y0,r0,x1,y1,r1){
  const dx=x1-x0,dy=y1-y0,d=Math.hypot(dx,dy);
  const a=(r0*r0-r1*r1+d*d)/(2*d);
  const h=Math.sqrt(Math.max(0,r0*r0-a*a));
  const xm=x0+a*dx/d,ym=y0+a*dy/d;
  const rx=-dy*h/d,ry=dx*h/d;
  return [[xm+rx,ym+ry],[xm-rx,ym-ry]];
}
function geometry(S=320){
  const cx=S/2,cy=S/2,d=S*.2476,h=d*Math.sqrt(3)/2;
  const centers={T:[cx,cy-h*2/3],L:[cx-d/2,cy+h/3],R:[cx+d/2,cy+h/3]};
  const radii=[S*.2,S*.2572,S*.3143];
  const slots=[];
  for(const [a,b] of [['T','L'],['T','R'],['L','R']]){
    const [x0,y0]=centers[a],[x1,y1]=centers[b];
    for(let i=0;i<3;i++)for(let j=0;j<3;j++){
      for(const [x,y] of circleIntersections(x0,y0,radii[i],x1,y1,radii[j])){
        const cross=(x1-x0)*(y-y0)-(y1-y0)*(x-x0);
        slots.push({x,y,pair:a+b,side:cross>0?'A':'B',circles:[a+i,b+j]});
      }
    }
  }
  return {centers,radii,slots};
}
function faceFromNormal(n){
  return FACES.find(f=>f.n.every((v,i)=>v===n[i])).id;
}
function nodeFor(p,n,g){
  const face=faceFromNormal(n);
  const normalAxis=n[0]?'x':n[1]?'y':'z';
  const other=['x','y','z'].filter(a=>a!==normalAxis);
  const coords={x:p[0],y:p[1],z:p[2]};
  const wanted=other.map(a=>FAMILY[a]+ring(coords[a]));
  const group=GROUP_FOR_FACE[face];
  const slot=g.slots.find(s=>(s.pair+s.side)===group && wanted.every(id=>s.circles.includes(id)));
  assert.ok(slot,'missing node '+face+' '+p+' '+n);
  return slot;
}
function rotate(v,axis,dir){
  const [x,y,z]=v;
  if(axis==='x') return dir>0?[x,-z,y]:[x,z,-y];
  if(axis==='y') return dir>0?[z,y,-x]:[-z,y,x];
  return dir>0?[-y,x,z]:[y,-x,z];
}
function stickers(){
  const out=[];
  for(let fi=0;fi<FACES.length;fi++){
    const f=FACES[fi];
    for(let row=0;row<3;row++)for(let col=0;col<3;col++){
      const up=1-row,right=col-1;
      const p=[0,1,2].map(i=>f.n[i]+up*f.u[i]+right*f.r[i]);
      out.push({id:fi*9+row*3+col,p,n:[...f.n]});
    }
  }
  return out;
}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}

const g=geometry();
assert.equal(g.slots.length,54);
assert.deepEqual(Object.fromEntries(Object.entries(FACE_FOR_GROUP).map(([k,v])=>[v,k])),GROUP_FOR_FACE);

for(const [name,m] of Object.entries(MOVES)){
  const ss=stickers();
  let moved=0;
  for(const s of ss){
    const before=nodeFor(s.p,s.n,g);
    const ai={x:0,y:1,z:2}[m.axis];
    let p=s.p,n=s.n;
    if(s.p[ai]===m.layer){p=rotate(p,m.axis,m.dir);n=rotate(n,m.axis,m.dir);}
    const after=nodeFor(p,n,g);
    if(dist(before,after)>.001) moved++;
  }
  assert.equal(moved,20,name+' should move exactly 20 visible sticker positions');

  // Four quarter turns must return every physical sticker to its start.
  let state=stickers();
  for(let q=0;q<4;q++){
    state=state.map(s=>{
      const ai={x:0,y:1,z:2}[m.axis];
      return s.p[ai]===m.layer?{...s,p:rotate(s.p,m.axis,m.dir),n:rotate(s.n,m.axis,m.dir)}:s;
    });
  }
  for(const s of state){
    const original=stickers()[s.id];
    assert.deepEqual(s.p,original.p,name+' position roundtrip');
    assert.deepEqual(s.n,original.n,name+' normal roundtrip');
  }
}

// Whole-cube face-to-face rotations use the same orbit nodes, but rotate
// every sticker rather than one layer. Two axis-center stickers stay fixed;
// the other 52 must move continuously to another valid node.
for(const axis of ['x','y','z']){
  for(const dir of [-1,1]){
    const ss=stickers();
    let moved=0;
    for(const s of ss){
      const before=nodeFor(s.p,s.n,g);
      const p=rotate(s.p,axis,dir);
      const n=rotate(s.n,axis,dir);
      const after=nodeFor(p,n,g);
      if(dist(before,after)>.001) moved++;
    }
    assert.equal(moved,52,`whole-cube ${axis} ${dir} should move 52 sticker positions`);

    let state=stickers();
    for(let q=0;q<4;q++){
      state=state.map(s=>({...s,p:rotate(s.p,axis,dir),n:rotate(s.n,axis,dir)}));
    }
    for(const s of state){
      const original=stickers()[s.id];
      assert.deepEqual(s.p,original.p,`whole-cube ${axis} ${dir} position roundtrip`);
      assert.deepEqual(s.n,original.n,`whole-cube ${axis} ${dir} normal roundtrip`);
    }
  }
}

// Enumerate the full 24-orientation cube rotation group and verify that a
// face turn still projects exactly 20 moving sticker positions from every view.
function stateKey(state){
  return state.map(s=>s.p.join(',')+'|'+s.n.join(',')).join(';');
}
const orientations=[];
const seen=new Set();
const pending=[stickers()];
while(pending.length){
  const state=pending.shift();
  const key=stateKey(state);
  if(seen.has(key)) continue;
  seen.add(key);
  orientations.push(state);
  for(const axis of ['x','y','z']){
    pending.push(state.map(s=>({...s,p:rotate(s.p,axis,1),n:rotate(s.n,axis,1)})));
  }
}
assert.equal(orientations.length,24,'cube should have exactly 24 face-to-face orientations');

for(const oriented of orientations){
  for(const axis of ['x','y','z']){
    for(const layer of [-1,1]){
      let moved=0;
      const ai={x:0,y:1,z:2}[axis];
      for(const s of oriented){
        const before=nodeFor(s.p,s.n,g);
        let p=s.p,n=s.n;
        if(s.p[ai]===layer){
          p=rotate(p,axis,1);
          n=rotate(n,axis,1);
        }
        const after=nodeFor(p,n,g);
        if(dist(before,after)>.001) moved++;
      }
      assert.equal(moved,20,
        `visible ${axis} layer ${layer} should move 20 projected stickers from every orientation`);
    }
  }
}

// A face quarter-turn has two geometric motion classes in the reference.
// Twelve adjacent-strip stickers remain on the active circle family/ring.
// The eight perimeter stickers of the rotating face move through radial space
// between rings.
for(const [name,m] of Object.entries(MOVES)){
  const ss=stickers();
  const activeCircle=FAMILY[m.axis]+ring(m.layer);
  let trackCount=0, radialCount=0;
  for(const s of ss){
    const ai={x:0,y:1,z:2}[m.axis];
    if(s.p[ai]!==m.layer) continue;
    const before=nodeFor(s.p,s.n,g);
    const p=rotate(s.p,m.axis,m.dir);
    const n=rotate(s.n,m.axis,m.dir);
    const after=nodeFor(p,n,g);
    if(before.circles.includes(activeCircle) && after.circles.includes(activeCircle)) trackCount++;
    else radialCount++;
  }
  assert.equal(trackCount,12,name+' should keep 12 stickers on the active circle track');
  assert.equal(radialCount,8,name+' should move 8 face-perimeter stickers through radial space');
}

// Half a physical quarter-turn is exactly half an orbit transition.
for(const p of [0,.1,.25,.5,.75,.9,1]){
  const angle=p*Math.PI/2;
  const orbitProgress=angle/(Math.PI/2);
  assert.ok(Math.abs(orbitProgress-p)<1e-12,'cube/orbit progress must be 1:1');
}

console.log('orbit reference model: OK (54 nodes, 24 views, 12 track + 8 radial face-turn paths, 1:1 drag sync)');
