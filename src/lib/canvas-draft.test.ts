import assert from "node:assert/strict";
import test from "node:test";
import { readCanvasDraft, writeCanvasDraft, clearCanvasDraft, sameCanvasContent } from "./canvas-draft";

const layout = {revision:3,nodes:[{id:"149e2eee-409f-4480-bba3-68da18847df7",x:20,y:-1}],connections:[],hiddenIds:[],viewport:{x:0,y:0,zoom:1}};
function storage() {
  const values = new Map<string,string>();
  return { getItem:(key:string)=>values.get(key) ?? null, setItem:(key:string,value:string)=>{values.set(key,value);}, removeItem:(key:string)=>{values.delete(key);}, values };
}
test("drafts are isolated by account and cleared explicitly", () => {
  const target = storage();
  assert.equal(writeCanvasDraft(target,"account-a",layout),true);
  assert.deepEqual(readCanvasDraft(target,"account-a"),layout);
  assert.equal(readCanvasDraft(target,"account-b"),null);
  clearCanvasDraft(target,"account-a");
  assert.equal(readCanvasDraft(target,"account-a"),null);
});
test("invalid data and unavailable storage are contained", () => {
  const target = storage(); target.values.set("deeproast.canvas-draft.account-a","{not-json");
  assert.equal(readCanvasDraft(target,"account-a"),null);
  const denied = {getItem:()=>{throw new Error("denied");}, setItem:()=>{throw new Error("denied");}, removeItem:()=>{throw new Error("denied");}};
  assert.equal(writeCanvasDraft(denied,"account-a",layout),false);
  assert.equal(readCanvasDraft(denied,"account-a"),null);
  assert.doesNotThrow(()=>clearCanvasDraft(denied,"account-a"));
});
test("same content ignores revision but compares position and viewport", () => {
  assert.equal(sameCanvasContent(layout,{...layout,revision:4}),true);
  assert.equal(sameCanvasContent(layout,{...layout,viewport:{...layout.viewport,zoom:2}}),false);
  assert.equal(sameCanvasContent(layout,{...layout,nodes:[{...layout.nodes[0]!,x:21}]}),false);
  assert.equal(sameCanvasContent(layout,{...layout,connections:[{id:"a-b",source:layout.nodes[0]!.id,target:"249e2eee-409f-4480-bba3-68da18847df7"}]}),false);
});
