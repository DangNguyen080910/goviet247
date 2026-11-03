const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../apps/rider-mobile/app/booking.tsx'),'utf8');
const ast=ts.createSourceFile('booking.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression;
function visit(node){if(!expression&&ts.isJsxExpression(node)&&node.expression&&node.expression.getText(ast).includes('Hình thức đặt chuyến'))expression=node.expression.getText(ast);ts.forEachChild(node,visit);}visit(ast);assert(expression,'real company-choice JSX exists');
function render(overrides={}){
 const deps={React:{createElement:(type,props,...children)=>({type,props,children})},View:'View',Text:'Text',Pressable:'Pressable',styles:{},modeUserId:'user',modeLoading:false,modeError:'',bookingCompanies:[],selectedCompany:undefined,bookingMode:'personal',isCreating:false,chooseBookingMode(){},...overrides};
 const js=ts.transpileModule(`const tree=(${expression});`,{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2020}}).outputText;
 return new Function(...Object.keys(deps),js+';return tree;')(...Object.values(deps));
}
function text(node){if(node==null)return '';if(typeof node!=='object')return String(node);if(Array.isArray(node))return node.map(text).join(' ');return text(node.children);}
test('guest and ordinary Rider never see company/personal booking choices',()=>{
 assert.equal(render({modeUserId:''}),null);assert.equal(render(),null);
});
test('verified linked Partner sees company and personal choices, including when personal was remembered',()=>{
 const company={id:'ot',name:'OT Travel'};
 const content=text(render({bookingCompanies:[company],bookingMode:'personal'}));
 assert.match(content,/Hình thức đặt chuyến/);assert.match(content,/OT Travel/);assert.match(content,/Đặt cá nhân/);
});
test('stale company data cannot flash on screen while account verification loads or fails',()=>{
 const companies=[{id:'old',name:'Old Company'}];
 assert.equal(render({bookingCompanies:companies,modeLoading:true}),null);
 assert.equal(render({bookingCompanies:companies,modeError:'offline'}),null);
 assert.equal(render({bookingCompanies:companies,modeUserId:''}),null);
});
