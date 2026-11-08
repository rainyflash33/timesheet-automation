(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./calculator.js"));
  else root.ClockyPeriods = factory(root.TimesheetCalc);
})(typeof globalThis !== "undefined" ? globalThis : this, function (C) {
  const copy = value => JSON.parse(JSON.stringify(value));
  const sameCalendar = (a, b) => C.isThursdayISO(a) && C.isThursdayISO(b) && C.fortnightFor(a, b).start === a;

  function createCalendar(submissions, anchor) {
    const valid = C.isThursdayISO(anchor), groups = new Map(), reviews = new Map();
    let invalidSources = 0, hasSubmitted = false;
    const review = (id, reason) => { if (!reviews.has(id)) reviews.set(id, []); reviews.get(id).push(reason); };
    for (const [id, raw] of Object.entries(submissions || {})) {
      if (!raw || typeof raw !== "object") { invalidSources++; continue; }
      hasSubmitted ||= Boolean(raw.submitted || raw.changed);
      if (!C.isValidISODate(id)) { invalidSources++; continue; }
      if (!valid) continue;
      const period = C.fortnightFor(id, anchor), offset = C.calendarDay(id) - C.calendarDay(period.start);
      const metadata = raw.clockyPeriod;
      const metadataValid = !metadata || (offset === 0 && metadata.version === 1 && metadata.start === id && metadata.end === C.addDays(id, 13) && sameCalendar(metadata.anchor, anchor));
      // The old local-midnight/DST calculation produced a start one day late.
      // Other offsets or incompatible recorded calendars cannot be inferred safely.
      if ((offset !== 0 && offset !== 1) || !metadataValid || typeof raw.submitted !== "boolean" || (raw.changed != null && typeof raw.changed !== "boolean") || (raw.changed && !raw.submitted)) {
        if (raw.submitted || raw.changed || !metadataValid || typeof raw.submitted !== "boolean") {
          for (const affected of new Set([period.start, C.fortnightFor(C.addDays(id, 13), anchor).start])) review(affected, {id, reason:"Submission ID or recorded calendar needs explicit review"});
        }
        continue;
      }
      if (!groups.has(period.start)) groups.set(period.start, {});
      groups.get(period.start)[id] = copy(raw);
    }

    function resolve(date, options = {}) {
      const period = valid ? C.fortnightFor(date, anchor) : {start:"", end:""};
      const configured = valid && Boolean(period.start), sources = groups.get(period.start) || {};
      const ids = Object.keys(sources).sort(), exact = sources[period.start], aliases = ids.filter(id => id !== period.start);
      const submitted = ids.some(id => sources[id].submitted);
      const resolved = Boolean(exact?.submitted && exact.clockyPeriod && aliases.every(id => exact.clockyPeriod.legacy?.[id] === JSON.stringify(sources[id])));
      const conflict = !resolved && ids.length > 1 && (new Set(ids.map(id => sources[id].submitted)).size > 1 || new Set(ids.filter(id => sources[id].submitted).map(id => Boolean(sources[id].changed))).size > 1);
      const changed = submitted && (resolved ? Boolean(exact.changed) : conflict || ids.some(id => sources[id].submitted && sources[id].changed));
      const issues = reviews.get(period.start) || [];
      const requiresReview = Boolean(options.storageError || invalidSources || issues.length || (!configured && hasSubmitted));
      const permission = options.authorization, session = options.session;
      const lease = Boolean(configured && permission && permission.start === period.start && permission.anchor === anchor && Number.isInteger(permission.id) && permission.id > 0);
      const sessionHere = Boolean(session && session.start === period.start && session.id === permission?.id);
      const authorized = lease && !requiresReview && (!session || sessionHere) && (!submitted || sessionHere);
      const otherSession = Boolean(session && !sessionHere);
      const storageConflict = Boolean(options.storageConflict);
      const canEditRecord = configured && !requiresReview && !storageConflict && !otherSession && (!submitted || authorized);
      const canSaveDraft = canEditRecord || (!valid && !hasSubmitted && !requiresReview && !storageConflict && !session);
      let status = "Setup required";
      if (configured) {
        if (storageConflict) status = "Storage changed";
        else if (requiresReview) status = "Calendar review required";
        else if (submitted) status = authorized || changed ? "To be submitted" : "Submitted";
        else if (C.calendarDay(period.end) < C.calendarDay(options.today)) status = "Overdue";
        else status = C.fortnightFor(options.today, anchor).start === period.start ? "Current" : "Upcoming";
      }
      return { ...period, configured, submitted, changed, conflict, requiresReview, storageConflict, authorized, sessionHere, otherSession, canEditRecord, canSaveDraft, canResubmit:authorized && sessionHere && submitted && !storageConflict, canCancel:lease && (!session || sessionHere), status, sourceEntries:sources, sourceIds:ids, legacyIds:aliases, issues, invalidSources, submission:{submitted, changed} };
    }

    function stamp(date, original = {}, time) {
      const period = resolve(date), legacy = {};
      for (const id of period.legacyIds) legacy[id] = JSON.stringify(period.sourceEntries[id]);
      return {...original, submitted:true, changed:false, submittedAt:time, clockyPeriod:{version:1, start:period.start, end:period.end, anchor, legacy}};
    }
    return {valid, resolve, stamp, periodIds:() => [...new Set([...groups.keys(), ...reviews.keys()])].sort(), sameCalendar};
  }
  return {createCalendar, sameCalendar};
});
