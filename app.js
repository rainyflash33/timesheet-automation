const C = TimesheetCalc;
const P = ClockyPeriods;
const STORAGE_KEY = "personal-timesheet-v1";
const TEST_MODE = new URLSearchParams(window.location.search).has("test");
const LEAVE_TYPES = ["", "Other", "Prior to Commencement", "Christmas Shutdown", "Public Holiday", "Long Service", "Maternity", "Bonding", "Primary Care Giver", "Purchased", "Without Pay", "Compassionate", "Study", "Time off in Lieu (TOIL)", "Recovery Leave (SOGA/B)", "Flex", "Annual", "Personal (No Certificate)", "Personal (Certificate)"];
const FIELD_GROUPS = {
  basicFields: [["startTime", "Start Work"], ["lunchOut", "Lunch Out"], ["lunchIn", "Lunch In"], ["finishTime", "Finish Work"]]
};
const RECORD_FIELDS = [...C.TIME_KEYS, "leaveType", "leaveHours", "attendanceType", "toilHours"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const defaults = { records: {}, submissions: {}, drafts: {}, activeDraftDate:"", settings: { attendanceType: "Flextime", fortnightStart: "", openingFlex: "0:00", openingToil: "0:00", standardByDay: ["0:00", "7:21", "7:21", "7:21", "7:21", "7:21", "0:00"] } };
let persistedStateRaw = null;
let storageReadError = "";
let state = load(true);
let periodCalendarCache = null;
let activeDate = initialRecordDate();
let viewStart = "";
let historicalStart = "";
let historicalMode = false;
let historicalEditStart = "";
let historicalEditAuthorization = null;
let historicalEditSequence = 0;
let historicalSession = null;
let historicalResubmitting = false;
let pendingHistoricalExit = null;
let historicalDiscardFocus = null;
let historicalDiscardMainInert = false;
let pendingHistoricalEdit = "";
let draft = emptyRecord(state.settings.attendanceType);
let originalDraft = emptyRecord(state.settings.attendanceType);
let originalSettings = "";
let reminderStart = "";
let filterYear = new Date().getFullYear();
let filterMonth = new Date().getMonth() + 1;
let interruptionEditorSequence = 0;
let originalLeaveToil = null;
let editMode = false;
let pendingRecordSubmission = null;
let pendingWeekendRecordOpen = null;
let pendingPreviousRecord = null;
let submittedWarningFocus = null;
let submittedWarningMainInert = false;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function el(id) { return document.getElementById(id); }
function load(track = false) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (track) { persistedStateRaw = raw; storageReadError = ""; }
    const saved = JSON.parse(raw);
    if (saved === null) return clone(defaults);
    if (typeof saved !== "object" || Array.isArray(saved) || ["records","submissions","drafts","settings"].some(key => saved[key] != null && (typeof saved[key] !== "object" || Array.isArray(saved[key])))) throw new Error("Saved data has an unsupported structure.");
    if (Object.entries(saved.records || {}).some(([date, record]) => !C.isValidISODate(date) || !record || typeof record !== "object" || Array.isArray(record))) throw new Error("A saved record has an invalid date or structure.");
    if (Object.entries(saved.drafts || {}).some(([date, entry]) => !C.isValidISODate(date) || !entry?.record || typeof entry.record !== "object" || Array.isArray(entry.record))) throw new Error("A saved draft has an invalid date or structure.");
    if (saved.settings?.standardByDay && (!Array.isArray(saved.settings.standardByDay) || saved.settings.standardByDay.length !== 7 || saved.settings.standardByDay.some(value => C.parseDuration(value) == null))) throw new Error("Saved standard hours need review.");
    return { ...saved, records: saved.records || {}, submissions: saved.submissions || {}, drafts: saved.drafts || {}, activeDraftDate: saved.activeDraftDate || "", settings: { ...defaults.settings, ...saved.settings } };
  } catch (error) { if (track) storageReadError = error.message; return clone(defaults); }
}
function save() {
  try {
    if (storageReadError) { alert("Saved timesheet data needs review. No data has been changed. Use the read-only diagnostic before saving."); return false; }
    if (localStorage.getItem(STORAGE_KEY) !== persistedStateRaw) { alert("Stored timesheet data changed in another window. Your input has been kept. Review or copy it before reloading; no data has been overwritten."); return false; }
    const raw = JSON.stringify(state); localStorage.setItem(STORAGE_KEY, raw); persistedStateRaw = raw; return true;
  }
  catch (error) { alert(`The app could not save to local storage: ${error.message}`); return false; }
}
function emptyRecord(attendanceType = "Flextime") { return { startTime:"", morningOut:"", morningIn:"", lunchOut:"", lunchIn:"", afternoonOut:"", afternoonIn:"", finishTime:"", leaveType:"", leaveHours:"", attendanceType, toilHours:"" }; }
function displayAttendanceType(value) { return C.isSeniorOfficer(value) ? "Senior Officer A/B" : "Flextime"; }
function formatDisplayDate(iso, style = "history") {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return iso || "";
  const [, year, month, day] = match;
  const date = new Date(C.calendarDay(iso) * 86400000);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (style === "range") return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
  return `${day}-${month}-${year} ${weekdays[date.getUTCDay()]}`;
}
function formatRecordDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return "";
  const [, year, month, day] = match;
  const localDate = new Date(C.calendarDay(iso) * 86400000);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${day} ${months[Number(month) - 1]} ${year} ${weekdays[localDate.getUTCDay()]}`;
}
function formatReminderDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return iso || "";
  const [, year, month, day] = match;
  return `${day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1]} ${year}`;
}
function renderRecordDate() { el("recordDateDisplay").textContent = formatRecordDate(el("recordDate").value); }
function weekdayForISO(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return null;
  return C.isValidISODate(iso) ? new Date(C.calendarDay(iso) * 86400000).getUTCDay() : null;
}
function isWeekendISO(iso) { const weekday = weekdayForISO(iso); return weekday === 0 || weekday === 6; }
function updateLeaveTypeOptions() {
  const current = el("leaveType").value;
  const seniorOfficer = C.isSeniorOfficer(draft.attendanceType);
  el("leaveType").innerHTML = LEAVE_TYPES.map(value => `<option${value === "Flex" && seniorOfficer ? " disabled" : ""}>${value}</option>`).join("");
  if ([...el("leaveType").options].some(option => option.value === current)) el("leaveType").value = current;
  if (seniorOfficer && current === "Flex") el("leaveType").value = "";
}
function validAnchor() { return C.isThursdayISO(state.settings.fortnightStart); }
function selectedAnchorValid() { return C.isThursdayISO(el("fortnightStart")?.value || ""); }
function fortnightCalculationAllowed() { return validAnchor() && selectedAnchorValid() && !storageReadError; }
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
function interruptionEditorIsDirty() {
  return [...document.querySelectorAll(".interruption-editor")].some(editor => editor.querySelector("[data-interruption-out]").value !== editor.dataset.originalOut || editor.querySelector("[data-interruption-in]").value !== editor.dataset.originalIn);
}
function draftIsDirty() { return submittedPeriodLocked() ? meaningfulDailyChanges() : !recordsEqual(draft, originalDraft) || interruptionEditorIsDirty(); }
function settingsAreDirty() { return settingsSnapshot() !== originalSettings; }

function buildUI() {
  Object.entries(FIELD_GROUPS).forEach(([container, fields]) => fields.forEach(([key, label]) => {
    const row = document.createElement("div"); row.className = "time-row";
    row.innerHTML = `<label for="${key}">${label}</label><input id="${key}" class="clock-time" data-record-time type="text" inputmode="numeric" maxlength="5" pattern="(?:[01]\\d|2[0-3]):[0-5]\\d" placeholder="HHMM" aria-label="${label}, 24-hour time" aria-describedby="${key}Error"><button data-stamp="${key}">Now</button><span id="${key}Error" class="time-error" hidden>Enter a valid time from 0000 to 2359.</span>`;
    el(container).append(row);
  }));
  updateLeaveTypeOptions();
  DAY_NAMES.forEach((name, index) => {
    const label = document.createElement("label"); label.innerHTML = `${name}<input id="standard${index}" data-duration data-setting-duration inputmode="numeric" placeholder="HMM" aria-describedby="standard${index}Error"><span id="standard${index}Error" class="field-error" role="alert" hidden>Use digits such as 721; minutes must be 00–59.</span>`; el("weekdaySettings").append(label);
  });
  document.querySelectorAll("[data-stamp]").forEach(button => button.addEventListener("click", () => {
    const now = new Date(), input = el(button.dataset.stamp); input.value = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`; setClockError(input, false); updateDraft();
  }));
  document.querySelectorAll(".clock-time").forEach(input => {
    input.addEventListener("input", () => { formatClockInput(input); if (input.dataset.recordTime != null) updateDraft(); });
    input.addEventListener("change", () => { formatClockInput(input, true); if (input.dataset.recordTime != null) updateDraft(); });
  });
  document.querySelectorAll("[data-duration]").forEach(input => {
    input.addEventListener("input", () => { setDurationError(input, false); if (input.dataset.recordDuration != null) updateDraft(); });
    input.addEventListener("change", () => { formatDurationInput(input, true); if (input.dataset.recordDuration != null) updateDraft(); });
  });
  el("leaveType").addEventListener("change", () => {
    if (el("leaveType").value === "Public Holiday" && !el("leaveHours").value) el("leaveHours").value = state.settings.standardByDay[weekdayForISO(activeDate)];
    updateDraft();
  });
  el("recordDate").addEventListener("change", () => { changeRecord(el("recordDate").value); renderRecordDate(); });
  el("viewFortnight").addEventListener("change", () => changeFortnight(el("viewFortnight").value));
  el("filterYear").addEventListener("change", () => changePeriodFilter(Number(el("filterYear").value), filterMonth));
  el("filterMonth").addEventListener("change", () => changePeriodFilter(filterYear, Number(el("filterMonth").value)));
  el("exportSelectedFortnight").addEventListener("click", () => exportCsv(historicalStart));
  el("editHistoricalTimesheet").addEventListener("click", openHistoricalEdit);
  el("resubmitHistoricalTimesheet").addEventListener("click", resubmitHistoricalEdit);
  el("resubmitHistoricalReminder").addEventListener("click", resubmitHistoricalEdit);
  el("cancelHistoricalSession").addEventListener("click", () => requestHistoricalExit());
  el("keepHistoricalChanges").addEventListener("click", () => closeHistoricalDiscard());
  el("discardHistoricalChanges").addEventListener("click", discardHistoricalChanges);
  el("historicalDiscardModal").addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeHistoricalDiscard(); }
    if (event.key === "Tab") {
      event.preventDefault();
      (document.activeElement === el("keepHistoricalChanges") ? el("discardHistoricalChanges") : el("keepHistoricalChanges")).focus();
    }
  });
  el("cancelHistoricalEdit").addEventListener("click", closeHistoricalEdit);
  el("confirmHistoricalEdit").addEventListener("click", confirmHistoricalEdit);
  el("historicalEditModal").addEventListener("click", event => { if (event.target === el("historicalEditModal")) closeHistoricalEdit(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !el("historicalEditModal").hidden) closeHistoricalEdit(); });
  ["exportPeriodFrom", "exportPeriodTo"].forEach(id => {
    el(id).addEventListener("input", () => clearExportDateError(id));
    el(id).addEventListener("change", () => normalizeExportDateField(id));
    el(id).addEventListener("blur", () => normalizeExportDateField(id));
  });
  el("exportMultiplePeriods").addEventListener("click", () => exportMultiplePeriodsCsv());
  el("toggleInterruptions").addEventListener("click", () => openInterruptionEditor());
  el("submitRecord").addEventListener("click", () => submitRecord({showSubmittedWarning:true}));
  el("saveDraft").addEventListener("click", () => saveDraft({showSubmittedWarning:true}));
  el("dismissSubmittedWarning").addEventListener("click", closeSubmittedWarning);
  el("submittedWarningModal").addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeSubmittedWarning(); }
    if (event.key === "Tab") { event.preventDefault(); el("dismissSubmittedWarning").focus(); }
  });
  el("copyPrevious").addEventListener("click", copyPrevious);
  el("clearRecord").addEventListener("click", clearRecordForm);
  el("cancelCopyPrevious").addEventListener("click", closeCopyPreviousModal);
  el("confirmCopyPrevious").addEventListener("click", confirmCopyPrevious);
  el("copyPreviousModal").addEventListener("click", event => { if (event.target === el("copyPreviousModal")) closeCopyPreviousModal(); });
  el("toggleLeaveToil").addEventListener("click", () => setLeaveToilExpanded(el("leaveToilPanel").hidden));
  el("cancelLeaveToil").addEventListener("click", cancelLeaveToil);
  el("cancelEdit").addEventListener("click", cancelEdit);
  el("saveSettings").addEventListener("click", saveSettings);
  el("openResetHistory").addEventListener("click", openResetHistoryModal);
  el("cancelResetHistory").addEventListener("click", closeResetHistoryModal);
  el("confirmResetHistory").addEventListener("click", resetTimesheetHistory);
  el("resetHistoryConfirmation").addEventListener("input", () => { el("confirmResetHistory").disabled = el("resetHistoryConfirmation").value !== "RESET"; });
  el("resetHistoryModal").addEventListener("click", event => { if (event.target === el("resetHistoryModal")) closeResetHistoryModal(); });
  el("settingsToggle").addEventListener("click", () => setSettingsExpanded(el("settingsContent").hidden));
  el("settingsToggle").addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSettingsExpanded(el("settingsContent").hidden);
    }
  });
  el("historicalToggle").addEventListener("click", () => setHistoricalExpanded(el("historicalContent").hidden));
  el("historicalToggle").addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setHistoricalExpanded(el("historicalContent").hidden);
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
  el("cancelSpecialWork").addEventListener("click", cancelPendingWorkConfirmation);
  el("openFeedback").addEventListener("click", openFeedbackModal);
  el("closeFeedback").addEventListener("click", closeFeedbackModal);
  el("cancelFeedback").addEventListener("click", closeFeedbackModal);
  el("validateFeedback").addEventListener("click", prepareFeedback);
  el("feedbackModal").addEventListener("click", event => { if (event.target === el("feedbackModal")) closeFeedbackModal(); });
  el("feedbackImprove").addEventListener("input", () => { el("feedbackImproveError").hidden = true; el("feedbackImprove").removeAttribute("aria-invalid"); });
  document.querySelectorAll('[name="feedbackRating"]').forEach(input => input.addEventListener("change", () => { el("feedbackRatingError").hidden = true; }));
  el("markSubmitted").addEventListener("click", markFortnightSubmitted);
  window.addEventListener("storage", event => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    if (historicalSession || draftIsDirty() || settingsAreDirty()) { renderAll(); showStatus("Stored data changed in another window. Your input is preserved and saving is blocked until you review or copy it and reload.", true); return; }
    const date = activeDate, browsing = historicalMode, selection = historicalStart, editing = editMode;
    revokeHistoricalEdit(); state = load(true); renderSettings(); loadRecord(date, true, editing ? "edit" : "new"); historicalMode = browsing; historicalStart = selection; renderAll();
    showStatus(storageReadError ? "Saved data needs review. No data has been changed." : "Stored timesheets refreshed from another window.", Boolean(storageReadError));
  });
  window.addEventListener("beforeunload", event => { if (draftIsDirty() || settingsAreDirty() || historicalSessionHasChanges()) { event.preventDefault(); event.returnValue = ""; } });
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
  updateLeaveTypeOptions();
  RECORD_FIELDS.forEach(key => { if (el(key)) el(key).value = value[key] || (key === "attendanceType" ? "Flextime" : ""); });
  document.querySelectorAll("[data-record-time]").forEach(input => setClockError(input, false));
  document.querySelectorAll("[data-record-duration]").forEach(input => setDurationError(input, false));
}
function updateDraft() { draft = readForm(); renderCurrentPreview(); updateActionState(); }

function clearRecordForm() {
  const locked = submittedPeriodLocked();
  const current = readForm();
  const editorHasData = [...document.querySelectorAll("[data-interruption-time]")].some(input => input.value);
  const savedDraft = state.drafts[activeDate] ? clone(state.drafts[activeDate]) : null;
  const previousActiveDraftDate = state.activeDraftDate;
  const hadSavedDraft = locked || historicalSession ? false : removeSavedDraft(activeDate);
  if (hadSavedDraft && !save()) { state.drafts[activeDate] = savedDraft; state.activeDraftDate = previousActiveDraftDate; return; }
  if (recordsEqual(current, emptyRecord(state.settings.attendanceType)) && !editorHasData) { setLeaveToilExpanded(false); if (hadSavedDraft) showStatus("Draft cleared"); return; }
  draft = emptyRecord(state.settings.attendanceType);
  if (!editMode && !locked) originalDraft = clone(draft);
  fillForm(draft);
  closeInterruptionEditor();
  renderInterruptionList();
  setLeaveToilExpanded(false);
  renderCurrentPreview();
  updateActionState();
}

function previousSavedRecord(date) {
  const dates = [...new Set([...Object.keys(state.records), ...Object.keys(state.drafts)])].filter(candidate => candidate < date).sort();
  const previousDate = dates.at(-1);
  if (!previousDate) return null;
  const saved = state.records[previousDate] || state.drafts[previousDate]?.record;
  return saved ? { date:previousDate, record:clone(saved) } : null;
}
function currentEntryHasData() {
  const current = readForm();
  return RECORD_FIELDS.some(key => key !== "attendanceType" && Boolean(current[key])) || [...document.querySelectorAll("[data-interruption-time]")].some(input => input.value);
}
function copyPrevious() {
  const previous = previousSavedRecord(activeDate);
  if (!previous) { showStatus("No previous entry available to copy."); return; }
  if (currentEntryHasData()) {
    pendingPreviousRecord = previous;
    el("copyPreviousModal").hidden = false;
    el("confirmCopyPrevious").focus();
    return;
  }
  applyPreviousRecord(previous.record);
}
function applyPreviousRecord(record) {
  const copied = emptyRecord(state.settings.attendanceType);
  RECORD_FIELDS.forEach(key => { copied[key] = record[key] || (key === "attendanceType" ? state.settings.attendanceType : ""); });
  draft = copied;
  fillForm(draft);
  closeInterruptionEditor();
  renderInterruptionList();
  setLeaveToilExpanded(recordHasLeaveToil(draft));
  renderCurrentPreview();
  updateActionState();
}
function closeCopyPreviousModal() { pendingPreviousRecord = null; el("copyPreviousModal").hidden = true; }
function confirmCopyPrevious() {
  if (!pendingPreviousRecord) return closeCopyPreviousModal();
  const record = pendingPreviousRecord.record;
  closeCopyPreviousModal();
  applyPreviousRecord(record);
}

function removeSavedDraft(date) {
  if (sessionContains(date)) { const existed = Boolean(historicalSession.drafts[date]); delete historicalSession.drafts[date]; return existed; }
  if (!periodContext(date).canSaveDraft) return false;
  if (!state.drafts[date]) return false;
  delete state.drafts[date];
  if (state.activeDraftDate === date) state.activeDraftDate = Object.keys(state.drafts).slice(-1)[0] || "";
  return true;
}

function saveDraft({showSubmittedWarning = false} = {}) {
  if (!guardDailySaveAttempt(showSubmittedWarning, "draft")) return false;
  if (!validateClockInputs("[data-record-time]")) return;
  if (!validateDurationInputs("[data-record-duration]")) return;
  draft = readForm();
  if (!stageInterruptionEditors()) return;
  const candidateDraft = readForm();
  if (C.isSeniorOfficer(candidateDraft.attendanceType) && candidateDraft.leaveType === "Flex") { alert("Flex Leave is not available for Senior Officer A/B attendance records."); el("leaveType").focus(); return; }
  if (!validateLeaveToil(candidateDraft)) return;
  if (historicalSession && sessionContains(activeDate) && historicalEditAllowed(activeDate)) {
    historicalSession.records[activeDate] = clone(candidateDraft);
    historicalSession.drafts[activeDate] = {record:clone(candidateDraft), editMode:true, leaveToilExpanded:!el("leaveToilPanel").hidden};
    editMode = true;
    historicalSession.touched.add(activeDate);
    draft = clone(candidateDraft); originalDraft = clone(draft); renderAll(); showStatus("Draft saved"); return true;
  }
  const previousDraft = state.drafts[activeDate] ? clone(state.drafts[activeDate]) : null;
  const previousActiveDraftDate = state.activeDraftDate;
  state.drafts[activeDate] = { record:clone(candidateDraft), editMode:Boolean(editMode), leaveToilExpanded:!el("leaveToilPanel").hidden };
  state.activeDraftDate = activeDate;
  if (!save()) {
    if (previousDraft) state.drafts[activeDate] = previousDraft; else delete state.drafts[activeDate];
    state.activeDraftDate = previousActiveDraftDate;
    return;
  }
  draft = clone(candidateDraft); originalDraft = clone(draft);
  renderAll(); showStatus("Draft saved");
  return true;
}

function openInterruptionEditor(slot = "") {
  if (slot && document.querySelector(`.interruption-editor[data-slot="${slot}"]`)) return;
  if (!slot && interruptionEntryCount() >= 2) return;
  const id = ++interruptionEditorSequence;
  const out = slot ? draft[`${slot}Out`] || "" : "", incoming = slot ? draft[`${slot}In`] || "" : "";
  const editor = document.createElement("div"); editor.className = "interruption-editor"; editor.dataset.editorId = String(id); editor.dataset.slot = slot; editor.dataset.originalOut = out; editor.dataset.originalIn = incoming;
  editor.innerHTML = `<h3>Additional Time Entry</h3><div class="interruption-inputs">${[["out", "Time Out"], ["in", "Time In"]].map(([kind, label]) => { const inputId = `interruption${kind === "out" ? "Out" : "In"}${id}`; return `<div class="time-row"><label for="${inputId}">${label}</label><input id="${inputId}" class="clock-time" data-interruption-time data-interruption-${kind} type="text" inputmode="numeric" maxlength="5" pattern="(?:[01]\\d|2[0-3]):[0-5]\\d" placeholder="HHMM" aria-describedby="${inputId}Error"><button data-interruption-now="${inputId}">Now</button><span id="${inputId}Error" class="time-error" hidden>Enter a valid time from 0000 to 2359.</span></div>`; }).join("")}</div><div class="record-actions"><button class="secondary" data-cancel-interruption="${id}" type="button">Cancel</button></div>`;
  el("interruptionEditors").append(editor);
  editor.querySelector("[data-interruption-out]").value = out; editor.querySelector("[data-interruption-in]").value = incoming;
  editor.querySelectorAll("[data-interruption-time]").forEach(input => {
    input.addEventListener("input", () => formatClockInput(input));
    input.addEventListener("change", () => formatClockInput(input, true));
  });
  editor.querySelectorAll("[data-interruption-now]").forEach(button => button.addEventListener("click", () => {
    const now = new Date(), input = el(button.dataset.interruptionNow); input.value = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`; setClockError(input, false);
  }));
  editor.querySelector("[data-cancel-interruption]").addEventListener("click", () => closeInterruptionEditor(String(id)));
  renderInterruptionEditorState(); editor.querySelector("[data-interruption-out]").focus();
}
function closeInterruptionEditor(id = "") {
  if (id) document.querySelector(`.interruption-editor[data-editor-id="${id}"]`)?.remove();
  else el("interruptionEditors").replaceChildren();
  renderInterruptionEditorState();
}
function interruptionEntryCount() {
  const editingSlots = new Set([...document.querySelectorAll(".interruption-editor[data-slot]")].map(editor => editor.dataset.slot).filter(Boolean));
  const storedCount = ["morning", "afternoon"].filter(slot => (draft[`${slot}Out`] || draft[`${slot}In`]) && !editingSlots.has(slot)).length;
  return storedCount + document.querySelectorAll(".interruption-editor").length;
}
function renderInterruptionEditorState() {
  const editors = [...document.querySelectorAll(".interruption-editor")];
  editors.forEach((editor, index) => { editor.querySelector("h3").textContent = editors.length > 1 ? `Additional Time Entry ${index + 1}` : "Additional Time Entry"; });
  el("toggleInterruptions").hidden = interruptionEntryCount() >= 2;
}
function classifyInterruption(out, incoming, record) {
  const lunchOut = normalizeClockTime(record.lunchOut), lunchIn = normalizeClockTime(record.lunchIn);
  if (clockTimeIsValid(lunchOut) && clockTimeIsValid(lunchIn) && lunchOut < lunchIn) {
    if (incoming <= lunchOut) return "morning";
    if (out >= lunchIn) return "afternoon";
    return "";
  }
  if (incoming <= "12:00") return "morning";
  if (out >= "12:00") return "afternoon";
  return "";
}
function stageInterruptionEditors() {
  const editors = [...document.querySelectorAll(".interruption-editor")];
  if (!editors.length) return true;
  if (!validateClockInputs("[data-interruption-time]")) return false;
  const record = readForm(), staged = clone(record);
  editors.forEach(editor => { const slot = editor.dataset.slot; if (slot) { staged[`${slot}Out`] = ""; staged[`${slot}In`] = ""; } });
  for (let index = 0; index < editors.length; index += 1) {
    const editor = editors[index], out = normalizeClockTime(editor.querySelector("[data-interruption-out]").value), incoming = normalizeClockTime(editor.querySelector("[data-interruption-in]").value);
    const label = editors.length > 1 ? `Additional Time Entry ${index + 1}` : "Additional Time Entry";
    if (!clockTimeIsValid(out) || !clockTimeIsValid(incoming) || out >= incoming) { alert(`${label} must have complete Out and In times, with Out before In.`); return false; }
    const slot = classifyInterruption(out, incoming, record);
    if (!slot) { alert(`${label} overlaps the lunch period. Please adjust its times before saving.`); return false; }
    if (staged[`${slot}Out`] || staged[`${slot}In`]) { alert(`${label} conflicts with the existing ${slot === "morning" ? "Morning" : "Afternoon"} Additional Time Entry.`); return false; }
    staged[`${slot}Out`] = out; staged[`${slot}In`] = incoming;
  }
  draft = staged;
  closeInterruptionEditor(); renderInterruptionList(); renderCurrentPreview(); updateActionState();
  return true;
}
function removeInterruption(slot) {
  draft[`${slot}Out`] = ""; draft[`${slot}In`] = "";
  const editor = document.querySelector(`.interruption-editor[data-slot="${slot}"]`); if (editor) closeInterruptionEditor(editor.dataset.editorId);
  renderInterruptionList(); renderCurrentPreview(); updateActionState();
}
function renderInterruptionList() {
  const items = [
    { slot:"morning", label:"Morning Additional Time Entry", out:draft.morningOut, incoming:draft.morningIn },
    { slot:"afternoon", label:"Afternoon Additional Time Entry", out:draft.afternoonOut, incoming:draft.afternoonIn }
  ].filter(item => item.out || item.incoming);
  const list = el("interruptionList"); list.hidden = items.length === 0;
  list.innerHTML = items.map(item => `<div class="interruption-item"><strong>${item.label}</strong><span>${item.out || "—"}–${item.incoming || "—"}</span><div><button class="link-button" data-edit-interruption="${item.slot}">Edit</button><button class="link-button danger" data-remove-interruption="${item.slot}">Remove</button></div></div>`).join("");
  renderInterruptionEditorState();
  list.querySelectorAll("[data-edit-interruption]").forEach(button => button.addEventListener("click", () => openInterruptionEditor(button.dataset.editInterruption)));
  list.querySelectorAll("[data-remove-interruption]").forEach(button => button.addEventListener("click", () => removeInterruption(button.dataset.removeInterruption)));
}

function recordHasLeaveToil(record) { return Boolean(record.leaveType || record.leaveHours || record.toilHours); }
function setLeaveToilExpanded(expanded) {
  if (expanded && el("leaveToilPanel").hidden) originalLeaveToil = { leaveType:draft.leaveType, leaveHours:draft.leaveHours, toilHours:draft.toilHours };
  el("leaveToilPanel").hidden = !expanded;
  el("toggleLeaveToil").setAttribute("aria-expanded", String(expanded));
  el("toggleLeaveToil").textContent = `${expanded ? "−" : "+"} Add Leave / TOIL Details`;
}
function cancelLeaveToil() {
  const snapshot = originalLeaveToil || { leaveType:"", leaveHours:"", toilHours:"" };
  Object.assign(draft, snapshot);
  ["leaveType", "leaveHours", "toilHours"].forEach(key => { el(key).value = snapshot[key] || ""; });
  document.querySelectorAll("[data-record-duration]").forEach(input => setDurationError(input, false));
  setLeaveToilExpanded(false); originalLeaveToil = null; renderCurrentPreview(); updateActionState();
}

function periodFor(date) { return C.fortnightFor(date, state.settings.fortnightStart); }
function periodCalendar() {
  const anchor = state.settings.fortnightStart, signature = JSON.stringify(state.submissions);
  if (!periodCalendarCache || periodCalendarCache.anchor !== anchor || periodCalendarCache.signature !== signature) periodCalendarCache = {anchor, signature, calendar:P.createCalendar(state.submissions, anchor)};
  return periodCalendarCache.calendar;
}
function periodContext(date = activeDate) {
  let storageConflict = false;
  try { storageConflict = localStorage.getItem(STORAGE_KEY) !== persistedStateRaw; } catch { storageReadError ||= "Browser storage cannot be checked."; }
  return periodCalendar().resolve(date, {today:todayISO(), authorization:historicalEditStart === historicalEditAuthorization?.start ? historicalEditAuthorization : null, session:historicalSession, storageError:storageReadError, storageConflict});
}
function periodEntries(records, start) {
  const id = periodFor(start).start;
  return Object.fromEntries(Object.entries(records).filter(([date]) => id && periodFor(date).start === id));
}
function sessionContains(date) {
  return Boolean(historicalSession && periodFor(date).start === historicalSession.start);
}
function editableRecords() {
  if (!historicalSession) return state.records;
  const records = {...state.records};
  Object.keys(periodEntries(records, historicalSession.start)).forEach(date => delete records[date]);
  return {...records, ...historicalSession.records};
}
function historicalDraftFor(date) { return sessionContains(date) ? historicalSession.drafts[date] || (!historicalSession.touched.has(date) ? state.drafts[date] : null) : state.drafts[date]; }
function historicalSessionHasChanges() {
  return Boolean(historicalSession && (!recordsEqual(historicalSession.records, historicalSession.originalRecords) || Object.keys(historicalSession.drafts).length ||
    (sessionContains(activeDate) && (draftIsDirty() || (editMode && !recordsEqual(readForm(), historicalSession.records[activeDate]))))));
}
function finishHistoricalCancel() {
  revokeHistoricalEdit(); loadRecord(activeDate, true);
  showStatus("Historical editing cancelled. No session changes were saved.");
}
function requestHistoricalExit(afterExit = null) {
  if (!historicalSession) { if (afterExit) afterExit(); return true; }
  if (!historicalSessionHasChanges()) { finishHistoricalCancel(); if (afterExit) afterExit(); return true; }
  pendingHistoricalExit = typeof afterExit === "function" ? afterExit : null;
  historicalDiscardFocus = document.activeElement;
  historicalDiscardMainInert = document.querySelector("main").inert;
  document.querySelector("main").inert = true;
  el("historicalDiscardModal").hidden = false; el("keepHistoricalChanges").focus();
  return false;
}
function closeHistoricalDiscard() {
  el("historicalDiscardModal").hidden = true;
  document.querySelector("main").inert = historicalDiscardMainInert;
  pendingHistoricalExit = null;
  if (historicalDiscardFocus?.isConnected && !historicalDiscardFocus.hidden) historicalDiscardFocus.focus();
}
function discardHistoricalChanges() {
  const afterExit = pendingHistoricalExit;
  closeHistoricalDiscard(); finishHistoricalCancel();
  if (afterExit) afterExit(); else el("editHistoricalTimesheet").focus();
}
function historicalRecordError(record, date) {
  if (C.TIME_KEYS.some(key => record[key] && !clockTimeIsValid(record[key]))) return "Enter valid 24-hour times.";
  if ([record.leaveHours, record.toilHours].some(value => C.parseDuration(value) == null)) return "Enter valid leave and TOIL durations.";
  if (Boolean(record.leaveType) !== Boolean(record.leaveHours)) return "Complete both Leave Type and Leave Hours.";
  if (C.isSeniorOfficer(record.attendanceType) && record.leaveType === "Flex") return "Flex Leave is unavailable for Senior Officer attendance.";
  for (const slot of ["morning", "afternoon"]) {
    const out = record[`${slot}Out`], incoming = record[`${slot}In`];
    if ((out || incoming) && (!out || !incoming || out >= incoming)) return "Complete valid Additional Time Out/In pairs.";
  }
  if (record.lunchOut && record.lunchIn && ((record.morningIn && record.morningIn > record.lunchOut) || (record.afternoonOut && record.afternoonOut < record.lunchIn))) return "Additional Time must not overlap lunch.";
  return C.calculateDay(record, C.standardFor(date, state.settings)).incomplete ? "Complete both ends of each work segment." : "";
}
function resubmitHistoricalEdit(confirmation = null) {
  const session = historicalSession;
  if (!session || !historicalEditAllowed(session.start) || historicalResubmitting) return false;
  if (pendingRecordSubmission?.historicalResubmission && confirmation?.id !== session.id) return false;
  historicalResubmitting = true;
  try {
    return commitHistoricalResubmission(session, confirmation);
  } finally { historicalResubmitting = false; }
}
function commitHistoricalResubmission(session, confirmation) {
  if (sessionContains(activeDate) && (editMode || draftHasAttendanceData() || draftIsDirty() || interruptionEditorIsDirty())) {
    if (!validateClockInputs("[data-record-time]") || !validateDurationInputs("[data-record-duration]")) { showStatus("Correct the highlighted fields before resubmitting.", true); return false; }
    draft = readForm();
    if (!stageInterruptionEditors()) return false;
    session.drafts[activeDate] = {record:clone(readForm()), editMode, leaveToilExpanded:!el("leaveToilPanel").hidden};
    session.touched.add(activeDate);
  }
  const records = clone(session.records);
  Object.entries(session.drafts).forEach(([date, saved]) => { records[date] = clone(saved.record); });
  for (const [date, record] of Object.entries(records)) {
    const error = !sessionContains(date) ? "Record is outside the authorised fortnight." : historicalRecordError(record, date);
    if (error) { showStatus(`Cannot resubmit ${date}: ${error}`, true); return false; }
  }
  const confirmedDates = confirmation?.id === session.id && recordsEqual(confirmation.records, records) ? confirmation.confirmedDates : [];
  for (const [date, record] of Object.entries(records)) {
    if (recordsEqual(record, session.originalRecords[date]) || confirmedDates.includes(date)) continue;
    const submission = {historicalResubmission:{id:session.id, records:clone(records), confirmedDates:[...confirmedDates, date]}};
    if (!guardWeekendSubmission(date, record, submission)) return false;
    const details = workConfirmationFor(date, record);
    if (details) { queueRecordConfirmation(submission, details); return false; }
  }
  try {
    if (localStorage.getItem(STORAGE_KEY) !== session.storageBaseline || !recordsEqual(state.settings, session.settings) || !recordsEqual(periodEntries(state.records, session.start), session.originalRecords) || !recordsEqual(state.submissions[session.start] || null, session.originalSubmission) || !recordsEqual(submittedPeriodsFor(session.start), session.originalSubmittedPeriods)) {
      showStatus("Stored timesheet data changed after editing began. Keep a copy of your working changes, then cancel and reopen the timesheet before resubmitting.", true); return false;
    }
  } catch (error) { showStatus(`Stored timesheet data could not be checked: ${error.message}`, true); return false; }
  const candidate = clone(state), previousState = state;
  Object.keys(periodEntries(candidate.records, session.start)).forEach(date => delete candidate.records[date]);
  Object.assign(candidate.records, records);
  candidate.submissions[session.start] = periodCalendar().stamp(session.start, session.originalSubmission || {}, new Date().toISOString());
  session.touched.forEach(date => delete candidate.drafts[date]);
  if (session.touched.has(candidate.activeDraftDate)) candidate.activeDraftDate = Object.keys(candidate.drafts).slice(-1)[0] || "";
  state = candidate;
  if (!save()) { state = previousState; showStatus("Historical resubmission could not be saved. Your working draft and editing permission are preserved.", true); return false; }
  revokeHistoricalEdit(); loadRecord(activeDate, true);
  showStatus("Historical timesheet resubmitted successfully. Changes saved and the fortnight is locked.");
  return true;
}
function submittedPeriodsFor(start) {
  return periodContext(start).sourceEntries;
}
function submissionForPeriod(start) {
  return periodContext(start).submission;
}
function submittedPeriodStart(date) {
  const period = periodContext(date); return period.submitted ? period.start : "";
}
function historicalEditAllowed(date) {
  return periodContext(date).authorized;
}
function submittedPeriodLocked(date = activeDate) {
  const period = periodContext(date); return period.submitted && !period.authorized;
}
function ensureRecordWritable(date) {
  return periodContext(date).canEditRecord;
}
function meaningfulDailyChanges() {
  const current = readForm();
  const normalise = (key, value) => {
    const text = String(value || "").trim();
    if (C.TIME_KEYS.includes(key)) return normalizeClockTime(text);
    if (key === "leaveHours" || key === "toilHours") return normalizeDurationInput(text);
    return text;
  };
  return RECORD_FIELDS.some(key => normalise(key, current[key]) !== normalise(key, originalDraft[key])) ||
    [...document.querySelectorAll(".interruption-editor")].some(editor =>
      normalise("morningOut", editor.querySelector("[data-interruption-out]").value) !== normalise("morningOut", editor.dataset.originalOut) ||
      normalise("morningIn", editor.querySelector("[data-interruption-in]").value) !== normalise("morningIn", editor.dataset.originalIn));
}
function guardDailySaveAttempt(showWarning, mode = "record") {
  const period = periodContext();
  if (period.storageConflict) { showStatus("Stored timesheets changed in another window. Your input is preserved; review or copy it before reloading. No data has been overwritten.", true); return false; }
  if (period.requiresReview || storageReadError) { showStatus("Saved submission identifiers or data need calendar review. No data has been changed. Use the read-only period diagnostic before editing.", true); return false; }
  if (period.submitted && !period.authorized) {
    if (showWarning) openSubmittedWarning();
    return false;
  }
  if (period.otherSession) { showStatus("Resubmit or Cancel historical editing before changing another fortnight.", true); return false; }
  try { if (localStorage.getItem(STORAGE_KEY) !== persistedStateRaw) { showStatus("Stored timesheets changed in another window. Your input is preserved; review or copy it before reloading. No data has been overwritten.", true); return false; } }
  catch { showStatus("Browser storage could not be checked. Your input is preserved and no data has been changed.", true); return false; }
  return mode === "draft" ? period.canSaveDraft : period.canEditRecord;
}
function openSubmittedWarning() {
  if (!el("submittedWarningModal").hidden) return;
  submittedWarningFocus = document.activeElement;
  const main = document.querySelector("main");
  submittedWarningMainInert = main.inert;
  main.inert = true;
  el("submittedWarningModal").hidden = false;
  el("dismissSubmittedWarning").focus();
}
function closeSubmittedWarning() {
  el("submittedWarningModal").hidden = true;
  document.querySelector("main").inert = submittedWarningMainInert;
  if (submittedWarningFocus?.isConnected && !submittedWarningFocus.disabled) submittedWarningFocus.focus();
  else el("saveDraft").focus();
  submittedWarningFocus = null;
}
function revokeHistoricalEdit() {
  historicalEditStart = ""; historicalEditAuthorization = null; historicalSession = null; historicalEditSequence++;
  el("historicalEditStatus").textContent = "";
  pendingRecordSubmission = null;
  if (!pendingWeekendRecordOpen) el("workConfirmationModal").hidden = true;
}
function leaveHistoricalEditing() {
  if (historicalSession) return requestHistoricalExit();
  if (!historicalEditStart) return true;
  if (draftIsDirty()) {
    if (!confirm("Save your unsaved historical changes as a draft before leaving historical editing?")) return false;
    if (!saveDraft()) return false;
  }
  revokeHistoricalEdit(); loadRecord(activeDate, true);
  return true;
}

function formatPeriod(start) {
  const formatter = new Intl.DateTimeFormat("en-AU", { day:"numeric", month:"short", year:"numeric", timeZone:"UTC" });
  const localDate = iso => new Date(C.calendarDay(iso) * 86400000);
  return `${formatter.format(localDate(start))} – ${formatter.format(localDate(C.addDays(start, 13)))}`;
}
function rebuildFortnightSelector() {
  const yearSelect = el("filterYear"), monthSelect = el("filterMonth"), selector = el("viewFortnight");
  if (!fortnightCalculationAllowed()) {
    yearSelect.innerHTML = monthSelect.innerHTML = selector.innerHTML = `<option value="">Setup required</option>`;
    yearSelect.disabled = monthSelect.disabled = selector.disabled = true; return;
  }
  yearSelect.disabled = monthSelect.disabled = selector.disabled = false;
  const knownDates = [todayISO(), activeDate, state.settings.fortnightStart, ...Object.keys(state.records), ...Object.keys(state.drafts), ...Object.keys(state.submissions)];
  const years = knownDates.filter(C.isValidISODate).map(date => Number(date.slice(0, 4)));
  const minYear = Math.min(filterYear, ...years), maxYear = Math.max(filterYear, ...years);
  yearSelect.innerHTML = Array.from({length:maxYear-minYear+1}, (_, i) => minYear+i).map(year => `<option value="${year}"${year === filterYear ? " selected" : ""}>${year}</option>`).join("");
  const monthNames = Array.from({length:12}, (_, i) => new Intl.DateTimeFormat("en-AU", {month:"long"}).format(new Date(2020, i, 1)));
  monthSelect.innerHTML = monthNames.map((name, i) => `<option value="${i+1}"${i+1 === filterMonth ? " selected" : ""}>${name}</option>`).join("");
  const starts = C.fortnightsOverlappingMonth(filterYear, filterMonth, state.settings.fortnightStart);
  if (!starts.includes(historicalStart)) {
    const currentStart = periodFor(todayISO()).start;
    historicalStart = starts.includes(currentStart) ? currentStart : starts[0];
  }
  selector.innerHTML = starts.map(start => `<option value="${start}"${start === historicalStart ? " selected" : ""}>${formatPeriod(start)}</option>`).join("");
}
function changePeriodFilter(year, month) {
  if (historicalSession) { requestHistoricalExit(() => changePeriodFilter(year, month)); if (historicalSession) rebuildFortnightSelector(); return; }
  if (!leaveHistoricalEditing()) { rebuildFortnightSelector(); return; }
  filterYear = year; filterMonth = month; historicalStart = ""; historicalMode = true;
  el("historicalEditStatus").textContent = "";
  renderAll();
}
function changeFortnight(start) {
  if (historicalSession) { requestHistoricalExit(() => changeFortnight(start)); if (historicalSession) rebuildFortnightSelector(); return; }
  if (!leaveHistoricalEditing()) { rebuildFortnightSelector(); return; }
  historicalStart = periodFor(start).start; historicalMode = true;
  el("historicalEditStatus").textContent = "";
  renderAll();
}

function openHistoricalEdit() {
  if (historicalSession) {
    if (historicalStart === historicalSession.start) { showStatus("Historical Edit Mode is already active. Use Resubmit or Cancel when finished."); return; }
    requestHistoricalExit(() => openHistoricalEdit()); return;
  }
  if (!ensureValidAnchor()) return;
  if (periodContext(historicalStart).requiresReview) { showStatus("This calendar has submission identifiers requiring review. Use the read-only diagnostic before historical editing.", true); return; }
  pendingHistoricalEdit = historicalStart;
  el("historicalSubmittedNotice").hidden = !periodContext(historicalStart).submitted;
  el("historicalDraftNotice").hidden = !draftIsDirty();
  el("historicalDraftNotice").textContent = submittedPeriodLocked() ? "Your temporary Daily Entry changes will remain in the form. They will not be saved until you explicitly save them in authorised historical editing." : "Your Daily Entry has unsaved changes. Continue Editing will save them as a draft before opening this timesheet.";
  el("historicalEditError").hidden = true;
  el("historicalEditModal").hidden = false;
  el("cancelHistoricalEdit").focus();
}
function closeHistoricalEdit(cancelled = true) {
  if (cancelled && !leaveHistoricalEditing()) return;
  pendingHistoricalEdit = "";
  el("historicalEditModal").hidden = true;
  el("editHistoricalTimesheet").focus();
}
function confirmHistoricalEdit() {
  const start = pendingHistoricalEdit;
  if (!start) return;
  const context = periodContext(start);
  if (context.requiresReview) { el("historicalEditError").textContent = "Submission identifiers need calendar review before editing."; el("historicalEditError").hidden = false; return; }
  const dates = Object.keys(periodEntries(state.records, start)).sort();
  if (!dates.length) {
    closeHistoricalEdit(false);
    el("historicalEditStatus").textContent = "No saved records for this fortnight. Select another fortnight to edit.";
    return;
  }
  const continuingSubmittedChanges = submittedPeriodLocked() && meaningfulDailyChanges();
  if (continuingSubmittedChanges && periodFor(activeDate).start !== start) {
    el("historicalEditError").textContent = "Your temporary changes belong to another submitted fortnight. Authorise that fortnight first, or return to its saved values before opening a different timesheet.";
    el("historicalEditError").hidden = false;
    return;
  }
  if (!continuingSubmittedChanges && draftIsDirty() && !saveDraft()) {
    el("historicalEditError").textContent = "Your Daily Entry could not be saved as a draft. Correct its highlighted fields before continuing. Your entry has not been discarded.";
    el("historicalEditError").hidden = false;
    return;
  }
  let storageBaseline = null;
  const submittedPeriods = submittedPeriodsFor(start);
  if (context.submitted) {
    try { storageBaseline = localStorage.getItem(STORAGE_KEY); }
    catch (error) { el("historicalEditError").textContent = `Stored data could not be checked: ${error.message}`; el("historicalEditError").hidden = false; return; }
  }
  closeHistoricalEdit(false);
  historicalEditStart = start;
  historicalEditAuthorization = {start, anchor:state.settings.fortnightStart, id:++historicalEditSequence};
  if (context.submitted) {
    historicalSession = {start, id:historicalEditAuthorization.id, originalRecords:clone(periodEntries(state.records, start)), records:clone(periodEntries(state.records, start)), drafts:{}, touched:new Set(), originalSubmission:state.submissions[start] ? clone(state.submissions[start]) : null, originalSubmittedPeriods:clone(submittedPeriods), settings:clone(state.settings), storageBaseline};
  }
  // Opening an existing record does not change any stored record or submission status.
  if (continuingSubmittedChanges) {
    historicalMode = false; editMode = Boolean(state.records[activeDate]); renderAll();
  } else loadRecord(dates[0], true, "edit");
  showStatus("Editing historical timesheet. Select a date or use Edit beside an entry; save each change when ready.");
  scrollTo({top:0, behavior:"smooth"});
}

function changeRecord(date) {
  if (!date) { el("recordDate").value = activeDate; return; }
  if (date === activeDate) { historicalMode = false; renderAll(); return; }
  if (!requestRecordOpen(date)) { el("recordDate").value = activeDate; renderRecordDate(); }
}
function requestRecordOpen(date, mode = "new") {
  if (historicalSession && !sessionContains(date)) return requestHistoricalExit(() => requestRecordOpen(date, mode));
  if (mode === "edit" && !ensureRecordWritable(date)) return false;
  if (draftIsDirty() && !confirm("Discard your unsaved changes and open another record?")) return false;
  return loadRecord(date, true, mode);
}
function loadRecord(date, force = false, mode = "new") {
  if (!force && draftIsDirty() && !confirm("Discard your unsaved changes and open another record?")) return;
  if (historicalSession && !sessionContains(date)) { showStatus("Resubmit or Cancel the current historical session before opening another fortnight.", true); return false; }
  if (historicalEditStart && !historicalEditAllowed(date)) revokeHistoricalEdit();
  const historicalRecord = Boolean(historicalEditAllowed(date) && editableRecords()[date]);
  const locked = submittedPeriodLocked(date);
  activeDate = date; historicalMode = false; el("recordDate").value = date; renderRecordDate();
  const savedDraft = !locked && (mode === "new" || historicalRecord) ? historicalDraftFor(date) : null;
  const existingRecord = Boolean(editableRecords()[date]);
  editMode = !locked && (mode === "edit" || historicalRecord || (savedDraft ? Boolean(savedDraft.editMode && existingRecord) : existingRecord));
  draft = locked ? clone(editableRecords()[date] || emptyRecord(state.settings.attendanceType)) : savedDraft ? clone(savedDraft.record) : editMode ? clone(editableRecords()[date]) : emptyRecord(state.settings.attendanceType); originalDraft = clone(draft);
  fillForm(draft); closeInterruptionEditor(); renderInterruptionList(); setLeaveToilExpanded(savedDraft ? savedDraft.leaveToilExpanded : (editMode || locked) && recordHasLeaveToil(draft)); renderAll();
  return true;
}
function submitRecord({showSubmittedWarning = false} = {}) {
  if (!guardDailySaveAttempt(showSubmittedWarning)) return false;
  if (!fortnightCalculationAllowed()) { setSettingsExpanded(true); alert("Please set the Fortnight Start Date to a Thursday before saving records."); el("fortnightStart").focus(); return; }
  if (!validateClockInputs("[data-record-time]")) return;
  if (!validateDurationInputs("[data-record-duration]")) return;
  draft = readForm();
  if (!stageInterruptionEditors()) return;
  const existed = Object.prototype.hasOwnProperty.call(editableRecords(), activeDate);
  if (!editMode && existed) { alert("A record already exists for this date. Use Edit in Timesheet History to change it."); return; }
  if (editMode && !existed) { alert("This record no longer exists. Cancel the edit and submit it as a new record."); return; }
  const candidateRecord = readForm();
  if (C.isSeniorOfficer(candidateRecord.attendanceType) && candidateRecord.leaveType === "Flex") { alert("Flex Leave is not available for Senior Officer A/B attendance records."); el("leaveType").focus(); return; }
  draft = clone(candidateRecord);
  if (!validateLeaveToil(candidateRecord)) return;
  if (!validateInterruptions(candidateRecord)) return;
  if (!validateRecordCompleteness(candidateRecord)) return;
  const submission = { date:activeDate, candidateRecord:clone(candidateRecord), previous:editableRecords()[activeDate] ? clone(editableRecords()[activeDate]) : null, existed, wasEditMode:editMode, historicalAuthorization:historicalEditAllowed(activeDate) ? historicalEditAuthorization.id : null };
  if (!guardWeekendSubmission(activeDate, candidateRecord, submission)) return;
  const publicHolidayConfirmation = workConfirmationFor(activeDate, candidateRecord);
  if (publicHolidayConfirmation) { queueRecordConfirmation(submission, publicHolidayConfirmation); return; }
  commitRecordSubmission(submission);
}
function nextAvailableRecordDate(date) {
  let nextDate = C.addDays(date, 1);
  while (isWeekendISO(nextDate) || Object.prototype.hasOwnProperty.call(state.records, nextDate) || Object.prototype.hasOwnProperty.call(state.drafts, nextDate)) nextDate = C.addDays(nextDate, 1);
  return nextDate;
}
function defaultRecordDate() {
  const dates = [...Object.keys(state.records), ...Object.keys(state.drafts)].filter(date => C.isValidISODate(date)).sort((a,b) => C.calendarDay(a) - C.calendarDay(b));
  if (dates.length) return nextAvailableRecordDate(dates.at(-1));
  let date = todayISO();
  while (isWeekendISO(date)) date = C.addDays(date, 1);
  return date;
}
function initialRecordDate() {
  return state.activeDraftDate && state.drafts[state.activeDraftDate] ? state.activeDraftDate : defaultRecordDate();
}
function advanceToNextAvailableRecordDate() {
  loadRecord(defaultRecordDate(), true);
}
function commitRecordSubmission(submission) {
  const { date, candidateRecord, previous, existed, wasEditMode } = submission;
  if (date !== activeDate || !ensureRecordWritable(date)) return false;
  if (submission.historicalAuthorization != null && submission.historicalAuthorization !== historicalEditAuthorization?.id) return false;
  if (submittedPeriodStart(date) && submission.historicalAuthorization !== historicalEditAuthorization?.id) return false;
  if (historicalSession && sessionContains(date) && historicalEditAllowed(date)) {
    if (submission.historicalAuthorization !== historicalEditAuthorization.id || !recordsEqual(editableRecords()[date] || null, previous)) return false;
    historicalSession.records[date] = clone(candidateRecord); delete historicalSession.drafts[date]; historicalSession.touched.add(date);
    loadRecord(date, true, "edit"); showStatus("Changes saved to the historical working draft. Resubmit to commit them."); return true;
  }
  if (!recordsEqual(state.records[date] || null, previous)) { alert("This record has changed since editing began. Reopen it before saving."); return false; }
  const previousDraft = state.drafts[date] ? clone(state.drafts[date]) : null;
  const previousActiveDraftDate = state.activeDraftDate;
  state.records[date] = clone(candidateRecord);
  removeSavedDraft(date);
  if (!save()) {
    if (previous) state.records[date] = previous; else delete state.records[date];
    if (previousDraft) state.drafts[date] = previousDraft;
    state.activeDraftDate = previousActiveDraftDate;
    return;
  }
  if (!wasEditMode && !existed) advanceToNextAvailableRecordDate();
  else {
    editMode = false; draft = emptyRecord(state.settings.attendanceType); originalDraft = clone(draft); fillForm(draft); closeInterruptionEditor(); renderInterruptionList(); setLeaveToilExpanded(false); renderAll();
  }
  showStatus(existed ? "Changes saved. Later balances have been recalculated." : "Record submitted and added to Timesheet History.");
}
function guardWeekendSubmission(date, candidateRecord, submission) {
  if (!isWeekendISO(date) || !hasMeaningfulTimesheetData(candidateRecord)) return true;
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
  const weekend = isWeekendISO(date);
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
    if (key === "attendanceType") return false;
    return Boolean(record[key]);
  });
}
function queueRecordConfirmation(submission, details) {
  pendingRecordSubmission = clone(submission);
  openWorkConfirmation(details);
}
function confirmPendingRecordSubmission() {
  if (pendingWeekendRecordOpen) {
    const pending = pendingWeekendRecordOpen;
    closeWorkConfirmation();
    loadRecord(pending.date, true, pending.mode);
    return;
  }
  const submission = pendingRecordSubmission;
  if (!submission) return;
  closeWorkConfirmation();
  if (submission.historicalResubmission) { resubmitHistoricalEdit(submission.historicalResubmission); return; }
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
  pendingWeekendRecordOpen = null;
  el("workConfirmationModal").hidden = true;
  el("submitRecord").focus();
}
function cancelPendingWorkConfirmation() {
  const cancelledRecordOpen = Boolean(pendingWeekendRecordOpen);
  closeWorkConfirmation();
  if (cancelledRecordOpen) { el("recordDate").value = activeDate; renderRecordDate(); }
}
function cancelEdit() {
  if (historicalSession) { requestHistoricalExit(); return; }
  if (!editMode && !historicalEditStart) return;
  if (draftIsDirty() && !confirm("Discard your unsaved changes and cancel editing?")) return;
  revokeHistoricalEdit();
  if (submittedPeriodLocked()) loadRecord(activeDate, true);
  else {
    editMode = false; draft = emptyRecord(state.settings.attendanceType); originalDraft = clone(draft);
    fillForm(draft); closeInterruptionEditor(); renderInterruptionList(); setLeaveToilExpanded(false); renderAll();
  }
  showStatus("Edit cancelled.");
}
function validateInterruptions(record) {
  const hasMorning = record.morningOut || record.morningIn;
  const hasAfternoon = record.afternoonOut || record.afternoonIn;
  if (hasMorning && (!record.morningOut || !record.morningIn || record.morningOut >= record.morningIn)) {
    alert("Complete the Additional Time Entry Out and In times before submitting."); return false;
  }
  if (hasAfternoon && (!record.afternoonOut || !record.afternoonIn || record.afternoonOut >= record.afternoonIn)) {
    alert("Complete the Additional Time Entry Out and In times before submitting."); return false;
  }
  if (record.lunchOut && record.lunchIn && ((hasMorning && record.morningIn > record.lunchOut) || (hasAfternoon && record.afternoonOut < record.lunchIn))) {
    alert("An Additional Time Entry overlaps the lunch period. Please adjust its times before submitting."); return false;
  }
  return true;
}
function validateLeaveToil(record) {
  if (Boolean(record.leaveType) === Boolean(record.leaveHours)) return true;
  setLeaveToilExpanded(true);
  alert("Complete both Leave Type and Leave Hours before saving the daily record.");
  el(record.leaveType ? "leaveHours" : "leaveType").focus();
  return false;
}
function validateRecordCompleteness(record) {
  if (!C.calculateDay(record, C.standardFor(activeDate, state.settings)).incomplete) return true;
  alert("Complete both ends of each work segment before submitting the record.");
  return false;
}
function deleteRecord(date) {
  if (!ensureRecordWritable(date)) return false;
  const currentDirty = date === activeDate && draftIsDirty();
  const message = currentDirty ? `Delete ${date} and discard its unsaved changes? This cannot be undone.` : `Delete the record for ${date}? This cannot be undone.`;
  if (!confirm(message)) return;
  if (historicalSession && sessionContains(date) && historicalEditAllowed(date)) {
    delete historicalSession.records[date]; delete historicalSession.drafts[date]; historicalSession.touched.add(date);
    if (date === activeDate) loadRecord(date, true);
    else renderAll();
    showStatus("Record removed from the historical working draft. Resubmit to commit the deletion."); return;
  }
  const deleted = state.records[date]; delete state.records[date];
  if (!save()) { state.records[date] = deleted; return; }
  if (date === activeDate) { editMode = false; draft = emptyRecord(state.settings.attendanceType); originalDraft = clone(draft); fillForm(draft); closeInterruptionEditor(); renderInterruptionList(); setLeaveToilExpanded(false); }
  renderAll(); showStatus("Record deleted. Later balances have been recalculated.");
}

function renderAll() {
  updateConfigurationValidity();
  const savedCalc = fortnightCalculationAllowed() ? C.recalculate(editableRecords(), state.settings) : {};
  const previewRecords = currentPreviewRecords();
  const previewCalc = fortnightCalculationAllowed() ? C.recalculate(previewRecords, state.settings) : {};
  rebuildFortnightSelector();
  viewStart = validAnchor() ? (historicalMode ? historicalStart : periodFor(activeDate).start) : "";
  updateRecordDateBounds();
  renderCalculations(previewCalc); renderFortnight(historicalMode ? savedCalc : previewCalc, historicalMode ? editableRecords() : previewRecords); renderRecords(savedCalc); renderSubmissionReminder(); renderFortnightStatus(); updateActionState();
}
function updateRecordDateBounds() {
  el("recordDate").removeAttribute("min"); el("recordDate").removeAttribute("max");
}
function draftHasAttendanceData() {
  return C.TIME_KEYS.some(key => draft[key]) || Boolean(draft.leaveType || draft.leaveHours || draft.toilHours);
}
function currentPreviewRecords() {
  const records = { ...editableRecords() };
  if (!submittedPeriodLocked() && (editMode || draftIsDirty() || draftHasAttendanceData())) records[activeDate] = clone(draft);
  return records;
}
function renderCurrentPreview() {
  if (!fortnightCalculationAllowed()) { renderCalculations({}); renderFortnight({}, {}); return; }
  const records = currentPreviewRecords();
  const calc = C.recalculate(records, state.settings);
  renderCalculations(calc);
  renderFortnight(historicalMode ? C.recalculate(editableRecords(), state.settings) : calc, historicalMode ? editableRecords() : records);
}
function renderCalculations(calc) {
  const seniorOfficer = C.isSeniorOfficer(draft.attendanceType);
  const balanceLabels = seniorOfficer ? ["Daily SOG Balance", "Progressive SOG Balance"] : ["Daily Flex Balance", "Progressive Flex Balance"];
  if (!fortnightCalculationAllowed()) {
    metricList("dailyResults", [["Daily Hours", null], [balanceLabels[0], null], [balanceLabels[1], null], ["Progressive TOIL Balance", null]]);
    showStatus("Invalid fortnight start date"); return;
  }
  let day = calc[activeDate];
  if (!day) day = C.recalculate({ ...editableRecords(), [activeDate]: draft }, state.settings)[activeDate];
  metricList("dailyResults", [["Daily Hours", day.daily], [balanceLabels[0], seniorOfficer ? day.dailySog : day.dailyFlex], [balanceLabels[1], seniorOfficer ? day.progressiveSog : day.progressiveFlex], ["Progressive TOIL Balance", day.progressiveToil]]);
  if (draftIsDirty()) showStatus("Unsaved changes");
  else showStatus("");
}
function updateActionState() {
  el("submitRecord").textContent = editMode ? "Save Changes" : "Submit";
  const card = el("dailyEntryCard");
  card.querySelectorAll("input").forEach(input => { input.readOnly = false; });
  card.querySelectorAll("select").forEach(input => { input.disabled = false; });
  card.querySelectorAll("button").forEach(button => { button.disabled = false; });
  renderInterruptionEditorState();
  el("submitRecord").disabled = !fortnightCalculationAllowed();
  el("cancelEdit").hidden = !editMode && !historicalEditStart;
  el("cancelEdit").disabled = false;
  const sessionActive = Boolean(historicalSession && historicalEditAllowed(historicalSession.start));
  el("resubmitHistoricalTimesheet").hidden = !sessionActive;
  el("cancelHistoricalSession").hidden = !sessionActive;
  if (sessionActive) el("historicalEditStatus").textContent = "Historical Edit Mode: changes are not committed until Resubmit.";
}
function metricList(id, entries) { el(id).innerHTML = entries.map(([label, value, helper]) => `<div><span>${label}</span>${helper ? `<small>${helper}</small>` : ""}<strong>${C.formatDuration(value) || "—"}</strong></div>`).join(""); }

function renderFortnight(calc, records = editableRecords()) {
  const seniorOfficer = C.isSeniorOfficer(historicalMode ? state.settings.attendanceType : draft.attendanceType);
  if (!fortnightCalculationAllowed()) {
    el("periodDates").textContent = storageReadError ? "Saved timesheet data needs review" : "Invalid fortnight start date";
    const label = seniorOfficer ? "SOG" : "Flex";
    metricList("fortnightResults", [["Standard Hours", null], ["Hours Recorded This Period", null], [`Opening ${label} Balance`, null], [`Net ${label} for the Period`, null], [`Closing ${label} Balance`, null], ["TOIL Balance", null]]);
    return;
  }
  const period = { start: viewStart, end: C.addDays(viewStart, 13) };
  let standard = 0, recorded = 0, netBalance = 0;
  for (let offset = 0; offset < 14; offset++) {
    const current = C.addDays(period.start, offset);
    standard += C.standardFor(current, state.settings);
    if (records[current]) { const day = calc[current]; if (day.daily != null) { recorded += day.daily; if (C.isSeniorOfficer(records[current].attendanceType) === seniorOfficer) netBalance += seniorOfficer ? day.dailySog : day.dailyFlex; } }
  }
  const datesBefore = Object.keys(calc).filter(d => C.calendarDay(d) < C.calendarDay(period.start)).sort((a,b) => C.calendarDay(a) - C.calendarDay(b));
  const carriedFlex = datesBefore.length ? calc[datesBefore.at(-1)].progressiveFlex : (C.parseDuration(state.settings.openingFlex) || 0);
  const endDates = Object.keys(calc).filter(d => C.calendarDay(d) <= C.calendarDay(period.end)).sort((a,b) => C.calendarDay(a) - C.calendarDay(b));
  const endFlex = endDates.length ? calc[endDates.at(-1)].progressiveFlex : carriedFlex;
  const toil = endDates.length ? calc[endDates.at(-1)].progressiveToil : (C.parseDuration(state.settings.openingToil) || 0);
  el("periodDates").textContent = `${formatDisplayDate(period.start, "range")} to ${formatDisplayDate(period.end, "range")}`;
  if (seniorOfficer) {
    const priorSogDates = Object.keys(calc).filter(d => C.calendarDay(d) < C.calendarDay(period.start) && calc[d].seniorOfficer).sort((a,b) => C.calendarDay(a) - C.calendarDay(b));
    const openingSog = priorSogDates.length ? calc[priorSogDates.at(-1)].progressiveSog : 0;
    metricList("fortnightResults", [["Standard Hours", standard], ["Hours Recorded This Period", recorded], ["Opening SOG Balance", openingSog], ["Net SOG for the Period", netBalance], ["Closing SOG Balance", openingSog + netBalance], ["TOIL Balance", toil]]);
  } else metricList("fortnightResults", [["Standard Hours", standard], ["Hours Recorded This Period", recorded], ["Opening Flex Balance", carriedFlex], ["Net Flex for the Period", netBalance], ["Closing Flex Balance", endFlex], ["TOIL Balance", toil]]);
}

function renderRecords(calc) {
  const balanceLabel = C.isSeniorOfficer(historicalMode ? state.settings.attendanceType : draft.attendanceType) ? "SOG" : "Flex";
  el("dailyBalanceHeading").textContent = `Daily ${balanceLabel}`;
  el("progressiveBalanceHeading").textContent = `Progressive ${balanceLabel}`;
  const end = viewStart ? C.addDays(viewStart, 13) : "";
  const dates = Object.keys(periodEntries(editableRecords(), viewStart)).sort((a,b) => C.calendarDay(a) - C.calendarDay(b));
  const hideActions = dates.length ? dates.every(date => !periodContext(date).canEditRecord) : !periodContext(viewStart).canEditRecord;
  el("recordActionsHeading").hidden = hideActions;
  el("recordsBody").innerHTML = dates.length ? dates.map(date => {
    const d = calc[date], senior = C.isSeniorOfficer(editableRecords()[date].attendanceType);
    const actions = !periodContext(date).canEditRecord ? "" : `<td class="row-actions"><button class="link-button" data-edit="${date}">Edit</button><button class="link-button danger" data-delete="${date}">Delete</button></td>`;
    return `<tr data-record-date="${date}"><td>${formatDisplayDate(date)}</td><td>${d ? C.formatDuration(d.daily) || "Incomplete" : "—"}</td><td>${d ? C.formatDuration(senior ? d.dailySog : d.dailyFlex) || "—" : "—"}</td><td>${d ? C.formatDuration(senior ? d.progressiveSog : d.progressiveFlex) : "—"}</td><td>${d ? C.formatDuration(d.progressiveToil) : "—"}</td>${actions}</tr>`;
  }).join("") : `<tr><td colspan="${hideActions ? 5 : 6}" class="muted">No records yet.</td></tr>`;
  document.querySelectorAll("[data-edit], [data-delete]").forEach(button => {
    button.disabled = (historicalMode && historicalEditStart !== viewStart) || submittedPeriodLocked(button.dataset.edit || button.dataset.delete);
    if (button.disabled) button.title = "Choose Edit Timesheet to enable historical editing.";
  });
  document.querySelectorAll("[data-edit]").forEach(button => button.addEventListener("click", () => { if (requestRecordOpen(button.dataset.edit, "edit")) scrollTo({top:0, behavior:"smooth"}); }));
  document.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => deleteRecord(button.dataset.delete)));
}

function historicalResubmissionActive(start) {
  return Boolean(historicalSession?.start === start && historicalEditAllowed(start));
}
function fortnightStatusFor(start) {
  return selectedAnchorValid() ? periodContext(start).status : "Setup required";
}
function renderFortnightStatus() {
  for (const [id, start] of [["fortnightStatus", viewStart], ["dailyEntryStatus", periodFor(activeDate).start], ["calculatedDateStatus", periodFor(activeDate).start]]) {
    const badge = el(id);
    badge.textContent = fortnightStatusFor(start);
    badge.classList.toggle("status-overdue", badge.textContent === "Overdue");
  }
}

function renderSubmissionReminder() {
  const box = el("submissionReminder"); reminderStart = "";
  const historical = sessionContains(activeDate) && historicalResubmissionActive(periodFor(activeDate).start);
  el("resubmitHistoricalReminder").hidden = !historical;
  el("markSubmitted").hidden = historical;
  if (historical) {
    box.hidden = false; setPrimaryLayoutState(true);
    el("submissionMessage").textContent = "Historical timesheet awaiting resubmission";
    el("submissionPeriod").textContent = "You are editing a previously submitted fortnight. Please resubmit it when you have finished making changes.";
    return;
  }
  if (!fortnightCalculationAllowed()) { box.hidden = true; setPrimaryLayoutState(false); return; }
  const today = todayISO();
  const currentStart = C.fortnightFor(today, state.settings.fortnightStart).start;
  const previousStart = C.addDays(currentStart, -14);
  const starts = new Set(Object.keys(editableRecords()).map(date => C.fortnightFor(date, state.settings.fortnightStart).start));
  starts.add(currentStart); starts.add(previousStart);
  periodCalendar().periodIds().forEach(start => starts.add(start));
  const candidates = [...starts].map(start => ({ start, end: C.addDays(start, 13), submission: submissionForPeriod(start), review:periodContext(start).requiresReview })).filter(period => {
    if (period.review) return false;
    if (period.submission.changed) return true;
    if (period.submission.submitted) return false;
    const hasRecords = Object.keys(periodEntries(editableRecords(), period.start)).length > 0;
    return today === period.end || (C.calendarDay(today) > C.calendarDay(period.end) && (hasRecords || period.start === previousStart));
  }).sort((a, b) => {
    if (a.start === viewStart) return -1;
    if (b.start === viewStart) return 1;
    return C.calendarDay(b.start) - C.calendarDay(a.start);
  });
  const period = candidates[0];
  if (!period) { box.hidden = true; setPrimaryLayoutState(false); return; }
  reminderStart = period.start; box.hidden = false;
  setPrimaryLayoutState(true);
  if (period.submission.changed) el("submissionMessage").textContent = "Submitted fortnight changed — please review and resubmit if needed.";
  else if (today === period.end) el("submissionMessage").textContent = "Timesheet due — please review and submit this fortnight.";
  else el("submissionMessage").textContent = "Timesheet overdue — please review and submit this fortnight.";
  el("submissionPeriod").textContent = `${formatReminderDate(period.start)} to ${formatReminderDate(period.end)}`;
}
function setPrimaryLayoutState(actionable) {
  const main = document.querySelector("main");
  main.classList.toggle("layout-actionable", actionable);
  main.classList.toggle("layout-unified", !actionable);
}

function markFortnightSubmitted() {
  if (historicalSession) { if (reminderStart === historicalSession.start) resubmitHistoricalEdit(); else showStatus("Resubmit or Cancel the historical session before marking another period submitted.", true); return; }
  if (!reminderStart) return;
  const submittedStart = periodFor(reminderStart).start, context = periodContext(submittedStart);
  if (context.storageConflict) { showStatus("Stored timesheets changed in another window. Your input is preserved; review or copy it before reloading. No data has been overwritten.", true); return; }
  if (context.requiresReview || context.submitted) { showStatus("Use authorised Historical Edit Mode to resubmit an existing submitted fortnight, or review incompatible calendar identifiers first.", true); return; }
  if (periodFor(activeDate).start === submittedStart && draftIsDirty()) {
    if (!confirm("Save the unsaved Daily Entry as a draft before marking this fortnight submitted?")) return;
    if (!saveDraft()) return;
  }
  const previousSubmission = state.submissions[submittedStart] ? clone(state.submissions[submittedStart]) : null;
  state.submissions[submittedStart] = periodCalendar().stamp(submittedStart, previousSubmission || {}, new Date().toISOString());
  if (!save()) { if (previousSubmission) state.submissions[submittedStart] = previousSubmission; else delete state.submissions[submittedStart]; return; }
  if (historicalEditStart === submittedStart) revokeHistoricalEdit();
  if (submittedPeriodLocked()) loadRecord(activeDate, true); else renderAll();
  showStatus("This fortnight has been submitted. You can no longer edit its entries directly. To make changes, go to Historical Timesheets, select the relevant fortnight, and click Edit Timesheet.");
}

function renderSettings() {
  el("attendanceTypeSetting").value = displayAttendanceType(state.settings.attendanceType); el("fortnightStart").value = state.settings.fortnightStart; el("openingFlex").value = state.settings.openingFlex; el("openingToil").value = state.settings.openingToil;
  state.settings.standardByDay.forEach((value, index) => el(`standard${index}`).value = value);
  document.querySelectorAll("[data-setting-duration]").forEach(input => setDurationError(input, false));
  originalSettings = settingsSnapshot(); setSettingsStatus(""); updateConfigurationValidity();
}
function settingsSnapshot() { return JSON.stringify({ attendanceType: el("attendanceTypeSetting")?.value || "Flextime", fortnightStart: el("fortnightStart")?.value || "", openingFlex: el("openingFlex")?.value || "", openingToil: el("openingToil")?.value || "", standardByDay: DAY_NAMES.map((_, i) => el(`standard${i}`)?.value || "") }); }
function setSettingsStatus(message, error = false) { el("settingsStatus").textContent = message; el("settingsStatus").classList.toggle("error", error); }
function setSettingsExpanded(expanded) {
  el("settingsContent").hidden = !expanded;
  el("settingsToggle").setAttribute("aria-expanded", String(expanded));
  el("settingsToggleButton").textContent = expanded ? "−" : "+";
  el("settingsToggleButton").setAttribute("aria-label", expanded ? "Collapse Settings" : "Expand Settings");
  document.querySelector(".settings").classList.toggle("settings-collapsed", !expanded);
}
function setHistoricalExpanded(expanded) {
  el("historicalContent").hidden = !expanded;
  el("historicalToggle").setAttribute("aria-expanded", String(expanded));
  el("historicalToggleButton").textContent = expanded ? "−" : "+";
  el("historicalToggleButton").setAttribute("aria-label", expanded ? "Collapse Historical Timesheets" : "Expand Historical Timesheets");
  document.querySelector(".historical-timesheets").classList.toggle("section-collapsed", !expanded);
}
function updateConfigurationValidity() {
  const selectedValid = selectedAnchorValid();
  el("fortnightStartError").hidden = selectedValid;
  el("saveSettings").disabled = !selectedValid;
  el("submitRecord").disabled = !fortnightCalculationAllowed();
}
function saveSettings() {
  if (historicalSession) { setSettingsStatus("Resubmit or Cancel historical editing before changing settings.", true); return; }
  const start = el("fortnightStart").value;
  if (!start) { const message = "Fortnight Start Date is required and must be a Thursday."; setSettingsStatus(message, true); alert(message); el("fortnightStart").focus(); return; }
  if (!C.isThursdayISO(start)) { const message = "Fortnight Start Date must be a Thursday."; setSettingsStatus(message, true); alert(message); el("fortnightStart").focus(); return; }
  if (validAnchor() && !P.sameCalendar(start, state.settings.fortnightStart) && [state.records,state.drafts,state.submissions].some(data => Object.keys(data).length)) {
    const proposed = P.createCalendar(state.submissions,start), needsReview = calendar => calendar.resolve(todayISO(),{today:todayISO()}).requiresReview || calendar.periodIds().some(id => calendar.resolve(id,{today:todayISO()}).requiresReview);
    const verifiedRestore = Object.values(state.submissions).some(status => status?.submitted) && needsReview(periodCalendar()) && !needsReview(proposed);
    if (!verifiedRestore) { setSettingsStatus("Existing timesheets use a different fortnight calendar. Keep the established calendar and review its identifiers before changing the reporting schedule.", true); return; }
    if (!confirm("Restore the fortnight calendar identified by the saved submission IDs? This changes the saved anchor only; timesheet records and submission IDs will not be moved or rewritten.")) return;
  }
  if (!validateDurationInputs("[data-setting-duration]")) { setSettingsStatus("Duration minutes must be between 00 and 59.", true); return; }
  const durationInputs = [
    ["Opening Flex Balance", el("openingFlex")], ["Opening TOIL Balance", el("openingToil")],
    ...DAY_NAMES.map((name, i) => [`${name} Standard Hours`, el(`standard${i}`)])
  ];
  const invalid = durationInputs.find(([, input]) => C.parseDuration(input.value) == null);
  if (invalid) { const message = `${invalid[0]} must use H:MM format, for example 7:21.`; setSettingsStatus(message, true); alert(message); invalid[1].focus(); return; }
  const previousSettings = state.settings;
  if (historicalEditStart && draftIsDirty() && !saveDraft()) { setSettingsStatus("Save or preserve the historical draft before changing settings.", true); return; }
  state.settings = {...state.settings, ...JSON.parse(settingsSnapshot())};
  if (!save()) { state.settings = previousSettings; setSettingsStatus("Settings could not be saved to localStorage.", true); return; }
  if (historicalEditStart) { revokeHistoricalEdit(); loadRecord(activeDate, true); }
  if (!editMode && !submittedPeriodLocked()) { draft.attendanceType = state.settings.attendanceType; originalDraft.attendanceType = state.settings.attendanceType; updateLeaveTypeOptions(); }
  originalSettings = settingsSnapshot(); renderAll(); setSettingsStatus("Settings saved"); showStatus("Settings saved. All balances have been recalculated."); setSettingsExpanded(false);
}
function openResetHistoryModal() {
  el("resetHistoryConfirmation").value = "";
  el("confirmResetHistory").disabled = true;
  el("resetHistoryModal").hidden = false;
  el("resetHistoryConfirmation").focus();
}
function closeResetHistoryModal() {
  el("resetHistoryModal").hidden = true;
  el("resetHistoryConfirmation").value = "";
  el("confirmResetHistory").disabled = true;
}
function resetTimesheetHistory() {
  if (el("resetHistoryConfirmation").value !== "RESET") return;
  const previousState = state;
  state = { records:{}, submissions:{}, drafts:clone(state.drafts), activeDraftDate:state.activeDraftDate, settings:clone(state.settings) };
  if (!save()) { state = previousState; return; }
  revokeHistoricalEdit();
  pendingRecordSubmission = null;
  reminderStart = "";
  editMode = false;
  interruptionEditorSequence = 0;
  draft = emptyRecord(state.settings.attendanceType);
  originalDraft = clone(draft);
  fillForm(draft);
  closeInterruptionEditor();
  renderInterruptionList();
  setLeaveToilExpanded(false);
  closeWorkConfirmation();
  closeResetHistoryModal();
  renderSettings();
  renderAll();
  showStatus("Timesheet history reset. Enter verified opening balances in Settings to start again.");
}
function showStatus(message, error = false) { el("status").textContent = message; el("status").classList.toggle("error", error); }

function formatCsvDate(iso) {
  const [year, month, day] = String(iso).split("-");
  return `${day}-${month}-${year}`;
}
function buildCsvPackage(start = viewStart) {
  const period = periodFor(start);
  const headers = ["Date", "Start Time", "Morning Out", "Morning In", "Lunch Out", "Lunch In", "Afternoon Out", "Afternoon In", "Finish Time", "Leave Type", "Leave Hours", "Standard Hours", "Attendance Type", "TOIL Hours", "Daily Hours"];
  const exportRows = C.buildFortnightExportRows(state.records, state.settings, period.start).map(([date, ...values]) => [formatCsvDate(date), ...values]);
  const rows = [headers, ...exportRows];
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
function parseExportDate(value) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let match = /^(\d{1,2})\s+(\d{1,2})\s+(\d{2}|\d{4})$/.exec(raw);
  if (!match && /^\d{6}$/.test(raw)) match = [raw, raw.slice(0, 2), raw.slice(2, 4), raw.slice(4, 6)];
  if (!match && /^\d{8}$/.test(raw)) match = [raw, raw.slice(0, 2), raw.slice(2, 4), raw.slice(4, 8)];
  if (!match) {
    const named = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(raw);
    if (named) {
      const monthIndex = months.findIndex(month => month.toLowerCase() === named[2].toLowerCase());
      if (monthIndex >= 0) match = [named[0], named[1], String(monthIndex + 1), named[3]];
    }
  }
  if (!match) return null;
  const day = Number(match[1]), month = Number(match[2]), enteredYear = Number(match[3]), year = match[3].length === 2 ? 2000 + enteredYear : enteredYear;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!C.isValidISODate(iso)) return null;
  return { iso, display:`${String(day).padStart(2, "0")} ${months[month - 1]} ${year}` };
}
function clearExportDateError(id) {
  el(`${id}Error`).hidden = true;
  el(`${id}Error`).textContent = "Enter a valid date in DD MM YYYY format.";
  el(id).removeAttribute("aria-invalid");
  el("multiplePeriodExportStatus").textContent = "";
  el("multiplePeriodExportStatus").classList.remove("error");
}
function normalizeExportDateField(id) {
  const input = el(id);
  if (!input.value.trim()) { clearExportDateError(id); return null; }
  const parsed = parseExportDate(input.value);
  el(`${id}Error`).hidden = Boolean(parsed);
  input.setAttribute("aria-invalid", String(!parsed));
  if (parsed) input.value = parsed.display;
  return parsed;
}
function exportReportingPeriods(from, to) {
  const periods = [];
  for (let start = periodFor(from).start; C.calendarDay(start) <= C.calendarDay(to); start = C.addDays(start, 14)) {
    const end = C.addDays(start, 13);
    if (Object.keys(state.records).some(date => periodFor(date).start === start)) periods.push({ start, end, rows:buildCsvPackage(start).rows });
  }
  return periods;
}
function reportingPeriodLabel(start, end) {
  return `${formatCsvDate(start)} to ${formatCsvDate(end)}`;
}
function buildMultiplePeriodsCsvPackage(periods, from, to) {
  const headers = ["Reporting Period", ...periods[0].rows[0]], rows = [headers];
  periods.forEach((period, index) => {
    if (index) rows.push([]);
    const label = reportingPeriodLabel(period.start, period.end);
    period.rows.slice(1).forEach(row => rows.push([label, ...row]));
  });
  const csv = rows.map(row => row.length ? row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(",") : "").join("\r\n");
  const filename = `Clocky_Timesheets_${from}_to_${to}.csv`;
  const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"});
  const file = typeof File === "function" ? new File([blob], filename, {type:blob.type}) : null;
  return { blob, csv, file, filename, periods, rows };
}
function downloadMultiplePeriodsCsv(csvPackage) {
  const link = document.createElement("a"); link.href = URL.createObjectURL(csvPackage.blob); link.download = csvPackage.filename; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
function exportMultiplePeriodsCsv(options = {}) {
  if (!ensureValidAnchor()) return "invalid";
  const from = normalizeExportDateField("exportPeriodFrom"), to = normalizeExportDateField("exportPeriodTo");
  if (!from || !to) { el("multiplePeriodExportStatus").textContent = "Enter valid From and To dates."; el("multiplePeriodExportStatus").classList.add("error"); return "invalid"; }
  if (C.calendarDay(to.iso) < C.calendarDay(from.iso)) { el("exportPeriodToError").textContent = "Period To cannot be earlier than Period From."; el("exportPeriodToError").hidden = false; el("exportPeriodTo").setAttribute("aria-invalid", "true"); return "invalid-range"; }
  el("exportPeriodToError").textContent = "Enter a valid date in DD MM YYYY format.";
  const periods = exportReportingPeriods(from.iso, to.iso);
  if (!periods.length) { el("multiplePeriodExportStatus").textContent = "No timesheet records found for this period."; el("multiplePeriodExportStatus").classList.add("error"); return "empty"; }
  const csvPackage = buildMultiplePeriodsCsvPackage(periods, from.iso, to.iso);
  (options.download || downloadMultiplePeriodsCsv)(csvPackage);
  el("multiplePeriodExportStatus").textContent = `${periods.length} reporting period${periods.length === 1 ? "" : "s"} exported.`; el("multiplePeriodExportStatus").classList.remove("error");
  return csvPackage;
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

buildUI(); renderSettings(); setSettingsExpanded(false); setHistoricalExpanded(false);
loadRecord(activeDate, true);
openWelcomeModal();
if (storageReadError) showStatus("Saved timesheet data could not be read safely. No data has been changed. Use the read-only diagnostic before saving.", true);
if (!validAnchor() && !TEST_MODE && !storageReadError) setTimeout(anchorReminder, 0);
if (TEST_MODE) {
  const testScript = document.createElement("script"); testScript.src = "test-ui-workflow.js"; document.body.append(testScript);
}
