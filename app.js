const C = TimesheetCalc;
const STORAGE_KEY = "personal-timesheet-v1";
const TEST_MODE = new URLSearchParams(window.location.search).has("test");
const LEAVE_TYPES = ["", "Other", "Prior to Commencement", "Christmas Shutdown", "Public Holiday", "Long Service", "Maternity", "Bonding", "Primary Care Giver", "Purchased", "Without Pay", "Compassionate", "Study", "Time off in Lieu (TOIL)", "Recovery Leave (SOGA/B)", "Flex", "Annual", "Personal (No Certificate)", "Personal (Certificate)"];
const FIELD_GROUPS = {
  basicFields: [["startTime", "Start Work"], ["lunchOut", "Lunch Out"], ["lunchIn", "Lunch In"], ["finishTime", "Finish Work"]]
};
const RECORD_FIELDS = [...C.TIME_KEYS, "leaveType", "leaveHours", "attendanceType", "toilHours"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const defaults = { records: {}, submissions: {}, settings: { fortnightStart: "", openingFlex: "0:00", openingToil: "0:00", standardByDay: ["0:00", "7:21", "7:21", "7:21", "7:21", "7:21", "0:00"] } };
let state = load();
let activeDate = todayISO();
let viewStart = "";
let draft = emptyRecord();
let originalDraft = emptyRecord();
let originalSettings = "";
let reminderStart = "";
let filterYear = new Date().getFullYear();
let filterMonth = new Date().getMonth() + 1;
let editingInterruption = "";
let originalInterruptionEditor = "";
let editMode = false;
let pendingRecordSubmission = null;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function el(id) { return document.getElementById(id); }
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { records: saved.records || {}, submissions: saved.submissions || {}, settings: { ...defaults.settings, ...saved.settings } } : clone(defaults);
  } catch { return clone(defaults); }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch (error) { alert(`The app could not save to local storage: ${error.message}`); return false; }
}
function emptyRecord() { return { startTime:"", morningOut:"", morningIn:"", lunchOut:"", lunchIn:"", afternoonOut:"", afternoonIn:"", finishTime:"", leaveType:"", leaveHours:"", attendanceType:"Flextime", toilHours:"" }; }
function validAnchor() { return C.isThursdayISO(state.settings.fortnightStart); }
function selectedAnchorValid() { return C.isThursdayISO(el("fortnightStart")?.value || ""); }
function fortnightCalculationAllowed() { return validAnchor() && selectedAnchorValid(); }
function anchorReminder() { alert("Set a Fortnight Start Date before submitting records. The fortnight must start on a Thursday."); }
function ensureValidAnchor() {
  const selected = el("fortnightStart").value;
  if (!C.isThursdayISO(selected)) { setSettingsExpanded(true); anchorReminder(); el("fortnightStart").focus(); return false; }
  if (!validAnchor() || selected !== state.settings.fortnightStart) {
    setSettingsExpanded(true);
    alert("Save the Thursday Fortnight Start Date in Settings before submitting records.");
    el("fortnightStart").focus(); return false;
  }
  return true;
}
function recordsEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function interruptionEditorSnapshot() { return el("interruptionEditor")?.hidden ? "" : JSON.stringify([el("interruptionOut").value, el("interruptionIn").value]); }
function interruptionEditorIsDirty() { return interruptionEditorSnapshot() !== originalInterruptionEditor; }
function draftIsDirty() { return !recordsEqual(draft, originalDraft) || interruptionEditorIsDirty(); }
function settingsAreDirty() { return settingsSnapshot() !== originalSettings; }

function buildUI() {
  Object.entries(FIELD_GROUPS).forEach(([container, fields]) => fields.forEach(([key, label]) => {
    const row = document.createElement("div"); row.className = "time-row";
    row.innerHTML = `<label for="${key}">${label}</label><input id="${key}" class="clock-time" data-record-time type="text" inputmode="numeric" maxlength="5" pattern="(?:[01]\\d|2[0-3]):[0-5]\\d" placeholder="HHMM" aria-label="${label}, 24-hour time" aria-describedby="${key}Error"><button data-stamp="${key}">Now</button><span id="${key}Error" class="time-error" hidden>Enter a valid time from 0000 to 2359.</span>`;
    el(container).append(row);
  }));
  el("leaveType").innerHTML = LEAVE_TYPES.map(value => `<option>${value}</option>`).join("");
  DAY_NAMES.forEach((name, index) => {
    const label = document.createElement("label"); label.innerHTML = `${name}<input id="standard${index}" data-duration data-setting-duration inputmode="numeric" placeholder="HMM" aria-describedby="standard${index}Error"><span id="standard${index}Error" class="field-error" role="alert" hidden>Use digits such as 721; minutes must be 00–59.</span>`; el("weekdaySettings").append(label);
  });
  el("interruptionInputs").innerHTML = [["interruptionOut", "Time Out"], ["interruptionIn", "Time In"]].map(([id, label]) => `<div class="time-row"><label for="${id}">${label}</label><input id="${id}" class="clock-time" data-interruption-time type="text" inputmode="numeric" maxlength="5" pattern="(?:[01]\\d|2[0-3]):[0-5]\\d" placeholder="HHMM" aria-describedby="${id}Error"><button data-interruption-now="${id}">Now</button><span id="${id}Error" class="time-error" hidden>Enter a valid time from 0000 to 2359.</span></div>`).join("");
  document.querySelectorAll("[data-stamp]").forEach(button => button.addEventListener("click", () => {
    const now = new Date(), input = el(button.dataset.stamp); input.value = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`; setClockError(input, false); updateDraft();
  }));
  document.querySelectorAll("[data-interruption-now]").forEach(button => button.addEventListener("click", () => {
    const now = new Date(), input = el(button.dataset.interruptionNow); input.value = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`; setClockError(input, false);
  }));
  document.querySelectorAll(".clock-time").forEach(input => {
    input.addEventListener("input", () => { formatClockInput(input); if (input.dataset.recordTime != null) updateDraft(); });
    input.addEventListener("change", () => { formatClockInput(input, true); if (input.dataset.recordTime != null) updateDraft(); });
  });
  document.querySelectorAll("[data-duration]").forEach(input => {
    input.addEventListener("input", () => { setDurationError(input, false); if (input.dataset.recordDuration != null) updateDraft(); });
    input.addEventListener("change", () => { formatDurationInput(input, true); if (input.dataset.recordDuration != null) updateDraft(); });
  });
  el("attendanceType").addEventListener("change", updateDraft);
  el("leaveType").addEventListener("change", () => {
    if (el("leaveType").value === "Public Holiday" && !el("leaveHours").value) el("leaveHours").value = state.settings.standardByDay[new Date(`${activeDate}T00:00:00`).getDay()];
    updateDraft();
  });
  el("recordDate").addEventListener("change", () => changeRecord(el("recordDate").value));
  el("viewFortnight").addEventListener("change", () => changeFortnight(el("viewFortnight").value));
  el("filterYear").addEventListener("change", () => changePeriodFilter(Number(el("filterYear").value), filterMonth));
  el("filterMonth").addEventListener("change", () => changePeriodFilter(filterYear, Number(el("filterMonth").value)));
  el("toggleInterruptions").addEventListener("click", () => openInterruptionEditor());
  el("saveInterruption").addEventListener("click", saveInterruption);
  el("cancelInterruption").addEventListener("click", closeInterruptionEditor);
  el("submitRecord").addEventListener("click", submitRecord);
  el("cancelEdit").addEventListener("click", cancelEdit);
  el("saveSettings").addEventListener("click", saveSettings);
  el("settingsToggle").addEventListener("click", () => setSettingsExpanded(el("settingsContent").hidden));
  el("settingsToggle").addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSettingsExpanded(el("settingsContent").hidden);
    }
  });
  ["input", "change"].forEach(eventName => el("fortnightStart").addEventListener(eventName, () => { updateConfigurationValidity(); renderAll(); }));
  el("exportCsv").addEventListener("click", () => exportCsv());
  el("emailCsv").addEventListener("click", openEmailModal);
  el("sendEmailCsv").addEventListener("click", () => sendEmailCsv());
  el("closeEmailModal").addEventListener("click", closeEmailModal);
  el("cancelEmail").addEventListener("click", closeEmailModal);
  el("emailModal").addEventListener("click", event => { if (event.target === el("emailModal")) closeEmailModal(); });
  el("emailTo").addEventListener("input", () => { el("emailToError").hidden = true; el("emailTo").removeAttribute("aria-invalid"); });
  el("closeWelcome").addEventListener("click", closeWelcomeModal);
  el("confirmSpecialWork").addEventListener("click", confirmPendingRecordSubmission);
  el("cancelSpecialWork").addEventListener("click", closeWorkConfirmation);
  el("openFeedback").addEventListener("click", openFeedbackModal);
  el("closeFeedback").addEventListener("click", closeFeedbackModal);
  el("cancelFeedback").addEventListener("click", closeFeedbackModal);
  el("validateFeedback").addEventListener("click", prepareFeedback);
  el("feedbackModal").addEventListener("click", event => { if (event.target === el("feedbackModal")) closeFeedbackModal(); });
  el("feedbackImprove").addEventListener("input", () => { el("feedbackImproveError").hidden = true; el("feedbackImprove").removeAttribute("aria-invalid"); });
  document.querySelectorAll('[name="feedbackRating"]').forEach(input => input.addEventListener("change", () => { el("feedbackRatingError").hidden = true; }));
  el("markSubmitted").addEventListener("click", markFortnightSubmitted);
  window.addEventListener("beforeunload", event => { if (draftIsDirty() || settingsAreDirty()) { event.preventDefault(); event.returnValue = ""; } });
}

function normalizeClockTime(value) {
  const trimmed = value.trim();
  const digits = trimmed.match(/^(\d{2})(\d{2})$/);
  const match = digits || trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value.trim();
  const hours = Number(match[1]), minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? `${String(hours).padStart(2, "0")}:${match[2]}` : value.trim();
}
function clockTimeIsValid(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function setClockError(input, show) {
  const error = el(`${input.id}Error`);
  if (error) error.hidden = !show;
  input.setAttribute("aria-invalid", String(show));
}
function formatClockInput(input, final = false) {
  const raw = input.value.trim();
  const normalized = normalizeClockTime(raw);
  if (clockTimeIsValid(normalized)) input.value = normalized;
  const definitelyInvalid = /^\d{4}$/.test(raw) && !clockTimeIsValid(normalized);
  setClockError(input, raw !== "" && (definitelyInvalid || (final && !clockTimeIsValid(normalized))));
  return clockTimeIsValid(input.value) || input.value === "";
}
function validateClockInputs(selector) {
  const inputs = [...document.querySelectorAll(selector)];
  const invalid = inputs.filter(input => !formatClockInput(input, true));
  if (invalid.length) invalid[0].focus();
  return invalid.length === 0;
}
function normalizeDurationInput(value) {
  const raw = String(value ?? "").trim();
  const existing = raw.match(/^(-?)(\d+):([0-5]\d)$/);
  if (existing) return `${existing[1]}${Number(existing[2])}:${existing[3]}`;
  const compact = raw.match(/^(-?)(\d{3,})$/) || raw.match(/^(-)(\d{2})$/);
  if (!compact) return raw;
  const digits = compact[2], minutes = digits.slice(-2);
  if (Number(minutes) > 59) return raw;
  return `${compact[1]}${Number(digits.slice(0, -2))}:${minutes}`;
}
function durationIsValid(value) { return /^-?\d+:[0-5]\d$/.test(value); }
function setDurationError(input, show) {
  const error = el(`${input.id}Error`);
  if (error) error.hidden = !show;
  input.setAttribute("aria-invalid", String(show));
}
function formatDurationInput(input, final = false) {
  const raw = input.value.trim(), normalized = normalizeDurationInput(raw);
  if (durationIsValid(normalized)) input.value = normalized;
  const invalid = raw !== "" && !durationIsValid(normalized);
  setDurationError(input, final && invalid);
  return raw === "" || !invalid;
}
function validateDurationInputs(selector) {
  const inputs = [...document.querySelectorAll(selector)];
  const invalid = inputs.filter(input => !formatDurationInput(input, true));
  if (invalid.length) invalid[0].focus();
  return invalid.length === 0;
}
function readForm() {
  const value = clone(draft);
  RECORD_FIELDS.forEach(key => { if (el(key)) value[key] = el(key).value.trim(); });
  return value;
}
function fillForm(value) {
  RECORD_FIELDS.forEach(key => { if (el(key)) el(key).value = value[key] || (key === "attendanceType" ? "Flextime" : ""); });
  document.querySelectorAll("[data-record-time]").forEach(input => setClockError(input, false));
  document.querySelectorAll("[data-record-duration]").forEach(input => setDurationError(input, false));
}
function updateDraft() { draft = readForm(); renderCurrentPreview(); updateActionState(); }

function openInterruptionEditor(slot = "") {
  editingInterruption = slot;
  const prefix = slot === "morning" ? "morning" : slot === "afternoon" ? "afternoon" : "";
  el("interruptionOut").value = prefix ? draft[`${prefix}Out`] : "";
  el("interruptionIn").value = prefix ? draft[`${prefix}In`] : "";
  el("interruptionEditor").hidden = false;
  originalInterruptionEditor = interruptionEditorSnapshot();
  el("interruptionOut").focus();
}
function closeInterruptionEditor() {
  editingInterruption = ""; el("interruptionEditor").hidden = true;
  el("interruptionOut").value = ""; el("interruptionIn").value = "";
  document.querySelectorAll("[data-interruption-time]").forEach(input => setClockError(input, false));
  originalInterruptionEditor = "";
}
function saveInterruption() {
  if (!validateClockInputs("[data-interruption-time]")) return;
  const out = normalizeClockTime(el("interruptionOut").value), incoming = normalizeClockTime(el("interruptionIn").value);
  const lunchOut = normalizeClockTime(draft.lunchOut), lunchIn = normalizeClockTime(draft.lunchIn);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(out) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(incoming) || out >= incoming) { alert("Enter a complete Additional Time Entry with an Out time before its In time."); return; }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(lunchOut) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(lunchIn) || lunchOut >= lunchIn) { alert("Enter valid Lunch Out and Lunch In times before adding an Additional Time Entry, so it can be placed correctly."); return; }
  let slot = "";
  if (incoming <= lunchOut) slot = "morning";
  else if (out >= lunchIn) slot = "afternoon";
  else { alert("The Additional Time Entry overlaps the lunch period. Please adjust its Out and In times."); return; }
  if (!editingInterruption && (draft[`${slot}Out`] || draft[`${slot}In`])) { alert(`Only one Additional Time Entry ${slot === "morning" ? "before lunch" : "after lunch"} is allowed in Version 1.`); return; }
  if (editingInterruption !== slot && (draft[`${slot}Out`] || draft[`${slot}In`])) { alert(`An Additional Time Entry ${slot === "morning" ? "before lunch" : "after lunch"} already exists.`); return; }
  if (editingInterruption && editingInterruption !== slot) {
    draft[`${editingInterruption}Out`] = ""; draft[`${editingInterruption}In`] = "";
  }
  draft[`${slot}Out`] = out; draft[`${slot}In`] = incoming;
  closeInterruptionEditor(); renderInterruptionList(); renderCurrentPreview(); updateActionState();
}
function removeInterruption(slot) {
  draft[`${slot}Out`] = ""; draft[`${slot}In`] = "";
  closeInterruptionEditor(); renderInterruptionList(); renderCurrentPreview(); updateActionState();
}
function renderInterruptionList() {
  const items = [
    { slot:"morning", out:draft.morningOut, incoming:draft.morningIn },
    { slot:"afternoon", out:draft.afternoonOut, incoming:draft.afternoonIn }
  ].filter(item => item.out || item.incoming).sort((a, b) => (a.out || a.incoming).localeCompare(b.out || b.incoming));
  const list = el("interruptionList"); list.hidden = items.length === 0;
  list.innerHTML = items.map(item => `<div class="interruption-item"><strong>Additional Time Entry</strong><span>${item.out || "—"}–${item.incoming || "—"}</span><div><button class="link-button" data-edit-interruption="${item.slot}">Edit</button><button class="link-button danger" data-remove-interruption="${item.slot}">Remove</button></div></div>`).join("");
  list.querySelectorAll("[data-edit-interruption]").forEach(button => button.addEventListener("click", () => openInterruptionEditor(button.dataset.editInterruption)));
  list.querySelectorAll("[data-remove-interruption]").forEach(button => button.addEventListener("click", () => removeInterruption(button.dataset.removeInterruption)));
}

function periodFor(date) { return C.fortnightFor(date, state.settings.fortnightStart); }
function formatPeriod(start) {
  const formatter = new Intl.DateTimeFormat("en-AU", { day:"numeric", month:"short", year:"numeric" });
  const localDate = iso => { const [y,m,d] = iso.split("-").map(Number); return new Date(y,m-1,d); };
  return `${formatter.format(localDate(start))} – ${formatter.format(localDate(C.addDays(start, 13)))}`;
}
function rebuildFortnightSelector() {
  const yearSelect = el("filterYear"), monthSelect = el("filterMonth"), selector = el("viewFortnight");
  if (!fortnightCalculationAllowed()) {
    yearSelect.innerHTML = monthSelect.innerHTML = selector.innerHTML = `<option value="">Setup required</option>`;
    yearSelect.disabled = monthSelect.disabled = selector.disabled = true; return;
  }
  yearSelect.disabled = monthSelect.disabled = selector.disabled = false;
  const knownDates = [todayISO(), state.settings.fortnightStart, ...Object.keys(state.records), ...Object.keys(state.submissions)];
  const years = knownDates.map(date => Number(date.slice(0, 4)));
  const minYear = Math.min(...years), maxYear = Math.max(...years);
  yearSelect.innerHTML = Array.from({length:maxYear-minYear+1}, (_, i) => minYear+i).map(year => `<option value="${year}"${year === filterYear ? " selected" : ""}>${year}</option>`).join("");
  const monthNames = Array.from({length:12}, (_, i) => new Intl.DateTimeFormat("en-AU", {month:"long"}).format(new Date(2020, i, 1)));
  monthSelect.innerHTML = monthNames.map((name, i) => `<option value="${i+1}"${i+1 === filterMonth ? " selected" : ""}>${name}</option>`).join("");
  const starts = C.fortnightsOverlappingMonth(filterYear, filterMonth, state.settings.fortnightStart);
  if (!starts.includes(viewStart)) {
    const currentStart = periodFor(todayISO()).start;
    viewStart = starts.includes(currentStart) ? currentStart : starts[0];
  }
  selector.innerHTML = starts.map(start => `<option value="${start}"${start === viewStart ? " selected" : ""}>${formatPeriod(start)}</option>`).join("");
}
function changePeriodFilter(year, month) {
  if (draftIsDirty() && !confirm("Discard your unsaved changes and filter another month?")) { rebuildFortnightSelector(); return; }
  filterYear = year; filterMonth = month; viewStart = "";
  rebuildFortnightSelector();
  const end = C.addDays(viewStart, 13), savedDates = Object.keys(state.records).filter(date => date >= viewStart && date <= end).sort();
  const nextDate = todayISO() >= viewStart && todayISO() <= end ? todayISO() : (savedDates[0] || viewStart);
  loadRecord(nextDate, true);
}
function changeFortnight(start) {
  if (draftIsDirty() && !confirm("Discard your unsaved changes and view another fortnight?")) { el("viewFortnight").value = viewStart; return; }
  viewStart = start;
  const end = C.addDays(start, 13), savedDates = Object.keys(state.records).filter(date => date >= start && date <= end).sort();
  const nextDate = todayISO() >= start && todayISO() <= end ? todayISO() : (savedDates[0] || start);
  loadRecord(nextDate, true);
}

function changeRecord(date) {
  if (!date || (viewStart && (date < viewStart || date > C.addDays(viewStart, 13)))) { alert("Choose a Record date within the fortnight currently being viewed."); el("recordDate").value = activeDate; return; }
  if (draftIsDirty() && !confirm("Discard your unsaved changes and open another record?")) { el("recordDate").value = activeDate; return; }
  loadRecord(date, true);
}
function loadRecord(date, force = false, mode = "new") {
  if (!force && draftIsDirty() && !confirm("Discard your unsaved changes and open another record?")) return;
  activeDate = date; el("recordDate").value = date;
  editMode = mode === "edit";
  draft = editMode ? clone(state.records[date]) : emptyRecord(); originalDraft = clone(draft);
  fillForm(draft); closeInterruptionEditor(); renderInterruptionList(); renderAll();
  return true;
}
function submitRecord() {
  if (!fortnightCalculationAllowed()) { setSettingsExpanded(true); alert("Please set the Fortnight Start Date to a Thursday before saving records."); el("fortnightStart").focus(); return; }
  if (!validateClockInputs("[data-record-time]")) return;
  if (!validateDurationInputs("[data-record-duration]")) return;
  if (interruptionEditorIsDirty()) { alert("Save or cancel the Additional Time Entry before submitting the daily record."); return; }
  const existed = Object.prototype.hasOwnProperty.call(state.records, activeDate);
  if (!editMode && existed) { alert("A record already exists for this date. Use Edit in Timesheet History to change it."); return; }
  if (editMode && !existed) { alert("This record no longer exists. Cancel the edit and submit it as a new record."); return; }
  const candidateRecord = readForm();
  draft = clone(candidateRecord);
  if (!validateInterruptions(candidateRecord)) return;
  const submission = { date:activeDate, candidateRecord:clone(candidateRecord), previous:state.records[activeDate] ? clone(state.records[activeDate]) : null, existed, wasEditMode:editMode };
  if (!guardWeekendSubmission(activeDate, candidateRecord, submission)) return;
  const publicHolidayConfirmation = workConfirmationFor(activeDate, candidateRecord);
  if (publicHolidayConfirmation) { queueRecordConfirmation(submission, publicHolidayConfirmation); return; }
  commitRecordSubmission(submission);
}
function commitRecordSubmission(submission) {
  const { date, candidateRecord, previous, existed } = submission;
  state.records[date] = clone(candidateRecord);
  const submittedChanged = !recordsEqual(previous, candidateRecord) && flagSubmittedChange(date);
  if (!save()) { if (previous) state.records[date] = previous; else delete state.records[date]; return; }
  editMode = false; draft = emptyRecord(); originalDraft = clone(draft); fillForm(draft); closeInterruptionEditor(); renderInterruptionList();
  renderAll(); showStatus(existed ? "Changes saved. Later balances have been recalculated." : "Record submitted and added to Timesheet History.");
  if (submittedChanged) alert("This fortnight was previously submitted. The saved record has changed and the fortnight may need to be resubmitted.");
}
function guardWeekendSubmission(date, candidateRecord, submission) {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  if ((weekday !== 0 && weekday !== 6) || !hasMeaningfulTimesheetData(candidateRecord)) return true;
  const publicHoliday = candidateRecord.leaveType === "Public Holiday";
  queueRecordConfirmation(submission, publicHoliday ? {
    title:"Please confirm this timesheet entry",
    message:"You have entered timesheet information for a weekend or public holiday. Please confirm that this is correct."
  } : {
    title:"Please confirm this weekend entry",
    message:"You have entered timesheet information for a Saturday or Sunday. Are you sure you want to submit this entry?"
  });
  return false;
}
function workConfirmationFor(date, record) {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const weekend = weekday === 0 || weekday === 6;
  const publicHoliday = record.leaveType === "Public Holiday";
  const publicHolidayAdditionalEntry = hasMeaningfulTimesheetData(record, true);
  if (weekend || !publicHoliday || !publicHolidayAdditionalEntry) return null;
  return {
    title:"Please confirm this public holiday entry",
    message:"You have entered timesheet information for a public holiday. Please confirm that this is correct."
  };
}
function hasMeaningfulTimesheetData(record, excludeLeaveType = false) {
  return RECORD_FIELDS.some(key => {
    if (excludeLeaveType && key === "leaveType") return false;
    if (key === "attendanceType") return Boolean(record[key] && record[key] !== "Flextime");
    return Boolean(record[key]);
  });
}
function queueRecordConfirmation(submission, details) {
  pendingRecordSubmission = clone(submission);
  openWorkConfirmation(details);
}
function confirmPendingRecordSubmission() {
  const submission = pendingRecordSubmission;
  if (!submission) return;
  closeWorkConfirmation();
  commitRecordSubmission(submission);
}
function openWorkConfirmation(details) {
  el("workConfirmationTitle").textContent = details.title;
  el("workConfirmationMessage").textContent = details.message;
  el("workConfirmationModal").hidden = false;
  el("confirmSpecialWork").focus();
}
function closeWorkConfirmation() {
  pendingRecordSubmission = null;
  el("workConfirmationModal").hidden = true;
  el("submitRecord").focus();
}
function cancelEdit() {
  if (!editMode) return;
  if (draftIsDirty() && !confirm("Discard your unsaved changes and cancel editing?")) return;
  editMode = false; draft = emptyRecord(); originalDraft = clone(draft);
  fillForm(draft); closeInterruptionEditor(); renderInterruptionList(); renderAll(); showStatus("Edit cancelled.");
}
function validateInterruptions(record) {
  const hasMorning = record.morningOut || record.morningIn;
  const hasAfternoon = record.afternoonOut || record.afternoonIn;
  if ((hasMorning || hasAfternoon) && (!record.lunchOut || !record.lunchIn)) {
    alert("Enter Lunch Out and Lunch In so each Additional Time Entry can be placed outside the lunch period."); return false;
  }
  if (hasMorning && (!record.morningOut || !record.morningIn || record.morningOut >= record.morningIn)) {
    alert("Complete the Additional Time Entry Out and In times before submitting."); return false;
  }
  if (hasAfternoon && (!record.afternoonOut || !record.afternoonIn || record.afternoonOut >= record.afternoonIn)) {
    alert("Complete the Additional Time Entry Out and In times before submitting."); return false;
  }
  if ((hasMorning && record.morningIn > record.lunchOut) || (hasAfternoon && record.afternoonOut < record.lunchIn)) {
    alert("An Additional Time Entry overlaps the lunch period. Please adjust its times before submitting."); return false;
  }
  return true;
}
function deleteRecord(date) {
  const currentDirty = date === activeDate && draftIsDirty();
  const message = currentDirty ? `Delete ${date} and discard its unsaved changes? This cannot be undone.` : `Delete the record for ${date}? This cannot be undone.`;
  if (!confirm(message)) return;
  const submittedChanged = flagSubmittedChange(date);
  const deleted = state.records[date]; delete state.records[date];
  if (!save()) { state.records[date] = deleted; return; }
  if (date === activeDate) { editMode = false; draft = emptyRecord(); originalDraft = clone(draft); fillForm(draft); closeInterruptionEditor(); renderInterruptionList(); }
  renderAll(); showStatus("Record deleted. Later balances have been recalculated.");
  if (submittedChanged) alert("This fortnight was previously submitted. A record was deleted and the fortnight may need to be resubmitted.");
}

function flagSubmittedChange(date) {
  if (!validAnchor()) return false;
  const start = C.fortnightFor(date, state.settings.fortnightStart).start;
  const submission = state.submissions[start];
  if (!submission?.submitted) return false;
  submission.changed = true;
  return true;
}

function renderAll() {
  updateConfigurationValidity();
  const savedCalc = fortnightCalculationAllowed() ? C.recalculate(state.records, state.settings) : {};
  const previewRecords = currentPreviewRecords();
  const previewCalc = fortnightCalculationAllowed() ? C.recalculate(previewRecords, state.settings) : {};
  rebuildFortnightSelector(); updateRecordDateBounds();
  renderCalculations(previewCalc); renderFortnight(previewCalc, previewRecords); renderRecords(savedCalc); renderSubmissionReminder(); renderFortnightStatus(); updateActionState();
}
function updateRecordDateBounds() {
  if (!viewStart) { el("recordDate").removeAttribute("min"); el("recordDate").removeAttribute("max"); return; }
  el("recordDate").min = viewStart; el("recordDate").max = C.addDays(viewStart, 13);
}
function draftHasAttendanceData() {
  return C.TIME_KEYS.some(key => draft[key]) || Boolean(draft.leaveType || draft.leaveHours || draft.toilHours);
}
function currentPreviewRecords() {
  const records = { ...state.records };
  if (editMode || draftIsDirty() || draftHasAttendanceData()) records[activeDate] = clone(draft);
  return records;
}
function renderCurrentPreview() {
  if (!fortnightCalculationAllowed()) { renderCalculations({}); renderFortnight({}, {}); return; }
  const records = currentPreviewRecords();
  const calc = C.recalculate(records, state.settings);
  renderCalculations(calc); renderFortnight(calc, records);
}
function renderCalculations(calc) {
  if (!fortnightCalculationAllowed()) {
    metricList("dailyResults", [["Daily Hours", null], ["Daily Flex Balance", null], ["Progressive Flex Balance", null], ["Progressive TOIL Balance", null]]);
    showStatus("Invalid fortnight start date"); return;
  }
  let day = calc[activeDate];
  if (!day) day = C.recalculate({ ...state.records, [activeDate]: draft }, state.settings)[activeDate];
  metricList("dailyResults", [["Daily Hours", day.daily], ["Daily Flex Balance", day.dailyFlex], ["Progressive Flex Balance", day.progressiveFlex], ["Progressive TOIL Balance", day.progressiveToil]]);
  if (day.incomplete) showStatus("Incomplete record — complete both ends of each work segment you started.");
  else if (draftIsDirty()) showStatus("Unsaved changes");
  else showStatus("");
}
function updateActionState() {
  el("submitRecord").textContent = editMode ? "Save Changes" : "Submit";
  el("cancelEdit").hidden = !editMode;
}
function metricList(id, entries) { el(id).innerHTML = entries.map(([label, value, helper]) => `<div><span>${label}</span>${helper ? `<small>${helper}</small>` : ""}<strong>${C.formatDuration(value) || "—"}</strong></div>`).join(""); }

function renderFortnight(calc, records = state.records) {
  if (!fortnightCalculationAllowed()) {
    el("periodDates").textContent = "Invalid fortnight start date";
    metricList("fortnightResults", [["Standard Hours", null], ["Hours Recorded This Period", null], ["TOIL Balance", null], ["Opening Flex Balance", null, "Carried over from previous fortnight"], ["Net Flex for the Period", null], ["Closing Flex Balance", null, "Carries forward to next fortnight"]]);
    return;
  }
  const period = { start: viewStart, end: C.addDays(viewStart, 13) };
  let standard = 0, recorded = 0, netFlex = 0, hasIncomplete = false;
  for (let current = period.start; current <= period.end; current = C.addDays(current, 1)) {
    standard += C.standardFor(current, state.settings);
    if (records[current]) { const day = calc[current]; if (day.daily == null) hasIncomplete = true; else { recorded += day.daily; netFlex += day.dailyFlex; } }
  }
  const datesBefore = Object.keys(calc).filter(d => d < period.start).sort();
  const carriedFlex = datesBefore.length ? calc[datesBefore.at(-1)].progressiveFlex : (C.parseDuration(state.settings.openingFlex) || 0);
  const endDates = Object.keys(calc).filter(d => d <= period.end).sort();
  const endFlex = endDates.length ? calc[endDates.at(-1)].progressiveFlex : carriedFlex;
  const toil = endDates.length ? calc[endDates.at(-1)].progressiveToil : (C.parseDuration(state.settings.openingToil) || 0);
  el("periodDates").textContent = `${period.start} to ${period.end}${hasIncomplete ? " · excludes incomplete records" : ""}`;
  metricList("fortnightResults", [["Standard Hours", standard], ["Hours Recorded This Period", recorded], ["TOIL Balance", toil], ["Opening Flex Balance", carriedFlex, "Carried over from previous fortnight"], ["Net Flex for the Period", netFlex], ["Closing Flex Balance", endFlex, "Carries forward to next fortnight"]]);
}

function renderRecords(calc) {
  const end = viewStart ? C.addDays(viewStart, 13) : "";
  const dates = Object.keys(state.records).filter(date => viewStart && date >= viewStart && date <= end).sort();
  el("recordsBody").innerHTML = dates.length ? dates.map(date => { const d = calc[date]; return `<tr><td>${date}</td><td>${d ? C.formatDuration(d.daily) || "Incomplete" : "—"}</td><td>${d ? C.formatDuration(d.dailyFlex) || "—" : "—"}</td><td>${d ? C.formatDuration(d.progressiveFlex) : "—"}</td><td>${d ? C.formatDuration(d.progressiveToil) : "—"}</td><td class="row-actions"><button class="link-button" data-edit="${date}">Edit</button><button class="link-button danger" data-delete="${date}">Delete</button></td></tr>`; }).join("") : `<tr><td colspan="6" class="muted">No records yet.</td></tr>`;
  document.querySelectorAll("[data-edit]").forEach(button => button.addEventListener("click", () => { if (loadRecord(button.dataset.edit, false, "edit")) scrollTo({top:0, behavior:"smooth"}); }));
  document.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => deleteRecord(button.dataset.delete)));
}

function renderFortnightStatus() {
  const badge = el("fortnightStatus");
  if (!fortnightCalculationAllowed() || !viewStart) { badge.textContent = "Setup required"; badge.classList.remove("status-overdue"); return; }
  const submission = state.submissions[viewStart] || {};
  const currentStart = periodFor(todayISO()).start;
  if (submission.submitted && !submission.changed) badge.textContent = "Submitted";
  else if (C.addDays(viewStart, 13) < todayISO()) badge.textContent = "Overdue";
  else if (viewStart === currentStart) badge.textContent = "Current";
  else badge.textContent = "Upcoming";
  badge.classList.toggle("status-overdue", badge.textContent === "Overdue");
}

function renderSubmissionReminder() {
  const box = el("submissionReminder"); reminderStart = "";
  if (!fortnightCalculationAllowed()) { box.hidden = true; return; }
  const today = todayISO();
  const currentStart = C.fortnightFor(today, state.settings.fortnightStart).start;
  const previousStart = C.addDays(currentStart, -14);
  const starts = new Set(Object.keys(state.records).map(date => C.fortnightFor(date, state.settings.fortnightStart).start));
  starts.add(currentStart); starts.add(previousStart);
  Object.keys(state.submissions).forEach(start => starts.add(start));
  const candidates = [...starts].map(start => ({ start, end: C.addDays(start, 13), submission: state.submissions[start] || {} })).filter(period => {
    if (period.submission.changed) return true;
    if (period.submission.submitted) return false;
    const hasRecords = Object.keys(state.records).some(date => date >= period.start && date <= period.end);
    return today === period.end || (today > period.end && (hasRecords || period.start === previousStart));
  }).sort((a, b) => {
    if (a.start === viewStart) return -1;
    if (b.start === viewStart) return 1;
    return b.start.localeCompare(a.start);
  });
  const period = candidates[0];
  if (!period) { box.hidden = true; return; }
  reminderStart = period.start; box.hidden = false;
  if (period.submission.changed) el("submissionMessage").textContent = "Submitted fortnight changed — please review and resubmit if needed.";
  else if (today === period.end) el("submissionMessage").textContent = "Timesheet due — please review and submit this fortnight.";
  else el("submissionMessage").textContent = "Timesheet overdue — please review and submit this fortnight.";
  el("submissionPeriod").textContent = `${period.start} to ${period.end}`;
}

function markFortnightSubmitted() {
  if (!reminderStart) return;
  const submittedStart = reminderStart;
  state.submissions[submittedStart] = { submitted: true, changed: false, submittedAt: new Date().toISOString() };
  save(); renderAll(); showStatus("Fortnight marked as submitted.");
  if (confirm("Timesheet submitted. Would you like to export a backup CSV?")) exportCsv(submittedStart);
}

function renderSettings() {
  el("fortnightStart").value = state.settings.fortnightStart; el("openingFlex").value = state.settings.openingFlex; el("openingToil").value = state.settings.openingToil;
  state.settings.standardByDay.forEach((value, index) => el(`standard${index}`).value = value);
  document.querySelectorAll("[data-setting-duration]").forEach(input => setDurationError(input, false));
  originalSettings = settingsSnapshot(); setSettingsStatus(""); updateConfigurationValidity();
}
function settingsSnapshot() { return JSON.stringify({ fortnightStart: el("fortnightStart")?.value || "", openingFlex: el("openingFlex")?.value || "", openingToil: el("openingToil")?.value || "", standardByDay: DAY_NAMES.map((_, i) => el(`standard${i}`)?.value || "") }); }
function setSettingsStatus(message, error = false) { el("settingsStatus").textContent = message; el("settingsStatus").classList.toggle("error", error); }
function setSettingsExpanded(expanded) {
  el("settingsContent").hidden = !expanded;
  el("settingsToggle").setAttribute("aria-expanded", String(expanded));
  el("settingsToggleButton").textContent = expanded ? "−" : "+";
  el("settingsToggleButton").setAttribute("aria-label", expanded ? "Collapse Settings" : "Expand Settings");
  document.querySelector(".settings").classList.toggle("settings-collapsed", !expanded);
}
function updateConfigurationValidity() {
  const selectedValid = selectedAnchorValid();
  el("fortnightStartError").hidden = selectedValid;
  el("saveSettings").disabled = !selectedValid;
  el("submitRecord").disabled = !fortnightCalculationAllowed();
}
function saveSettings() {
  const start = el("fortnightStart").value;
  if (!start) { const message = "Fortnight Start Date is required and must be a Thursday."; setSettingsStatus(message, true); alert(message); el("fortnightStart").focus(); return; }
  if (!C.isThursdayISO(start)) { const message = "Fortnight Start Date must be a Thursday."; setSettingsStatus(message, true); alert(message); el("fortnightStart").focus(); return; }
  if (!validateDurationInputs("[data-setting-duration]")) { setSettingsStatus("Duration minutes must be between 00 and 59.", true); return; }
  const durationInputs = [
    ["Opening Flex Balance", el("openingFlex")], ["Opening TOIL Balance", el("openingToil")],
    ...DAY_NAMES.map((name, i) => [`${name} Standard Hours`, el(`standard${i}`)])
  ];
  const invalid = durationInputs.find(([, input]) => C.parseDuration(input.value) == null);
  if (invalid) { const message = `${invalid[0]} must use H:MM format, for example 7:21.`; setSettingsStatus(message, true); alert(message); invalid[1].focus(); return; }
  const previousSettings = state.settings;
  state.settings = JSON.parse(settingsSnapshot()); viewStart = periodFor(activeDate).start;
  if (!save()) { state.settings = previousSettings; setSettingsStatus("Settings could not be saved to localStorage.", true); return; }
  originalSettings = settingsSnapshot(); renderAll(); setSettingsStatus("Settings saved"); showStatus("Settings saved. All balances have been recalculated."); setSettingsExpanded(false);
}
function showStatus(message, error = false) { el("status").textContent = message; el("status").classList.toggle("error", error); }

function buildCsvPackage(start = viewStart) {
  const period = { start, end: C.addDays(start, 13) };
  const headers = ["Date", "Start Time", "Morning Out", "Morning In", "Lunch Out", "Lunch In", "Afternoon Out", "Afternoon In", "Finish Time", "Leave Type", "Leave Hours", "Standard Hours", "Attendance Type", "TOIL Hours", "Daily Hours"];
  const rows = [headers, ...C.buildFortnightExportRows(state.records, state.settings, start)];
  const csv = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")).join("\r\n");
  const filename = `Timesheet_${period.start}_to_${period.end}.csv`;
  const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"});
  const file = typeof File === "function" ? new File([blob], filename, {type:blob.type}) : null;
  return { period, csv, blob, file, filename, rows };
}
function downloadCsvPackage(csvPackage) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(csvPackage.blob); link.download = csvPackage.filename; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
function exportCsv(start = viewStart) {
  if (!ensureValidAnchor()) return;
  downloadCsvPackage(buildCsvPackage(start));
}
function emailIsValid(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
function openEmailModal() {
  if (!ensureValidAnchor()) return;
  const end = C.addDays(viewStart, 13);
  el("emailSubject").value = `Clocky Timesheet – ${viewStart} to ${end}`;
  el("emailMessage").value = `Hi,\n\nPlease find my timesheet for ${viewStart} to ${end}.\n\nThanks.`;
  el("emailToError").hidden = true; el("emailTo").removeAttribute("aria-invalid"); el("emailStatus").textContent = "";
  el("emailModal").hidden = false; el("emailTo").focus();
}
function closeEmailModal() { el("emailModal").hidden = true; }
function supportsFileShare(file, shareNavigator = navigator) {
  return Boolean(file) && typeof shareNavigator.share === "function" && typeof shareNavigator.canShare === "function" && shareNavigator.canShare({ files:[file] });
}
function mailtoUrl(to, subject, message) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
async function sendEmailCsv(options = {}) {
  const to = el("emailTo").value.trim(), subject = el("emailSubject").value, message = el("emailMessage").value;
  if (!emailIsValid(to)) {
    el("emailToError").hidden = false; el("emailTo").setAttribute("aria-invalid", "true"); el("emailTo").focus(); return "invalid";
  }
  const csvPackage = buildCsvPackage(viewStart);
  const shareNavigator = options.navigator || navigator;
  if (supportsFileShare(csvPackage.file, shareNavigator)) {
    try {
      await shareNavigator.share({ files:[csvPackage.file], title:subject, text:`To: ${to}\n\n${message}` });
      closeEmailModal(); showStatus("Timesheet CSV shared."); return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
    }
  }
  (options.download || downloadCsvPackage)(csvPackage);
  const url = mailtoUrl(to, subject, message);
  if (options.openMailto) options.openMailto(url); else window.location.href = url;
  el("emailStatus").textContent = "Your CSV has been saved. Please attach the downloaded CSV to the email before sending.";
  return "fallback";
}
function openWelcomeModal() { el("welcomeModal").hidden = false; el("closeWelcome").focus(); }
function closeWelcomeModal() { el("welcomeModal").hidden = true; }
function openFeedbackModal() {
  el("feedbackImproveError").hidden = true; el("feedbackImprove").removeAttribute("aria-invalid");
  el("feedbackRatingError").hidden = true; el("feedbackStatus").textContent = "";
  el("feedbackModal").hidden = false; el("feedbackLike").focus();
}
function closeFeedbackModal() { el("feedbackModal").hidden = true; }
function prepareFeedback(options = {}) {
  const improvementMissing = !el("feedbackImprove").value.trim();
  const rating = document.querySelector('[name="feedbackRating"]:checked');
  el("feedbackImproveError").hidden = !improvementMissing;
  el("feedbackImprove").setAttribute("aria-invalid", String(improvementMissing));
  el("feedbackRatingError").hidden = Boolean(rating);
  if (improvementMissing || !rating) {
    (improvementMissing ? el("feedbackImprove") : document.querySelector('[name="feedbackRating"]')).focus();
    return "invalid";
  }
  const liked = el("feedbackLike").value.trim() || "Not provided";
  const improvement = el("feedbackImprove").value.trim();
  const contact = el("feedbackContact").value.trim() || "Not provided";
  const message = `What I like:\n${liked}\n\nWhat could be improved:\n${improvement}\n\nOverall experience:\n${rating.value}/5\n\nContact details:\n${contact}`;
  const url = mailtoUrl("sharonwong3386@outlook.com", "Clocky Beta Feedback", message);
  if (options.openMailto) options.openMailto(url); else window.location.href = url;
  el("feedbackStatus").textContent = "Your email app has been opened. Please review and send the feedback when ready.";
  return "opened";
}

buildUI(); renderSettings();
if (validAnchor()) viewStart = periodFor(todayISO()).start;
loadRecord(activeDate, true);
openWelcomeModal();
if (!validAnchor() && !TEST_MODE) setTimeout(anchorReminder, 0);
if (TEST_MODE) {
  const testScript = document.createElement("script"); testScript.src = "test-ui-workflow.js"; document.body.append(testScript);
}
