/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS VM fixture tests real route code without a database or network. */
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root=process.cwd();
const projectRequire=createRequire(path.join(root,'package.json'));
const ts=projectRequire('typescript');
function makeLoader(overrides={},globals={}){
 const cache=new Map();
 function resolveFile(p){for(const x of [p,p+'.ts',p+'.tsx',path.join(p,'index.ts')])if(fs.existsSync(x)&&fs.statSync(x).isFile())return x;throw new Error('Missing module '+p);}
 function load(rel){
  const filename=resolveFile(path.isAbsolute(rel)?rel:path.join(root,rel));
  if(cache.has(filename))return cache.get(filename).exports;
  const loadedModule={exports:{}};cache.set(filename,loadedModule);
  const js=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const localRequire=name=>{if(Object.hasOwn(overrides,name))return overrides[name];if(name.startsWith('@/'))return load(path.join(root,'src',name.slice(2)));if(name.startsWith('.'))return load(path.join(path.dirname(filename),name));return projectRequire(name);};
  vm.runInNewContext(js,{module:loadedModule,exports:loadedModule.exports,require:localRequire,console,URL,Request,Response,Headers,AbortSignal,AbortController,DOMException,Error,TypeError,TextDecoder,TextEncoder,ReadableStream,Buffer,setTimeout,clearTimeout,process:{env:{NODE_ENV:'test',PUBLIC_APP_URL:'https://app.invalid'}},...globals},{filename});
  return loadedModule.exports;
 }
 return load;
}

async function testPartialBatch(){
 let ApiError;
 let generationCalls=0,charged=0;
 let stored=null;
 const apiUsage=[];const history=[];const operationKeys=[];
 const makeClaim=()=>stored?{kind:'replay',status:stored.status,body:stored.body}:{kind:'new',id:'claim-1',key:'batch-audit',leaseToken:'lease-1'};
 const gatewayLoader=makeLoader({
  '@/server/auth':{requireApiUser:async()=>({userId:'audit-user',role:'user',apiKeyId:'audit-key'})},
  '@/server/rate-limit':{enforceRateLimit:async()=>{}},
  '@/lib/config':{getConfig:async()=>({imageModel:'gpt-image-2'})},
  '@/server/services/image-costs':{getImageModelCreditCost:async()=>5},
  '@/server/services/api-keys':{recordApiKeyUsage:async(_id,cost)=>{apiUsage.push(cost);}},
  '@/server/services/private-images':{createImageAccessToken:()=> 'synthetic-signed-token'},
  '@/server/services/request-idempotency-store':{
   beginRequest:async()=>makeClaim(),
   completeRequest:async(_id,_lease,status,body)=>{stored={status,body};},
   failRequest:async(_id,_lease,status,body)=>{stored={status,body};},
   inProgressError:()=>new ApiError('in progress',409),
   requestErrorStatus:e=>e instanceof ApiError?e.status:500,
   requestErrorBody:e=>({error:e.message,...(e.code?{code:e.code}:{})})
  },
  '@/server/services/image':{generateImage:async(options)=>{
   operationKeys.push(options.idempotencyKey);
   generationCalls++;
   if(generationCalls===1){charged+=5;const image={id:'completed-image-1',storageKey:'00000000-0000-4000-8000-000000000001.png',imageUrl:'/api/images/00000000-0000-4000-8000-000000000001.png'};history.push(image);return image;}
   throw new ApiError('Simulated second image upstream failure',502,'UPSTREAM_IMAGE_ERROR');
  }}
 });
 ApiError=gatewayLoader('src/server/http.ts').ApiError;
 const {POST}=gatewayLoader('src/app/api/v1/images/generations/route.ts');
 const request=()=>new Request('https://app.invalid/api/v1/images/generations',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'batch-audit'},body:JSON.stringify({prompt:'synthetic review image',model:'gpt-image-2',n:2})});
 const first=await POST(request());const firstBody=await first.json();
 const retry=await POST(request());const retryBody=await retry.json();
 assert.equal(first.status,200);assert.equal(retry.status,200);assert.equal(generationCalls,2);assert.equal(charged,5);assert.equal(history.length,1);assert.equal(firstBody.data.length,1);assert.equal(stored.body.images.length,1);assert.equal(retryBody.data.length,1);assert.equal(firstBody.partial,true);assert.equal(firstBody.errors[0].code,"UPSTREAM_IMAGE_ERROR");assert.deepEqual(operationKeys,["claim-1:0","claim-1:1"]);
}
async function runUpstreamRetry(editMode){
 let reserved=0,refunded=0,providerExecutions=0,filesystemCalls=0;
 const providerKeys=[];const upstreamLedger=new Set();
 const forbidden=()=>{throw new Error('Unexpected actual persistence call');};
 const fakeFiles=new Proxy({}, {get:()=>async()=>{filesystemCalls++;throw new Error('Unexpected image artifact file operation');}});
 const imageLoader=makeLoader({
  '@/db':{db:new Proxy({}, {get:()=>forbidden})},
  '@/db/schema':{imageGenerations:{}},
  '@/lib/config':{getConfig:async()=>({imageModel:'gpt-image-2',imageSystemPrompt:''})},
  '@/server/services/model-channels':{isConfiguredModelEnabled:async()=>true,resolveConfiguredEndpoint:async()=>({apiKey:'synthetic-key',baseUrl:'https://upstream.invalid/v1',maxRetries:3,enforcePublicHttps:false})},
  '@/server/services/credits':{assertEnoughCredits:async()=>{},reserveCredits:async(_u,cost)=>{reserved+=cost;return {refund:async()=>{refunded+=cost;}};}},
  '@/server/services/image-costs':{getImageModelCreditCost:async()=>5,calculateImageCreditCost:(cost,count)=>cost*count},
  '@/server/services/site-settings':{assertImageGenerationAllowed:async()=>{}},
  '@/server/safe-http':{requestPublicHttpsBuffer:forbidden,requestPublicHttpsResponse:forbidden},
  'fs/promises':fakeFiles
 },{
  fetch:async(_url,options)=>{
   const key=options.headers['Idempotency-Key'];providerKeys.push(key);
   if(!upstreamLedger.has(key)){upstreamLedger.add(key);providerExecutions++;}
   throw new TypeError('Synthetic connection reset after provider completed its work');
  },
  setTimeout:(fn)=>setTimeout(fn,0)
 });
 const image=imageLoader('src/server/services/image.ts');
 const options={userId:'audit-user',role:'user',prompt:'synthetic retry audit',modelOverride:'gpt-image-2',size:'1024x1024',idempotencyKey:'one-business-operation'};
 if(editMode){
  const input='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1sAAAAASUVORK5CYII=';
  for(let operationIndex=0;operationIndex<2;operationIndex++){
   await assert.rejects(()=>image.editImage({...options,image:input,operationIndex}));
  }
 }else{
  await assert.rejects(()=>image.generateImage(options));
 }
 const operations=editMode?2:1;
 assert.equal(providerKeys.length,operations*3,'every operation must reach its three simulated transport retries');
 for(let operation=0;operation<operations;operation++)assert.equal(new Set(providerKeys.slice(operation*3,operation*3+3)).size,1,'retry identity must remain stable');
 assert.equal(new Set(providerKeys).size,operations,'distinct edits must never share an upstream business key');
 assert.equal(providerExecutions,operations);assert.equal(filesystemCalls,0);assert.equal(reserved,operations*5);assert.equal(refunded,operations*5);
}
async function testUpstreamRetry(){await runUpstreamRetry(false);}
async function testEditRetryIdentity(){await runUpstreamRetry(true);}

async function testRefundSignal(){

 const load=makeLoader();
 const E=load('src/server/http.ts').ApiError;
 const {executeImageEditTasks}=load('src/server/services/image-edit-runner.ts');
 const result=await executeImageEditTasks([{mode:'per-image',targetImage:'synthetic-input',prompt:'review',targetIndex:0}],1,async()=>{throw new E('Refund pending; contact support',503,'CREDIT_REFUND_PENDING');});
 assert.equal(result.failed,1);
 assert.equal(result.refundPending,true);
 assert.match(result.lastError,/Refund pending/);

}

async function testAllFailedRefundReplay(){
 for(const pendingFirst of [false,true]){
  let ApiError,stored=null,generationCalls=0,usageCalls=0;
  const gatewayLoader=makeLoader({
   '@/server/auth':{requireApiUser:async()=>({userId:'audit-user',role:'user',apiKeyId:'audit-key'})},
   '@/server/rate-limit':{enforceRateLimit:async()=>{}},
   '@/lib/config':{getConfig:async()=>({imageModel:'gpt-image-2'})},
   '@/server/services/image-costs':{getImageModelCreditCost:async()=>5},
   '@/server/services/api-keys':{recordApiKeyUsage:async()=>{usageCalls++;}},
   '@/server/services/private-images':{createImageAccessToken:()=> 'synthetic-signed-token'},
   '@/server/services/request-idempotency-store':{
    beginRequest:async()=>stored?{kind:'replay',...stored}:{kind:'new',id:'claim-refund',leaseToken:'lease-refund'},
    completeRequest:async()=>{throw new Error('All-failed batches cannot complete successfully');},
    failRequest:async(_id,_lease,status,body)=>{stored={status,body};},
    inProgressError:()=>new ApiError('in progress',409),
    requestErrorStatus:e=>e instanceof ApiError?e.status:500,
    requestErrorBody:e=>({error:e.message,...(e.code?{code:e.code}:{})})
   },
   '@/server/services/image':{generateImage:async()=>{
    const pending=(generationCalls++===0)===pendingFirst;
    throw pending?new ApiError('Refund pending; contact support',503,'CREDIT_REFUND_PENDING'):new ApiError('Image upstream failure',502,'UPSTREAM_IMAGE_ERROR');
   }}
  });
  ApiError=gatewayLoader('src/server/http.ts').ApiError;
  const {POST}=gatewayLoader('src/app/api/v1/images/generations/route.ts');
  const request=()=>new Request('https://app.invalid/api/v1/images/generations',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':'refund-audit'},body:JSON.stringify({prompt:'synthetic refund audit',n:2})});
  for(let replay=0;replay<2;replay++){
   const response=await POST(request());const body=await response.json();
   assert.equal(response.status,503,'an outstanding refund must take priority regardless of error order');
   assert.equal(body.code,'CREDIT_REFUND_PENDING');assert.match(body.error,/Refund pending/);
  }
  assert.equal(generationCalls,2);assert.equal(usageCalls,0);assert.equal(stored.body.code,'CREDIT_REFUND_PENDING');
 }
}

module.exports={testPartialBatch,testUpstreamRetry,testEditRetryIdentity,testAllFailedRefundReplay,testRefundSignal};
