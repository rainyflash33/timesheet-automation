const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const C = require("./calculator.js"), P = require("./periods.js");
const anchor = "2026-09-24", record = {startTime:"09:00",lunchOut:"12:00",lunchIn:"13:00",finishTime:"16:00",morningOut:"",morningIn:"",afternoonOut:"",afternoonIn:"",attendanceType:"Flextime",leaveType:"",leaveHours:"",toilHours:""};
let stored = null, writes = 0;
const elements = new Map(), main = {inert:false};
const element = id => { if (!elements.has(id)) elements.set(id,{value:anchor,hidden:true,textContent:"",focus(){}}); return elements.get(id); };
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [2026,10,8,12])); } }
const context = vm.createContext({TimesheetCalc:C,ClockyPeriods:P,URLSearchParams,Date:FixedDate,window:{location:{search:""}},document:{getElementById:element,querySelector:()=>main,querySelectorAll:()=>[]},localStorage:{getItem:()=>stored,setItem:(key,value)=>{writes++;stored=value;}},alert:()=>{},console});
const source = fs.readFileSync(__dirname+"/app.js","utf8").split("buildUI(); renderSettings(); setSettingsExpanded(false); setHistoricalExpanded(false);")[0];
vm.runInContext(source,context);
vm.runInContext(`
  showStatus=()=>{}; renderAll=()=>{}; loadRecord=()=>true; fillForm=()=>{}; closeInterruptionEditor=()=>{}; renderInterruptionList=()=>{}; setLeaveToilExpanded=()=>{};
  readForm=()=>({...__candidate}); validateClockInputs=()=>{__validations++;return true;};validateDurationInputs=()=>true;stageInterruptionEditors=()=>true;
  guardWeekendSubmission=()=>true;workConfirmationFor=()=>null;openSubmittedWarning=()=>{__warnings++;};
`,context);
const run = code => vm.runInContext(code,context);
function prepare(date, submissions) {
  const outside = C.addDays(date,35);
  context.__fixture = {records:{[date]:{...record},[outside]:{...record}},drafts:{},activeDraftDate:"",submissions:JSON.parse(JSON.stringify(submissions)),settings:{attendanceType:"Flextime",fortnightStart:anchor,openingFlex:"0:00",openingToil:"0:00",standardByDay:["0:00","7:21","7:21","7:21","7:21","7:21","0:00"]}};
  context.__date=date;context.__candidate={...record,finishTime:"17:00"};stored=JSON.stringify(context.__fixture);context.__raw=stored;writes=0;context.__warnings=0;context.__validations=0;
  run(`state=__fixture;persistedStateRaw=__raw;storageReadError="";activeDate=__date;editMode=true;historicalSession=null;historicalEditStart="";historicalEditAuthorization=null;pendingHistoricalExit=null;pendingRecordSubmission=null;pendingWeekendRecordOpen=null;`);
  return outside;
}
function grant() {
  run(`(()=>{const start=periodFor(activeDate).start;historicalEditStart=start;historicalEditAuthorization={start,anchor:state.settings.fortnightStart,id:77};historicalSession={start,id:77,records:JSON.parse(JSON.stringify(periodEntries(state.records,start))),originalRecords:JSON.parse(JSON.stringify(periodEntries(state.records,start))),drafts:{},touched:new Set(),settings:JSON.parse(JSON.stringify(state.settings)),storageBaseline:persistedStateRaw,originalSubmission:state.submissions[start]||null,originalSubmittedPeriods:JSON.parse(JSON.stringify(submittedPeriodsFor(start)))};})()`);
}
let cases = 0;
for (let start=C.fortnightFor("1990-01-01",anchor).start;start<="2100-12-31";start=C.addDays(start,14)) {
  for (let kind=0;kind<3;kind++) {
    const statuses = {[C.addDays(start,-13)]:{submitted:true,changed:false},[C.addDays(start,14)]:{submitted:true,changed:false}};
    if (kind) statuses[C.addDays(start,kind-1)]={submitted:true,changed:false};
    for (const offset of [-1,0,1,13,14]) {
      const date=C.addDays(start,offset), id=C.fortnightFor(date,anchor).start, submitted=id!==start||kind>0;
      const outside=prepare(date,statuses), original=stored;
      assert.equal(run("periodContext().submitted"),submitted);
      assert.equal(run("submittedPeriodLocked()"),submitted);
      assert.equal(run("ensureRecordWritable(activeDate)"),!submitted);
      assert.equal(run("fortnightStatusFor(periodFor(activeDate).start)"),run("periodContext().status"));
      run("saveDraft({showSubmittedWarning:true});submitRecord({showSubmittedWarning:true});");
      if (submitted) {
        assert.equal(context.__warnings,2);assert.equal(context.__validations,0);assert.equal(writes,0);assert.equal(stored,original);
        grant();assert.equal(run("historicalEditAllowed(activeDate)"),true);
        run("saveDraft({showSubmittedWarning:true});submitRecord({showSubmittedWarning:true});");
        assert.equal(writes,0);assert.equal(stored,original);assert.equal(run("historicalSession.records[activeDate].finishTime"),"17:00");
        run("cancelEdit();discardHistoricalChanges();");
        assert.equal(stored,original);assert.equal(run("historicalSession"),null);assert(run("submittedPeriodLocked()"));
        grant();run("saveDraft({showSubmittedWarning:true});resubmitHistoricalEdit();");
        assert.equal(writes,1);assert.equal(run("historicalSession"),null);assert.equal(run("periodContext().status"),"Submitted");
        assert.equal(JSON.parse(stored).records[date].finishTime,"17:00");
        const committed=stored;run("saveDraft({showSubmittedWarning:true});submitRecord({showSubmittedWarning:true});");assert.equal(stored,committed);assert.equal(writes,1);
      } else {
        assert.equal(context.__warnings,0);assert.equal(writes,2);assert.equal(JSON.parse(stored).records[date].finishTime,"17:00");
        assert.deepEqual(JSON.parse(stored).submissions,statuses,"Daily Submit must not submit the fortnight");
      }
      assert.equal(JSON.parse(stored).records[outside].finishTime,"16:00");
      cases++;
    }
  }
}
// Same in-memory object, changed submissions: no stale cached period state.
prepare("2026-11-05",{"2026-10-23":{submitted:true,changed:false}});
assert.equal(run("periodContext().submitted"),false);run("state.submissions['2026-11-05']={submitted:true,changed:false};");assert.equal(run("periodContext().submitted"),true);
// A newer persisted snapshot must block writes before validation, without replacing input.
prepare("2026-11-05",{});stored=JSON.stringify({...context.__fixture,submissions:{"2026-11-05":{submitted:true,changed:false}}});const newer=stored;
assert.equal(run("periodContext().status"),"Storage changed");run("saveDraft({showSubmittedWarning:true});submitRecord({showSubmittedWarning:true});");assert.equal(writes,0);assert.equal(stored,newer);assert.equal(context.__validations,0);
console.log(`PASS: ${cases} actual app-handler scenarios across every 1990–2100 fortnight boundary; Save, Submit, Cancel Edit, Resubmit, source-state cache invalidation and storage-conflict protection.`);
