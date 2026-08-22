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
    state = clone(defaults); activeDate = "2026-08-21"; viewStart = ""; editMode = false;
    renderSettings(); loadRecord(activeDate, true);

    assert(!el("welcomeModal").hidden, "welcome disclaimer did not open on page load");
    assert(el("welcomeModal").textContent.includes("Clocky is for personal use only.") && el("welcomeModal").textContent.includes("Please do not enter any confidential, sensitive, or work-related information."), "welcome disclaimer text is incorrect");
    let modalRect = el("welcomeModal").querySelector(".dialog-card").getBoundingClientRect();
    assert(modalRect.left >= 0 && modalRect.right <= innerWidth && modalRect.height <= innerHeight, "welcome disclaimer is not contained by the viewport");
    el("closeWelcome").click(); assert(el("welcomeModal").hidden, "welcome disclaimer did not close");
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
    assert(stored.settings.fortnightStart === "2026-08-20", "settings were not persisted");
    assert(el("settingsStatus").textContent === "Settings saved", "settings confirmation missing");
    assert(!el("submitRecord").disabled, "Submit remained disabled after saving Thursday");
    assert(el("settingsContent").hidden, "Settings did not collapse after a successful save");
    assert(el("settingsToggle").getAttribute("aria-expanded") === "false", "Settings toggle state is incorrect after save");
    el("settingsToggle").click();
    assert(!el("settingsContent").hidden, "Settings did not expand when its header was clicked");

    const noWork = emptyRecord();
    const working = {...noWork, startTime:"09:00", finishTime:"12:00"};
    assert(workConfirmationFor("2026-08-21", working) == null, "weekday work incorrectly triggered confirmation");
    assert(!hasMeaningfulTimesheetData(noWork), "blank/default record was treated as meaningful");
    assert(hasMeaningfulTimesheetData(working), "working time was not treated as meaningful");
    assert(hasMeaningfulTimesheetData({...noWork, leaveType:"Annual", leaveHours:"7:21"}), "Annual Leave was not treated as meaningful");
    assert(hasMeaningfulTimesheetData({...noWork, toilHours:"1:00"}), "TOIL was not treated as meaningful");
    assert(hasMeaningfulTimesheetData({...noWork, attendanceType:"Senior Officer A/B"}), "changed Attendance Type was not treated as meaningful");
    assert(hasMeaningfulTimesheetData({...noWork, afternoonOut:"15:00", afternoonIn:"15:30"}), "Additional Time Entry was not treated as meaningful");
    assert(workConfirmationFor("2026-08-21", {...noWork, leaveType:"Public Holiday", leaveHours:"7:21"})?.title === "Please confirm this public holiday entry", "Public Holiday additional data did not trigger confirmation");

    // End-to-end Saturday diagnostic and hard-gate test through the real controls and Submit button.
    change("recordDate", "2026-08-22"); change("leaveType", "Annual"); change("leaveHours", "721");
    let candidate = readForm();
    assert(activeDate === "2026-08-22" && DAY_NAMES[new Date(`${activeDate}T00:00:00`).getDay()] === "Saturday", "Saturday Record Date did not reach submit state");
    assert(candidate.leaveType === "Annual" && candidate.leaveHours === "7:21" && hasMeaningfulTimesheetData(candidate), "Saturday candidate was not read/normalised correctly");
    const storageBeforeSaturdaySubmit = JSON.parse(localStorage.getItem(STORAGE_KEY));
    el("submitRecord").click();
    assert(!el("workConfirmationModal").hidden, "Saturday Other Details did not open confirmation");
    assert(state.records["2026-08-22"] === undefined, "Saturday record mutated state before confirmation");
    assert(storageBeforeSaturdaySubmit.records["2026-08-22"] === undefined && JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-22"] === undefined, "Saturday record reached localStorage before confirmation");
    modalRect = el("workConfirmationModal").querySelector(".dialog-card").getBoundingClientRect();
    assert(modalRect.left >= 0 && modalRect.right <= innerWidth && modalRect.height <= innerHeight, "work confirmation is not contained by the viewport");
    el("cancelSpecialWork").click();
    assert(el("workConfirmationModal").hidden && el("leaveType").value === "Annual" && el("leaveHours").value === "7:21", "Go Back lost the Other Details draft");
    assert(state.records["2026-08-22"] === undefined && JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-22"] === undefined, "Go Back saved the Saturday record");
    el("submitRecord").click(); el("confirmSpecialWork").click();
    assert(Boolean(state.records["2026-08-22"]) && Boolean(JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-22"]), "Confirm did not save the captured Saturday record");
    delete state.records["2026-08-22"]; save();

    // The same hard gate must hold for Sunday.
    change("recordDate", "2026-08-23"); change("leaveType", "Annual"); change("leaveHours", "721"); el("submitRecord").click();
    assert(!el("workConfirmationModal").hidden && state.records["2026-08-23"] === undefined && JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-23"] === undefined, "Sunday record bypassed confirmation");
    el("cancelSpecialWork").click();
    assert(el("leaveType").value === "Annual" && el("leaveHours").value === "7:21" && state.records["2026-08-23"] === undefined, "Sunday Go Back lost the draft or saved it");
    el("submitRecord").click(); el("confirmSpecialWork").click();
    assert(Boolean(state.records["2026-08-23"]) && Boolean(JSON.parse(localStorage.getItem(STORAGE_KEY)).records["2026-08-23"]), "Sunday Confirm did not save the record");
    delete state.records["2026-08-23"]; save();
    loadRecord("2026-08-21", true);

    const durationCases = [["721","7:21"],["730","7:30"],["700","7:00"],["130","1:30"],["100","1:00"],["050","0:50"],["030","0:30"],["000","0:00"],["1000","10:00"],["1230","12:30"],["-50","-0:50"],["-130","-1:30"],["-721","-7:21"],["7:21","7:21"],["0:50","0:50"],["10:00","10:00"],["-0:50","-0:50"]];
    durationCases.forEach(([entered, expected]) => assert(normalizeDurationInput(entered) === expected, `${entered} did not normalize to ${expected}`));
    ["760","165","1260"].forEach(entered => assert(!durationIsValid(normalizeDurationInput(entered)), `${entered} was accepted as a duration`));
    assert(document.querySelectorAll("[data-duration]").length === 11, "not all duration fields use the shared formatter");
    change("leaveHours", "721"); assert(el("leaveHours").value === "7:21", "Leave Hours did not format without a leading zero"); input("leaveHours", "");
    change("openingFlex", "-130"); assert(el("openingFlex").value === "-1:30", "negative Opening Flex did not format"); change("openingFlex", "0:00");
    change("standard1", "721"); assert(el("standard1").value === "7:21", "weekday Standard Hours did not format");
    change("leaveType", "Flex"); change("leaveHours", "721");
    assert(metric("dailyResults", "Daily Hours") === "7:21", "full-day Flex leave did not count toward Daily Hours");
    assert(metric("dailyResults", "Daily Flex Balance") === "0:00", "full-day Flex leave incorrectly generated Daily Flex");
    assert(metric("dailyResults", "Progressive Flex Balance") === "-7:21", "full-day Flex leave was not deducted from Progressive Flex");
    change("leaveType", ""); input("leaveHours", "");
    change("toilHours", "760");
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
    assert(el("recordsBody").textContent.includes(activeDate), "new record missing from history");
    assert(el("submitRecord").textContent === "Submit", "submit did not return to new-record mode");

    el("recordsBody").querySelector(`[data-edit="${activeDate}"]`).click();
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

    input("startTime", "0900"); input("lunchOut", "1230"); input("lunchIn", "1330"); input("finishTime", "1720");
    el("toggleInterruptions").click(); input("interruptionOut", "1500"); input("interruptionIn", "1530"); el("saveInterruption").click();
    assert(metric("dailyResults", "Daily Hours") === "6:50", "Additional Time Entry preview Daily Hours is stale");
    assert(metric("dailyResults", "Daily Flex Balance") === "-0:31", "Additional Time Entry preview Daily Flex is stale");
    assert(metric("dailyResults", "Progressive Flex Balance") === "-0:31", "Additional Time Entry preview Progressive Flex is stale");
    assert(metric("dailyResults", "Progressive TOIL Balance") === "0:00", "Additional Time Entry preview TOIL is incorrect");
    assert(metric("fortnightResults", "Hours Recorded This Period") === "6:50", "Fortnight hours do not match the preview");
    assert(metric("fortnightResults", "Net Flex for the Period") === "-0:31", "Fortnight flex does not match the preview");
    el("submitRecord").click();
    assert(metric("dailyResults", "Daily Hours") === "6:50", "Daily Hours became stale after Submit");
    assert(metric("dailyResults", "Daily Flex Balance") === "-0:31", "Daily Flex became stale after Submit");
    el("recordsBody").querySelector(`[data-edit="${activeDate}"]`).click();
    el("interruptionList").querySelector("[data-edit-interruption='afternoon']").click(); input("interruptionIn", "1520"); el("saveInterruption").click();
    assert(metric("dailyResults", "Daily Hours") === "7:00" && metric("dailyResults", "Daily Flex Balance") === "-0:21" && metric("fortnightResults", "Hours Recorded This Period") === "7:00" && metric("fortnightResults", "Net Flex for the Period") === "-0:21", "Editing Additional Time Entry did not update both displays");
    el("interruptionList").querySelector("[data-remove-interruption='afternoon']").click();
    assert(metric("dailyResults", "Daily Hours") === "7:20" && metric("dailyResults", "Daily Flex Balance") === "-0:01" && metric("fortnightResults", "Hours Recorded This Period") === "7:20" && metric("fortnightResults", "Net Flex for the Period") === "-0:01", "Removing Additional Time Entry did not update both displays");
    el("cancelEdit").click();
    el("recordsBody").querySelector(`[data-delete="${activeDate}"]`).click();

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
      const settingsInputs = [el("fortnightStart"), el("openingFlex"), el("openingToil")];
      const settingsTops = settingsInputs.map(input => Math.round(input.getBoundingClientRect().top));
      const settingsWidths = settingsInputs.map(input => Math.round(input.getBoundingClientRect().width));
      const settingsHeights = settingsInputs.map(input => Math.round(input.getBoundingClientRect().height));
      assert(new Set(settingsTops).size === 1, "tablet Settings fields are not on the same row");
      assert(settingsWidths[0] < settingsWidths[1] && Math.abs(settingsWidths[1] - settingsWidths[2]) <= 1, "tablet Settings width proportions are incorrect");
      assert(settingsHeights[0] === 36 && settingsHeights[1] === 38 && settingsHeights[2] === 38, "tablet Settings input heights are incorrect");
    }
    if (innerWidth <= 600) assert(Math.round(parseFloat(getComputedStyle(el("fortnightStart")).height)) === 48, "mobile Fortnight Start Date is not 48px high");
    window.scrollTo(0, 0);
    result.textContent = "PASS: welcome Feedback shared durations email CSV validation synchronized calculations responsive workflow";
  } catch (error) {
    result.textContent = `FAIL: ${error.message}`;
  } finally { restore(); }
})();
