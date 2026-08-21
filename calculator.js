(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TimesheetCalc = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const TIME_KEYS = ["startTime", "morningOut", "morningIn", "lunchOut", "lunchIn", "afternoonOut", "afternoonIn", "finishTime"];

  function parseDuration(value) {
    if (value === "" || value == null) return 0;
    const match = String(value).trim().match(/^(-)?(\d+):([0-5]\d)$/);
    if (!match) return null;
    const minutes = Number(match[2]) * 60 + Number(match[3]);
    return match[1] ? -minutes : minutes;
  }

  function formatDuration(minutes) {
    if (minutes == null || !Number.isFinite(minutes)) return "";
    const sign = minutes < 0 ? "-" : "";
    const absolute = Math.abs(minutes);
    return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, "0")}`;
  }

  function timeMinutes(value) {
    if (!/^\d{2}:\d{2}$/.test(value || "")) return null;
    const [hours, minutes] = value.split(":").map(Number);
    return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
  }

  function session(start, end) {
    const a = timeMinutes(start), b = timeMinutes(end);
    return a == null || b == null || b < a ? null : b - a;
  }

  // A work segment may be unused (both ends blank), complete, or incomplete.
  function optionalSession(start, end) {
    if (!start && !end) return { minutes: 0, incomplete: false };
    const minutes = session(start, end);
    return { minutes: minutes == null ? 0 : minutes, incomplete: minutes == null };
  }

  function calculateDay(record, standardMinutes) {
    let morningSegments;
    if (record.morningOut || record.morningIn) {
      morningSegments = [
        optionalSession(record.startTime, record.morningOut),
        optionalSession(record.morningIn, record.lunchOut)
      ];
    } else {
      morningSegments = [optionalSession(record.startTime, record.lunchOut)];
    }
    const morningIncomplete = morningSegments.some(segment => segment.incomplete);
    const morning = morningIncomplete ? null : morningSegments.reduce((sum, segment) => sum + segment.minutes, 0);

    let afternoonSegments;
    if (record.afternoonOut || record.afternoonIn) {
      afternoonSegments = [
        optionalSession(record.lunchIn, record.afternoonOut),
        optionalSession(record.afternoonIn, record.finishTime)
      ];
    } else {
      afternoonSegments = [optionalSession(record.lunchIn, record.finishTime)];
    }
    const afternoonIncomplete = afternoonSegments.some(segment => segment.incomplete);
    const afternoon = afternoonIncomplete ? null : afternoonSegments.reduce((sum, segment) => sum + segment.minutes, 0);

    const leave = parseDuration(record.leaveHours);
    const toil = parseDuration(record.toilHours);
    const valid = !morningIncomplete && !afternoonIncomplete && leave != null && toil != null;
    const daily = valid ? morning + afternoon + (record.leaveType === "Flex" ? -leave : leave) : null;
    const dailyFlex = valid ? daily - standardMinutes - toil : null;
    return { morning, afternoon, daily, dailyFlex, toilEarned: toil, incomplete: !valid };
  }

  function dateFromISO(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }
  function isoFromDate(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
  function addDays(iso, days) { const date = dateFromISO(iso); date.setDate(date.getDate() + days); return isoFromDate(date); }
  function standardFor(date, settings) { return parseDuration(settings.standardByDay[dateFromISO(date).getDay()]) || 0; }
  function isThursdayISO(date) { return Boolean(date) && /^\d{4}-\d{2}-\d{2}$/.test(date) && dateFromISO(date).getDay() === 4; }

  function recalculate(records, settings) {
    let flex = parseDuration(settings.openingFlex) || 0;
    let toil = parseDuration(settings.openingToil) || 0;
    const calculated = {};
    Object.keys(records).sort().forEach(date => {
      const day = calculateDay(records[date], standardFor(date, settings));
      if (day.dailyFlex != null) flex += day.dailyFlex;
      if (day.toilEarned != null) toil += day.toilEarned;
      const used = records[date].leaveType === "Time off in Lieu (TOIL)" ? parseDuration(records[date].leaveHours) : 0;
      if (used != null) toil -= used;
      calculated[date] = { ...day, progressiveFlex: flex, progressiveToil: toil };
    });
    return calculated;
  }

  function fortnightFor(date, anchor) {
    const difference = Math.floor((dateFromISO(date) - dateFromISO(anchor)) / 86400000);
    const offset = ((difference % 14) + 14) % 14;
    const start = addDays(date, -offset);
    return { start, end: addDays(start, 13) };
  }

  function buildFortnightExportRows(records, settings, selectedDate) {
    const period = fortnightFor(selectedDate, settings.fortnightStart);
    const calculated = recalculate(records, settings);
    const rows = [];
    for (let offset = 0; offset < 14; offset += 1) {
      const date = addDays(period.start, offset);
      const record = records[date];
      if (!record) { rows.push([date, ...Array(14).fill("")]); continue; }
      rows.push([
        date, ...TIME_KEYS.map(key => record[key] || ""), record.leaveType || "",
        record.leaveHours || "", formatDuration(standardFor(date, settings)),
        record.attendanceType || "", record.toilHours || "", formatDuration(calculated[date].daily)
      ]);
    }
    return rows;
  }

  function fortnightsOverlappingMonth(year, month, anchor) {
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDate = new Date(year, month, 0);
    const monthEnd = isoFromDate(lastDate);
    const starts = [];
    for (let start = fortnightFor(monthStart, anchor).start; start <= monthEnd; start = addDays(start, 14)) starts.push(start);
    return starts;
  }

  return { TIME_KEYS, parseDuration, formatDuration, calculateDay, recalculate, fortnightFor, standardFor, addDays, isThursdayISO, buildFortnightExportRows, fortnightsOverlappingMonth };
});
