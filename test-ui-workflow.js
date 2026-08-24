(async function () {
  const result = document.createElement("pre"); result.id = "testResult"; result.style.cssText = "position:fixed;z-index:9999;left:8px;bottom:8px;max-width:calc(100% - 16px);white-space:pre-wrap;background:white;color:black;padding:8px;border:2px solid #6848a8"; document.body.append(result);
  const originalStoredValue = localStorage.getItem(STORAGE_KEY);
  const originalConfirm = window.confirm;
  const originalAlert = window.alert;
  const alerts = [];
  window.confirm = () => true;
  window.alert = message => alerts.push(message);
  function assert(condition, message) { if (!condition) throw new Error(message); }
  function input(id, value) { el(id).value = value; el(id).dispatchEvent(new Event("input", { bubbles:true })); }
  function change(id, value) { input(id, value); el(id).dispatchEvent(new Event("change", { bubbles:true })); }
  function interruptionEditor(index = 0) { return document.querySelectorAll(".interruption-editor")[index]; }
  function interruptionInput(index, kind, value) { const field = interruptionEditor(index).querySelector(`[data-interruption-${kind}]`); field.value = value; field.dispatchEvent(new Event("input", { bubbles:true })); return field; }
  function metric(id, label) { return [...el(id).children].find(card => card.querySelector("span")?.textContent === label)?.querySelector("strong")?.textContent; }
  function restore() {
    if (originalStoredValue == null) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, originalStoredValue);
    window.confirm = originalConfirm;
    window.alert = originalAlert;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ records:{"2025-01-02":{attendanceType:"Senior Officer A/B"}}, submissions:{}, settings:{fortnightStart:""} }));
    const migratedState = load();
    assert(migratedState.settings.attendanceType === "Flextime" && migratedState.records["2025-01-02"].attendanceType === "Senior Officer A/B", "Attendance Type settings migration changed a historical record");
    localStorage.removeItem(STORAGE_KEY);
    state = clone(defaults); activeDate = "2026-08-21"; viewStart = ""; editMode = false;
    renderSettings(); loadRecord(activeDate, true);
    assert(el("settingsContent").hidden && el("settingsToggle").getAttribute("aria-expanded") === "false" && el("settingsToggleButton").textContent === "+", "Settings did not start collapsed");
    assert(el("historicalContent").hidden && el("historicalToggle").getAttribute("aria-expanded") === "false" && el("historicalToggleButton").textContent === "+", "Historical Timesheets did not start collapsed");
    el("historicalToggle").click();
    assert(!el("historicalContent").hidden && el("historicalToggle").getAttribute("aria-expanded") === "true" && el("historicalToggleButton").textContent === "−", "Historical Timesheets did not expand normally");
    el("historicalToggle").click();
    assert(el("historicalContent").hidden, "Historical Timesheets did not collapse normally");
    assert(el("leaveToilPanel").hidden && el("toggleLeaveToil").getAttribute("aria-expanded") === "false", "new-record Leave / TOIL panel did not start collapsed");
    assert(!el("attendanceType") && el("attendanceTypeSetting").value === "Flextime", "Attendance Type was not moved from the daily form into Settings");
    assert([...document.querySelector(".settings .form-grid").querySelectorAll("label")].slice(0, 4).map(label => label.childNodes[0].textContent.trim()).join("|") === "Attendance Type|Fortnight start date|Opening Flex Balance|Opening TOIL Balance", "Settings fields are not in the required order");
    assert(el("dailyBalanceHeading").textContent === "Daily Flex" && el("progressiveBalanceHeading").textContent === "Progressive Flex", "Flextime history headings are incorrect");
    assert(!document.querySelector(".danger-zone h3") && document.querySelector(".danger-zone-title").textContent === "Delete All Saved Timesheet Records", "reset section cosmetic title is incorrect");
    assert(getComputedStyle(document.querySelector(".danger-zone")).borderTopStyle !== "none", "reset section divider was removed");
    assert(document.querySelector('script[src="app.js?v=collapsed-sections-v1"]'), "page is not loading the cache-busted collapsed-sections application bundle");
    assert([...document.querySelector(".history-filters").children].map(control => control.tagName === "LABEL" ? control.childNodes[0].textContent.trim() : control.textContent.trim()).join("|") === "Year|Month|Fortnight|Export", "Historical Timesheets controls are not ordered Year, Month, Fortnight, Export");
    assert(el("exportSelectedFortnight").classList.contains("secondary") && el("exportWorkbook").classList.contains("secondary") && el("exportWorkbook").textContent === "Export", "Historical Timesheets export actions do not share the secondary utility style or wording");
    assert(getComputedStyle(document.querySelector(".multi-period-export")).borderTopStyle === "none" && getComputedStyle(document.querySelector(".multi-period-export h3")).color === "rgb(81, 74, 92)", "Export Multiple Periods heading or divider styling is incorrect");

    assert(!el("welcomeModal").hidden, "welcome disclaimer did not open on page load");
    assert(el("welcomeModal").textContent.includes("Clocky is for personal use only.") && el("welcomeModal").textContent.includes("Please do not enter any confidential, sensitive, or work-related information."), "welcome disclaimer text is incorrect");
    let modalRect = el("welcomeModal").querySelector(".dialog-card").getBoundingClientRect();
    assert(modalRect.left >= 0 && modalRect.right <= innerWidth && modalRect.height <= innerHeight, "welcome disclaimer is not contained by the viewport");
    el("closeWelcome").click(); assert(el("welcomeModal").hidden, "welcome disclaimer did not close");

    assert(getComputedStyle(el("status")).color === "rgb(243, 240, 255)", "Record Date status text does not use the high-contrast lavender colour");
    assert(getComputedStyle(el("status")).fontWeight === "600", "status and feedback messages are not displayed at the requested font weight");
    assert(formatReminderDate("2026-08-06") === "06 Aug 2026" && formatReminderDate("2026-09-02") === "02 Sep 2026", "submission reminder date format is incorrect");
    const installOptions = [...document.querySelectorAll("[data-install-platform]")];
    assert(installOptions.length === 4, "Install Clocky does not show all four platform options");
    document.querySelector('[data-install-platform="ios"]').click();
    assert(!el("installModal").hidden && el("installModalContent").textContent.includes("Add to Home Screen"), "iOS Home Screen instructions are missing");
    el("dismissInstallModal").click();
    document.querySelector('[data-install-platform="windows"]').click();
    assert(!el("installModal").hidden && el("installModalContent").textContent.includes("Chrome or Microsoft Edge"), "Windows install fallback instructions are missing");
    el("dismissInstallModal").click();
    document.querySelector('[data-install-platform="mac"]').click();
    assert(!el("installModal").hidden && el("installModalContent").textContent.includes("Add to Dock"), "Mac Safari Add to Dock instructions are missing");
    el("dismissInstallModal").click();
    document.querySelector('[data-install-platform="android"]').click();
    assert(!el("installModal").hidden && el("installModalContent").textContent.includes("Add to Home screen"), "Android install fallback instructions are missing");
    el("dismissInstallModal").click();
    const detectedPlatform = currentPlatform();
    if (detectedPlatform && detectedPlatform !== "ios") {
      let promptOpened = false;
      const installPromptEvent = new Event("beforeinstallprompt", { cancelable: true });
      Object.defineProperties(installPromptEvent, {
        prompt: { value: async () => { promptOpened = true; } },
        userChoice: { value: Promise.resolve({ outcome: "accepted" }) }
      });
      window.dispatchEvent(installPromptEvent);
      await handleInstallChoice(detectedPlatform);
      assert(promptOpened, "available browser PWA install prompt was not opened for the current platform");
    }

    el("openFeedback").click();
    assert(!el("feedbackModal").hidden, "Feedback entry point did not open the modal");
    modalRect = el("feedbackModal").querySelector(".dialog-card").getBoundingClientRect();
    assert(modalRect.left >= 0 && modalRect.right <= innerWidth && modalRect.height <= innerHeight, "Feedback modal is not contained by the viewport");
    assert(!el("feedbackModal").textContent.includes("Would you like a reply?"), "removed reply question is still present");
    assert(prepareFeedback() === "invalid" && !el("feedbackImproveError").hidden && !el("feedbackRatingError").hidden, "Feedback required fields were not validated");
    input("feedbackImprove", "Make historical navigation faster.");
    const ratingFour = document.querySelector('[name="feedbackRating"][value="4"]'); ratingFour.checked = true; ratingFour.dispatchEvent(new Event("change", {bubbles:true}));
    let feedbackMailto = "";
    assert(prepareFeedback({openMailto:url => { feedbackMailto = url; }}) === "opened", "valid Feedback form did not open a mail draft");
    const decodedFeedbackMailto = decodeURIComponent(feedbackMailto);
    assert(decodedFeedbackMailto.startsWith("mailto:sharonwong3386@outlook.com?"), "Feedback mail draft has the wrong recipient");
    assert(decodedFeedbackMailto.includes("subject=Clocky Beta Feedback") && decodedFeedbackMailto.includes("What I like:\nNot provided") && decodedFeedbackMailto.includes("What could be improved:\nMake historical navigation faster.") && decodedFeedbackMailto.includes("Overall experience:\n4/5") && decodedFeedbackMailto.includes("Contact details:\nNot provided"), "Feedback mail draft content is incorrect");
    assert(el("feedbackStatus").textContent.includes("review and send"), "Feedback status incorrectly claims automatic sending");
    el("cancelFeedback").click(); assert(el("feedbackModal").hidden, "Feedback modal did not close");

    input("fortnightStart", "2026-08-19");
    assert(!el("fortnightStartError").hidden, "Wednesday validation warning missing");
    assert(el("saveSettings").disabled, "Save Settings enabled for Wednesday");
    assert(el("submitRecord").disabled, "Submit enabled for Wednesday");

    input("fortnightStart", "2026-08-21");
    assert(!el("fortnightStartError").hidden, "Friday validation warning missing");
    assert(el("saveSettings").disabled, "Save Settings enabled for Friday");
    saveSettings();
    assert(localStorage.getItem(STORAGE_KEY) == null, "invalid settings were persisted");

    input("fortnightStart", "2026-08-20");
    assert(el("fortnightStartError").hidden, "warning remained after switching to Thursday");
    assert(!el("saveSettings").disabled, "Save Settings remained disabled for Thursday");
    el("saveSettings").click();
    let stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.settings.fortnightStart === "2026-08-20" && stored.settings.attendanceType === "Flextime", "settings were not persisted");
    assert(el("settingsStatus").textContent === "Settings saved", "settings confirmation missing");
    assert(!el("submitRecord").disabled, "Submit remained disabled after saving Thursday");
    assert(el("settingsContent").hidden, "Settings did not collapse after a successful save");
    assert(el("settingsToggle").getAttribute("aria-expanded") === "false", "Settings toggle state is incorrect after save");
    assert([...el("submitRecord").parentElement.children].slice(0, 4).map(button => button.textContent).join("|") === "Submit|Save|Copy Previous|Clear", "Daily Entry actions are not ordered Submit, Save, Copy Previous, Clear");
    const actionColors = ["submitRecord", "saveDraft", "copyPrevious", "clearRecord"].map(id => getComputedStyle(el(id)).backgroundColor.match(/\d+/g).slice(0, 3).map(Number).reduce((sum, channel) => sum + channel, 0));
    assert(actionColors.every((brightness, index) => index === 0 || brightness > actionColors[index - 1]), "Daily Entry action colours do not progress from darkest to lightest");
    assert(formatRecordDate("2026-08-18") === "18 Aug 2026 Tue" && formatRecordDate("2026-08-21") === "21 Aug 2026 Fri" && formatRecordDate("2026-08-23") === "23 Aug 2026 Sun", "Record Date display format or local weekday is incorrect");
    change("recordDate", "2026-08-21");
    assert(el("recordDate").value === "2026-08-21" && el("recordDateDisplay").textContent === "21 Aug 2026 Fri", "formatted Record Date changed the underlying value or displayed the wrong weekday");
    assert(getComputedStyle(el("dailyResults").querySelector("span")).color === getComputedStyle(el("fortnightStatus")).color, "daily result label does not use the Current badge text colour");
    assert(getComputedStyle(el("fortnightResults").querySelector("span")).color === getComputedStyle(el("fortnightStatus")).color, "fortnight result label does not use the Current badge text colour");
    if (innerWidth > 780) {
      const summaryValueTops = [...el("fortnightResults").children].map(card => Math.round(card.querySelector("strong").getBoundingClientRect().top));
      assert(new Set(summaryValueTops.slice(0, 3)).size === 1 && new Set(summaryValueTops.slice(3, 6)).size === 1, "Fortnight Summary values are not consistently bottom-aligned within each row");
    }

    // Copy Previous copies only editable record inputs, leaves the date/storage untouched, and recalculates the target date.
    const normalPrevious = {...emptyRecord(), startTime:"09:00", lunchOut:"12:00", lunchIn:"12:30", finishTime:"17:00", dailyFlex:9999, progressiveFlex:9999};
    state.records = {"2026-08-21":clone(normalPrevious)}; state.drafts = {}; save(); loadRecord("2026-08-24", true);
    const storageBeforeCopy = localStorage.getItem(STORAGE_KEY), copiedDate = activeDate;
    el("copyPrevious").click();
    assert(activeDate === copiedDate && el("recordDate").value === copiedDate, "Copy Previous changed the current Record Date");
    assert(el("startTime").value === "09:00" && el("finishTime").value === "17:00", "normal workday was not copied");
    assert(draft.dailyFlex === undefined && draft.progressiveFlex === undefined, "derived Daily or Progressive balances were copied");
    assert(localStorage.getItem(STORAGE_KEY) === storageBeforeCopy && !state.records[copiedDate] && !state.drafts[copiedDate], "Copy Previous saved, submitted, or created History data");
    assert(metric("dailyResults", "Daily Hours") === "7:30" && metric("dailyResults", "Progressive Flex Balance") !== C.formatDuration(9999), "copied inputs were not recalculated for the current date");
    input("finishTime", "1730"); assert(el("finishTime").value === "17:30", "copied entry could not be edited");
    el("clearRecord").click(); assert(!el("startTime").value && !el("finishTime").value, "Clear did not clear a copied entry");

    const assertCopiedDetails = (source, message) => {
      state.records = {"2026-08-21":{...emptyRecord(), ...source}}; state.drafts = {}; loadRecord("2026-08-24", true); el("copyPrevious").click();
      Object.entries(source).forEach(([key, value]) => { if (RECORD_FIELDS.includes(key)) assert(draft[key] === value, message); });
    };
    assertCopiedDetails({leaveType:"Annual", leaveHours:"7:21"}, "Annual Leave entry was not copied");
    assert(!el("leaveToilPanel").hidden, "copied Annual Leave details were not revealed");
    assertCopiedDetails({leaveType:"Public Holiday", leaveHours:"7:21"}, "Public Holiday entry was not copied");
    assertCopiedDetails({leaveType:"Time off in Lieu (TOIL)", leaveHours:"1:00", toilHours:"0:30"}, "TOIL/Other Details were not copied");
    assertCopiedDetails({attendanceType:"Senior Officer A/B", leaveType:"Personal (Certificate)", leaveHours:"7:21"}, "Senior Officer attendance details were not copied");
    assertCopiedDetails({attendanceType:"Flextime", leaveType:"Flex", leaveHours:"1:00"}, "Flextime details were not copied");
    assertCopiedDetails({morningOut:"10:30", morningIn:"10:45"}, "Morning Additional Time Entry was not copied");
    assert(!el("interruptionList").hidden && el("interruptionList").textContent.includes("Morning Additional Time Entry"), "copied Morning Additional Time was not rendered");
    assertCopiedDetails({afternoonOut:"15:00", afternoonIn:"15:20"}, "Afternoon Additional Time Entry was not copied");
    assertCopiedDetails({morningOut:"10:30", morningIn:"10:45", afternoonOut:"15:00", afternoonIn:"15:20"}, "both Additional Time Entries were not copied");
    assert(el("interruptionList").textContent.includes("Morning Additional Time Entry") && el("interruptionList").textContent.includes("Afternoon Additional Time Entry"), "both copied Additional Time Entries were not rendered");

    state.records = {"2026-08-21":clone(normalPrevious)}; state.drafts = {}; loadRecord("2026-08-24", true); input("startTime", "0800"); el("copyPrevious").click();
    assert(!el("copyPreviousModal").hidden && el("startTime").value === "08:00", "unsaved current data was overwritten without confirmation");
    el("cancelCopyPrevious").click(); assert(el("startTime").value === "08:00", "cancelling Copy Previous changed the current entry");
    el("copyPrevious").click(); el("confirmCopyPrevious").click(); assert(el("copyPreviousModal").hidden && el("startTime").value === "09:00", "confirmed Copy Previous did not replace current data");
    el("clearRecord").click(); el("copyPrevious").click(); assert(el("copyPreviousModal").hidden && el("startTime").value === "09:00", "empty current form did not copy immediately");
    el("saveDraft").click(); assert(state.drafts["2026-08-24"]?.record.startTime === "09:00" && !state.records["2026-08-24"], "copied entry could not be saved as a draft");
    el("submitRecord").click(); assert(state.records["2026-08-24"]?.startTime === "09:00" && !state.drafts["2026-08-24"], "copied entry could not be submitted normally");
    state.records = {}; state.drafts = {}; save(); loadRecord("2026-08-24", true); const emptyBeforeNoPrevious = JSON.stringify(draft); el("copyPrevious").click();
    assert(el("status").textContent === "No previous entry available to copy." && JSON.stringify(draft) === emptyBeforeNoPrevious, "no-previous state did not show the required message or changed the form");

    state.records = {}; state.drafts = {}; save(); loadRecord("2026-08-21", true);

    // Drafts persist separately from submitted records and never enter History or saved calculations.
    const draftDate = "2026-08-24", existingDate = "2026-08-20";
    const existingRecord = {...emptyRecord(), startTime:"09:00", lunchOut:"12:30", lunchIn:"13:10", finishTime:"17:21"};
    state.records[existingDate] = clone(existingRecord); save(); loadRecord(draftDate, true);
    const calculationsBeforeDraft = JSON.stringify(C.recalculate(state.records, state.settings));
    input("startTime", "0900"); input("lunchOut", "1230"); input("lunchIn", "1310"); input("finishTime", "1721");
    el("toggleInterruptions").click(); interruptionInput(0, "out", "1500"); interruptionInput(0, "in", "1520");
    el("toggleLeaveToil").click(); change("leaveType", "Annual"); change("leaveHours", "100"); el("saveDraft").click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(el("status").textContent === "Draft saved" && stored.drafts[draftDate]?.record.afternoonOut === "15:00" && stored.drafts[draftDate]?.record.leaveHours === "1:00", "Save did not persist all current Additional Time and Leave draft data");
    assert(!stored.records[draftDate] && !el("recordsBody").textContent.includes(formatDisplayDate(draftDate)), "saving a draft created a Timesheet History record");
    assert(JSON.stringify(C.recalculate(state.records, state.settings)) === calculationsBeforeDraft && recordsEqual(state.records[existingDate], existingRecord), "saving a draft changed balances or an existing submitted record");
    input("finishTime", "1731"); el("saveDraft").click(); stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.drafts[draftDate].record.finishTime === "17:31", "saving an edited draft did not replace its previous values");
    state = load(); activeDate = todayISO(); loadRecord(state.activeDraftDate, true);
    assert(activeDate === draftDate && el("finishTime").value === "17:31" && draft.afternoonOut === "15:00" && el("leaveType").value === "Annual" && el("leaveHours").value === "1:00" && !el("leaveToilPanel").hidden, "saved draft did not restore correctly after reopening");
    el("submitRecord").click(); stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.records[draftDate]?.finishTime === "17:31" && !stored.drafts[draftDate] && C.recalculate(state.records, state.settings)[draftDate]?.daily != null, "submitting a saved draft did not create the normal record, calculate it, and remove the draft");
    assert(recordsEqual(stored.records[existingDate], existingRecord), "submitting a draft changed an existing submitted record");
    delete state.records[draftDate]; save(); loadRecord("2026-08-25", true); input("startTime", "0900"); el("saveDraft").click();
    assert(JSON.parse(localStorage.getItem(STORAGE_KEY)).drafts["2026-08-25"]?.record.startTime === "09:00", "partial Daily Entry draft was not saved");
    el("clearRecord").click(); stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(!stored.drafts["2026-08-25"] && !el("startTime").value && recordsEqual(stored.records[existingDate], existingRecord), "Clear did not remove only the current saved draft");
    delete state.records[existingDate]; save(); loadRecord("2026-08-21", true);

    el("settingsToggle").click();
    assert(!el("settingsContent").hidden, "Settings did not expand when its header was clicked");

    const liveEntryDate = activeDate;
    input("startTime", "0900");
    assert(!el("status").textContent.includes("Incomplete record"), "Start Work displayed a live incomplete-record warning");
    const alertsBeforeStartSubmit = alerts.length; el("submitRecord").click();
    assert(alerts.length === alertsBeforeStartSubmit + 1 && alerts.at(-1).includes("Complete both ends"), "incomplete Start Work was not validated on Submit");
    assert(activeDate === liveEntryDate && !state.records[liveEntryDate], "incomplete Start Work saved or advanced the date");
    el("clearRecord").click(); input("lunchOut", "1230");
    assert(!el("status").textContent.includes("Incomplete record"), "Lunch Out displayed a live incomplete-record warning");
    el("submitRecord").click();
    assert(alerts.at(-1).includes("Complete both ends") && activeDate === liveEntryDate && !state.records[liveEntryDate], "incomplete Lunch pair was not blocked at Submit");
    el("clearRecord").click(); input("lunchOut", "1230"); input("lunchIn", "1300"); el("toggleInterruptions").click(); interruptionInput(0, "out", "1100");
    assert(!el("status").textContent.includes("Incomplete record"), "partial Additional Time Entry displayed a live incomplete-record warning");
    el("submitRecord").click();
    assert(alerts.at(-1).includes("complete Out and In times") && interruptionEditor() && activeDate === liveEntryDate && !state.records[liveEntryDate], "partial Additional Time Entry was not blocked at Submit with its editor open");
    interruptionEditor().querySelector("[data-cancel-interruption]").click(); el("clearRecord").click();

    input("startTime", "0900"); input("lunchOut", "1200"); input("lunchIn", "1300"); input("finishTime", "1721");
    assert(el("leaveToilPanel").hidden, "normal working day unexpectedly expanded Leave / TOIL");
    const normalRecordDate = activeDate;
    el("submitRecord").click();
    assert(state.records[normalRecordDate]?.finishTime === "17:21" && state.records[normalRecordDate]?.attendanceType === "Flextime", "normal working day did not submit with the Attendance Type default");
    assert(activeDate === C.addDays(normalRecordDate, 1) && el("recordDate").value === activeDate, "new record submission did not advance one day");
    el("recordsBody").querySelector(`[data-delete="${normalRecordDate}"]`).click();
    assert(el("leaveToilPanel").hidden, "normal working day cleanup expanded Leave / TOIL");

    const assertRecordFormCleared = message => {
      assert(recordsEqual(readForm(), emptyRecord(state.settings.attendanceType)), `${message}: record fields were not reset`);
      assert(el("attendanceTypeSetting").value === state.settings.attendanceType, `${message}: persistent Attendance Type changed`);
      assert(!interruptionEditor() && el("interruptionList").hidden, `${message}: Additional Time Entry UI remained visible`);
      assert(el("leaveToilPanel").hidden, `${message}: Leave / TOIL panel did not collapse`);
      assert(metric("dailyResults", "Daily Hours") === "0:00", `${message}: empty daily preview was not recalculated`);
    };

    // Clear is a draft-only reset for Daily Entry, Leave / TOIL, and Additional Time Entries.
    input("startTime", "0900"); input("finishTime", "1200");
    el("clearRecord").click();
    assertRecordFormCleared("Daily Entry only");

    el("toggleLeaveToil").click(); change("leaveType", "Annual"); change("leaveHours", "721"); change("toilHours", "100");
    el("clearRecord").click();
    assertRecordFormCleared("Leave / TOIL only");

    input("startTime", "0900"); input("finishTime", "1200"); change("leaveType", "Annual"); change("leaveHours", "421");
    el("clearRecord").click();
    assertRecordFormCleared("Daily Entry and Leave / TOIL");

    input("lunchOut", "1230"); input("lunchIn", "1330");
    Object.assign(draft, {morningOut:"10:00", morningIn:"10:30", afternoonOut:"15:00", afternoonIn:"15:30"}); renderInterruptionList();
    assert(!el("interruptionList").hidden && draft.morningOut === "10:00" && draft.afternoonOut === "15:00", "two Additional Time Entry clear test setup failed");
    el("clearRecord").click();
    assertRecordFormCleared("Morning and Afternoon Additional Time Entries");

    const emptyDraftBeforeClear = JSON.stringify(draft), emptyStorageBeforeClear = localStorage.getItem(STORAGE_KEY);
    el("clearRecord").click();
    assert(JSON.stringify(draft) === emptyDraftBeforeClear && localStorage.getItem(STORAGE_KEY) === emptyStorageBeforeClear, "Clear changed an already empty form or storage");

    const preservedRecord = { ...emptyRecord(), startTime:"09:00", finishTime:"12:00", leaveType:"Annual", leaveHours:"4:21" };
    state.records[activeDate] = clone(preservedRecord); save();
    const savedRecordBeforeClear = localStorage.getItem(STORAGE_KEY);
    loadRecord(activeDate, true, "edit");
    assert(!el("leaveToilPanel").hidden && el("leaveType").value === "Annual" && el("leaveHours").value === "4:21", "editing a Leave record did not reveal its saved Leave / TOIL values");
    el("clearRecord").click();
    assertRecordFormCleared("Existing saved record");
    assert(editMode && recordsEqual(state.records[activeDate], preservedRecord), "Clear modified the saved record in memory or left edit mode");
    assert(localStorage.getItem(STORAGE_KEY) === savedRecordBeforeClear, "Clear modified the saved record in localStorage");
    delete state.records[activeDate]; save(); loadRecord(activeDate, true);

    const noWork = emptyRecord();
    const working = {...noWork, startTime:"09:00", finishTime:"12:00"};
    assert(workConfirmationFor("2026-08-21", working) == null, "weekday work incorrectly triggered confirmation");
    assert(!hasMeaningfulTimesheetData(noWork), "blank/default record was treated as meaningful");
    assert(hasMeaningfulTimesheetData(working), "working time was not treated as meaningful");
    assert(hasMeaningfulTimesheetData({...noWork, leaveType:"Annual", leaveHours:"7:21"}), "Annual Leave was not treated as meaningful");
    assert(hasMeaningfulTimesheetData({...noWork, toilHours:"1:00"}), "TOIL was not treated as meaningful");
    assert(!hasMeaningfulTimesheetData({...noWork, attendanceType:"Senior Officer"}), "persistent Attendance Type alone was treated as daily timesheet data");
    assert(hasMeaningfulTimesheetData({...noWork, afternoonOut:"15:00", afternoonIn:"15:30"}), "Additional Time Entry was not treated as meaningful");
    assert(workConfirmationFor("2026-08-21", {...noWork, leaveType:"Public Holiday", leaveHours:"7:21"})?.title === "Please confirm this public holiday entry", "Public Holiday additional data did not trigger confirmation");
    const recordsBeforeNextDateTests = state.records;
    state.records = {"2026-07-24":clone(noWork)};
    assert(nextAvailableRecordDate("2026-07-23") === "2026-07-25", "next available date did not skip one saved record");
    state.records["2026-07-25"] = clone(noWork);
    assert(nextAvailableRecordDate("2026-07-23") === "2026-07-26", "next available date did not skip two saved records");
    state.records = recordsBeforeNextDateTests;

    // Record Date selection uses the underlying ISO date and the existing confirmation modal.
    viewStart = periodFor("2026-08-08").start; loadRecord("2026-08-07", true);
    assert(weekdayForISO("2026-08-07") === 5 && weekdayForISO("2026-08-08") === 6 && weekdayForISO("2026-08-09") === 0 && weekdayForISO("2026-08-10") === 1, "local calendar weekday detection is incorrect");
    change("recordDate", "2026-08-08");
    assert(!el("workConfirmationModal").hidden && activeDate === "2026-08-07" && el("recordDate").value === "2026-08-08", "selecting Saturday 08 Aug 2026 did not open the weekend confirmation from the underlying date value");
    el("cancelSpecialWork").click();
    assert(activeDate === "2026-08-07" && el("recordDate").value === "2026-08-07" && el("recordDateDisplay").textContent === "07 Aug 2026 Fri", "cancelling Saturday selection did not restore the prior Record Date");
    change("recordDate", "2026-08-08"); el("confirmSpecialWork").click();
    assert(activeDate === "2026-08-08" && el("recordDateDisplay").textContent === "08 Aug 2026 Sat", "confirming Saturday selection did not load the weekend date");

    loadRecord("2026-08-07", true); change("recordDate", "2026-08-09");
    assert(!el("workConfirmationModal").hidden && activeDate === "2026-08-07", "selecting Sunday 09 Aug 2026 did not open the weekend confirmation");
    el("confirmSpecialWork").click(); assert(activeDate === "2026-08-09", "confirming Sunday selection did not load the weekend date");
    change("recordDate", "2026-08-10"); assert(el("workConfirmationModal").hidden && activeDate === "2026-08-10", "Monday 10 Aug 2026 incorrectly triggered the weekend confirmation");
    change("recordDate", "2026-08-07"); assert(el("workConfirmationModal").hidden && activeDate === "2026-08-07", "Friday 07 Aug 2026 incorrectly triggered the weekend confirmation");

    state.records["2026-08-08"] = clone(working); save(); renderAll();
    el("recordsBody").querySelector('[data-edit="2026-08-08"]').click();
    assert(!el("workConfirmationModal").hidden && activeDate === "2026-08-07" && !editMode, "editing an existing weekend record bypassed the weekend confirmation");
    el("confirmSpecialWork").click();
    assert(activeDate === "2026-08-08" && editMode && el("startTime").value === "09:00", "confirmed weekend History edit did not load the existing record");
    el("cancelEdit").click(); delete state.records["2026-08-08"]; save();
    viewStart = periodFor("2026-08-21").start; loadRecord("2026-08-21", true);

    // End-to-end Saturday diagnostic and hard-gate test through the real controls and Submit button.
    change("recordDate", "2026-08-22"); assert(!el("workConfirmationModal").hidden, "Saturday selection warning did not precede Daily Entry"); el("confirmSpecialWork").click(); el("toggleLeaveToil").click(); change("leaveType", "Annual"); change("leaveHours", "721"); el("toggleLeaveToil").click();
    assert(el("leaveToilPanel").hidden && el("leaveType").value === "Annual" && el("leaveHours").value === "7:21", "collapsing Leave / TOIL discarded entered values");
    let candidate = readForm();
    assert(activeDate === "2026-08-22" && DAY_NAMES[new Date(`${activeDate}T00:00:00`).getDay()] === "Saturday", "Saturday Record Date did not reach submit state");
    assert(candidate.leaveType === "Annual" && candidate.leaveHours === "7:21" && hasMeaningfulTimesheetData(candidate), "Saturday candidate was not read/normalised correctly");
    const storageBeforeSaturdaySubmit = JSON.parse(localStorage.getItem(STORAGE_KEY));
    el("submitRecord").click();
    assert(!el("workConfirmationModal").hidden, "Saturday Leave details did not open confirmation");
    assert(state.records["2026-08-22"] === undefined, "Saturday record mutated state before confirmation");
    assert(storageBeforeSaturdaySubmit.records["2026-08-22"] === undefined && JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-22"] === undefined, "Saturday record reached localStorage before confirmation");
    modalRect = el("workConfirmationModal").querySelector(".dialog-card").getBoundingClientRect();
    assert(modalRect.left >= 0 && modalRect.right <= innerWidth && modalRect.height <= innerHeight, "work confirmation is not contained by the viewport");
    el("cancelSpecialWork").click();
    assert(el("workConfirmationModal").hidden && el("leaveType").value === "Annual" && el("leaveHours").value === "7:21", "Go Back lost the collapsed Leave / TOIL draft");
    assert(activeDate === "2026-08-22", "Go Back advanced the Record Date");
    assert(state.records["2026-08-22"] === undefined && JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-22"] === undefined, "Go Back saved the Saturday record");
    el("submitRecord").click(); el("confirmSpecialWork").click();
    assert(Boolean(state.records["2026-08-22"]) && Boolean(JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-22"]), "Confirm did not save the captured Saturday record");
    assert(activeDate === "2026-08-23", "confirmed weekend submission did not advance the Record Date");
    delete state.records["2026-08-22"]; save();

    // The same hard gate must hold for Sunday.
    change("recordDate", "2026-08-23"); el("toggleLeaveToil").click(); change("leaveType", "Annual"); change("leaveHours", "721"); el("submitRecord").click();
    assert(!el("workConfirmationModal").hidden && state.records["2026-08-23"] === undefined && JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-23"] === undefined, "Sunday record bypassed confirmation");
    el("cancelSpecialWork").click();
    assert(el("leaveType").value === "Annual" && el("leaveHours").value === "7:21" && state.records["2026-08-23"] === undefined, "Sunday Go Back lost the draft or saved it");
    assert(activeDate === "2026-08-23", "Sunday Go Back advanced the Record Date");
    el("submitRecord").click(); el("confirmSpecialWork").click();
    assert(Boolean(state.records["2026-08-23"]) && Boolean(JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-23"]), "Sunday Confirm did not save the record");
    assert(activeDate === "2026-08-24", "confirmed Sunday submission did not advance the Record Date");
    delete state.records["2026-08-23"]; save();
    loadRecord("2026-08-21", true);
    assert(el("leaveToilPanel").hidden, "normal new record did not restore the collapsed Leave / TOIL state");

    const durationCases = [["721","7:21"],["730","7:30"],["700","7:00"],["130","1:30"],["100","1:00"],["050","0:50"],["030","0:30"],["000","0:00"],["1000","10:00"],["1230","12:30"],["-50","-0:50"],["-130","-1:30"],["-721","-7:21"],["7:21","7:21"],["0:50","0:50"],["10:00","10:00"],["-0:50","-0:50"]];
    durationCases.forEach(([entered, expected]) => assert(normalizeDurationInput(entered) === expected, `${entered} did not normalize to ${expected}`));
    ["760","165","1260"].forEach(entered => assert(!durationIsValid(normalizeDurationInput(entered)), `${entered} was accepted as a duration`));
    assert(document.querySelectorAll("[data-duration]").length === 11, "not all duration fields use the shared formatter");
    el("toggleLeaveToil").click();
    const leaveToilTops = [el("leaveType"), el("leaveHours"), el("toilHours")].map(input => Math.round(input.getBoundingClientRect().top));
    if (innerWidth <= 780) assert(leaveToilTops[0] < leaveToilTops[1] && leaveToilTops[1] < leaveToilTops[2], "mobile Leave / TOIL fields do not stack");
    else assert(new Set(leaveToilTops).size === 1, "desktop Leave / TOIL fields are not aligned in one row");
    change("leaveHours", "721"); assert(el("leaveHours").value === "7:21", "Leave Hours did not format without a leading zero"); input("leaveHours", "");
    assert(el("openingFlex").inputMode === "text" && el("openingToil").inputMode === "text", "Opening balance mobile keyboards do not permit a minus sign");
    change("openingFlex", "-046"); change("openingToil", "-030");
    assert(el("openingFlex").value === "-0:46" && el("openingToil").value === "-0:30", "signed Opening balances did not format");
    el("saveSettings").click(); stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.settings.openingFlex === "-0:46" && stored.settings.openingToil === "-0:30", "negative Opening balances were not persisted");
    state = load(); renderSettings();
    assert(el("openingFlex").value === "-0:46" && el("openingToil").value === "-0:30", "negative Opening balances did not survive reload");
    const beforeInvalidOpeningSave = localStorage.getItem(STORAGE_KEY);
    change("openingFlex", "-0:60"); el("saveSettings").click();
    assert(!el("openingFlexError").hidden && localStorage.getItem(STORAGE_KEY) === beforeInvalidOpeningSave, "invalid signed Opening Flex was saved");
    change("openingFlex", "-0:46"); change("openingToil", "-1:75"); el("saveSettings").click();
    assert(!el("openingToilError").hidden && localStorage.getItem(STORAGE_KEY) === beforeInvalidOpeningSave, "invalid signed Opening TOIL was saved");
    change("openingFlex", "0:00"); change("openingToil", "0:00"); el("saveSettings").click(); setSettingsExpanded(true);
    change("standard1", "721"); assert(el("standard1").value === "7:21", "weekday Standard Hours did not format");
    change("leaveType", "Annual"); change("leaveHours", "721");
    assert(metric("dailyResults", "Daily Hours") === "7:21" && metric("dailyResults", "Daily Flex Balance") === "0:00", "full-day Annual Leave calculation changed");
    change("leaveType", "Flex");
    assert(metric("dailyResults", "Daily Hours") === "7:21", "full-day Flex leave did not count toward Daily Hours");
    assert(metric("dailyResults", "Daily Flex Balance") === "0:00", "full-day Flex leave incorrectly generated Daily Flex");
    assert(metric("dailyResults", "Progressive Flex Balance") === "-7:21", "full-day Flex leave was not deducted from Progressive Flex");
    change("leaveType", ""); input("leaveHours", "");
    change("toilHours", "100");
    assert(metric("dailyResults", "Progressive TOIL Balance") === "1:00", "TOIL Hours earned did not update the preview balance");
    input("toilHours", ""); change("toilHours", "760");
    assert(!el("toilHoursError").hidden, "invalid compact duration did not show its inline error");
    const beforeInvalidDurationSave = localStorage.getItem(STORAGE_KEY); submitRecord();
    assert(localStorage.getItem(STORAGE_KEY) === beforeInvalidDurationSave, "invalid compact duration was saved"); input("toilHours", "");

    input("startTime", "0900"); input("lunchOut", "1230"); input("lunchIn", "1300"); input("finishTime", "1721");
    assert(el("startTime").value === "09:00", "four-digit Start Work was not formatted");
    assert(el("lunchOut").value === "12:30", "four-digit Lunch Out was not formatted");
    input("finishTime", "2460");
    assert(!el("finishTimeError").hidden, "invalid four-digit time did not show an inline error");
    const beforeInvalidTimeSave = localStorage.getItem(STORAGE_KEY);
    const dateBeforeInvalidTimeSave = activeDate;
    submitRecord();
    assert(localStorage.getItem(STORAGE_KEY) === beforeInvalidTimeSave, "invalid manual time was saved");
    assert(activeDate === dateBeforeInvalidTimeSave, "validation failure advanced the Record Date");
    input("finishTime", "1721");
    assert(el("finishTime").value === "17:21" && el("finishTimeError").hidden, "corrected time did not format or clear its error");
    el("toggleInterruptions").click();
    interruptionInput(0, "out", "1015"); interruptionInput(0, "in", "1040");
    assert(interruptionEditor().querySelector("[data-interruption-out]").value === "10:15" && interruptionEditor().querySelector("[data-interruption-in]").value === "10:40", "Additional Time Entry digits were not formatted");
    const invalidInterruptionIn = interruptionInput(0, "in", "1265");
    assert(!el(`${invalidInterruptionIn.id}Error`).hidden, "invalid Additional Time Entry did not show an inline error");
    interruptionEditor().querySelector("[data-cancel-interruption]").click();
    assert(el("submitRecord").textContent === "Submit", "new record is not in Submit mode");
    const workflowRecordDate = activeDate;
    el("submitRecord").click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.records[workflowRecordDate].finishTime === "17:21", "new record was not persisted");
    assert(stored.records[workflowRecordDate].attendanceType === "Flextime", "new record did not use the saved Attendance Type setting");
    assert(el("recordsBody").textContent.includes(formatDisplayDate(workflowRecordDate)), "new record missing from history");
    assert(el("submitRecord").textContent === "Submit", "submit did not return to new-record mode");

    setSettingsExpanded(true); change("attendanceTypeSetting", "Senior Officer A/B"); el("saveSettings").click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.settings.attendanceType === "Senior Officer A/B" && draft.attendanceType === "Senior Officer A/B", "Attendance Type setting was not saved or applied to new records");
    assert(stored.records[workflowRecordDate].attendanceType === "Flextime", "changing Attendance Type rewrote a historical record");
    assert(metric("dailyResults", "Daily SOG Balance") !== undefined && metric("dailyResults", "Daily Flex Balance") === undefined, "Senior Officer mode did not replace Flex results with SOG results");
    assert(el("dailyBalanceHeading").textContent === "Daily SOG" && el("progressiveBalanceHeading").textContent === "Progressive SOG", "Senior Officer history headings are incorrect");
    assert([...el("leaveType").options].find(option => option.value === "Flex")?.disabled, "Flex Leave remained selectable for Senior Officer A/B");
    assert(metric("fortnightResults", "Opening SOG Balance") !== undefined && metric("fortnightResults", "Opening Flex Balance") === undefined, "Senior Officer fortnight summary retained Flex-specific labels");
    input("startTime", "0900"); el("clearRecord").click();
    assert(draft.attendanceType === "Senior Officer A/B" && el("attendanceTypeSetting").value === "Senior Officer A/B" && el("leaveToilPanel").hidden, "Clear reset the persistent Attendance Type setting");

    el("recordsBody").querySelector(`[data-edit="${workflowRecordDate}"]`).click();
    assert(draft.attendanceType === "Flextime", "editing a historical record did not preserve its Attendance Type");
    assert(el("dailyBalanceHeading").textContent === "Daily Flex" && el("progressiveBalanceHeading").textContent === "Progressive Flex", "historical Flextime edit did not restore Flex headings");
    input("finishTime", "17:41");
    input("fortnightStart", "2026-08-21");
    const beforeBlockedSave = localStorage.getItem(STORAGE_KEY);
    submitRecord();
    assert(alerts.includes("Please set the Fortnight Start Date to a Thursday before saving records."), "invalid submission message missing");
    assert(localStorage.getItem(STORAGE_KEY) === beforeBlockedSave, "invalid submission modified existing records");
    assert(el("dailyResults").textContent.includes("—"), "invalid calculations were displayed");
    assert(!el("settingsContent").hidden, "Invalid submission did not reveal Settings");
    input("fortnightStart", "2026-08-20");
    assert(!el("submitRecord").disabled, "Submit did not recover after switching back to Thursday");
    el("cancelEdit").click();

    el("recordsBody").querySelector(`[data-edit="${workflowRecordDate}"]`).click();
    assert(el("submitRecord").textContent === "Save Changes", "Edit did not enter edit mode");
    assert(!el("cancelEdit").hidden, "Cancel Edit is hidden in edit mode");
    input("finishTime", "17:31"); el("cancelEdit").click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.records[workflowRecordDate].finishTime === "17:21", "Cancel Edit changed stored data");
    assert(el("submitRecord").textContent === "Submit", "Cancel Edit did not leave edit mode");

    el("recordsBody").querySelector(`[data-edit="${workflowRecordDate}"]`).click();
    input("finishTime", "17:31"); el("submitRecord").click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.records[workflowRecordDate].finishTime === "17:31" && activeDate === workflowRecordDate, "edited record was not persisted or changed the active date");
    assert(el("submitRecord").textContent === "Submit", "Save Changes did not leave edit mode");

    el("recordsBody").querySelector(`[data-delete="${workflowRecordDate}"]`).click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(!stored.records[workflowRecordDate], "deleted record remains in storage");

    setSettingsExpanded(true); change("attendanceTypeSetting", "Flextime"); el("saveSettings").click();

    // Up to two Additional Time Entry editors can be open, cancelled independently, and classified in either order.
    loadRecord("2026-08-24", true); input("startTime", "0900"); input("lunchOut", "1230"); input("lunchIn", "1310"); input("finishTime", "1721");
    el("toggleInterruptions").click();
    assert(document.querySelectorAll(".interruption-editor").length === 1 && !el("toggleInterruptions").hidden, "one Additional Time Entry editor did not leave capacity for a second");
    el("toggleInterruptions").click();
    assert(document.querySelectorAll(".interruption-editor").length === 2 && el("toggleInterruptions").hidden && interruptionEditor(0).querySelector("h3").textContent.endsWith("1") && interruptionEditor(1).querySelector("h3").textContent.endsWith("2"), "two numbered Additional Time Entry editors were not shown or the third-entry control remained available");
    el("toggleInterruptions").click(); assert(document.querySelectorAll(".interruption-editor").length === 2, "a third Additional Time Entry editor was created");
    interruptionInput(0, "out", "1500"); interruptionInput(0, "in", "1520"); interruptionInput(1, "out", "1030"); interruptionInput(1, "in", "1045"); el("saveDraft").click();
    assert(state.drafts["2026-08-24"]?.record.afternoonOut === "15:00" && state.drafts["2026-08-24"]?.record.morningOut === "10:30", "Afternoon-first and Morning-second editors were not classified correctly on draft Save");
    el("clearRecord").click(); loadRecord("2026-08-25", true); input("startTime", "0900"); input("lunchOut", "1230"); input("lunchIn", "1310"); input("finishTime", "1721");
    el("toggleInterruptions").click(); el("toggleInterruptions").click(); interruptionInput(0, "out", "1030"); interruptionInput(0, "in", "1045"); interruptionInput(1, "out", "1500"); interruptionInput(1, "in", "1520"); el("submitRecord").click();
    assert(state.records["2026-08-25"]?.morningOut === "10:30" && state.records["2026-08-25"]?.afternoonOut === "15:00", "Morning-first and Afternoon-second editors were not classified and submitted correctly");
    delete state.records["2026-08-25"]; save(); loadRecord("2026-08-26", true); input("lunchOut", "1230"); input("lunchIn", "1310");
    el("toggleInterruptions").click(); el("toggleInterruptions").click(); interruptionInput(0, "out", "1030"); interruptionInput(0, "in", "1045"); interruptionInput(1, "out", "1500"); interruptionInput(1, "in", "1520");
    interruptionEditor(0).querySelector("[data-cancel-interruption]").click();
    assert(document.querySelectorAll(".interruption-editor").length === 1 && interruptionEditor(0).querySelector("[data-interruption-out]").value === "15:00" && !el("toggleInterruptions").hidden, "cancelling editor 1 changed or closed editor 2");
    el("toggleInterruptions").click(); interruptionInput(1, "out", "1030"); interruptionInput(1, "in", "1045"); interruptionEditor(1).querySelector("[data-cancel-interruption]").click();
    assert(document.querySelectorAll(".interruption-editor").length === 1 && interruptionEditor(0).querySelector("[data-interruption-out]").value === "15:00", "cancelling editor 2 changed or closed editor 1");
    el("toggleInterruptions").click(); interruptionInput(1, "out", "1030"); const beforeIncompletePairSave = localStorage.getItem(STORAGE_KEY); el("saveDraft").click();
    assert(alerts.at(-1).includes("Additional Time Entry 2") && alerts.at(-1).includes("complete Out and In times") && document.querySelectorAll(".interruption-editor").length === 2 && localStorage.getItem(STORAGE_KEY) === beforeIncompletePairSave, "one valid and one incomplete editor did not block Save and identify entry 2");
    closeInterruptionEditor(); el("clearRecord").click();

    // Additional Time Entries are classified by lunch relationship and staged by the main Save action.
    loadRecord("2026-08-24", true); input("startTime", "0900"); input("lunchOut", "1230"); input("lunchIn", "1310"); input("finishTime", "1721");
    assert(!el("saveInterruption"), "the separate Additional Time Entry Save button still exists");
    el("toggleInterruptions").click(); interruptionInput(0, "out", "1500"); interruptionInput(0, "in", "1520"); el("submitRecord").click();
    assert(state.records["2026-08-24"]?.afternoonOut === "15:00" && !state.records["2026-08-24"]?.morningOut, "first and only afternoon entry was not saved as Afternoon");
    loadRecord("2026-08-24", true, "edit"); el("interruptionList").querySelector("[data-edit-interruption='afternoon']").click(); interruptionInput(0, "in", "1530"); interruptionEditor().querySelector("[data-cancel-interruption]").click();
    assert(draft.afternoonIn === "15:20", "cancelling an Additional Time Entry edit changed its original value");
    el("interruptionList").querySelector("[data-edit-interruption='afternoon']").click(); interruptionInput(0, "in", "1530"); el("submitRecord").click();
    assert(state.records["2026-08-24"].afternoonIn === "15:30", "main Save Changes did not update an Additional Time Entry");
    loadRecord("2026-08-24", true, "edit"); el("toggleInterruptions").click(); interruptionInput(0, "out", "1030"); interruptionInput(0, "in", "1045"); el("submitRecord").click();
    assert(state.records["2026-08-24"].morningOut === "10:30" && state.records["2026-08-24"].afternoonOut === "15:00", "Afternoon-first then Morning did not preserve both entries");
    loadRecord("2026-08-24", true, "edit"); el("interruptionList").querySelector("[data-remove-interruption='morning']").click(); el("submitRecord").click();
    assert(!state.records["2026-08-24"].morningOut && state.records["2026-08-24"].afternoonOut === "15:00", "Remove did not delete only the selected entry");

    loadRecord("2026-08-25", true); input("startTime", "0900"); input("lunchOut", "1230"); input("lunchIn", "1310"); input("finishTime", "1721"); el("toggleInterruptions").click(); interruptionInput(0, "out", "1030"); interruptionInput(0, "in", "1045"); el("submitRecord").click();
    assert(state.records["2026-08-25"]?.morningOut === "10:30" && !state.records["2026-08-25"]?.afternoonOut, "first and only morning entry was not saved as Morning");
    loadRecord("2026-08-25", true, "edit"); el("toggleInterruptions").click(); interruptionInput(0, "out", "1500"); interruptionInput(0, "in", "1520"); el("submitRecord").click();
    assert(state.records["2026-08-25"].morningOut === "10:30" && state.records["2026-08-25"].afternoonOut === "15:00", "Morning-first then Afternoon did not preserve both entries");
    loadRecord("2026-08-26", true); input("startTime", "0900"); input("lunchOut", "1230"); input("lunchIn", "1310"); input("finishTime", "1721"); el("toggleInterruptions").click(); interruptionInput(0, "out", "1500"); interruptionInput(0, "in", "1520"); interruptionEditor().querySelector("[data-cancel-interruption]").click();
    assert(!interruptionEditor() && !draft.morningOut && !draft.afternoonOut, "cancelling a new Additional Time Entry did not discard it");
    el("toggleInterruptions").click(); interruptionInput(0, "out", "1220"); interruptionInput(0, "in", "1240"); const beforeLunchOverlap = localStorage.getItem(STORAGE_KEY); el("submitRecord").click();
    assert(alerts.at(-1).includes("overlaps the lunch period") && interruptionEditor() && localStorage.getItem(STORAGE_KEY) === beforeLunchOverlap, "lunch-overlapping Additional Time Entry was not clearly rejected");
    interruptionEditor().querySelector("[data-cancel-interruption]").click(); el("clearRecord").click();
    ["2026-08-24", "2026-08-25"].forEach(date => { delete state.records[date]; }); save(); loadRecord("2026-08-26", true);

    // Leave / TOIL uses the same main-save and local-cancel interaction pattern.
    el("toggleLeaveToil").click(); change("leaveType", "Annual"); change("leaveHours", "721"); change("toilHours", "100"); el("cancelLeaveToil").click();
    assert(el("leaveToilPanel").hidden && !draft.leaveType && !draft.leaveHours && !draft.toilHours, "cancelling new Leave / TOIL details did not clear and close the section");
    el("toggleLeaveToil").click(); change("leaveType", "Annual"); change("leaveHours", "721"); const leaveRecordDate = activeDate; el("submitRecord").click();
    assert(state.records[leaveRecordDate]?.leaveType === "Annual" && state.records[leaveRecordDate]?.leaveHours === "7:21", "valid new Leave details were not saved by the main Save action");
    loadRecord("2026-08-27", true); el("toggleLeaveToil").click(); change("leaveType", "Annual"); const beforeIncompleteLeave = localStorage.getItem(STORAGE_KEY); el("submitRecord").click();
    assert(localStorage.getItem(STORAGE_KEY) === beforeIncompleteLeave && !el("leaveToilPanel").hidden, "incomplete Leave details saved or collapsed their editor");
    el("cancelLeaveToil").click(); loadRecord(leaveRecordDate, true, "edit"); change("leaveHours", "421"); el("cancelLeaveToil").click();
    assert(el("leaveToilPanel").hidden && draft.leaveHours === "7:21" && state.records[leaveRecordDate].leaveHours === "7:21", "cancelling edited Leave details did not preserve the saved values");
    setLeaveToilExpanded(true); change("leaveHours", "421"); el("submitRecord").click();
    assert(state.records[leaveRecordDate].leaveHours === "4:21", "main Save Changes did not update Leave details");
    delete state.records[leaveRecordDate]; save(); loadRecord("2026-08-27", true);

    setSettingsExpanded(true); change("attendanceTypeSetting", "Senior Officer A/B"); el("saveSettings").click();
    el("toggleLeaveToil").click(); change("toilHours", "100"); const toilRecordDate = activeDate; el("submitRecord").click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.records[toilRecordDate].toilHours === "1:00" && stored.records[toilRecordDate].attendanceType === "Senior Officer A/B", "TOIL Hours earned or the new-record Attendance Type was not saved");
    el("recordsBody").querySelector(`[data-edit="${toilRecordDate}"]`).click();
    assert(metric("dailyResults", "Progressive TOIL Balance") === "1:00", "saved TOIL Hours earned did not update the balance");
    assert(!el("leaveToilPanel").hidden && el("toilHours").value === "1:00", "editing a TOIL record did not reveal its saved value");
    el("cancelEdit").click(); el("recordsBody").querySelector(`[data-delete="${toilRecordDate}"]`).click();

    assert(formatDisplayDate("2026-08-20") === "20-08-2026 Thu", "Thursday history date formatting is incorrect");
    assert(formatDisplayDate("2026-08-21") === "21-08-2026 Fri", "Friday history date formatting is incorrect");
    assert(formatDisplayDate("2026-08-23") === "23-08-2026 Sun", "Sunday history date formatting is incorrect");
    assert(`${formatDisplayDate("2026-08-20", "range")} to ${formatDisplayDate("2026-09-02", "range")}` === "20 Aug 2026 to 2 Sep 2026", "fortnight range date formatting is incorrect");

    const csvPackage = buildCsvPackage(viewStart);
    assert(csvPackage.rows.length === 15 && csvPackage.filename.endsWith(".csv"), "email CSV package does not contain the existing 14-day export");
    const csvBeforeWorkbookTests = csvPackage.csv;

    // Multi-period XLSX export uses complete intersecting fortnights, skips empty periods, and preserves the CSV schema.
    const exportRecord = {...emptyRecord("Flextime"), startTime:"09:00", lunchOut:"12:00", lunchIn:"12:30", finishTime:"16:51"};
    [["020826", "02 Aug 2026"], ["02 08 26", "02 Aug 2026"], ["02082026", "02 Aug 2026"], ["02 08 2026", "02 Aug 2026"], ["311226", "31 Dec 2026"], ["010127", "01 Jan 2027"], ["290224", "29 Feb 2024"]].forEach(([entered, expected]) => assert(parseWorkbookDate(entered)?.display === expected, `${entered} did not parse as ${expected}`));
    ["290226", "310426", "31022026", "31 02 26", "32132026"].forEach(entered => assert(parseWorkbookDate(entered) === null, `${entered} was incorrectly accepted as a calendar date`));
    input("exportPeriodFrom", "020826"); el("exportPeriodFrom").dispatchEvent(new Event("blur"));
    input("exportPeriodTo", "02082026"); el("exportPeriodTo").dispatchEvent(new Event("blur"));
    assert(el("exportPeriodFrom").value === "02 Aug 2026" && el("exportPeriodFromError").hidden && el("exportPeriodTo").value === "02 Aug 2026" && el("exportPeriodToError").hidden, "compact dates were rejected or not normalized by the actual Period From/To fields");
    state.records = {"2026-08-20":clone(exportRecord), "2026-09-03":clone(exportRecord), "2026-09-17":clone(exportRecord)};
    input("exportPeriodFrom", "20 08 2026"); el("exportPeriodFrom").dispatchEvent(new Event("blur"));
    input("exportPeriodTo", "02 09 2026"); el("exportPeriodTo").dispatchEvent(new Event("change"));
    assert(el("exportPeriodFrom").value === "20 Aug 2026" && el("exportPeriodTo").value === "02 Sep 2026", "workbook dates were not normalized to DD MMM YYYY");
    let workbook = exportWorkbook({download:() => {}});
    assert(workbook.sheets.length === 1 && workbook.sheets[0].name === "20 Aug - 2 Sep" && workbook.filename.endsWith(".xlsx"), "one reporting period did not produce one correctly named workbook sheet");
    assert(workbook.sheets[0].rows.length === csvPackage.rows.length && workbook.sheets[0].rows[0].join("|") === csvPackage.rows[0].join("|"), "workbook did not reuse the existing fortnight CSV schema");

    input("exportPeriodFrom", "25 08 2026"); input("exportPeriodTo", "20 09 2026");
    workbook = exportWorkbook({download:() => {}});
    assert(workbook.sheets.map(sheet => sheet.name).join("|") === "20 Aug - 2 Sep|3 Sep - 16 Sep|17 Sep - 30 Sep", "mid-period From date or multiple reporting periods were selected incorrectly");
    input("exportPeriodFrom", "20 08 2026"); input("exportPeriodTo", "05 09 2026"); workbook = exportWorkbook({download:() => {}});
    assert(workbook.sheets.length === 2 && workbook.sheets.at(-1).name === "3 Sep - 16 Sep", "mid-period To date did not include the complete intersecting reporting period");
    delete state.records["2026-09-03"];
    input("exportPeriodFrom", "20 08 2026"); input("exportPeriodTo", "20 09 2026"); workbook = exportWorkbook({download:() => {}});
    assert(workbook.sheets.map(sheet => sheet.name).join("|") === "20 Aug - 2 Sep|17 Sep - 30 Sep", "empty reporting periods were not skipped");
    assert(workbook.blob.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" && workbook.files.some(file => file.name === "xl/workbook.xml"), "export did not build a valid XLSX package structure");
    const workbookBytes = new Uint8Array(await workbook.blob.arrayBuffer()), workbookView = new DataView(workbookBytes.buffer, workbookBytes.byteOffset, workbookBytes.byteLength);
    const eocdOffset = workbookBytes.length - 22;
    assert(workbookView.getUint32(eocdOffset, true) === 0x06054b50, "XLSX ZIP end-of-central-directory signature is missing");
    const centralEntryCount = workbookView.getUint16(eocdOffset + 10, true), centralSize = workbookView.getUint32(eocdOffset + 12, true), centralOffset = workbookView.getUint32(eocdOffset + 16, true);
    assert(centralEntryCount === workbook.files.length, "XLSX ZIP central-directory entry count is incorrect");
    let centralCursor = centralOffset;
    for (let entry = 0; entry < centralEntryCount; entry++) {
      assert(workbookView.getUint32(centralCursor, true) === 0x02014b50, `XLSX ZIP central entry ${entry + 1} has an invalid signature`);
      const nameLength = workbookView.getUint16(centralCursor + 28, true), extraLength = workbookView.getUint16(centralCursor + 30, true), commentLength = workbookView.getUint16(centralCursor + 32, true), localOffset = workbookView.getUint32(centralCursor + 42, true);
      assert(workbookView.getUint32(localOffset, true) === 0x04034b50, `XLSX ZIP central entry ${entry + 1} points to an invalid local header`);
      centralCursor += 46 + nameLength + extraLength + commentLength;
    }
    assert(centralCursor === centralOffset + centralSize && centralCursor === eocdOffset, "XLSX ZIP central-directory size or offset is inconsistent");

    input("exportPeriodFrom", "31 02 2026"); input("exportPeriodTo", "20 09 2026");
    assert(exportWorkbook({download:() => {}}) === "invalid" && !el("exportPeriodFromError").hidden, "invalid From date was not rejected inline");
    input("exportPeriodFrom", "20 08 2026"); input("exportPeriodTo", "not a date");
    assert(exportWorkbook({download:() => {}}) === "invalid" && !el("exportPeriodToError").hidden, "invalid To date was not rejected inline");
    input("exportPeriodFrom", "20 09 2026"); input("exportPeriodTo", "20 08 2026");
    assert(exportWorkbook({download:() => {}}) === "invalid-range" && el("exportPeriodToError").textContent === "Period To cannot be earlier than Period From.", "To earlier than From was not rejected inline");
    state.records = {}; input("exportPeriodFrom", "20 08 2026"); input("exportPeriodTo", "20 09 2026");
    assert(exportWorkbook({download:() => {}}) === "empty" && el("workbookExportStatus").textContent === "No timesheet records found for this period.", "record-free range did not suppress download and show the required message");
    assert(buildCsvPackage(viewStart).csv === csvBeforeWorkbookTests, "existing single-fortnight CSV export changed after workbook export");

    openEmailModal(); input("emailTo", "not-an-email");
    assert(await sendEmailCsv({ navigator:{} }) === "invalid" && !el("emailToError").hidden, "invalid email was not rejected inline");
    input("emailTo", "person@example.com");
    let sharedData;
    const shareResult = await sendEmailCsv({ navigator:{ canShare:data => data.files?.[0]?.name === csvPackage.filename, share:async data => { sharedData = data; } } });
    assert(shareResult === "shared" && sharedData.files[0].name === csvPackage.filename, "Web Share did not receive the CSV file");
    openEmailModal(); input("emailTo", "person@example.com");
    let downloaded = "", openedMailto = "";
    const fallbackResult = await sendEmailCsv({ navigator:{ canShare:() => false }, download:item => { downloaded = item.filename; }, openMailto:url => { openedMailto = url; } });
    assert(fallbackResult === "fallback" && downloaded === csvPackage.filename && openedMailto.startsWith("mailto:person%40example.com"), "fallback did not download CSV and open mailto");
    assert(el("emailStatus").textContent.includes("Please attach the downloaded CSV"), "fallback attachment message is missing");
    closeEmailModal();

    // Marking an overdue fortnight ends after saving status; export remains an explicit separate action.
    const overdueStart = "2026-08-06";
    state.records = {[overdueStart]:clone(exportRecord)}; state.submissions = {}; viewStart = overdueStart; save(); renderAll();
    assert(!el("submissionReminder").hidden && reminderStart === overdueStart, "overdue fortnight reminder test setup failed");
    let exportPromptCount = 0;
    window.confirm = message => { if (/CSV|export|share/i.test(message)) exportPromptCount++; return true; };
    el("markSubmitted").click();
    window.confirm = () => true;
    assert(state.submissions[overdueStart]?.submitted && state.submissions[overdueStart]?.changed === false, "Mark fortnight as submitted did not preserve the existing submission state logic");
    assert(exportPromptCount === 0, "Mark fortnight as submitted triggered an export/download/share prompt");
    assert(el("submissionReminder").hidden && el("status").textContent === "Fortnight marked as submitted.", "submitted reminder or success feedback did not update normally");

    // A submitted fortnight warns only on the persisted false -> true changed-state transition.
    const resubmissionWarning = "This fortnight was previously submitted. The saved record has changed and the fortnight may need to be resubmitted.";
    const resubmissionWarningCount = () => alerts.filter(message => message === resubmissionWarning).length;
    const workdayRecord = (finishTime = "16:51") => ({...emptyRecord("Flextime"), startTime:"09:00", lunchOut:"12:00", lunchIn:"12:30", finishTime});
    const submitWorkday = (date, finishTime = "16:51", mode = "new") => {
      loadRecord(date, true, mode);
      input("startTime", "0900"); input("lunchOut", "1200"); input("lunchIn", "1230"); input("finishTime", finishTime.replace(":", ""));
      el("submitRecord").click();
    };
    const submittedFortnightA = "2026-08-20", submittedFortnightB = "2026-09-03";
    state.records = {}; state.submissions = {[submittedFortnightA]:{submitted:true, changed:false, submittedAt:"2026-08-20T00:00:00.000Z"}}; viewStart = submittedFortnightA; save();
    const warningsBeforeSequence = resubmissionWarningCount();
    submitWorkday("2026-08-24");
    assert(resubmissionWarningCount() === warningsBeforeSequence + 1 && state.submissions[submittedFortnightA].changed, "Day 1 did not show exactly one resubmission warning and enter changed state");
    assert(JSON.parse(localStorage.getItem(STORAGE_KEY)).submissions[submittedFortnightA].changed, "changed/acknowledged state was not persisted after Day 1");
    submitWorkday("2026-08-25");
    submitWorkday("2026-08-26");
    submitWorkday("2026-08-24", "17:01", "edit");
    assert(resubmissionWarningCount() === warningsBeforeSequence + 1, "Day 2, Day 3, or the second Day 1 edit repeated the resubmission warning");

    state = load(); renderSettings(); viewStart = submittedFortnightA;
    submitWorkday("2026-08-25", "17:11", "edit");
    assert(state.submissions[submittedFortnightA].changed && resubmissionWarningCount() === warningsBeforeSequence + 1, "refresh/reload lost the acknowledged needs-resubmission state");
    renderAll();
    assert(reminderStart === submittedFortnightA, "changed submitted fortnight was not available to mark as submitted again");
    el("markSubmitted").click();
    assert(state.submissions[submittedFortnightA].submitted && !state.submissions[submittedFortnightA].changed, "explicit resubmission did not reset the changed transition state");
    submitWorkday("2026-08-26", "17:21", "edit");
    assert(resubmissionWarningCount() === warningsBeforeSequence + 2 && state.submissions[submittedFortnightA].changed, "first change after explicit resubmission did not warn again exactly once");
    submitWorkday("2026-08-25", "17:31", "edit");
    assert(resubmissionWarningCount() === warningsBeforeSequence + 2, "second change after explicit resubmission repeated the warning");

    state.records["2026-09-07"] = workdayRecord(); state.submissions[submittedFortnightB] = {submitted:true, changed:false, submittedAt:"2026-09-03T00:00:00.000Z"}; save();
    submitWorkday("2026-09-07", "17:01", "edit");
    assert(resubmissionWarningCount() === warningsBeforeSequence + 3 && state.submissions[submittedFortnightB].changed, "Fortnight A acknowledgement suppressed Fortnight B's first warning");

    // Destructive history reset preserves Settings but removes every historical source of balances.
    state.settings.attendanceType = "Flextime";
    state.settings.openingFlex = "10:00";
    state.settings.openingToil = "2:00";
    state.settings.standardByDay[1] = "7:00";
    const resetWorkday = {...emptyRecord("Flextime"), startTime:"09:00", lunchOut:"13:00", lunchIn:"14:00", finishTime:"18:00"};
    state.records = {"2026-08-20":clone(resetWorkday), "2026-08-21":clone(resetWorkday)};
    state.submissions = {"2026-08-20":{submitted:true, changed:false}};
    save(); loadRecord("2026-08-21", true, "edit"); input("finishTime", "18:15");
    pendingRecordSubmission = {date:"2026-08-22", candidateRecord:clone(resetWorkday)};
    assert(Object.keys(state.records).length === 2 && C.recalculate(state.records, state.settings)["2026-08-21"].progressiveFlex > C.parseDuration(state.settings.openingFlex), "reset test history did not contain derived balances");
    setSettingsExpanded(true); el("openResetHistory").click();
    assert(!el("resetHistoryModal").hidden && el("confirmResetHistory").disabled, "Reset History modal or initial safety lock is missing");
    modalRect = el("resetHistoryModal").querySelector(".dialog-card").getBoundingClientRect();
    assert(modalRect.left >= 0 && modalRect.right <= innerWidth && modalRect.height <= innerHeight, "Reset History modal is not contained by the viewport");
    input("resetHistoryConfirmation", "reset"); assert(el("confirmResetHistory").disabled, "lowercase reset enabled the destructive action");
    el("cancelResetHistory").click(); assert(Object.keys(state.records).length === 2, "Cancel deleted timesheet history");
    el("openResetHistory").click(); input("resetHistoryConfirmation", "RESET");
    assert(!el("confirmResetHistory").disabled, "typing RESET did not enable the final action"); el("confirmResetHistory").click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(Object.keys(state.records).length === 0 && Object.keys(stored.records).length === 0 && el("recordsBody").textContent.includes("No records yet"), "Reset did not remove all records and Timesheet History");
    assert(Object.keys(state.submissions).length === 0 && Object.keys(stored.submissions).length === 0, "Reset did not remove fortnight submission statuses");
    assert(!editMode && pendingRecordSubmission === null && recordsEqual(draft, emptyRecord("Flextime")) && el("leaveToilPanel").hidden, "Reset did not clear draft, edit, confirmation, or optional-entry state");
    assert(state.settings.standardByDay[1] === "7:00" && stored.settings.standardByDay[1] === "7:00", "Reset changed Standard Hours");
    assert(Object.keys(C.recalculate(state.records, state.settings)).length === 0, "old progressive balances remained after reset");
    setSettingsExpanded(true); change("openingFlex", "2:00"); change("openingToil", "0:00"); el("saveSettings").click();
    loadRecord("2026-08-24", true); input("startTime", "0900"); input("lunchOut", "1300"); input("lunchIn", "1400"); input("finishTime", "1800");
    const firstPostResetDate = activeDate; el("submitRecord").click();
    const postResetCalc = C.recalculate(state.records, state.settings);
    assert(postResetCalc[firstPostResetDate].progressiveFlex === 180, "new record did not calculate solely from the new Opening Flex Balance");
    const refreshedAfterReset = load();
    assert(Object.keys(refreshedAfterReset.records).join() === firstPostResetDate && !refreshedAfterReset.records["2026-08-20"] && refreshedAfterReset.settings.standardByDay[1] === "7:00", "refresh restored deleted history or lost preserved Settings");

    const rows = [...el("basicFields").children].map(node => node.getBoundingClientRect().top);
    assert(rows.every((top, index) => index === 0 || top > rows[index - 1]), "daily time fields are not vertically ordered");
    if (innerWidth >= 768 && innerWidth <= 1180) {
      setSettingsExpanded(true);
      const settingsInputs = [el("attendanceTypeSetting"), el("fortnightStart"), el("openingFlex"), el("openingToil")];
      const settingsTops = settingsInputs.map(input => Math.round(input.getBoundingClientRect().top));
      const settingsWidths = settingsInputs.map(input => Math.round(input.getBoundingClientRect().width));
      const settingsHeights = settingsInputs.map(input => Math.round(input.getBoundingClientRect().height));
      assert(new Set(settingsTops).size === 1, "tablet Settings fields are not on the same row");
      assert(Math.max(...settingsWidths) - Math.min(...settingsWidths) <= 1, "tablet Settings fields are not evenly balanced");
      assert(settingsHeights.join(",") === "38,36,38,38", `tablet Settings input heights are incorrect: ${settingsHeights.join(",")}`);
    }
    if (innerWidth <= 600) assert(Math.round(parseFloat(getComputedStyle(el("fortnightStart")).height)) === 48, "mobile Fortnight Start Date is not 48px high");
    window.scrollTo(0, 0);
    result.textContent = "PASS: Copy Previous record date summary colours attendance settings Leave TOIL welcome Feedback shared durations email CSV validation synchronized calculations responsive workflow";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
  } finally { restore(); }
})();
