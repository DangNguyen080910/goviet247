const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const e={};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../../mobile-chat/floatingPosition.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;new Function('exports',code)(e);
test('admin inbox positions stay in safe screen area after dragging or restoring invalid values',()=>{
 for(const b of [{width:320,height:568,top:20,bottom:0},{width:390,height:844,top:47,bottom:34},{width:844,height:390,top:0,bottom:21}]) {
  for(const size of [{width:172,height:48},{width:172,height:90}])for(const value of [null,{x:9999,y:9999},{x:-100,y:-100},{x:NaN,y:Infinity}]) {
   const p=e.constrainFloatingPoint(value,b,size,true);assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert(p.x>=16);assert(p.x+size.width<=b.width-16);assert(p.y>=b.top+8);assert(p.y+size.height<=b.height-b.bottom-88);
  }
 }
});
test('screen rotation clamps a previously saved portrait position',()=>{
 const size={width:172,height:48},portrait=e.constrainFloatingPoint(null,{width:390,height:844,top:47,bottom:34},size);
 const p=e.constrainFloatingPoint(portrait,{width:844,height:390,top:0,bottom:21},size,true);assert(p.x+172<=828);assert(p.y+48<=281);
});
