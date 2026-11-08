const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const C = require("./calculator.js"), P = require("./periods.js");
const source = fs.readFileSync(__dirname + "/app.js", "utf8").split("buildUI(); renderSettings(); setSettingsExpanded(false); setHistoricalExpanded(false);")[0];
const fixture = {records:{"2026-11-05":{startTime:"09:00",finishTime:"17:00",attendanceType:"Flextime",privateLegacyField:"retained"}},submissions:{"2026-10-23":{submitted:true,changed:false,legacyMetadata:{preserved:true}}},drafts:{},settings:{fortnightStart:"2026-09-24"},unknownRootField:{preserved:true}};
function boot(initial) {
  let raw = initial, writes = 0;
  const context = vm.createContext({TimesheetCalc:C,ClockyPeriods:P,URLSearchParams,Date,window:{location:{search:""}},document:{getElementById:()=>({value:"2026-09-24"})},localStorage:{getItem:()=>raw,setItem:(key,value)=>{writes++;raw=value;}},alert:()=>{}});
  vm.runInContext(source,context);
  return {run:code=>vm.runInContext(code,context),read:()=>raw,writes:()=>writes,external:value=>{raw=value;}};
}
const original = JSON.stringify(fixture), valid = boot(original);
assert.equal(valid.writes(),0); assert.equal(valid.read(),original);
assert.equal(valid.run("periodContext('2026-11-05').canEditRecord"),true);
assert.equal(valid.run("periodContext('2026-11-04').submitted"),true);
valid.run("state.settings.openingFlex='1:00';save();");
const saved = JSON.parse(valid.read());
assert.deepEqual(saved.records,fixture.records); assert.deepEqual(saved.submissions,fixture.submissions); assert.deepEqual(saved.unknownRootField,fixture.unknownRootField);
for (const bad of ["{malformed", "[]", "false", JSON.stringify({...fixture,records:{"2026-02-30":{}}}), JSON.stringify({...fixture,records:{"2026-11-05":null}}), JSON.stringify({...fixture,drafts:{"2026-11-05":{record:[]}}}), JSON.stringify({...fixture,settings:{standardByDay:["7:21"]}})]) {
  const app = boot(bad);
  assert(app.run("Boolean(storageReadError)")); assert.equal(app.run("save()"),false); assert.equal(app.read(),bad); assert.equal(app.writes(),0);
}
const stale = boot(original), newer = JSON.stringify({...fixture,submissions:{...fixture.submissions,"2026-11-05":{submitted:true,changed:false}}});
stale.external(newer);
assert.equal(stale.run("periodContext('2026-11-05').status"),"Storage changed"); assert.equal(stale.run("save()"),false); assert.equal(stale.read(),newer); assert.equal(stale.writes(),0);
console.log("PASS: legacy records and unknown metadata survive explicit saving; boot never rewrites IDs; malformed data and newer external snapshots cannot be overwritten.");
