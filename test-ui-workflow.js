(async function () {
  const result = document.createElement("pre"); result.id = "testResult"; result.style.cssText = "position:fixed;z-index:9999;left:8px;bottom:8px;max-width:calc(100% - 16px);white-space:pre-wrap;background:white;color:black;padding:8px;border:2px solid #6848a8"; document.body.append(result);
  const visualScale = document.documentElement.clientWidth <= 600 ? .85 : 1;
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
    const initialPreviousStart = C.addDays(periodFor(todayISO()).start, -14);
    state.submissions[initialPreviousStart] = {submitted:true, changed:false}; renderAll();
    const mainLayout = document.querySelector("main"), primaryFlowStyle = getComputedStyle(el("primaryEntryFlow")), heroStyle = getComputedStyle(document.querySelector(".hero")), dailyEntryStyle = getComputedStyle(el("dailyEntryCard"));
    assert(mainLayout.classList.contains("layout-unified") && el("submissionReminder").hidden, "no-reminder state did not select the unified hero and Daily Entry layout");
    assert(primaryFlowStyle.overflow === "hidden" && primaryFlowStyle.backgroundColor !== "rgba(0, 0, 0, 0)" && heroStyle.borderBottomLeftRadius === "0px" && dailyEntryStyle.marginTop === "0px" && dailyEntryStyle.borderTopWidth === "0px" && dailyEntryStyle.borderBottomWidth === "0px" && dailyEntryStyle.borderTopLeftRadius === "0px" && dailyEntryStyle.boxShadow === "none", "unified layout has a gap, shadow seam, separate card border, or doubled radius at the hero/Daily Entry join");
    assert(getComputedStyle(document.querySelector(".hero"), "::after").backgroundImage.includes("linear-gradient") && Math.abs(parseFloat(getComputedStyle(document.querySelector(".hero"), "::after").height) - 28 * visualScale) < .03, "unified hero does not have the requested short CSS fade into Daily Entry");
    showStatus("Draft saved");
    assert(getComputedStyle(el("status")).backgroundColor === getComputedStyle(el("dailyEntryCard")).backgroundColor && getComputedStyle(el("status")).borderTopWidth === "0px" && getComputedStyle(el("status")).boxShadow === "none", "Draft saved introduced a separate status surface or divider");
    showStatus("This fortnight has been submitted. You can no longer edit its entries directly. To make changes, go to Historical Timesheets, select the relevant fortnight, and click Edit Timesheet.");
    assert(mainLayout.classList.contains("layout-unified") && getComputedStyle(el("status")).color === "rgb(104, 72, 168)" && getComputedStyle(el("status")).backgroundColor === getComputedStyle(el("dailyEntryCard")).backgroundColor, "informational status is not purple text on the exact Daily Entry surface");
    showStatus(""); state.submissions = {}; renderAll();
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
    assert(document.querySelector('script[src="app.js?v=clocky-release-v22"]'), "page is not loading the current summary presentation bundle");
    assert(document.querySelector('link[href="styles.css?v=clocky-release-v22"]'), "page is not loading the current desktop/tablet summary stylesheet");
    assert([...document.querySelectorAll(".history-filters > label")].map(control => control.childNodes[0].textContent.trim()).join("|") === "Year|Month|Fortnight", "Historical Timesheets selectors changed");
    assert([...document.querySelectorAll(".historical-actions button")].filter(button => !button.hidden).map(button => button.textContent.trim()).join("|") === "Edit Timesheet|Export", "historical actions must put Edit Timesheet before Export");
    assert(el("exportSelectedFortnight").classList.contains("secondary") && el("exportMultiplePeriods").classList.contains("secondary") && el("exportMultiplePeriods").textContent === "Export", "Historical Timesheets export actions do not share the secondary utility style or wording");
    assert(getComputedStyle(document.querySelector(".multi-period-export")).borderTopStyle === "none" && getComputedStyle(document.querySelector(".multi-period-export h3")).color === "rgb(81, 74, 92)", "Export Multiple Periods heading or divider styling is incorrect");

    assert(!el("welcomeModal").hidden, "welcome disclaimer did not open on page load");
    assert(el("welcomeModal").textContent.includes("Clocky is for personal use only.") && el("welcomeModal").textContent.includes("Please do not enter any confidential, sensitive, or work-related information."), "welcome disclaimer text is incorrect");
    let modalRect = el("welcomeModal").querySelector(".dialog-card").getBoundingClientRect();
    assert(modalRect.left >= 0 && modalRect.right <= innerWidth && modalRect.height <= innerHeight, "welcome disclaimer is not contained by the viewport");
    el("closeWelcome").click(); assert(el("welcomeModal").hidden, "welcome disclaimer did not close");

    assert(getComputedStyle(el("status")).color === "rgb(104, 72, 168)", "unified status text does not use the primary purple colour");
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
    // The selected August period can be overdue; its red badge must not change metric label colours.
    assert(getComputedStyle(el("dailyResults").querySelector("span")).color === "rgb(89, 68, 135)", "daily result label lost its stable purple text colour");
    assert(getComputedStyle(el("fortnightResults").querySelector("span")).color === "rgb(89, 68, 135)", "fortnight result label lost its stable purple text colour");
    const summaryValueTops = [...el("fortnightResults").children].map(card => Math.round(card.querySelector("strong").getBoundingClientRect().top));
    const summaryColumns = document.documentElement.clientWidth <= 600 ? 2 : 3;
    assert(summaryValueTops.every((top, index) => index % summaryColumns === 0 || top === summaryValueTops[index - 1]), "Fortnight Summary values are not bottom-aligned within their responsive row");

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
    assert(activeDate === nextAvailableRecordDate(normalRecordDate) && el("recordDate").value === activeDate, "new record submission did not advance one day");
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
    assert(nextAvailableRecordDate("2026-07-23") === "2026-07-27", "next available date did not skip one saved record");
    state.records["2026-07-25"] = clone(noWork);
    assert(nextAvailableRecordDate("2026-07-23") === "2026-07-27", "next available date did not skip two saved records");
    state.records = recordsBeforeNextDateTests;

    // Manual date selection accepts weekends immediately, without automatic date skipping.
    loadRecord("2026-08-07", true);
    assert(weekdayForISO("2026-08-07") === 5 && weekdayForISO("2026-08-08") === 6 && weekdayForISO("2026-08-09") === 0, "local calendar weekday detection is incorrect");
    for (const date of ["2026-08-08", "2026-08-09", "2026-08-10", "2026-08-07"]) {
      change("recordDate", date);
      assert(activeDate === date && el("recordDate").value === date && el("workConfirmationModal").hidden, "manual date selection was restricted or advanced automatically");
    }
    state.records["2026-08-08"] = clone(working); save(); renderAll();
    el("recordsBody").querySelector('[data-edit="2026-08-08"]').click();
    assert(activeDate === "2026-08-08" && editMode && el("startTime").value === "09:00", "weekend History edit did not keep the selected date");
    el("cancelEdit").click(); delete state.records["2026-08-08"]; save();
    viewStart = periodFor("2026-08-21").start; loadRecord("2026-08-21", true);

    // End-to-end Saturday diagnostic and hard-gate test through the real controls and Submit button.
    change("recordDate", "2026-08-22"); assert(activeDate === "2026-08-22" && el("workConfirmationModal").hidden, "manual Saturday selection was not retained"); el("toggleLeaveToil").click(); change("leaveType", "Annual"); change("leaveHours", "721"); el("toggleLeaveToil").click();
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
    assert(activeDate === "2026-08-24", "automatic date after Saturday submission did not skip Sunday");
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
    [["2026-08-06", "06-08-2026"], ["2026-08-18", "18-08-2026"], ["2026-09-02", "02-09-2026"], ["2026-12-31", "31-12-2026"]].forEach(([iso, expected]) => assert(formatCsvDate(iso) === expected, `${iso} was not formatted as ${expected} for CSV`));
    assert(csvPackage.rows.slice(1).every(row => /^\d{2}-\d{2}-\d{4}$/.test(row[0])), "single-fortnight CSV contains a Date outside DD-MM-YYYY format");
    assert(csvPackage.csv.includes(`"${csvPackage.rows[1][0]}"`), "single-fortnight serialized CSV does not contain its DD-MM-YYYY Date value");
    const singleFortnightCsvBeforeMultiplePeriodTests = csvPackage.csv;

    // Multi-period CSV uses complete intersecting fortnights, skips empty periods, and preserves the existing CSV fields.
    const exportRecord = {...emptyRecord("Flextime"), startTime:"09:00", lunchOut:"12:00", lunchIn:"12:30", finishTime:"16:51"};
    [["020826", "02 Aug 2026"], ["02 08 26", "02 Aug 2026"], ["02082026", "02 Aug 2026"], ["02 08 2026", "02 Aug 2026"], ["311226", "31 Dec 2026"], ["010127", "01 Jan 2027"], ["290224", "29 Feb 2024"]].forEach(([entered, expected]) => assert(parseExportDate(entered)?.display === expected, `${entered} did not parse as ${expected}`));
    ["290226", "310426", "31022026", "31 02 26", "32132026"].forEach(entered => assert(parseExportDate(entered) === null, `${entered} was incorrectly accepted as a calendar date`));
    input("exportPeriodFrom", "020826"); el("exportPeriodFrom").dispatchEvent(new Event("blur"));
    input("exportPeriodTo", "02082026"); el("exportPeriodTo").dispatchEvent(new Event("blur"));
    assert(el("exportPeriodFrom").value === "02 Aug 2026" && el("exportPeriodFromError").hidden && el("exportPeriodTo").value === "02 Aug 2026" && el("exportPeriodToError").hidden, "compact dates were rejected or not normalized by the actual Period From/To fields");
    state.records = {"2026-08-20":clone(exportRecord), "2026-09-03":clone(exportRecord), "2026-09-17":clone(exportRecord)};
    input("exportPeriodFrom", "20 08 2026"); el("exportPeriodFrom").dispatchEvent(new Event("blur"));
    input("exportPeriodTo", "02 09 2026"); el("exportPeriodTo").dispatchEvent(new Event("change"));
    assert(el("exportPeriodFrom").value === "20 Aug 2026" && el("exportPeriodTo").value === "02 Sep 2026", "multiple-period export dates were not normalized to DD MMM YYYY");
    let combinedCsv = exportMultiplePeriodsCsv({download:() => {}});
    assert(combinedCsv.periods.length === 1 && combinedCsv.filename === "Clocky_Timesheets_2026-08-20_to_2026-09-02.csv" && combinedCsv.blob.type === "text/csv;charset=utf-8", "one reporting period did not produce the expected CSV package");
    assert(combinedCsv.rows[0][0] === "Reporting Period" && combinedCsv.rows[0].slice(1).join("|") === csvPackage.rows[0].join("|"), "Reporting Period is not the first column or existing CSV headers changed");
    assert(combinedCsv.rows.slice(1).every(row => row[0] === "20-08-2026 to 02-09-2026"), "one-period data rows do not contain the correct reporting period");
    assert(combinedCsv.rows.slice(1).every((row, index) => row.slice(1).join("|") === combinedCsv.periods[0].rows[index + 1].join("|")), "existing single-fortnight CSV field representations changed");
    assert(!combinedCsv.rows.some(row => row.length === 0) && !combinedCsv.csv.includes("\r\n\r\n"), "one-period export contains an unnecessary blank row");

    input("exportPeriodFrom", "25 08 2026"); input("exportPeriodTo", "20 09 2026");
    combinedCsv = exportMultiplePeriodsCsv({download:() => {}});
    assert(combinedCsv.periods.map(period => period.start).join("|") === "2026-08-20|2026-09-03|2026-09-17", "mid-period From date or multiple reporting periods were selected incorrectly or are not chronological");
    assert(combinedCsv.rows[0][0] === "Reporting Period" && combinedCsv.rows.filter(row => row[0] === "Reporting Period").length === 1, "combined CSV does not contain exactly one header at the top");
    const combinedLines = combinedCsv.csv.split("\r\n"), blankLineIndexes = combinedLines.map((line, index) => line === "" ? index : -1).filter(index => index >= 0);
    assert(blankLineIndexes.join("|") === "15|30", "combined CSV does not contain exactly one genuinely empty line between reporting periods");
    assert(combinedLines[0] !== "" && combinedLines.at(-1) !== "", "combined CSV contains a blank line before the first or after the final period");
    assert(reportingPeriodLabel("2026-08-06", "2026-08-19") === "06-08-2026 to 19-08-2026", "reporting period was not formatted as DD-MM-YYYY to DD-MM-YYYY");
    assert(combinedCsv.rows.filter(row => row.length).slice(1).every(row => /^\d{2}-\d{2}-\d{4} to \d{2}-\d{2}-\d{4}$/.test(row[0]) && /^\d{2}-\d{2}-\d{4}$/.test(row[1])), "a combined CSV row has an invalid reporting-period or Date format");
    combinedCsv.periods.forEach(period => {
      const label = reportingPeriodLabel(period.start, period.end), exportedRows = combinedCsv.rows.filter(row => row[0] === label);
      assert(exportedRows.length === period.rows.length - 1 && exportedRows.every((row, index) => row.slice(1).join("|") === period.rows[index + 1].join("|")), `CSV representations or chronological row order changed for ${label}`);
    });
    input("exportPeriodFrom", "20 08 2026"); input("exportPeriodTo", "05 09 2026"); combinedCsv = exportMultiplePeriodsCsv({download:() => {}});
    assert(combinedCsv.periods.length === 2 && combinedCsv.periods.at(-1).start === "2026-09-03", "mid-period To date did not include the complete intersecting reporting period");
    delete state.records["2026-09-03"];
    input("exportPeriodFrom", "20 08 2026"); input("exportPeriodTo", "20 09 2026"); combinedCsv = exportMultiplePeriodsCsv({download:() => {}});
    assert(combinedCsv.periods.map(period => period.start).join("|") === "2026-08-20|2026-09-17" && combinedCsv.rows.filter(row => row.length === 0).length === 1, "empty reporting periods were not skipped or separator count is incorrect");

    input("exportPeriodFrom", "31 02 2026"); input("exportPeriodTo", "20 09 2026");
    assert(exportMultiplePeriodsCsv({download:() => {}}) === "invalid" && !el("exportPeriodFromError").hidden, "invalid From date was not rejected inline");
    input("exportPeriodFrom", "20 08 2026"); input("exportPeriodTo", "not a date");
    assert(exportMultiplePeriodsCsv({download:() => {}}) === "invalid" && !el("exportPeriodToError").hidden, "invalid To date was not rejected inline");
    input("exportPeriodFrom", "20 09 2026"); input("exportPeriodTo", "20 08 2026");
    assert(exportMultiplePeriodsCsv({download:() => {}}) === "invalid-range" && el("exportPeriodToError").textContent === "Period To cannot be earlier than Period From.", "To earlier than From was not rejected inline");
    state.records = {}; input("exportPeriodFrom", "20 08 2026"); input("exportPeriodTo", "20 09 2026");
    assert(exportMultiplePeriodsCsv({download:() => {}}) === "empty" && el("multiplePeriodExportStatus").textContent === "No timesheet records found for this period.", "record-free range did not suppress download and show the required message");
    assert(buildCsvPackage(viewStart).csv === singleFortnightCsvBeforeMultiplePeriodTests, "existing single-fortnight CSV export changed after multiple-period export");

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
    const currentReminderPeriod = periodFor(todayISO()).start;
    const previousReminderPeriod = C.addDays(currentReminderPeriod, -14);
    const overdueStart = C.addDays(previousReminderPeriod, -14);
    const reminderFilters = {year:filterYear, month:filterMonth};
    state.records = {[overdueStart]:clone(exportRecord), [previousReminderPeriod]:clone(exportRecord)};
    // Isolate two overdue periods, even when today is the current period's final Wednesday.
    state.submissions = {[currentReminderPeriod]:{submitted:true, changed:false}};
    filterYear = Number(overdueStart.slice(0, 4)); filterMonth = Number(overdueStart.slice(5, 7));
    historicalStart = overdueStart; historicalMode = true; save(); renderAll();
    assert(!el("submissionReminder").hidden && reminderStart === overdueStart, "overdue fortnight reminder test setup failed");
    const beforeSubmissionFailure = JSON.stringify(state), beforeSubmissionStorage = localStorage.getItem(STORAGE_KEY), beforeSubmissionMessage = el("status").textContent;
    const setItemBeforeSubmissionFailure = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key,value) { if (key === STORAGE_KEY) throw new DOMException("Isolated submission failure", "QuotaExceededError"); return setItemBeforeSubmissionFailure.call(this,key,value); };
    try { el("markSubmitted").click(); } finally { Storage.prototype.setItem = setItemBeforeSubmissionFailure; }
    assert(JSON.stringify(state) === beforeSubmissionFailure && localStorage.getItem(STORAGE_KEY) === beforeSubmissionStorage && el("status").textContent === beforeSubmissionMessage, "failed fortnight submission changed stored state or displayed success feedback");
    assert(mainLayout.classList.contains("layout-actionable") && !mainLayout.classList.contains("layout-unified") && getComputedStyle(el("primaryEntryFlow")).backgroundColor === "rgba(0, 0, 0, 0)" && getComputedStyle(el("primaryEntryFlow")).overflow === "visible" && getComputedStyle(el("submissionReminder")).marginTop === `${20 * visualScale}px` && getComputedStyle(el("dailyEntryCard")).marginTop === `${20 * visualScale}px` && getComputedStyle(el("dailyEntryCard")).borderTopWidth !== "0px" && getComputedStyle(document.querySelector(".hero"), "::after").content === "none", "actionable reminder did not select the separated hero/reminder/Daily Entry layout");
    let exportPromptCount = 0;
    window.confirm = message => { if (/CSV|export|share/i.test(message)) exportPromptCount++; return true; };
    el("markSubmitted").click();
    window.confirm = () => true;
    assert(state.submissions[overdueStart]?.submitted && state.submissions[overdueStart]?.changed === false, "Mark fortnight as submitted did not preserve the existing submission state logic");
    assert(!el("submissionReminder").hidden && reminderStart === previousReminderPeriod && el("status").textContent === "This fortnight has been submitted. You can no longer edit its entries directly. To make changes, go to Historical Timesheets, select the relevant fortnight, and click Edit Timesheet.", "submitting one period must preserve another outstanding reminder and show success feedback");
    window.confirm = message => { if (/CSV|export|share/i.test(message)) exportPromptCount++; return true; };
    el("markSubmitted").click(); window.confirm = () => true;
    assert(state.submissions[previousReminderPeriod]?.submitted && !state.submissions[previousReminderPeriod].changed, "the remaining overdue period was not marked submitted");
    assert(exportPromptCount === 0, "Mark fortnight as submitted triggered an export/download/share prompt");
    assert(el("submissionReminder").hidden && el("status").textContent === "This fortnight has been submitted. You can no longer edit its entries directly. To make changes, go to Historical Timesheets, select the relevant fortnight, and click Edit Timesheet.", "submitted reminder or success feedback did not update normally");
    assert(el("status").scrollWidth <= el("status").clientWidth && getComputedStyle(el("status")).whiteSpace === "normal", "long fortnight success message does not wrap within the existing status area");
    assert(mainLayout.classList.contains("layout-unified") && getComputedStyle(el("status")).color === "rgb(104, 72, 168)" && getComputedStyle(el("dailyEntryCard")).marginTop === "0px", "submitted informational status did not return to the unified layout");
    filterYear = reminderFilters.year; filterMonth = reminderFilters.month;

    const authoriseHistoricalPeriod = start => {
      change("filterYear", start.slice(0, 4)); change("filterMonth", String(Number(start.slice(5, 7)))); change("viewFortnight", start);
      el("editHistoricalTimesheet").click(); el("confirmHistoricalEdit").click();
      assert(historicalEditAllowed(start), "historical permission was not granted through confirmation");
    };
    const assertPeriodBadges = expected => {
      const badges = [el("dailyEntryStatus"), el("fortnightStatus"), el("calculatedDateStatus")];
      assert(badges.every(badge => badge.textContent === expected), `all three period badges must show ${expected}`);
      const styles = badges.map(badge => getComputedStyle(badge)), rects = badges.map(badge => badge.getBoundingClientRect());
      assert(styles.every(style => ["fontFamily","fontSize","fontWeight","color","backgroundColor","border","borderRadius","padding","lineHeight"].every(key => styles[0][key] === style[key])), "period badges do not share the existing styling");
      assert(rects.every(rect => Math.abs(rects[0].width - rect.width) < .02 && Math.abs(rects[0].height - rect.height) < .02), "period badge dimensions differ");
      const heading = el("dailyEntryStatus").previousElementSibling.getBoundingClientRect();
      assert(rects[0].left > heading.right && Math.abs((rects[0].top + rects[0].bottom) / 2 - (heading.top + heading.bottom) / 2) < .02 && rects[0].right <= el("dailyEntryCard").getBoundingClientRect().right, "Daily Entry badge overlaps, wraps or misaligns");
      const calculatedHeading = el("calculatedDateStatus").previousElementSibling.getBoundingClientRect();
      assert(rects[2].left > calculatedHeading.right && Math.abs((rects[2].top + rects[2].bottom) / 2 - (calculatedHeading.top + calculatedHeading.bottom) / 2) < .02, "Calculated badge must remain beside its naturally wrapping heading");
    };
    const assertHistoricalReminder = active => {
      assert(el("resubmitHistoricalReminder").hidden === !active && el("resubmitHistoricalTimesheet").hidden === !active, "historical Resubmit controls do not share the active-session state");
      if (active) {
        assert(!el("submissionReminder").hidden && el("markSubmitted").hidden && el("submissionMessage").textContent === "Historical timesheet awaiting resubmission" && el("submissionPeriod").textContent === "You are editing a previously submitted fortnight. Please resubmit it when you have finished making changes.", "historical reminder wording, placement or submission type is incorrect");
        const upper = getComputedStyle(el("resubmitHistoricalReminder")), lower = getComputedStyle(el("resubmitHistoricalTimesheet"));
        assert(["backgroundColor","color","fontFamily","fontSize","fontWeight","borderRadius"].every(key => upper[key] === lower[key]), "upper Resubmit styling differs from existing primary button");
        const rect = el("submissionReminder").getBoundingClientRect();
        assert(rect.left >= 0 && rect.right <= innerWidth && el("resubmitHistoricalReminder").scrollWidth <= el("resubmitHistoricalReminder").clientWidth, "historical reminder overflows");
      }
    };
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
    setSettingsExpanded(true);
    change("fortnightStart", "2026-08-21");
    const settingsInputsWithError = [el("attendanceTypeSetting"), el("fortnightStart"), el("openingFlex"), el("openingToil")];
    const settingsInputTopsWithError = settingsInputsWithError.map(input => Math.round(input.getBoundingClientRect().top));
    assert(!el("fortnightStartError").hidden, "Fortnight Thursday validation message was not shown");
    if (innerWidth > 600) assert(new Set(settingsInputTopsWithError).size === 1, "Settings inputs moved out of alignment when the fortnight validation message appeared");
    assert(el("fortnightStartError").getBoundingClientRect().top >= el("fortnightStart").getBoundingClientRect().bottom, "Fortnight validation message is not below its date input");
    assert(document.documentElement.scrollWidth <= document.documentElement.clientWidth, "Settings validation layout introduced horizontal overflow");
    if (innerWidth <= 600) assert(Math.round(parseFloat(getComputedStyle(el("fortnightStart")).height)) === Math.round(48 * visualScale), "mobile Fortnight Start Date does not follow the visual scale");

    // Daily Entry owns its date and draft; historical browsing owns a separate period.
    state = clone(defaults); state.settings.fortnightStart = "2026-09-24"; state.settings.openingFlex = "1:00";
    const displayPeriods = [
      {start:"2026-09-24", end:"2026-10-07", finish:"16:51", hours:"14:42", closing:"1:00"},
      {start:"2026-10-08", end:"2026-10-21", finish:"17:51", hours:"16:42", closing:"3:00"},
      {start:"2026-10-22", end:"2026-11-04", finish:"15:51", hours:"12:42", closing:"1:00"}
    ];
    displayPeriods.forEach(period => [period.start, period.end].forEach(date => { state.records[date] = {...exportRecord, finishTime:period.finish}; }));
    save(); renderSettings(); loadRecord("2026-09-24", true);
    const storedBeforeBrowsing = localStorage.getItem(STORAGE_KEY), recordsBeforeBrowsing = JSON.stringify(state.records);
    function assertDisplayedPeriod(period) {
      assert(viewStart === period.start && el("periodDates").textContent === `${formatDisplayDate(period.start, "range")} to ${formatDisplayDate(period.end, "range")}`, "summary is displaying a stale reporting period");
      assert([...el("recordsBody").querySelectorAll("[data-edit]")].map(button => button.dataset.edit).join("|") === `${period.start}|${period.end}`, "Timesheet History is displaying records from another period");
      assert(metric("fortnightResults", "Hours Recorded This Period") === period.hours && metric("fortnightResults", "Closing Flex Balance") === period.closing, "fortnight totals or carried balances did not follow the selected period");
      assert(metric("fortnightResults", "Standard Hours") === "73:30", "selected fortnight does not contain ten standard workdays");
    }
    for (const period of [...displayPeriods, displayPeriods[0]]) {
      change("recordDate", period.start); assertDisplayedPeriod(period);
      assert(activeDate === period.start && !el("recordDate").min && !el("recordDate").max, "Daily Entry date remains restricted to the previously displayed fortnight");
    }
    loadRecord("2026-10-08", true, "edit"); input("finishTime", "1851");
    el("toggleInterruptions").click(); interruptionInput(0, "out", "1030");
    const dailySnapshot = () => JSON.stringify({date:activeDate, inputDate:el("recordDate").value, draft, originalDraft, form:readForm(), editMode, leaveToil:!el("leaveToilPanel").hidden, interruptions:[...document.querySelectorAll("[data-interruption-time]")].map(input => input.value)});
    const entryBeforeBrowsing = dailySnapshot();
    let browsingConfirmations = 0; window.confirm = () => { browsingConfirmations++; return false; };
    change("filterYear", "2026"); change("filterMonth", "10");
    for (const period of displayPeriods) {
      change("viewFortnight", period.start); assertDisplayedPeriod(period);
      assert(dailySnapshot() === entryBeforeBrowsing, "historical browsing changed Daily Entry or its open unsaved editor");
      renderAll(); renderCurrentPreview(); assertDisplayedPeriod(period);
    }
    assert(browsingConfirmations === 0, "historical browsing incorrectly requested permission to discard Daily Entry");
    assert(localStorage.getItem(STORAGE_KEY) === storedBeforeBrowsing && JSON.stringify(state.records) === recordsBeforeBrowsing, "date selection or browsing modified stored records");
    change("recordDate", "2026-09-24");
    assert(activeDate === "2026-10-08" && dailySnapshot() === entryBeforeBrowsing && viewStart === "2026-10-22", "cancelling a Daily Entry date change lost the draft or changed the viewed period");
    window.confirm = () => true;
    change("recordDate", "2026-09-24"); assertDisplayedPeriod(displayPeriods[0]);
    assert(historicalStart === "2026-10-22" && el("viewFortnight").value === "2026-10-22", "Daily Entry selection replaced the independent historical period");
    // Historical exports remain tied to that selector even after returning to Daily Entry.
    let browsingExport;
    const originalBrowsingDownload = downloadCsvPackage;
    try {
      downloadCsvPackage = pkg => { browsingExport = pkg; };
      el("exportCsv").click(); assert(browsingExport.period.start === "2026-09-24", "Timesheet History export ignored the displayed Daily Entry period");
      el("exportSelectedFortnight").click(); assert(browsingExport.period.start === "2026-10-22" && browsingExport.rows[1][0] === "22-10-2026" && browsingExport.rows.at(-1)[0] === "04-11-2026", "historical export used the Daily Entry period instead of its independent selection");
    } finally { downloadCsvPackage = originalBrowsingDownload; }

    // Exercise the real period selectors and download actions across the October DST boundary.
    state = clone(defaults); state.settings.fortnightStart = "2026-09-24";
    const csvDateAt = (start, offset) => {
      const date = new Date(`${start}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    };
    for (let offset = 0; offset < 44; offset++) {
      const date = csvDateAt("2026-09-23", offset);
      if (date !== "2026-10-10") state.records[date] = {...exportRecord, startTime:`09:${String(offset).padStart(2, "0")}`};
    }
    state.records["2025-10-09"] = {...exportRecord}; state.records["2025-10-22"] = {...exportRecord};
    const exportStateBefore = JSON.stringify(state);
    renderSettings(); loadRecord("2026-10-08", true);
    const csvDailyDate = activeDate;
    change("filterYear", "2026"); change("filterMonth", "10");
    assert([...el("viewFortnight").options].map(option => option.value).join("|") === "2026-09-24|2026-10-08|2026-10-22", "October selector lost its Thursday reporting-period boundaries");
    const expectedCsvHeaders = "Date|Start Time|Morning Out|Morning In|Lunch Out|Lunch In|Afternoon Out|Afternoon In|Finish Time|Leave Type|Leave Hours|Standard Hours|Attendance Type|TOIL Hours|Daily Hours";
    function assertPeriodCsv(pkg, start, end) {
      assert(pkg.period.start === start && pkg.period.end === end && pkg.filename === `Timesheet_${start}_to_${end}.csv`, "CSV filename and selected period disagree");
      assert(pkg.rows.length === 15 && pkg.rows[0].join("|") === expectedCsvHeaders, "single-period CSV headers or row count changed");
      const serializedRows = pkg.csv.split("\r\n").slice(1);
      assert(serializedRows.length === 14, "serialized CSV does not contain exactly 14 dates");
      pkg.rows.slice(1).forEach((row, index) => {
        const date = csvDateAt(start, index), formatted = date.split("-").reverse().join("-");
        assert(date >= start && date <= end && row[0] === formatted && row.length === 15, `exported row ${index + 1} is outside ${start} to ${end} or has changed columns`);
        assert(serializedRows[index].startsWith(`"${formatted}",`), "serialized CSV date differs from its selected period");
        const record = state.records[date];
        assert(record ? row[1] === record.startTime : row.slice(1).every(value => value === ""), `CSV picked up a record from the wrong date: ${date}`);
      });
      assert(pkg.rows[1][0] === start.split("-").reverse().join("-") && pkg.rows.at(-1)[0] === end.split("-").reverse().join("-"), "first or last selected date is missing from CSV");
    }
    let capturedCsv;
    const originalSingleDownload = downloadCsvPackage, originalMultipleDownload = downloadMultiplePeriodsCsv;
    downloadCsvPackage = pkg => { capturedCsv = pkg; };
    downloadMultiplePeriodsCsv = pkg => { capturedCsv = pkg; };
    try {
      for (const [start, end] of [["2026-09-24", "2026-10-07"], ["2026-10-08", "2026-10-21"], ["2026-10-22", "2026-11-04"]]) {
        change("viewFortnight", start);
        assert(viewStart === start && historicalStart === start && activeDate === csvDailyDate, "historical period selection changed Daily Entry or displayed the wrong period");
        for (const button of ["exportCsv", "exportSelectedFortnight"]) {
          capturedCsv = null; el(button).click(); assert(capturedCsv, `${button} did not generate a CSV`);
          assertPeriodCsv(capturedCsv, start, end);
        }
        const bytes = new Uint8Array(await capturedCsv.blob.arrayBuffer());
        assert(bytes.slice(0, 3).join() === "239,187,191" && new TextDecoder().decode(bytes) === capturedCsv.csv, "CSV download encoding or contents changed");
      }
      assertPeriodCsv(buildCsvPackage("2026-10-15"), "2026-10-08", "2026-10-21");
      change("filterYear", "2025"); change("filterMonth", "10"); change("viewFortnight", "2025-10-09");
      el("exportSelectedFortnight").click(); assertPeriodCsv(capturedCsv, "2025-10-09", "2025-10-22");
      const multiPeriodCases = [
        ["30 09 2026", "01 11 2026", ["2026-09-24", "2026-10-08", "2026-10-22"]],
        ["08 10 2026", "21 10 2026", ["2026-10-08"]]
      ];
      for (const [from, to, expectedStarts] of multiPeriodCases) {
        input("exportPeriodFrom", from); input("exportPeriodTo", to);
        capturedCsv = null; el("exportMultiplePeriods").click();
        assert(capturedCsv && capturedCsv.periods.map(period => period.start).join("|") === expectedStarts.join("|"), "multiple-period export selected incorrect periods");
        assert(capturedCsv.rows[0].join("|") === `Reporting Period|${expectedCsvHeaders}`, "multiple-period CSV column structure changed");
        expectedStarts.forEach(start => {
          const end = csvDateAt(start, 13), label = `${start.split("-").reverse().join("-")} to ${end.split("-").reverse().join("-")}`;
          const rows = capturedCsv.rows.filter(row => row[0] === label);
          assert(rows.length === 14, `multiple-period export omitted or duplicated dates for ${label}`);
          const pkg = buildCsvPackage(start); assertPeriodCsv(pkg, start, end);
          rows.forEach((row, index) => assert(JSON.stringify(row.slice(1)) === JSON.stringify(pkg.rows[index + 1]), `reporting-period label does not match the exported data: ${label}`));
        });
        assert(capturedCsv.rows.length === expectedStarts.length * 15 && capturedCsv.rows.filter(row => !row.length).length === expectedStarts.length - 1, "multiple-period export contains extra rows or incorrect separators");
      }
      assert(JSON.stringify(state) === exportStateBefore, "period selection or CSV export modified saved timesheet data");
    } finally {
      downloadCsvPackage = originalSingleDownload; downloadMultiplePeriodsCsv = originalMultipleDownload;
    }
    // Startup and new-entry defaults use record chronology, never the last viewed date or today's date.
    revokeHistoricalEdit();
    for (const [latest, expected] of [["2026-10-09","2026-10-12"], ["2026-10-06","2026-10-07"], ["2026-10-08","2026-10-09"], ["2026-10-10","2026-10-12"], ["2026-10-11","2026-10-12"], ["2026-10-02","2026-10-05"], ["2026-12-31","2027-01-01"]]) {
      state = clone(defaults); state.settings.fortnightStart = "2026-09-24"; state.records[latest] = {...exportRecord};
      const beforeDefault = JSON.stringify(state);
      assert(defaultRecordDate() === expected && initialRecordDate() === expected, `automatic default after ${latest} must be ${expected}`);
      renderSettings(); loadRecord(initialRecordDate(), true); renderAll(); renderAll();
      assert(activeDate === expected && JSON.stringify(state) === beforeDefault, "default selection or re-render changed records or advanced repeatedly");
    }
    state.records = {"2026-10-06":{...exportRecord}}; state.drafts = {"2026-10-09":{record:{...exportRecord}, editMode:false}};
    assert(defaultRecordDate() === "2026-10-12", "a saved draft's Record Date was omitted from the latest-entry calculation");
    state.activeDraftDate = "2026-10-09";
    assert(initialRecordDate() === "2026-10-09", "startup abandoned an unfinished saved draft");
    state.drafts = {}; state.activeDraftDate = "";
    loadRecord("2026-10-05", true);
    for (let offset = 0; offset < 7; offset++) {
      const date = C.addDays("2026-10-05", offset); change("recordDate", date); renderAll();
      assert(activeDate === date && el("recordDate").value === date && !el("recordDate").min && !el("recordDate").max && el("workConfirmationModal").hidden, "one of the seven manually selected weekdays was restricted or redirected");
    }
    input("startTime", "0900"); const manualDate = activeDate, manualState = JSON.stringify(state);
    window.confirm = () => false; change("recordDate", "2026-10-12");
    assert(activeDate === manualDate && el("startTime").value === "09:00", "declining a date change discarded unsaved work");
    window.confirm = () => true; change("filterYear", "2025"); change("filterMonth", "1"); renderAll();
    assert(activeDate === manualDate && el("startTime").value === "09:00" && JSON.stringify(state) === manualState, "historical browsing recalculated the default date or overwrote Daily Entry");
    state.submissions = {"2026-10-08":{submitted:true, changed:false}};
    change("recordDate", "2026-10-10");
    assert(activeDate === "2026-10-10" && submittedPeriodLocked() && !el("startTime").readOnly && !el("submitRecord").disabled, "manual Saturday selection bypassed the submitted-period lock");
    change("recordDate", "2026-10-11");
    assert(activeDate === "2026-10-11" && submittedPeriodLocked() && !el("saveDraft").disabled, "manual Sunday selection bypassed the submitted-period lock");
    // Every explicit unauthorised Save/Submit click warns before validation, even for empty/unchanged forms.
    revokeHistoricalEdit(); state = clone(defaults); state.settings.fortnightStart = "2026-09-24";
    state.records = {"2026-10-07":{...exportRecord, finishTime:"17:21"}, "2026-10-08":{...exportRecord}, "2026-11-05":{...exportRecord}};
    state.submissions = {"2026-10-08":{submitted:true, changed:false}};
    save(); renderSettings(); loadRecord("2026-10-08", true);
    assertPeriodBadges("Submitted"); assertHistoricalReminder(false);
    const modalStateBefore = JSON.stringify(state), modalStoredBefore = localStorage.getItem(STORAGE_KEY);
    assert(el("submittedWarningModal").hidden, "selecting or viewing a submitted record opened the warning");
    function assertSubmittedWarning(trigger) {
      const selectedDate = activeDate, temporaryValues = JSON.stringify(readForm()), alertsBeforeClick = alerts.length;
      const clockValidation = validateClockInputs, durationValidation = validateDurationInputs;
      let validations = 0, writes = 0;
      const originalSetItem = Storage.prototype.setItem;
      validateClockInputs = (...args) => { validations++; return clockValidation(...args); };
      validateDurationInputs = (...args) => { validations++; return durationValidation(...args); };
      Storage.prototype.setItem = function(key,value) { if (key === STORAGE_KEY) writes++; return originalSetItem.call(this,key,value); };
      try { el(trigger).focus(); el(trigger).click(); } finally { validateClockInputs = clockValidation; validateDurationInputs = durationValidation; Storage.prototype.setItem = originalSetItem; }
      assert(validations === 0 && writes === 0 && alerts.length === alertsBeforeClick, "submitted protection did not precede ordinary validation or attempted a data write");
      assert(!el("submittedWarningModal").hidden && document.activeElement === el("dismissSubmittedWarning") && document.querySelector("main").inert, "submitted warning did not open accessibly after a Save/Submit attempt");
      assert(el("submittedWarningTitle").textContent === "You CANNOT edit a submitted timesheet" && el("dismissSubmittedWarning").textContent === "OK, Got It", "submitted warning title or button wording changed");
      assert([...el("submittedWarningMessage").querySelectorAll("p")].map(p => p.textContent).join("\n\n") === "This fortnight has already been submitted. You cannot make changes to a submitted timesheet.\n\nTo make changes, go to Historical Timesheets, select the relevant fortnight, and click Edit Timesheet.", "submitted warning message changed");
      const rect = el("submittedWarningModal").querySelector(".dialog-card").getBoundingClientRect();
      assert(Math.abs((rect.left + rect.right) / 2 - innerWidth / 2) < 1 && Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2) < 1 && rect.width <= innerWidth && rect.height <= innerHeight, "submitted warning must stay centred and fit the viewport");
      const ok = el("dismissSubmittedWarning").getBoundingClientRect();
      assert(getComputedStyle(el("submittedWarningModal")).display !== "none" && document.elementFromPoint(ok.left + ok.width / 2, ok.top + ok.height / 2) === el("dismissSubmittedWarning"), "submitted modal is obscured, clipped or behind page content");
      el("dismissSubmittedWarning").dispatchEvent(new KeyboardEvent("keydown", {key:"Tab", bubbles:true, cancelable:true}));
      assert(document.activeElement === el("dismissSubmittedWarning"), "focus escaped the submitted warning");
      assert(JSON.stringify(state) === modalStateBefore && localStorage.getItem(STORAGE_KEY) === modalStoredBefore, "blocked Save/Submit wrote submitted data");
      el("dismissSubmittedWarning").click();
      assert(el("submittedWarningModal").hidden && !document.querySelector("main").inert && document.activeElement === el(trigger) && activeDate === selectedDate && JSON.stringify(readForm()) === temporaryValues, "dismissal failed to restore focus or changed the selected date or temporary input");
    }
    loadRecord("2026-10-15", true);
    assertPeriodBadges("Submitted");
    assert(["startTime","lunchOut","lunchIn","finishTime"].every(id => el(id).value === "") && el("submittedWarningModal").hidden, "empty submitted-date fixture did not load silently");
    for (const id of ["saveDraft","submitRecord"]) assertSubmittedWarning(id);
    input("startTime", "0900"); input("lunchOut", "1200"); input("lunchIn", "1300"); input("finishTime", "1700");
    for (const id of ["saveDraft","submitRecord"]) assertSubmittedWarning(id);
    input("finishTime", "2500");
    for (const id of ["saveDraft","submitRecord"]) assertSubmittedWarning(id);
    input("finishTime", ""); input("lunchIn", "");
    for (const id of ["saveDraft","submitRecord"]) assertSubmittedWarning(id);
    loadRecord("2026-10-08", true);
    assert(!meaningfulDailyChanges() && el("submittedWarningModal").hidden, "viewing unchanged submitted records opened a warning");
    for (const id of ["saveDraft","submitRecord"]) assertSubmittedWarning(id);
    el("startTime").focus(); input("startTime", "0900");
    assert(!meaningfulDailyChanges() && el("submittedWarningModal").hidden, "focus or equivalent formatting counted as a modification or opened the modal");
    assertSubmittedWarning("saveDraft");
    el("toggleInterruptions").click(); assertSubmittedWarning("saveDraft"); closeInterruptionEditor();
    input("finishTime", "1751"); assertSubmittedWarning("saveDraft");
    assert(el("finishTime").value === "17:51", "dismissing Save warning lost temporary hours");
    assertSubmittedWarning("submitRecord");
    assert(el("finishTime").value === "17:51", "dismissing Submit warning lost temporary hours");
    input("finishTime", "1651"); assertSubmittedWarning("submitRecord");
    el("toggleInterruptions").click(); interruptionInput(0, "out", "1030"); interruptionInput(0, "in", "1045");
    assertSubmittedWarning("saveDraft");
    assert(interruptionEditor().querySelector("[data-interruption-out]").value === "10:30", "warning discarded temporary additional time");
    closeInterruptionEditor(); setLeaveToilExpanded(true); change("leaveType", "Annual"); input("leaveHours", "100");
    assertSubmittedWarning("submitRecord");
    assert(el("leaveType").value === "Annual" && el("leaveHours").value === "100", "warning discarded temporary leave details");
    cancelLeaveToil(); clearRecordForm(); assertSubmittedWarning("saveDraft");
    copyPrevious(); assertSubmittedWarning("submitRecord");
    assert(JSON.stringify(state) === modalStateBefore && localStorage.getItem(STORAGE_KEY) === modalStoredBefore, "Clear or Copy Previous bypassed persistence protection");
    loadRecord("2026-10-08", true); change("recordDate", "2026-10-09");
    assert(el("submittedWarningModal").hidden && activeDate === "2026-10-09", "navigating unchanged submitted data opened a warning");
    assert(!el("submittedPeriodNotice") && !el("status").textContent.includes("This fortnight has already been submitted."), "removed inline submitted warning returned");

    // Submitted historical edits are an isolated transaction until successful resubmission.
    setHistoricalExpanded(true);
    revokeHistoricalEdit(); state = clone(defaults); state.settings.fortnightStart = "2026-09-24";
    state.records = {"2026-10-08":clone(exportRecord), "2026-10-21":clone(exportRecord), "2026-10-22":clone(exportRecord), "2026-11-05":clone(exportRecord)};
    state.submissions = {"2026-10-08":{submitted:true, changed:false, submittedAt:"original", note:"preserve"}, "2026-10-22":{submitted:true, changed:false}};
    save(); renderSettings(); loadRecord("2026-10-08", true);
    const transactionState = JSON.stringify(state), transactionStorage = localStorage.getItem(STORAGE_KEY);
    const approvedCsv = buildCsvPackage("2026-10-08").csv;
    change("filterYear", "2026"); change("filterMonth", "10"); change("viewFortnight", "2026-10-08");
    el("editHistoricalTimesheet").click();
    assert(!el("historicalEditModal").hidden && !historicalSession && el("resubmitHistoricalTimesheet").hidden, "historical permission activated before confirmation");
    assertPeriodBadges("Submitted"); assertHistoricalReminder(false);
    el("cancelHistoricalEdit").click();
    assert(!historicalSession && submittedPeriodLocked() && JSON.stringify(state) === transactionState, "initial Cancel changed submitted data or permission");
    assertPeriodBadges("Submitted"); assertHistoricalReminder(false);
    authoriseHistoricalPeriod("2026-10-08");
    assertPeriodBadges("To be submitted"); assertHistoricalReminder(true);
    assert(historicalSession && !submittedPeriodLocked() && !el("resubmitHistoricalTimesheet").hidden && !el("cancelHistoricalSession").hidden, "confirmed submitted period did not enter transactional editing");
    const entryActions = [...document.querySelectorAll(".daily-entry-actions > button")].filter(button => !button.hidden);
    assert(entryActions.map(button => button.textContent).join("|") === "Save Changes|Save|Copy Previous|Clear|Cancel Edit", "wrapping changed the Daily Entry action order");
    assert(entryActions.every(button => button.getBoundingClientRect().right <= el("dailyEntryCard").getBoundingClientRect().right) && document.documentElement.scrollWidth <= document.documentElement.clientWidth, "historical Cancel Edit or heading causes horizontal page overflow");
    const actionButtons = [...document.querySelectorAll(".historical-actions > button")];
    const visualButtons = [...actionButtons].sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    assert(visualButtons.map(button => button.textContent.trim()).join("|") === (innerWidth <= 600 ? "Edit Timesheet|Export|Resubmit|Cancel" : "Edit Timesheet|Resubmit|Export|Cancel"), "historical action visual order is incorrect");
    const actionRects = actionButtons.map(button => button.getBoundingClientRect()), actionStyles = actionButtons.map(button => getComputedStyle(button));
    assert(actionRects.every(rect => Math.abs(rect.height - actionRects[0].height) < .02), "historical actions have unequal heights");
    assert(actionStyles.every(style => ["fontSize","fontWeight","lineHeight","borderRadius"].every(key => style[key] === actionStyles[0][key])), "historical action typography or corners differ");
    assert(["backgroundColor","color","padding"].every(key => actionStyles[0][key] === actionStyles[1][key] && actionStyles[2][key] === actionStyles[3][key]), "historical action colour/style pairs do not match exactly");
    if (innerWidth <= 600) {
      assert(actionRects.every(rect => Math.abs(rect.width - actionRects[0].width) < .02) && actionRects[0].top === actionRects[2].top && actionRects[1].top === actionRects[3].top && actionRects[1].top > actionRects[0].top, "mobile historical actions are not an equal 2 by 2 grid");
    } else {
      assert(actionRects.every(rect => rect.top === actionRects[0].top) && Math.abs(actionRects[0].left - el("filterYear").getBoundingClientRect().left) < .02 && actionRects.at(-1).right <= document.querySelector(".historical-actions").getBoundingClientRect().right, "desktop/tablet historical actions wrap, stretch or misalign");
    }
    input("finishTime", "1751"); el("saveDraft").click();
    assert(el("status").textContent === "Draft saved" && historicalSession.records["2026-10-08"].finishTime === "17:51", "historical Save did not stage the draft or preserve success feedback");
    assert(JSON.stringify(state) === transactionState && localStorage.getItem(STORAGE_KEY) === transactionStorage && buildCsvPackage("2026-10-08").csv === approvedCsv, "historical Save changed persisted records, status or approved export");
    const unload = new Event("beforeunload", {cancelable:true}); window.dispatchEvent(unload);
    assert(unload.defaultPrevented, "staged historical changes lack reload protection");
    change("recordDate", "2026-10-21"); input("finishTime", "1721"); el("submitRecord").click();
    assert(historicalSession.records["2026-10-21"].finishTime === "17:21" && JSON.stringify(state) === transactionState && localStorage.getItem(STORAGE_KEY) === transactionStorage, "historical Submit wrote records before Resubmit");
    assert(C.recalculate(editableRecords(), state.settings)["2026-10-21"].progressiveFlex === C.recalculate(state.records, state.settings)["2026-10-21"].progressiveFlex + 90, "historical working balance did not recalculate using existing logic");
    el("cancelHistoricalSession").click();
    assert(!el("historicalDiscardModal").hidden && el("historicalDiscardTitle").textContent === "Discard historical changes?" && el("historicalDiscardMessage").textContent === "Any changes made during this editing session will be discarded. The timesheet will remain submitted and locked.", "historical discard confirmation is missing or has incorrect wording");
    const discardRect = el("historicalDiscardModal").querySelector(".dialog-card").getBoundingClientRect();
    assert(document.activeElement === el("keepHistoricalChanges") && document.querySelector("main").inert && discardRect.left >= 0 && discardRect.right <= innerWidth && discardRect.height <= innerHeight, "historical discard dialog focus or responsive bounds are incorrect");
    el("keepHistoricalChanges").click();
    assertPeriodBadges("To be submitted"); assertHistoricalReminder(true);
    assert(historicalSession && historicalSession.records["2026-10-08"].finishTime === "17:51" && el("historicalDiscardModal").hidden, "Keep Editing discarded working changes");
    el("cancelHistoricalSession").click(); el("discardHistoricalChanges").click();
    assertPeriodBadges("Submitted"); assertHistoricalReminder(false);
    assert(!historicalSession && !historicalEditAuthorization && submittedPeriodLocked() && el("resubmitHistoricalTimesheet").hidden && el("cancelHistoricalSession").hidden && JSON.stringify(state) === transactionState && localStorage.getItem(STORAGE_KEY) === transactionStorage, "Cancel failed to restore original submitted data and revoke permission");
    assert(!el("status").textContent.includes("This fortnight has already been submitted."), "Cancel restored removed inline warning");
    authoriseHistoricalPeriod("2026-10-08");
    input("finishTime", "1751"); el("saveDraft").click();
    input("finishTime", "2500"); el("resubmitHistoricalReminder").click();
    assertPeriodBadges("To be submitted"); assertHistoricalReminder(true);
    assert(historicalSession && localStorage.getItem(STORAGE_KEY) === transactionStorage && el("finishTime").value.replace(":", "") === "2500", "failed validation wrote data or lost historical input/permission");
    input("finishTime", "1751");
    const storageSetBeforeFailure = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key,value) { if (key === STORAGE_KEY) throw new DOMException("Isolated quota failure", "QuotaExceededError"); return storageSetBeforeFailure.call(this,key,value); };
    try { el("resubmitHistoricalReminder").click(); } finally { Storage.prototype.setItem = storageSetBeforeFailure; }
    assertPeriodBadges("To be submitted"); assertHistoricalReminder(true);
    assert(historicalSession && historicalEditAllowed(activeDate) && JSON.stringify(state) === transactionState && localStorage.getItem(STORAGE_KEY) === transactionStorage && el("status").textContent.includes("could not be saved"), "storage failure caused a partial write, false success or lost permission");
    localStorage.setItem(STORAGE_KEY, transactionStorage + " "); el("resubmitHistoricalTimesheet").click();
    assert(historicalSession && el("status").textContent.includes("changed after editing began") && localStorage.getItem(STORAGE_KEY) === transactionStorage + " ", "external storage conflict was overwritten");
    localStorage.setItem(STORAGE_KEY, transactionStorage);
    deleteRecord("2026-10-21");
    assert(!editableRecords()["2026-10-21"] && state.records["2026-10-21"] && localStorage.getItem(STORAGE_KEY) === transactionStorage, "historical deletion changed the submitted record before resubmission");
    const oldPermission = historicalEditAuthorization.id;
    const setItem = Storage.prototype.setItem; let historicalWrites = 0;
    Storage.prototype.setItem = function(key,value) { if (key === STORAGE_KEY) historicalWrites++; return setItem.call(this,key,value); };
    try { el("resubmitHistoricalTimesheet").click(); } finally { Storage.prototype.setItem = setItem; }
    assert(historicalWrites === 1 && !historicalSession && !historicalEditAuthorization && submittedPeriodLocked(), "successful resubmission was not one atomic write followed by relocking");
    assertPeriodBadges("Submitted"); assertHistoricalReminder(false);
    const afterHistoricalStorage = localStorage.getItem(STORAGE_KEY);
    for (const trigger of ["saveDraft","submitRecord"]) {
      el(trigger).click();
      assert(!el("submittedWarningModal").hidden && localStorage.getItem(STORAGE_KEY) === afterHistoricalStorage, "ordinary Save/Submit protection did not resume after historical resubmission");
      el("dismissSubmittedWarning").click();
    }
    assert(state.records["2026-10-08"].finishTime === "17:51" && !state.records["2026-10-21"] && state.submissions["2026-10-08"].submitted && !state.submissions["2026-10-08"].changed && state.submissions["2026-10-08"].note === "preserve", "Resubmit did not commit authorised records and submission state");
    const approvedState = JSON.parse(transactionState), committedState = JSON.stringify(state);
    assert(recordsEqual(state.records["2026-10-22"], approvedState.records["2026-10-22"]) && recordsEqual(state.records["2026-11-05"], approvedState.records["2026-11-05"]) && recordsEqual(state.submissions["2026-10-22"], approvedState.submissions["2026-10-22"]) && recordsEqual(state.settings, approvedState.settings), "resubmission modified unrelated periods or settings");
    assert(!commitRecordSubmission({date:activeDate,candidateRecord:{...exportRecord,finishTime:"19:00"},previous:clone(state.records[activeDate]),historicalAuthorization:oldPermission}) && JSON.stringify(state) === committedState, "stale permission allowed a post-resubmission write");
    assert(el("status").textContent.includes("resubmitted successfully") && !el("status").textContent.includes("This fortnight has already been submitted."), "resubmission feedback is missing or removed warning returned");
    authoriseHistoricalPeriod("2026-10-08"); input("finishTime", "1821"); el("saveDraft").click();
    change("recordDate", "2026-10-22");
    assert(!el("historicalDiscardModal").hidden && activeDate === "2026-10-08" && !historicalEditAllowed("2026-10-22"), "date switching transferred historical permission or silently discarded changes");
    el("keepHistoricalChanges").click();
    change("recordDate", "2026-10-22"); el("discardHistoricalChanges").click();
    assert(activeDate === "2026-10-22" && !historicalSession && submittedPeriodLocked() && JSON.stringify(state) === committedState, "discard-and-navigate changed saved records or transferred permission");
    authoriseHistoricalPeriod("2026-10-08"); el("cancelHistoricalSession").click();
    assert(!historicalSession && el("historicalDiscardModal").hidden, "clean historical Cancel unnecessarily prompted or retained permission");
    authoriseHistoricalPeriod("2026-10-08");
    change("recordDate", "2026-10-10"); input("startTime", "0900"); input("lunchOut", "1200"); input("lunchIn", "1300"); input("finishTime", "1700");
    el("resubmitHistoricalTimesheet").click();
    assert(!el("workConfirmationModal").hidden && historicalSession && !state.records["2026-10-10"], "historical Resubmit bypassed existing weekend confirmation");
    const pendingHistoricalConfirmation = pendingRecordSubmission;
    el("resubmitHistoricalReminder").click(); el("resubmitHistoricalTimesheet").click();
    assert(pendingRecordSubmission === pendingHistoricalConfirmation, "duplicate Resubmit clicks restarted an in-progress confirmation");
    el("cancelSpecialWork").click();
    assert(historicalSession && !state.records["2026-10-10"] && activeDate === "2026-10-10", "declining weekend confirmation lost historical session");
    el("resubmitHistoricalTimesheet").click(); el("confirmSpecialWork").click();
    assert(!historicalSession && state.records["2026-10-10"]?.finishTime === "17:00" && submittedPeriodLocked(), "confirmed weekend historical resubmission failed");
    assertPeriodBadges("Submitted"); assertHistoricalReminder(false);
    authoriseHistoricalPeriod("2026-10-08"); input("finishTime", "1821"); el("submitRecord").click();
    assert(el("status").textContent === "Changes saved to the historical working draft. Resubmit to commit them.", "historical working-draft success notification changed");
    let upperWrites = 0;
    Storage.prototype.setItem = function(key,value) { if (key === STORAGE_KEY) { upperWrites++; el("resubmitHistoricalTimesheet").click(); } return setItem.call(this,key,value); };
    try { el("resubmitHistoricalReminder").click(); el("resubmitHistoricalReminder").click(); el("resubmitHistoricalTimesheet").click(); } finally { Storage.prototype.setItem = setItem; }
    assert(upperWrites === 1 && !historicalSession && state.records["2026-10-08"].finishTime === "18:21", "upper Resubmit failed to commit the same draft exactly once or permit re-entry");
    assertPeriodBadges("Submitted"); assertHistoricalReminder(false);
    for (const date of ["2026-10-07", todayISO(), C.addDays(periodFor(todayISO()).start, 14), "2026-10-08"]) {
      loadRecord(date, true); assertPeriodBadges(fortnightStatusFor(periodFor(date).start));
    }
    const beforeFutureSession = clone(state), beforeFutureStorage = localStorage.getItem(STORAGE_KEY);
    const futureSubmittedStart = C.addDays(periodFor(todayISO()).start, 14);
    state.records[futureSubmittedStart] = clone(exportRecord); state.submissions[futureSubmittedStart] = {submitted:true,changed:false};
    save(); loadRecord(futureSubmittedStart, true);
    authoriseHistoricalPeriod(futureSubmittedStart);
    assertPeriodBadges("To be submitted"); assertHistoricalReminder(true);
    el("cancelHistoricalSession").click();
    assertPeriodBadges("Submitted"); assertHistoricalReminder(false);
    state = beforeFutureSession; localStorage.setItem(STORAGE_KEY, beforeFutureStorage); renderSettings(); loadRecord("2026-10-08", true);
    loadRecord("2026-11-05", true); clearRecordForm(); input("startTime", "0900"); el("saveDraft").click();
    assert(el("status").textContent === "Draft saved" && state.drafts["2026-11-05"].record.startTime === "09:00", "ordinary unsubmitted draft Save or success notification regressed");
    loadRecord("2026-10-08", true);
    assert(el("recordsBody").querySelectorAll("[data-edit],[data-delete]").length === 0 && !el("status").textContent.includes("This fortnight has already been submitted."), "relocked records exposed actions or removed inline warning");
    const afterTransactionStorage = localStorage.getItem(STORAGE_KEY);
    deleteRecord("2026-10-08");
    assert(localStorage.getItem(STORAGE_KEY) === afterTransactionStorage && !requestRecordOpen("2026-10-08", "edit"), "direct row mutation handlers bypassed submitted protection");
    authoriseHistoricalPeriod("2026-10-08"); input("finishTime", "1821"); el("saveDraft").click();
    change("viewFortnight", "2026-10-22");
    assert(!el("historicalDiscardModal").hidden && historicalSession.start === "2026-10-08" && !historicalEditAllowed("2026-10-22"), "historical selectors transferred permission or dropped staged changes");
    el("keepHistoricalChanges").click();
    assert(historicalStart === "2026-10-08" && el("viewFortnight").value === "2026-10-08", "Keep Editing did not restore the selected historical fortnight");
    el("cancelHistoricalSession").click(); el("discardHistoricalChanges").click();
    loadRecord("2026-11-06", true); input("startTime", "0915");
    authoriseHistoricalPeriod("2026-10-08");
    assert(state.drafts["2026-11-06"].record.startTime === "09:15" && historicalSession, "historical entry discarded unsaved ordinary Daily Entry work");
    el("cancelHistoricalSession").click();
    authoriseHistoricalPeriod("2026-11-05");
    assert(!historicalSession && historicalEditAllowed("2026-11-05") && el("resubmitHistoricalTimesheet").hidden && el("cancelHistoricalSession").hidden, "ordinary unsubmitted historical workflow incorrectly acquired submitted-session controls");
    revokeHistoricalEdit(); loadRecord("2026-10-08", true);
    change("viewFortnight", "2026-11-19");
    const emptyPeriodState = JSON.stringify(state);
    el("editHistoricalTimesheet").click(); el("confirmHistoricalEdit").click();
    assert(!historicalSession && !historicalEditAuthorization && el("historicalEditStatus").textContent.includes("No saved records") && JSON.stringify(state) === emptyPeriodState, "empty historical period created records or granted permission");
    // Saved submission IDs from the old DST calculation must not revoke or block
    // authorisation for the selected current calendar fortnight.
    const legacyRecord = {...emptyRecord("Flextime"), startTime:"09:00", lunchOut:"12:00", lunchIn:"13:00", finishTime:"17:00"};
    const historicalIdCases = [
      ["canonical", {"2026-10-08":{submitted:true,changed:false,note:"canonical"}}],
      ["legacy only", {"2026-10-09":{submitted:true,changed:false,note:"legacy"}}],
      ["legacy inserted first", {"2026-10-09":{submitted:true,changed:false,note:"legacy"}, "2026-10-08":{submitted:true,changed:false,note:"canonical"}}],
      ["canonical inserted first", {"2026-10-08":{submitted:true,changed:false,note:"canonical"}, "2026-10-09":{submitted:true,changed:false,note:"legacy"}}]
    ];
    for (const [caseName, statuses] of historicalIdCases) {
      revokeHistoricalEdit(); state = clone(defaults); state.settings.fortnightStart = "2026-09-24";
      state.records = Object.fromEntries(["2026-10-08","2026-10-15","2026-10-16","2026-10-21","2026-10-22"].map(date => [date,clone(legacyRecord)]));
      state.submissions = caseName === "legacy only" ? clone(statuses) : {...clone(statuses), "2026-10-23":{submitted:true,changed:false,note:"other period"}};
      state.drafts = {"2026-11-06":{record:{...legacyRecord,startTime:"10:00"},editMode:false}}; state.activeDraftDate = "2026-11-06";
      save(); renderSettings(); loadRecord("2026-10-15", true);
      const originalState = JSON.stringify(state), originalStorage = localStorage.getItem(STORAGE_KEY), originalStateValue = clone(state);
      assertPeriodBadges("Submitted");
      assert(submittedPeriodLocked("2026-10-08"), `${caseName}: the canonical first date was left unprotected`);
      if (caseName === "legacy only") assert(submittedPeriodLocked("2026-10-22") && !submittedPeriodLocked("2026-10-23"), "legacy stored-range protection was weakened or extended into unrelated unsubmitted dates");
      assert(el("submittedWarningModal").hidden, `${caseName}: viewing a submitted date showed a warning`);
      for (const trigger of ["saveDraft","submitRecord"]) {
        el(trigger).click(); assert(!el("submittedWarningModal").hidden && localStorage.getItem(STORAGE_KEY) === originalStorage, `${caseName}: normal Save/Submit bypassed protection`); el("dismissSubmittedWarning").click();
      }
      authoriseHistoricalPeriod("2026-10-08");
      const permissionId = historicalEditAuthorization.id;
      assert(historicalSession?.start === "2026-10-08" && !submittedPeriodLocked() && !el("historicalSubmittedNotice").hidden, `${caseName}: confirmation did not create a submitted working session`);
      assertPeriodBadges("To be submitted");
      change("recordDate", "2026-10-15"); input("finishTime", "1730"); el("saveDraft").click();
      assert(el("submittedWarningModal").hidden && historicalSession.records["2026-10-15"].finishTime === "17:30", `${caseName}: authorised Save was blocked`);
      change("recordDate", "2026-10-16"); input("finishTime", "1800"); el("submitRecord").click();
      assert(el("submittedWarningModal").hidden && historicalSession.records["2026-10-16"].finishTime === "18:00", `${caseName}: authorised Save Changes was blocked`);
      renderAll(); renderAll(); loadRecord("2026-10-15", true, "edit");
      assert(historicalEditAuthorization.id === permissionId && historicalEditAllowed(activeDate) && el("finishTime").value === "17:30", `${caseName}: date/form reload lost permission or the working draft`);
      for (const [date, finish] of [["2026-10-08","17:15"],["2026-10-21","17:45"]]) {
        change("recordDate", date); input("finishTime", finish); el("submitRecord").click();
        assert(el("submittedWarningModal").hidden && historicalSession.records[date].finishTime === finish, `${caseName}: selected-period boundary date was not editable`);
      }
      assert(JSON.stringify(state) === originalState && localStorage.getItem(STORAGE_KEY) === originalStorage, `${caseName}: historical Save/Save Changes modified the submitted snapshot`);
      assert(!historicalEditAllowed("2026-10-22") && !ensureRecordWritable("2026-10-22"), `${caseName}: permission extended to another submitted fortnight`);
      deleteRecord("2026-10-22");
      assert(state.records["2026-10-22"] && localStorage.getItem(STORAGE_KEY) === originalStorage, `${caseName}: another submitted fortnight was modified`);
      el("cancelHistoricalSession").click(); el("keepHistoricalChanges").click();
      assert(historicalEditAuthorization.id === permissionId && historicalSession.records["2026-10-15"].finishTime === "17:30", `${caseName}: Keep Editing discarded permission or draft`);
      el("cancelHistoricalSession").click(); el("discardHistoricalChanges").click();
      assert(!historicalSession && !historicalEditAuthorization && JSON.stringify(state) === originalState && localStorage.getItem(STORAGE_KEY) === originalStorage, `${caseName}: Cancel failed to restore the exact submitted snapshot`);
      assertPeriodBadges("Submitted");
      el("saveDraft").click(); assert(!el("submittedWarningModal").hidden, `${caseName}: Cancel did not restore the warning`); el("dismissSubmittedWarning").click();
      authoriseHistoricalPeriod("2026-10-08"); input("finishTime", "1731"); el("saveDraft").click();
      change("recordDate", "2026-10-22");
      assert(!el("historicalDiscardModal").hidden && !historicalEditAllowed("2026-10-22"), `${caseName}: switching periods transferred permission`);
      el("discardHistoricalChanges").click();
      assert(activeDate === "2026-10-22" && !historicalSession && submittedPeriodLocked(), `${caseName}: another submitted fortnight was not relocked`);
      for (const trigger of ["saveDraft","submitRecord"]) { el(trigger).click(); assert(!el("submittedWarningModal").hidden, `${caseName}: switched period bypassed protection`); el("dismissSubmittedWarning").click(); }
      assert(localStorage.getItem(STORAGE_KEY) === originalStorage, `${caseName}: cancellation or navigation changed storage`);
      authoriseHistoricalPeriod("2026-10-08"); change("recordDate", "2026-10-15"); input("finishTime", "1800"); el("submitRecord").click();
      const resubmitId = historicalEditAuthorization.id, beforeResubmit = C.recalculate(state.records, state.settings)["2026-10-21"].progressiveFlex;
      if (caseName === "legacy only") {
        const legacySetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key,value) { if (key === STORAGE_KEY) throw new DOMException("Isolated legacy resubmission failure", "QuotaExceededError"); return legacySetItem.call(this,key,value); };
        try { el("resubmitHistoricalReminder").click(); } finally { Storage.prototype.setItem = legacySetItem; }
        assert(historicalSession && historicalEditAllowed(activeDate) && historicalSession.records[activeDate].finishTime === "18:00" && JSON.stringify(state) === originalState && localStorage.getItem(STORAGE_KEY) === originalStorage, "failed legacy resubmission lost the working draft, snapshot or permission");
        const legacyNote = state.submissions["2026-10-09"].note;
        state.submissions["2026-10-09"].note = "changed during editing";
        el("resubmitHistoricalReminder").click();
        assert(historicalSession && el("status").textContent.includes("changed after editing began") && localStorage.getItem(STORAGE_KEY) === originalStorage, "changed legacy submission metadata bypassed the transaction conflict guard");
        state.submissions["2026-10-09"].note = legacyNote;
        assertPeriodBadges("To be submitted");
      }
      const originalSet = Storage.prototype.setItem; let resubmitWrites = 0;
      Storage.prototype.setItem = function(key,value) { if (key === STORAGE_KEY) resubmitWrites++; return originalSet.call(this,key,value); };
      try { el(caseName === "legacy only" ? "resubmitHistoricalReminder" : "resubmitHistoricalTimesheet").click(); } finally { Storage.prototype.setItem = originalSet; }
      assert(resubmitWrites === 1 && !historicalSession && !historicalEditAuthorization && state.records["2026-10-15"].finishTime === "18:00", `${caseName}: Resubmit failed to commit and relock atomically`);
      assert(state.submissions["2026-10-08"].submitted && !state.submissions["2026-10-08"].changed && C.recalculate(state.records,state.settings)["2026-10-21"].progressiveFlex === beforeResubmit + 60, `${caseName}: resubmission status or recalculated balance is wrong`);
      for (const key of Object.keys(originalStateValue.submissions).filter(key => key !== "2026-10-08")) assert(recordsEqual(state.submissions[key],originalStateValue.submissions[key]), `${caseName}: unrelated/legacy submission metadata changed`);
      assert(recordsEqual(state.records["2026-10-22"],originalStateValue.records["2026-10-22"]) && recordsEqual(state.drafts,originalStateValue.drafts) && recordsEqual(state.settings,originalStateValue.settings), `${caseName}: unrelated records, saved drafts or settings changed`);
      assertPeriodBadges("Submitted");
      const committedStorage = localStorage.getItem(STORAGE_KEY);
      for (const trigger of ["saveDraft","submitRecord"]) { el(trigger).click(); assert(!el("submittedWarningModal").hidden && localStorage.getItem(STORAGE_KEY) === committedStorage, `${caseName}: normal writes were allowed after Resubmit`); el("dismissSubmittedWarning").click(); }
      loadRecord("2026-11-09", true);
      assert(!commitRecordSubmission({date:activeDate,candidateRecord:clone(legacyRecord),previous:null,existed:false,wasEditMode:false,historicalAuthorization:resubmitId}) && localStorage.getItem(STORAGE_KEY) === committedStorage, `${caseName}: a revoked historical token committed a stale entry`);
      input("startTime", "0900"); el("saveDraft").click();
      assert(el("submittedWarningModal").hidden && state.drafts["2026-11-09"].record.startTime === "09:00", `${caseName}: an unsubmitted draft was blocked`);
      input("lunchOut", "1200"); input("lunchIn", "1300"); input("finishTime", "1700"); el("submitRecord").click();
      assert(el("submittedWarningModal").hidden && state.records["2026-11-09"].finishTime === "17:00", `${caseName}: an unsubmitted record was blocked`);
    }
    // A shifted preceding range can protect only the first date of the selected
    // calendar fortnight; its raw key must still create a working transaction.
    revokeHistoricalEdit(); state = clone(defaults); state.settings.fortnightStart = "2026-09-24";
    state.records = {"2026-10-08":clone(legacyRecord), "2026-10-15":clone(legacyRecord)};
    state.submissions = {"2026-09-25":{submitted:true,changed:false,note:"preceding legacy range"}};
    save(); renderSettings(); loadRecord("2026-10-08", true);
    const precedingSnapshot = JSON.stringify(state), precedingStored = localStorage.getItem(STORAGE_KEY);
    assert(submittedPeriodLocked() && !submittedPeriodLocked("2026-10-15"), "legacy boundary fixture does not preserve its original protected dates");
    el("saveDraft").click(); assert(!el("submittedWarningModal").hidden, "preceding submitted range allowed an ordinary write"); el("dismissSubmittedWarning").click();
    authoriseHistoricalPeriod("2026-10-08"); input("finishTime", "1730"); el("submitRecord").click();
    assert(historicalSession && historicalEditAllowed(activeDate) && el("submittedWarningModal").hidden && historicalSession.records["2026-10-08"].finishTime === "17:30", "overlapping preceding range blocked authorised Save Changes");
    change("recordDate", "2026-10-15"); input("finishTime", "1800"); el("saveDraft").click();
    assert(historicalSession && historicalEditAllowed(activeDate) && historicalSession.records["2026-10-15"].finishTime === "18:00" && JSON.stringify(state) === precedingSnapshot && localStorage.getItem(STORAGE_KEY) === precedingStored, "mixed submitted/unsubmitted dates escaped the selected historical transaction");
    el("cancelHistoricalSession").click(); el("discardHistoricalChanges").click();
    assert(!historicalSession && JSON.stringify(state) === precedingSnapshot && localStorage.getItem(STORAGE_KEY) === precedingStored && submittedPeriodLocked("2026-10-08") && !submittedPeriodLocked("2026-10-15"), "Cancel changed the preceding snapshot or unrelated unsubmitted-date permissions");
    // Footer copy is local-storage verified, pure white and high contrast over the existing background.
    const privacy = document.querySelector(".privacy-disclaimer"), privacyBody = privacy.querySelector("p");
    assert(privacy.nextElementSibling.classList.contains("feedback-entry") && privacy.parentElement.tagName === "FOOTER" && privacy.querySelector("h2").textContent === "Privacy & Data Storage", "Feedback is not directly below the privacy disclaimer");
    const feedbackRect = el("openFeedback").getBoundingClientRect(), footerRect = privacy.parentElement.getBoundingClientRect();
    assert(Math.abs((feedbackRect.left + feedbackRect.right) / 2 - (footerRect.left + footerRect.right) / 2) < .02 && feedbackRect.width < footerRect.width / 2 && feedbackRect.top > privacy.getBoundingClientRect().bottom, "Feedback is not compact, centred beneath the disclaimer");
    assert(privacyBody.textContent === "Your timesheet data is stored locally in your browser and is not uploaded to the cloud. Records do not sync across devices, so please use the same device and browser. Avoid entering sensitive personal information and export your records regularly for backup.", "privacy wording changed");
    const bodyStyle = getComputedStyle(privacyBody), headingStyle = getComputedStyle(privacy.querySelector("h2"));
    assert(bodyStyle.color === "rgb(255, 255, 255)" && headingStyle.color === "rgb(255, 255, 255)" && bodyStyle.opacity === "1" && headingStyle.opacity === "1", "privacy text must be opaque pure white");
    const background = getComputedStyle(document.body).backgroundColor.match(/\d+/g).slice(0, 3).map(Number);
    const linear = background.map(value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
    const contrast = 1.05 / (.2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2] + .05);
    assert(contrast >= 4.5 && parseFloat(bodyStyle.fontSize) >= 13 && parseFloat(bodyStyle.fontSize) <= 14 && parseInt(headingStyle.fontWeight) > parseInt(bodyStyle.fontWeight), "privacy contrast or typography is insufficient");
    assert(getComputedStyle(privacy).backgroundColor === "rgba(0, 0, 0, 0)" && privacy.scrollWidth <= privacy.clientWidth, "privacy disclaimer introduced a box or overflow");
    window.scrollTo(0, 0);
    result.textContent = "PASS: Copy Previous record date summary colours attendance settings Leave TOIL welcome Feedback shared durations email CSV validation synchronized calculations responsive workflow";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
  } finally { restore(); }
})();
