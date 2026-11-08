// Paste into the affected Clocky page's Web Inspector console. Read-only:
// no storage writes, record values, network requests, clipboard or uploads.
(() => {
  try {
    const raw = localStorage.getItem("personal-timesheet-v1"), data = raw ? JSON.parse(raw) : {};
    const anchor = data.settings?.fortnightStart || "", selected = document.getElementById("recordDate")?.value || "";
    if (typeof TimesheetCalc === "undefined" || !TimesheetCalc.isThursdayISO(anchor) || TimesheetCalc.addDays(anchor,0) !== anchor || !/^\d{4}-\d{2}-\d{2}$/.test(selected) || TimesheetCalc.addDays(selected,0) !== selected) return {readOnly:true,error:"A valid saved calendar and selected Record Date are required. No data was changed."};
    const C = TimesheetCalc, period = C.fortnightFor(selected,anchor), nearby = new Set([C.addDays(period.start,-14),period.start,C.addDays(period.start,14)]);
    let invalidSubmissionIdCount = 0;
    const identifiers = Object.entries(data.submissions || {}).flatMap(([id,status]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(id) || C.addDays(id,0) !== id) { invalidSubmissionIdCount++; return []; }
      const mapped = C.fortnightFor(id,anchor), known = id === mapped.start || id === C.addDays(mapped.start,1);
      if (!nearby.has(mapped.start)) return [];
      const safeDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && C.addDays(value,0) === value ? value : null;
      const metadata = status?.clockyPeriod;
      return [{storedId:id,canonicalId:mapped.start,knownIdShape:known,submitted:status?.submitted === true,changed:status?.changed === true,oldRawSpanMatchesSelected:id <= selected && selected <= C.addDays(id,13),recordedCalendar:metadata ? {version:Number.isInteger(metadata.version) ? metadata.version : null,anchor:safeDate(metadata.anchor),start:safeDate(metadata.start),end:safeDate(metadata.end)} : null}];
    });
    return {
      readOnly:true,selectedDate:selected,savedAnchor:anchor,formAnchor:document.getElementById("fortnightStart")?.value || "",period,
      canonicalSubmitted:identifiers.some(entry => entry.canonicalId === period.start && entry.submitted),
      legacySpillover:identifiers.filter(entry => entry.oldRawSpanMatchesSelected && entry.canonicalId !== period.start),
      identifiers,invalidSubmissionIdCount,
      badges:Object.fromEntries(["dailyEntryStatus","calculatedDateStatus","fortnightStatus"].map(id => [id,document.getElementById(id)?.textContent || ""])),
      authorizedPeriod:typeof historicalEditAuthorization === "undefined" ? null : historicalEditAuthorization?.start || null,
      historicalSessionPeriod:typeof historicalSession === "undefined" ? null : historicalSession?.start || null
    };
  } catch { return {readOnly:true,error:"Saved data could not be read or parsed. No data was changed; no record contents are included in this diagnostic."}; }
})()
