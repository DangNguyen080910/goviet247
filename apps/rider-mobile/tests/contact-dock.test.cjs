const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const moduleExports={};
const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../utils/contactDock.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
new Function('exports',code)(moduleExports);
const {constrainContactDock,CONTACT_DOCK_WIDTH:W,CONTACT_DOCK_HEIGHT:H}=moduleExports;
test('saved and dragged positions stay within screen and above navigation on common phone sizes',()=>{
 for(const [width,height,top,bottom] of [[320,568,20,0],[390,844,47,34],[844,390,0,21],[768,1024,24,20]]) {
  for(const point of [null,{x:-100,y:-200},{x:9000,y:9000},{x:NaN,y:Infinity}]) {
   const p=constrainContactDock(point,width,height,top,bottom,true);
   assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert(p.x>=16);assert(p.x+W<=width-16);
   assert(p.y>=top+8);assert(p.y+H<=height-bottom-96);
  }
 }
});
test('rotation repositions the entire group without putting either action outside the screen',()=>{
 const portrait=constrainContactDock(null,390,844,47,34);
 const rotated=constrainContactDock(portrait,844,390,0,21,true);
 assert(rotated.x+W<=844-16);assert(rotated.y+H<=390-21-96);
});
test('drag snaps to either edge while keeping room for both controls',()=>{
 const left=constrainContactDock({x:0,y:250},390,844,47,34,true);
 const right=constrainContactDock({x:1000,y:250},390,844,47,34,true);
 assert.equal(left.x,16);assert.equal(right.x,390-W-16);assert.equal(left.y,right.y);
});

test('larger accessibility text reserves the actual group height above navigation',()=>{
 const p=constrainContactDock(null,390,844,47,34,true,190);
 assert(p.y+190<=844-34-96);
});
