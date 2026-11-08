const assert = require("node:assert/strict");
const C = require("./calculator.js");
const P = require("./periods.js");
const anchor = "2026-09-24", today = "2026-11-08";
// Independent Gregorian day-number reference, without JavaScript Date parsing.
function referenceDay(y, m, d) {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400), year = y - era * 400;
  return era * 146097 + year * 365 + Math.floor(year / 4) - Math.floor(year / 100) + Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1 - 719468;
}
function iso(day) { const date = new Date(day * 86400000); return `${String(date.getUTCFullYear()).padStart(4,"0")}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}`; }
const anchorDay = referenceDay(2026,9,24), full = process.argv.includes("--full");
const firstYear = full ? 1 : 1990, lastYear = full ? 9999 : 2100;
let dates = 0;
for (let year = firstYear; year <= lastYear; year++) {
  for (let month = 1; month <= 12; month++) {
    const days = [31,year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,31,30,31,30,31,31,30,31,30,31][month-1];
    for (let day = 1; day <= days; day++) {
      const date = `${String(year).padStart(4,"0")}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const expectedDay = referenceDay(year,month,day), start = expectedDay - ((expectedDay - anchorDay) % 14 + 14) % 14;
      const actual = C.fortnightFor(date, anchor);
      const opposite = C.fortnightFor(date, "2026-09-17"), oppositeStart = expectedDay - ((expectedDay - (anchorDay-7)) % 14 + 14) % 14;
      if (opposite.start !== iso(oppositeStart) || opposite.end !== iso(oppositeStart+13)) throw Error(`Alternate Thursday-calendar mismatch at ${date}`);
      if (C.calendarDay(date) !== expectedDay || actual.start !== iso(start) || actual.end !== iso(start+13)) throw Error(`Calendar mismatch at ${date} in ${process.env.TZ}`);
      dates++;
    }
  }
}

const submissions = {}, patterns = new Map();
for (let start = C.fortnightFor("1990-01-01",anchor).start, i = 0; start <= "2100-12-31"; start = C.addDays(start,14), i++) {
  const pattern = i % 5; patterns.set(start, pattern);
  if (pattern === 0) submissions[start] = {submitted:true,changed:false};
  if (pattern === 1) submissions[C.addDays(start,1)] = {submitted:true,changed:false};
  if (pattern === 3) { submissions[start] = {submitted:true,changed:true}; submissions[C.addDays(start,1)] = {submitted:true,changed:false}; }
  if (pattern === 4) submissions[start] = {submitted:false,changed:false};
}
const original = JSON.stringify(submissions), calendar = P.createCalendar(submissions,anchor);
let periodCases = 0;
for (const [start, pattern] of patterns) {
  for (const offset of [-1, ...Array.from({length:14},(_,i)=>i), 14]) {
    const date = C.addDays(start,offset), day = C.calendarDay(date), expectedStart = iso(day - ((day-anchorDay)%14+14)%14), p = patterns.get(expectedStart);
    const submitted = [0,1,3].includes(p), state = calendar.resolve(date,{today});
    assert.equal(state.start,expectedStart); assert.equal(state.submitted,submitted); assert.equal(state.canEditRecord,!submitted); assert.equal(state.canSaveDraft,!submitted);
    const expectedStatus = submitted ? p === 3 ? "To be submitted" : "Submitted" : C.calendarDay(state.end) < C.calendarDay(today) ? "Overdue" : expectedStart === C.fortnightFor(today,anchor).start ? "Current" : "Upcoming";
    assert.equal(state.status,expectedStatus);
    const authorization = {start:expectedStart,anchor,id:77}, session = submitted ? {start:expectedStart,id:77} : null;
    const editing = calendar.resolve(date,{today,authorization,session});
    assert.equal(editing.authorized,true); assert.equal(editing.canEditRecord,true); assert.equal(editing.canResubmit,submitted);
    assert.equal(editing.status,submitted ? "To be submitted" : expectedStatus);
    const wrong = calendar.resolve(date,{today,authorization:{...authorization,start:C.addDays(expectedStart,-14)},session:{start:C.addDays(expectedStart,-14),id:77}});
    assert.equal(wrong.authorized,false); assert.equal(wrong.canEditRecord,false); assert.equal(wrong.submitted,submitted);
    assert.equal(calendar.resolve(date,{today,authorization,session:{start:expectedStart,id:78}}).authorized,false);
    assert.equal(calendar.resolve(date,{today}).canEditRecord,!submitted); // revoked/reopened
    periodCases++;
  }
}
assert.equal(JSON.stringify(submissions),original,"Resolution must never migrate or rewrite saved statuses");

// Exact reported example, plus a preceding shifted period at every generated boundary.
const regression = P.createCalendar({"2026-10-23":{submitted:true,changed:false}},anchor);
for (const date of ["2026-11-05","2026-11-06"]) { const state = regression.resolve(date,{today}); assert.equal(state.status,"Current"); assert.equal(state.submitted,false); assert.equal(state.canEditRecord,true); }
assert.equal(regression.resolve("2026-11-04",{today}).submitted,true);
for (const start of patterns.keys()) {
  const previous = C.addDays(start,-14), isolated = P.createCalendar({[C.addDays(previous,1)]:{submitted:true,changed:false}},anchor);
  for (let i=0;i<14;i++) assert.equal(isolated.resolve(C.addDays(start,i),{today}).canEditRecord,true,`Legacy spillover at ${start}`);
  assert.equal(isolated.resolve(C.addDays(start,-1),{today}).submitted,true);
}

const conflictSources = {"2026-10-22":{submitted:true,changed:false},"2026-10-23":{submitted:true,changed:true,note:"preserve"}};
const conflictCalendar = P.createCalendar(conflictSources,anchor);
assert.equal(conflictCalendar.resolve("2026-10-25",{today}).status,"To be submitted");
const approved = conflictCalendar.stamp("2026-10-22",conflictSources["2026-10-22"],"approved");
const approvedSources = {...conflictSources,"2026-10-22":approved};
assert.equal(P.createCalendar(approvedSources,anchor).resolve("2026-10-25",{today}).status,"Submitted");
assert.equal(conflictSources["2026-10-23"].changed,true,"Explicit resolution must preserve legacy metadata");
approvedSources["2026-10-23"] = {...approvedSources["2026-10-23"],changed:false};
assert.equal(P.createCalendar(approvedSources,anchor).resolve("2026-11-05",{today}).canEditRecord,true);
for (const bad of [{"2026-10-24":{submitted:true,changed:false}},{"not-a-date":{submitted:true}},{"2026-10-22":{submitted:false,changed:true}},{"2026-10-22":{submitted:"true"}}]) {
  const snapshot = JSON.stringify(bad), state = P.createCalendar(bad,anchor).resolve("2026-10-25",{today});
  assert(state.requiresReview); assert(!state.canEditRecord); assert.equal(state.status,"Calendar review required"); assert.equal(JSON.stringify(bad),snapshot);
}
assert(!P.sameCalendar(anchor,C.addDays(anchor,7))); assert(P.sameCalendar(anchor,C.addDays(anchor,14)));
assert(!P.createCalendar({},anchor).resolve(today,{today,storageError:"unreadable"}).canSaveDraft);
const stale = regression.resolve("2026-11-05",{today,storageConflict:true}); assert.equal(stale.status,"Storage changed"); assert.equal(stale.submitted,false); assert.equal(stale.canSaveDraft,false);
for (const date of ["2024-02-30","2026-13-01","2026-00-01",""]) assert(!C.isValidISODate(date));
for (const date of ["0001-01-01","0099-12-31","0100-01-01","1900-02-28","2000-02-29","2011-12-30","2100-03-01","2400-02-29","9999-12-31"]) {
  const [y,m,d] = date.split("-").map(Number); assert.equal(C.calendarDay(date),referenceDay(y,m,d));
  assert.equal(C.addDays(date,1),iso(referenceDay(y,m,d)+1));
}
for (const year of [1,99,100,1900,2000,2011,2026,2100,2400,9999]) for (const month of [1,2,10,12]) {
  const starts = C.fortnightsOverlappingMonth(year,month,anchor), first = `${String(year).padStart(4,"0")}-${String(month).padStart(2,"0")}-01`;
  assert(starts.includes(C.fortnightFor(first,anchor).start)); assert(starts.every(C.isThursdayISO));
}
console.log(`PASS ${process.env.TZ || "default"}: ${dates} civil dates in both Thursday-calendar phases (${firstYear}–${lastYear}), ${patterns.size} fortnights, ${periodCases} boundary/state/authorisation cases; legacy conflicts and read-only review verified.`);
