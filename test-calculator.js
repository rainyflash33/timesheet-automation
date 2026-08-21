const assert = require("node:assert/strict");
const C = require("./calculator.js");
const settings = { openingFlex:"1:00", openingToil:"2:00", standardByDay:["0:00","7:21","7:21","7:21","7:21","7:21","0:00"] };
const base = { startTime:"09:00", morningOut:"", morningIn:"", lunchOut:"12:30", lunchIn:"13:00", afternoonOut:"", afternoonIn:"", finishTime:"16:51", leaveType:"", leaveHours:"", toilHours:"" };
let day = C.calculateDay(base, 441);
assert.deepEqual([day.morning, day.afternoon, day.daily, day.dailyFlex], [210, 231, 441, 0]);
day = C.calculateDay({...base, morningOut:"10:00", morningIn:"10:15", afternoonOut:"15:00", afternoonIn:"15:10", finishTime:"17:16"}, 441);
assert.deepEqual([day.morning, day.afternoon, day.daily], [195, 246, 441]);
day = C.calculateDay({...base, leaveType:"Annual", leaveHours:"1:00"}, 441);
assert.equal(day.daily, 501);
day = C.calculateDay({...base, leaveType:"Flex", leaveHours:"0:30"}, 441);
assert.deepEqual([day.daily, day.dailyFlex], [471, 30]);
assert.equal(C.calculateDay({...base, finishTime:""}, 441).daily, null);

// Regression: blank optional morning interruption must not require Morning In.
const reportedCase = {
  startTime:"09:11", morningOut:"", morningIn:"", lunchOut:"12:59",
  lunchIn:"13:50", afternoonOut:"", afternoonIn:"", finishTime:"17:33",
  leaveType:"", leaveHours:"", toilHours:""
};
day = C.calculateDay(reportedCase, 441);
assert.deepEqual([day.morning, day.afternoon, day.daily], [228, 223, 451]);

// Partial work and full-day leave are valid without a complete-day time pattern.
const morningPlusAnnualLeave = {
  startTime:"09:00", morningOut:"12:21", morningIn:"", lunchOut:"",
  lunchIn:"", afternoonOut:"", afternoonIn:"", finishTime:"",
  leaveType:"Annual", leaveHours:"4:00", toilHours:""
};
day = C.calculateDay(morningPlusAnnualLeave, 441);
assert.deepEqual([day.morning, day.afternoon, day.daily, day.dailyFlex], [201, 0, 441, 0]);

const fullDayAnnualLeave = {
  startTime:"", morningOut:"", morningIn:"", lunchOut:"", lunchIn:"",
  afternoonOut:"", afternoonIn:"", finishTime:"",
  leaveType:"Annual", leaveHours:"7:21", toilHours:""
};
day = C.calculateDay(fullDayAnnualLeave, 441);
assert.deepEqual([day.morning, day.afternoon, day.daily, day.dailyFlex], [0, 0, 441, 0]);

// Flex leave contributes effective hours in the same way as approved leave.
day = C.calculateDay({...fullDayAnnualLeave, leaveType:"Flex"}, 441);
assert.deepEqual([day.morning, day.afternoon, day.daily, day.dailyFlex], [0, 0, 441, 0]);

const partialWorkPlusFlex = {
  startTime:"09:00", morningOut:"13:00", morningIn:"", lunchOut:"",
  lunchIn:"", afternoonOut:"", afternoonIn:"", finishTime:"",
  leaveType:"Flex", leaveHours:"3:21", toilHours:""
};
day = C.calculateDay(partialWorkPlusFlex, 441);
assert.deepEqual([day.morning, day.afternoon, day.daily, day.dailyFlex], [240, 0, 441, 0]);

const eightHourWorkday = {
  startTime:"09:00", morningOut:"", morningIn:"", lunchOut:"13:00",
  lunchIn:"14:00", afternoonOut:"", afternoonIn:"", finishTime:"18:00",
  leaveType:"", leaveHours:"", toilHours:""
};
day = C.calculateDay(eightHourWorkday, 441);
assert.deepEqual([day.daily, day.dailyFlex], [480, 39]);

const flexLeaveDate = "2026-08-20";
let flexBalances = C.recalculate(
  {[flexLeaveDate]: {...fullDayAnnualLeave, leaveType:"Flex"}},
  {...settings, openingFlex:"10:00"}
);
assert.deepEqual(
  [flexBalances[flexLeaveDate].daily, flexBalances[flexLeaveDate].dailyFlex, flexBalances[flexLeaveDate].progressiveFlex],
  [441, 0, 159]
);
flexBalances = C.recalculate(
  {[flexLeaveDate]: {...fullDayAnnualLeave, leaveType:"Flex"}},
  {...settings, openingFlex:"0:00"}
);
assert.equal(flexBalances[flexLeaveDate].progressiveFlex, -441);

day = C.calculateDay({...fullDayAnnualLeave, leaveType:"Public Holiday"}, 441);
assert.deepEqual([day.morning, day.afternoon, day.daily, day.dailyFlex], [0, 0, 441, 0]);
const records = {
  "2026-08-17": {...base, toilHours:"1:00"},
  "2026-08-18": {...base, leaveType:"Time off in Lieu (TOIL)", leaveHours:"0:30"}
};
let all = C.recalculate(records, settings);
assert.equal(all["2026-08-18"].progressiveFlex, 30);
assert.equal(all["2026-08-18"].progressiveToil, 150);
records["2026-08-17"] = {...records["2026-08-17"], finishTime:"17:21"};
all = C.recalculate(records, settings);
assert.equal(all["2026-08-18"].progressiveFlex, 60);
assert.deepEqual(C.fortnightFor("2026-08-21", "2026-08-17"), {start:"2026-08-17", end:"2026-08-30"});
assert.equal(C.isThursdayISO("2026-08-20"), true);
assert.equal(C.isThursdayISO("2026-08-19"), false);
assert.equal(C.isThursdayISO("2026-08-21"), false);
assert.equal(C.isThursdayISO(""), false);
const exportSettings = {...settings, fortnightStart:"2026-08-20"};
const exportRows = C.buildFortnightExportRows({"2026-08-20": base}, exportSettings, "2026-08-21");
assert.equal(exportRows.length, 14);
assert.equal(exportRows[0].length, 15);
assert.equal(exportRows[0][0], "2026-08-20");
assert.equal(exportRows[13][0], "2026-09-02");
assert.deepEqual(exportRows[2], ["2026-08-22", ...Array(14).fill("")]);
assert.deepEqual(C.fortnightsOverlappingMonth(2026, 8, "2026-08-20"), ["2026-07-23", "2026-08-06", "2026-08-20"]);
console.log("All calculation tests passed.");
