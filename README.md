# Clocky

A small browser-only timesheet. Records are stored in the current browser using `localStorage`; there is no server or login.

## Open the app

Open the published GitHub Pages URL in a browser. For local use, open the project folder and double-click `index.html`.

On first use, save a Thursday as the required **Fortnight Start Date** in Settings. Click **Now** to stamp the current local time, or type a time in 24-hour `HH:MM` format, such as `13:50`. Use **Save** to keep the current Daily Entry as a local draft without adding it to History or balances, then press **Submit** when it is ready to become a timesheet record. Saved drafts restore on the same device and are removed after Submit or Clear. Use **Edit** or **Delete** beside an editable record; editing and deleting automatically recalculates later balances. The app warns before discarding unsaved changes.

Selecting a **Daily Entry Record Date** shows that date's reporting period in **Fortnight Summary** and **Timesheet History**. You can select dates across period boundaries. **Export Fortnight CSV** exports the period currently displayed in those sections, with 14 chronological rows from Thursday through the second Wednesday, including blank rows for dates without records.

Use the **Historical Timesheets Year** and **Month** filters to find older timesheets, then choose a fortnight to view its saved records and summary. Browsing does not change the Daily Entry date, form values, or unsaved draft. Selecting a Daily Entry date returns the summary and history to that date's period while retaining the historical selection. The **Export** button beside the historical selector always exports that selector's period. An explicit **Edit** action opens a saved record in Daily Entry. Previous records remain in localStorage when a new fortnight begins. CSV backup filenames use the period dates, for example `Timesheet_2026-08-20_to_2026-09-02.csv`.

The normal work form shows Start Work, Lunch Out, Lunch In, and Finish Work. Use **+ Add Additional Time Entry** for an optional Morning or Afternoon interruption; its times determine its classification, regardless of entry order. The main Daily Entry button saves an open interruption, while Cancel discards only its unsaved changes. Each saved entry can be edited or removed independently, and an interval that overlaps lunch is rejected. Leave and TOIL fields use the same main-save and Cancel pattern under **+ Add Leave / TOIL Details**. Attendance Type is a persistent setting used as the default for new records, while historical record values remain unchanged.

On the final Wednesday, the app displays a submission reminder. **Submit Timesheet** saves that status locally and explains how to make future changes. CSV export remains a separate action. Unsubmitted ended fortnights appear as overdue. Previously submitted fortnights require the authorised historical workflow below.

Clearing browser site data removes the stored records, so export CSV backups regularly. Opening the app in another browser or at a different web address uses separate storage.

A genuinely new entry defaults to the next Monday–Friday date after the latest saved record or draft, even when that date is in the past. Reopening an unfinished active draft resumes that draft. With no entries, the default is today or the next weekday. This calculation runs only at startup or after submitting a new record; viewing history and re-rendering never advance the date. Manual Record Date selection accepts all seven days immediately, and weekend work can still be submitted through its existing confirmation.

Submitted fortnights remain protected in Daily Entry, including periods awaiting resubmission. All form controls remain interactive, but normal Save and Submit never persist changes. Every explicit unauthorised Save or Submit click opens the submitted-timesheet modal before validation, including empty, unchanged, incomplete or invalid forms. Simply selecting or viewing a submitted date, focusing a field or opening an editor does not open it. Dismissing the modal preserves the temporary input and selected date. Clear, Copy Previous and optional details affect only temporary form values in a protected period. Saved drafts never grant historical permission on reopening. There is no inline submitted-fortnight warning. Submitted rows omit Edit/Delete actions until the selected fortnight has been authorised for historical editing; other notifications remain unchanged.

Use **Edit Timesheet** beside the historical **Export** button to open the selected fortnight for editing. The existing confirmation explains when a period was previously submitted. Cancel leaves it locked. Continue Editing saves normal unsaved Daily Entry work as a draft first; validation or storage failures block the switch. Temporary changes for a different submitted fortnight must be reviewed or cancelled before switching. Empty fortnights show a message without creating entries.

For a submitted fortnight, Continue Editing creates an in-memory working session restricted to that fortnight and reveals **Resubmit** and **Cancel**. Daily Save, Submit and row deletion update this working session only. History and balances preview its changes; CSV exports continue to use the approved persisted records until resubmission. **Cancel** asks before discarding session changes and leaves the original records and submission status intact. Leaving for another fortnight requires the same confirmation. **Resubmit** validates the working records, preserves weekend/public-holiday confirmations, then saves the selected fortnight and submitted status in one localStorage write before revoking editing permission. Failed validation, storage errors or detected external storage changes preserve the session without reporting success. Other periods remain unchanged. Uncommitted sessions are not persisted across reloads; the browser warns before leaving with session changes. Unsubmitted fortnights retain their existing editing workflow.

Daily Entry, Calculated for this date and Fortnight Summary reuse the same badge styling and status calculation for their displayed periods. During an authorised submitted historical session, the relevant badges show **To be submitted** without changing the saved submission status. The upper historical reminder and the Historical Timesheets action row both offer **Resubmit**, using the same handler with duplicate-execution protection. Cancel or successful resubmission restores **Submitted** and removes these historical controls; failures retain the pending status and working session. Ordinary submission reminders retain their existing deadline rules.

Historical authorisation uses the selected calendar fortnight, including when an older release saved a submission start shifted by daylight saving. Those saved statuses are recognised without renaming or deleting them. Confirmation creates a scoped working session whenever the selected fortnight intersects a stored submitted range. Cancel preserves the exact stored snapshot. Resubmit writes only the selected fortnight's records and its current submission status, retaining legacy and unrelated submission metadata. Original submitted date ranges remain protected outside that authorisation.

## Run the calculation tests

With Node.js installed, run `node test-calculator.js` from this folder.

Run `node test-service-worker.js` to verify that the offline shell includes the exact versioned assets referenced by the HTML. Browser workflow tests should run only with isolated test storage.

## Installed-app updates

The service worker precaches the complete static shell and checks for updates without automatically reloading an open form. It removes only old Clocky shell caches; timesheet records, drafts, settings and submission status remain in the same localStorage key. To update an iPhone Home Screen installation, finish or save current work, close Clocky from the app switcher, reopen it while online and allow the update to download, then close and reopen once more. Do not clear website data or remove the installed app as an update step.
