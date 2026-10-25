// Loads assets/progress-api.js with a fake window/localStorage/fetch and checks F10 timeout + retry.
// Run: node tools/progress-api.test.js assets/progress-api.js   (no dependencies, ~15 s)
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(process.argv[2],'utf8');
function load(fetchImpl){
  const store={rfMilesFamilyKey:'k'};const calls=[];
  const win={localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]},
    location:{href:'http://x/'},history:{replaceState(){}},document:{documentElement:{setAttribute(){},getAttribute(){}},querySelectorAll:()=>[],readyState:'complete',addEventListener(){}},
    console:{warn(){}},AbortController,setTimeout,clearTimeout,Promise,URL,Blob,JSON,Math,Error,Object,Array,String,isFinite,encodeURIComponent};
  win.fetch=(u,o)=>{calls.push({u,o});return fetchImpl(calls.length,o);};
  win.window=win;win.addEventListener=()=>{};
  vm.createContext(win);vm.runInContext(src,win);
  return {RF:win.RFProgress,calls};
}
const ok=(body={})=>Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(body),headers:{get:()=>null}});
const st=(s)=>Promise.resolve({ok:false,status:s,json:()=>Promise.resolve({})});
const hang=(o)=>new Promise((_,rej)=>o.signal.addEventListener('abort',()=>rej(new Error('aborted'))));
(async()=>{
 // 1. 503 then OK -> retried, succeeds
 let t=load(n=>n<2?st(503):ok({a:1})); let r=await t.RF.markSessionDone('unit1','A'); assert.deepStrictEqual(r,{a:1}); assert.strictEqual(t.calls.length,2); console.log('503 then ok: retried once ✓');
 // 2. 401 -> not retried
 t=load(()=>st(401)); r=await t.RF.markSessionDone('unit1','A'); assert.strictEqual(r,null); assert.strictEqual(t.calls.length,1); console.log('401: no retry ✓');
 // 3. network error x3 -> gives up after 3 tries, queue keeps working
 t=load(n=>n<=3?Promise.reject(new TypeError('net')):ok({b:2})); r=await t.RF.markSessionDone('unit1','A'); assert.strictEqual(r,null); assert.strictEqual(t.calls.length,3);
 r=await t.RF.markSessionDone('unit1','B'); assert.deepStrictEqual(r,{b:2}); console.log('network error x3: gives up, next write still runs ✓');
 // 4. hanging request -> aborted at 10 s, retried; measure with fake-ish wall clock
 const t0=Date.now(); t=load((n,o)=>n===1?hang(o):ok({c:3})); r=await t.RF.markSessionDone('unit2','A'); const dt=Date.now()-t0;
 assert.deepStrictEqual(r,{c:3}); assert.strictEqual(t.calls.length,2); assert(dt>=10900&&dt<12500,dt); console.log('hang: aborted after 10 s, retry ok ('+dt+' ms) ✓');
 // 5. retell upload: 500 twice -> only 1 retry, throws so recorder shows "Try Save again"
 t=load(()=>st(500)); await assert.rejects(t.RF.uploadRetell('unit1',new Blob(['x'],{type:'audio/mp4'}),1000)); assert.strictEqual(t.calls.length,2); console.log('retell upload: 1 retry then error ✓');
 // 6. retell upload body reused on retry
 t=load(n=>n<2?Promise.reject(new TypeError('net')):ok({saved:true})); r=await t.RF.uploadRetell('unit1',new Blob(['abc'],{type:'audio/mp4'}),1000); assert.deepStrictEqual(r,{saved:true}); assert.strictEqual(t.calls[0].o.body,t.calls[1].o.body); console.log('retell retry sends same blob ✓');
 console.log('ALL PASS');
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
