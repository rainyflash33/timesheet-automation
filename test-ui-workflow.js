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
    assert(el("leaveToilPanel").hidden && el("toggleLeaveToil").getAttribute("aria-expanded") === "false", "new-record Leave / TOIL panel did not start collapsed");
    assert(!el("attendanceType") && el("attendanceTypeSetting").value === "Flextime", "Attendance Type was not moved from the daily form into Settings");
    assert([...document.querySelector(".settings .form-grid").querySelectorAll("label")].slice(0, 4).map(label => label.childNodes[0].textContent.trim()).join("|") === "Attendance Type|Fortnight start date|Opening Flex Balance|Opening TOIL Balance", "Settings fields are not in the required order");

    assert(!el("welcomeModal").hidden, "welcome disclaimer did not open on page load");
    assert(el("welcomeModal").textContent.includes("Clocky is for personal use only.") && el("welcomeModal").textContent.includes("Please do not enter any confidential, sensitive, or work-related information."), "welcome disclaimer text is incorrect");
    let modalRect = el("welcomeModal").querySelector(".dialog-card").getBoundingClientRect();
    assert(modalRect.left >= 0 && modalRect.right <= innerWidth && modalRect.height <= innerHeight, "welcome disclaimer is not contained by the viewport");
    el("closeWelcome").click(); assert(el("welcomeModal").hidden, "welcome disclaimer did not close");

    assert(getComputedStyle(el("status")).color === "rgb(243, 240, 255)", "Record Date status text does not use the high-contrast lavender colour");
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
    el("settingsToggle").click();
    assert(!el("settingsContent").hidden, "Settings did not expand when its header was clicked");

    input("startTime", "0900"); input("lunchOut", "1200"); input("lunchIn", "1300"); input("finishTime", "1721");
    assert(el("leaveToilPanel").hidden, "normal working day unexpectedly expanded Leave / TOIL");
    el("submitRecord").click();
    assert(state.records[activeDate]?.finishTime === "17:21" && state.records[activeDate]?.attendanceType === "Flextime", "normal working day did not submit with the Attendance Type default");
    el("recordsBody").querySelector(`[data-delete="${activeDate}"]`).click();
    assert(el("leaveToilPanel").hidden, "normal working day cleanup expanded Leave / TOIL");

    const assertRecordFormCleared = message => {
      assert(recordsEqual(readForm(), emptyRecord(state.settings.attendanceType)), `${message}: record fields were not reset`);
      assert(el("attendanceTypeSetting").value === state.settings.attendanceType, `${message}: persistent Attendance Type changed`);
      assert(el("interruptionEditor").hidden && el("interruptionList").hidden, `${message}: Additional Time Entry UI remained visible`);
      assert(!el("interruptionOut").value && !el("interruptionIn").value, `${message}: Additional Time Entry editor values remained`);
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
    el("toggleInterruptions").click(); input("interruptionOut", "1000"); input("interruptionIn", "1030"); el("saveInterruption").click();
    el("toggleInterruptions").click(); input("interruptionOut", "1500"); input("interruptionIn", "1530"); el("saveInterruption").click();
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

    // End-to-end Saturday diagnostic and hard-gate test through the real controls and Submit button.
    change("recordDate", "2026-08-22"); el("toggleLeaveToil").click(); change("leaveType", "Annual"); change("leaveHours", "721"); el("toggleLeaveToil").click();
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
    assert(state.records["2026-08-22"] === undefined && JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-22"] === undefined, "Go Back saved the Saturday record");
    el("submitRecord").click(); el("confirmSpecialWork").click();
    assert(Boolean(state.records["2026-08-22"]) && Boolean(JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-22"]), "Confirm did not save the captured Saturday record");
    delete state.records["2026-08-22"]; save();

    // The same hard gate must hold for Sunday.
    change("recordDate", "2026-08-23"); el("toggleLeaveToil").click(); change("leaveType", "Annual"); change("leaveHours", "721"); el("submitRecord").click();
    assert(!el("workConfirmationModal").hidden && state.records["2026-08-23"] === undefined && JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-23"] === undefined, "Sunday record bypassed confirmation");
    el("cancelSpecialWork").click();
    assert(el("leaveType").value === "Annual" && el("leaveHours").value === "7:21" && state.records["2026-08-23"] === undefined, "Sunday Go Back lost the draft or saved it");
    el("submitRecord").click(); el("confirmSpecialWork").click();
    assert(Boolean(state.records["2026-08-23"]) && Boolean(JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-23"]), "Sunday Confirm did not save the record");
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
    change("openingFlex", "-130"); assert(el("openingFlex").value === "-1:30", "negative Opening Flex did not format"); change("openingFlex", "0:00");
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
    submitRecord();
    assert(localStorage.getItem(STORAGE_KEY) === beforeInvalidTimeSave, "invalid manual time was saved");
    input("finishTime", "1721");
    assert(el("finishTime").value === "17:21" && el("finishTimeError").hidden, "corrected time did not format or clear its error");
    el("toggleInterruptions").click();
    input("interruptionOut", "1015"); input("interruptionIn", "1040");
    assert(el("interruptionOut").value === "10:15" && el("interruptionIn").value === "10:40", "Additional Time Entry digits were not formatted");
    input("interruptionIn", "1265");
    assert(!el("interruptionInError").hidden, "invalid Additional Time Entry did not show an inline error");
    el("cancelInterruption").click();
    assert(el("submitRecord").textContent === "Submit", "new record is not in Submit mode");
    el("submitRecord").click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.records[activeDate].finishTime === "17:21", "new record was not persisted");
    assert(stored.records[activeDate].attendanceType === "Flextime", "new record did not use the saved Attendance Type setting");
    assert(el("recordsBody").textContent.includes(formatDisplayDate(activeDate)), "new record missing from history");
    assert(el("submitRecord").textContent === "Submit", "submit did not return to new-record mode");

    setSettingsExpanded(true); change("attendanceTypeSetting", "Senior Officer A/B"); el("saveSettings").click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.settings.attendanceType === "Senior Officer A/B" && draft.attendanceType === "Senior Officer A/B", "Attendance Type setting was not saved or applied to new records");
    assert(stored.records[activeDate].attendanceType === "Flextime", "changing Attendance Type rewrote a historical record");
    assert(metric("dailyResults", "Daily SOG Balance") !== undefined && metric("dailyResults", "Daily Flex Balance") === undefined, "Senior Officer mode did not replace Flex results with SOG results");
    assert([...el("leaveType").options].find(option => option.value === "Flex")?.disabled, "Flex Leave remained selectable for Senior Officer A/B");
    assert(metric("fortnightResults", "Opening SOG Balance") !== undefined && metric("fortnightResults", "Opening Flex Balance") === undefined, "Senior Officer fortnight summary retained Flex-specific labels");
    input("startTime", "0900"); el("clearRecord").click();
    assert(draft.attendanceType === "Senior Officer A/B" && el("attendanceTypeSetting").value === "Senior Officer A/B" && el("leaveToilPanel").hidden, "Clear reset the persistent Attendance Type setting");

    el("recordsBody").querySelector(`[data-edit="${activeDate}"]`).click();
    assert(draft.attendanceType === "Flextime", "editing a historical record did not preserve its Attendance Type");
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

    el("recordsBody").querySelector(`[data-edit="${activeDate}"]`).click();
    assert(el("submitRecord").textContent === "Save Changes", "Edit did not enter edit mode");
    assert(!el("cancelEdit").hidden, "Cancel Edit is hidden in edit mode");
    input("finishTime", "17:31"); el("cancelEdit").click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.records[activeDate].finishTime === "17:21", "Cancel Edit changed stored data");
    assert(el("submitRecord").textContent === "Submit", "Cancel Edit did not leave edit mode");

    el("recordsBody").querySelector(`[data-edit="${activeDate}"]`).click();
    input("finishTime", "17:31"); el("submitRecord").click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.records[activeDate].finishTime === "17:31", "edited record was not persisted");
    assert(el("submitRecord").textContent === "Submit", "Save Changes did not leave edit mode");

    el("recordsBody").querySelector(`[data-delete="${activeDate}"]`).click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(!stored.records[activeDate], "deleted record remains in storage");

    setSettingsExpanded(true); change("attendanceTypeSetting", "Flextime"); el("saveSettings").click();

    input("startTime", "0900"); input("lunchOut", "1200"); input("lunchIn", "1300"); input("finishTime", "1721");
    el("toggleInterruptions").click();
    assert(el("interruptionEditorTitle").textContent === "Morning Additional Time Entry", "first Additional Time Entry did not open the Morning editor");
    input("interruptionOut", "1100"); input("interruptionIn", "1130"); el("saveInterruption").click();
    assert(draft.morningOut === "11:00" && !draft.afternoonOut, "Morning Additional Time Entry was not saved independently");
    assert(!el("toggleInterruptions").hidden && metric("dailyResults", "Daily Hours") === "6:51", "Morning-only entry or second-entry action is incorrect");
    el("toggleInterruptions").click();
    assert(el("interruptionEditorTitle").textContent === "Afternoon Additional Time Entry", "second Additional Time Entry did not open the Afternoon editor");
    input("interruptionOut", "1500"); input("interruptionIn", "1520"); el("saveInterruption").click();
    assert(draft.afternoonOut === "15:00" && draft.afternoonIn === "15:20", "Afternoon Additional Time Entry was not saved independently");
    assert(el("interruptionList").textContent.includes("Morning Additional Time Entry") && el("interruptionList").textContent.includes("Afternoon Additional Time Entry"), "saved entries are not labelled Morning and Afternoon");
    assert(el("toggleInterruptions").hidden, "Add Additional Time Entry remained available after both slots were saved");
    assert(metric("dailyResults", "Daily Hours") === "6:31", "both Additional Time Entries were not subtracted from Daily Hours");
    assert(metric("dailyResults", "Daily Flex Balance") === "-0:50", "both Additional Time Entries were not included in Daily Flex");
    el("interruptionList").querySelector("[data-edit-interruption='morning']").click(); input("interruptionIn", "1120"); el("saveInterruption").click();
    assert(draft.morningIn === "11:20" && draft.afternoonOut === "15:00" && draft.afternoonIn === "15:20", "editing Morning affected Afternoon");
    assert(metric("dailyResults", "Daily Hours") === "6:41", "editing Morning did not refresh Daily Hours");
    el("interruptionList").querySelector("[data-remove-interruption='morning']").click();
    assert(!draft.morningOut && !draft.morningIn && draft.afternoonOut === "15:00" && draft.afternoonIn === "15:20", "removing Morning affected Afternoon");
    assert(!el("toggleInterruptions").hidden && metric("dailyResults", "Daily Hours") === "7:01", "removing Morning did not restore the slot or calculations");
    assert(metric("dailyResults", "Progressive Flex Balance") === "-0:20", "Additional Time Entry preview Progressive Flex is stale");
    assert(metric("dailyResults", "Progressive TOIL Balance") === "0:00", "Additional Time Entry preview TOIL is incorrect");
    assert(metric("fortnightResults", "Hours Recorded This Period") === "7:01", "Fortnight hours do not match the two-entry preview");
    assert(metric("fortnightResults", "Net Flex for the Period") === "-0:20", "Fortnight flex does not match the two-entry preview");
    el("submitRecord").click();
    assert(metric("dailyResults", "Daily Hours") === "7:01", "Daily Hours became stale after Submit");
    assert(metric("dailyResults", "Daily Flex Balance") === "-0:20", "Daily Flex became stale after Submit");
    el("recordsBody").querySelector(`[data-edit="${activeDate}"]`).click();
    el("interruptionList").querySelector("[data-edit-interruption='afternoon']").click(); input("interruptionIn", "1510"); el("saveInterruption").click();
    assert(metric("dailyResults", "Daily Hours") === "7:11" && metric("dailyResults", "Daily Flex Balance") === "-0:10" && metric("fortnightResults", "Hours Recorded This Period") === "7:11" && metric("fortnightResults", "Net Flex for the Period") === "-0:10", "Editing Afternoon did not update both displays");
    el("interruptionList").querySelector("[data-remove-interruption='afternoon']").click();
    assert(metric("dailyResults", "Daily Hours") === "7:21" && metric("dailyResults", "Daily Flex Balance") === "0:00" && metric("fortnightResults", "Hours Recorded This Period") === "7:21" && metric("fortnightResults", "Net Flex for the Period") === "0:00", "Removing Afternoon did not update both displays");
    el("cancelEdit").click();
    el("recordsBody").querySelector(`[data-delete="${activeDate}"]`).click();

    setSettingsExpanded(true); change("attendanceTypeSetting", "Senior Officer A/B"); el("saveSettings").click();
    el("toggleLeaveToil").click(); change("toilHours", "100"); el("submitRecord").click();
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(stored.records[activeDate].toilHours === "1:00" && stored.records[activeDate].attendanceType === "Senior Officer A/B", "TOIL Hours earned or the new-record Attendance Type was not saved");
    assert(metric("dailyResults", "Progressive TOIL Balance") === "1:00", "saved TOIL Hours earned did not update the balance");
    el("recordsBody").querySelector(`[data-edit="${activeDate}"]`).click();
    assert(!el("leaveToilPanel").hidden && el("toilHours").value === "1:00", "editing a TOIL record did not reveal its saved value");
    el("cancelEdit").click(); el("recordsBody").querySelector(`[data-delete="${activeDate}"]`).click();

    assert(formatDisplayDate("2026-08-20") === "20-08-2026 Thu", "Thursday history date formatting is incorrect");
    assert(formatDisplayDate("2026-08-21") === "21-08-2026 Fri", "Friday history date formatting is incorrect");
    assert(formatDisplayDate("2026-08-23") === "23-08-2026 Sun", "Sunday history date formatting is incorrect");
    assert(`${formatDisplayDate("2026-08-20", "range")} to ${formatDisplayDate("2026-09-02", "range")}` === "20 Aug 2026 to 2 Sep 2026", "fortnight range date formatting is incorrect");

    const csvPackage = buildCsvPackage(viewStart);
    assert(csvPackage.rows.length === 15 && csvPackage.filename.endsWith(".csv"), "email CSV package does not contain the existing 14-day export");
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
    result.textContent = "PASS: attendance settings Leave TOIL welcome Feedback shared durations email CSV validation synchronized calculations responsive workflow";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
  } finally { restore(); }
})();
