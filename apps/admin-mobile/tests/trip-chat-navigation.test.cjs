const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../services/useTripChatNavigation.ts'), 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export function', 'function');
const code = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function mount(os) {
  const calls=[],interactions=[],frames=[],cleanups=[];
  const hook = new Function('useCallback','useEffect','useRef','InteractionManager','Platform','router','requestAnimationFrame','cancelAnimationFrame',
    code+';return useTripChatNavigation;')(
      fn=>fn,fn=>cleanups.push(fn()),value=>({current:value}),
      {runAfterInteractions:fn=>{interactions.push(fn);return {cancel(){calls.push('cancel');}};}},
      {OS:os},{push:route=>calls.push(route)},fn=>{frames.push(fn);return frames.length;},()=>{}
    );
  return {...hook(()=>calls.push('close detail')),calls,interactions,frames,unmount:()=>cleanups.forEach(fn=>fn?.())};
}
test('iOS dismisses detail before navigation, and repeated taps navigate once',()=>{
  const f=mount('ios');f.openChatFromDetail('trip-1');f.openChatFromDetail('trip-1');
  assert.deepEqual(f.calls,['close detail']);
  f.onChatDetailDismiss();f.onChatDetailDismiss();
  assert.deepEqual(f.calls,['close detail','/trip-chat?tripId=trip-1']);
});
test('Android waits for interactions and modal removal frames before navigation',async()=>{
  const f=mount('android');await f.openChatFromDetail('trip/2');
  assert.deepEqual(f.calls,['close detail']);f.interactions.shift()();
  assert.deepEqual(f.calls,['close detail']);f.frames.shift()();
  assert.deepEqual(f.calls,['close detail']);f.frames.shift()();
  assert.deepEqual(f.calls,['close detail','/trip-chat?tripId=trip%2F2']);
});
test('leaving the screen cancels queued navigation',()=>{
  const f=mount('ios');f.openChatFromDetail('trip-3');f.unmount();f.onChatDetailDismiss();
  assert.deepEqual(f.calls,['close detail']);
});
