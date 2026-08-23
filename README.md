# Clocky

A small browser-only timesheet. Records are stored in the current browser using `localStorage`; there is no server or login.

## Open the app

Open the published GitHub Pages URL in a browser. For local use, open the project folder and double-click `index.html`.

On first use, save a Thursday as the required **Fortnight Start Date** in Settings. Click **Now** to stamp the current local time, or type a time in 24-hour `HH:MM` format, such as `13:50`. Press **Submit** to save a new daily record. Use **Edit** or **Delete** beside a saved record; editing and deleting automatically recalculates later balances. The app warns before discarding an unsaved daily draft.

**Export Fortnight CSV** exports the period selected under **View fortnight**. It always contains 14 chronological rows from Thursday through the second Wednesday, including completely blank rows for dates without records.

Use the **Year** and **Month** filters to find older timesheets, then choose one of the fortnights that overlaps that month. The summary, saved-record list, status, editing, and CSV export all follow the selected fortnight. Previous records remain in localStorage when a new fortnight begins. CSV backup filenames use the period dates, for example `Timesheet_2026-08-20_to_2026-09-02.csv`.

The normal work form shows Start Work, Lunch Out, Lunch In, and Finish Work. Use **+ Add Additional Time Entry** to add one optional Morning entry and then one optional Afternoon entry. Each saved entry can be edited or removed independently; an interval that overlaps lunch is rejected. Leave and TOIL fields are available from the compact **+ Add Leave / TOIL Details** control. Attendance Type is a persistent setting used as the default for new records, while historical record values remain unchanged.

On the final Wednesday, the app displays a submission reminder. Marking it submitted saves that status locally and offers to export a backup CSV. Unsubmitted ended fortnights appear as overdue, and edits to a submitted fortnight display a resubmission warning.

Clearing browser site data removes the stored records, so export CSV backups regularly. Opening the app in another browser or at a different web address uses separate storage.

## Run the calculation tests

With Node.js installed, run `node test-calculator.js` from this folder.
