const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync(require('node:path').join(__dirname,'../apps/web/src/components/customer/BookingCard.jsx'),'utf8');
const ast=ts.createSourceFile('booking.jsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);let arrow;
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='handleVerifyGuestOtpAndCreateTrip')arrow=n.initializer.getText(ast);ts.forEachChild(n,visit);}visit(ast);
function fixture({meFailure=false,createFailure=false,expired=false,verifyFailure=false,userFromOtp=false}={}){
 const counts={verify:0,me:0,login:0,create:0,reset:0,finish:0,sms:0},toasts=[],errors=[];
 const ref={current:''},quote={inputKey:'same',expiresAt:new Date(Date.now()+(expired?-1000:60000)).toISOString(),totalPrice:100000};
 let dialog=true,clearedQuote=false;
 const deps={guestVerifiedUserRef:{current:null},guestVerifiedTokenRef:ref,otpSessionId:'offline',otpCode:'offline',isOtpExpired:false,pendingTripPayload:{bookingRequestId:'same'},quote,quoteInputKeyRef:{current:'same'},
  setOtpLoading(){},setIsCreating(){},setOtpErrorMsg:message=>errors.push(message),setToast:toast=>toasts.push(toast),setQuote:value=>{clearedQuote=value===null;},
  requestOtp:async()=>{counts.sms++;},verifyOtp:async()=>{counts.verify++;if(verifyFailure)throw Error('OTP_INVALID');return{access_token:'offline-token',...(userFromOtp?{user:{id:'rider'}}:{})};},
  getMe:async()=>{counts.me++;if(meFailure&&counts.me===1)throw Error('ACCOUNT_UNAVAILABLE');return{id:'rider'};},login:()=>counts.login++,
  createTrip:async()=>{counts.create++;if(createFailure)throw Error('REQUEST_UNCONFIRMED');return{trip:{id:'offline-trip'}};},
  resetOtpDialogState:()=>{ref.current='';dialog=false;counts.reset++;},trackGoogleAdsConversion(){},finishCreatedTrip:()=>counts.finish++};
 const run=()=>new Function(...Object.keys(deps),'return ('+arrow+');')(...Object.values(deps))();
 return{counts,toasts,errors,run,deps,get dialog(){return dialog;},get clearedQuote(){return clearedQuote;}};
}
test('verified OTP followed by booking failure leaves a logged-in user outside the consumed OTP dialog',async()=>{
 const f=fixture({createFailure:true});await f.run();assert.equal(f.counts.verify,1);assert.equal(f.counts.login,1);assert.equal(f.counts.create,1);assert.equal(f.dialog,false);assert.equal(f.counts.sms,0);assert.equal(f.toasts.at(-1).message,'REQUEST_UNCONFIRMED');
});
test('account lookup can retry after OTP consumption without verifying or sending another code',async()=>{
 const f=fixture({meFailure:true});await f.run();assert.equal(f.dialog,true);f.deps.isOtpExpired=true;f.deps.otpCode='';await f.run();
 assert.equal(f.counts.verify,1);assert.equal(f.counts.me,2);assert.equal(f.counts.login,1);assert.equal(f.counts.create,1);assert.equal(f.counts.finish,1);assert.equal(f.counts.sms,0);
});
test('OTP can complete after the quote expires, retaining login and requiring a fresh confirmed price',async()=>{
 const f=fixture({expired:true});await f.run();assert.equal(f.counts.login,1);assert.equal(f.counts.verify,1);assert.equal(f.counts.create,0);assert.equal(f.dialog,false);assert.equal(f.clearedQuote,true);assert.match(f.toasts.at(-1).message,/không cần nhập OTP lại/);
});
test('invalid OTP remains a verification error without creating a trip or requesting more SMS',async()=>{
 const f=fixture({verifyFailure:true});await f.run();assert.equal(f.dialog,true);assert.equal(f.counts.login,0);assert.equal(f.counts.create,0);assert.equal(f.counts.sms,0);assert.equal(f.errors.at(-1),'OTP_INVALID');
});

test('verified user returned by OTP logs in without a redundant account lookup',async()=>{
 const f=fixture({userFromOtp:true});await f.run();assert.equal(f.counts.verify,1);assert.equal(f.counts.me,0);assert.equal(f.counts.login,1);assert.equal(f.counts.create,1);assert.equal(f.counts.finish,1);
});
