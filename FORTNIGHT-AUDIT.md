# Fortnight mapping and submission audit

Audited against production-release source `074a097` (v22), 8 November 2026. The candidate fix is local and uncommitted. No production deployment or real-user storage modification was performed.

## Confirmed defect and scope

The status display canonicalised a known legacy Friday submission ID to the configured Thursday fortnight. The write guard additionally checked the original ID through ID + 13 days. Those two interpretations disagreed on the first Thursday of the following fortnight.

With anchor 24 September and saved submitted ID 23 October 2026, the legacy ID belongs to 22 October–4 November. Its raw span nevertheless includes 5 November. The deployed functions therefore displayed Current for 5 November while treating it as protected, but permitted 6 November in that same fortnight. This exact symptom was reproduced using isolated fixtures. Repeating the fixture across 30 consecutive boundaries reproduced the same defect; it is not specific to November.

The earlier raw-span protection fallback and tests asserting that overlap were incorrect. They have been replaced by calendar-membership invariants. The affected physical device's private localStorage has not been inspected: the diagnostic below can confirm whether its identifiers match the reproduced legacy-data condition. Stale assets are not required to reproduce the defect.

## Shared model and compatibility

- `calculator.js` maps civil dates using validated UTC calendar-day arithmetic, avoiding DST-length days, JavaScript's years 00–99 constructor adjustment, and local dates skipped by timezone/dateline changes. The configured Thursday calendar remains unchanged. Hour, flex and TOIL formulas remain unchanged.
- `periods.js` resolves canonical identity, submission state, pending status and exact-session authorisation. Badges, history, reminders and write handlers consume this model. A recognised legacy ID one day late aliases one fortnight; it never creates an overlapping submitted range.
- Reading storage never rewrites IDs or records. Unrecognised IDs, incompatible recorded calendars and malformed data block writes for review. Conflicting recognised statuses remain protected and pending explicit historical review. Only an explicit successful Submit Timesheet or Resubmit writes canonical provenance, preserving legacy aliases and unrelated metadata.
- Arbitrary changes to the calendar phase with existing history are blocked. Restoring a calendar demonstrably supported by saved submission IDs requires explicit confirmation; it changes the anchor only, without moving records or rewriting IDs. Equivalent anchors 14 days apart retain the same calendar.
- Submitted Save/Submit checks run before ordinary validation. Exact-fortnight historical authorisation permits only in-memory working-draft changes. Cancel revokes the session without storage writes. Resubmit validates and writes the approved period in one localStorage operation, then revokes authorisation. Failed validation/storage retains the session.
- Every write checks the last loaded storage snapshot. Clean pages refresh after another window's storage event; dirty pages retain input and refuse stale writes. Unreadable storage is preserved verbatim rather than replaced with defaults. Unknown saved fields are retained.

## Verification results

Changed application files: `app.js`, `calculator.js`, new `periods.js`, `index.html`, `service-worker.js`, and new `diagnose-period.js`. Changed/added tests: `test-ui-workflow.js`, `test-service-worker.js`, `test-periods.js`, `test-period-handlers.js`, `test-period-storage.js`, `test-diagnostics.js`. Documentation: `README.md` and this report. No CSS, hour formulas, CSV columns or unrelated user files were changed.

| Check | Result |
| --- | --- |
| Every civil date, years 0001–9999, both Thursday phases, independent Gregorian reference | PASS: 3,652,059 dates per phase |
| Complete 1990–2100 sweep in UTC, Sydney, Brisbane, New York, London, Auckland, Apia and Kathmandu | PASS: 40,542 dates per phase per timezone |
| Submission, boundary and scoped-authorisation state cases | PASS: 2,897 periods and 46,352 cases per timezone |
| Actual app Save, Submit, Cancel Edit and Resubmit handlers across all 1990–2100 boundaries | PASS: 43,455 scenarios |
| Rendered workflow suite at 320, 375, 390, 430, 768, 1024 and 1280px | PASS at all seven sizes |
| Real pointer Save/Submit attempts with empty, valid, invalid and populated protected forms | PASS: 56 attempts; modal visible/topmost, zero writes, input preserved |
| Historical authorisation, multiple edits, same-period navigation, wrong-period rejection, Cancel, both Resubmit controls | PASS |
| Quota failure, validation failure, external storage conflicts and duplicate resubmission | PASS; approved records preserved |
| Existing calculation/CSV/independent-history/default-date and settings regression suite | PASS |
| Reload during a staged historical session; ordinary saved draft restoration | PASS; exact approved storage retained, authorisation revoked |
| Clean/dirty storage-event handling, malformed storage, legacy metadata compatibility | PASS |
| Fresh v23 PWA install and offline reopening; v22 → v23 update and offline reopening | PASS; original stored records/drafts/statuses unchanged, unrelated cache retained |
| Essential HTML asset URLs versus service-worker precache | PASS; all current dependencies, including periods.js, included |

Durable tests: `test-calculator.js`, `test-periods.js` (`--full` optional), `test-period-handlers.js`, `test-period-storage.js`, `test-diagnostics.js`, `test-service-worker.js`, and the isolated-browser `test-ui-workflow.js` suite. Browser and PWA evidence for this audit is in `/private/tmp/clocky-csv-investigation-9awhb96g/`, particularly `system-calendar-verified.log`, `calendar-storage-browser.log`, `calendar-fresh-offline-final.log` and `calendar-update-final.log`.

The shell is prepared as v23 locally to keep the new dependency consistent during an eventual update. Production remains v22 until approval and deployment.

## Safe diagnosis on the affected device

1. Keep the affected app's existing website data. Select the affected date without saving or submitting.
2. Connect iPhone Safari/Web Inspector to a Mac, and inspect that existing Clocky page or installed-app context. Do not use the automated `?test` suite in a real-data browser.
3. Paste the contents of `diagnose-period.js` into its inspector console. The returned object contains only the selected date, calendar anchor, nearby submission IDs and boolean flags, current badge text and authorised/session period IDs. It omits times, leave details, names, notes, raw records and legacy metadata contents. It makes no writes, network requests or uploads.
4. Inspect `period`, `identifiers` and `legacySpillover` to establish whether a prior legacy ID is incorrectly covering the selected date in v22. Share only this diagnostic object if needed, not the complete localStorage value.

## Remaining verification limits

Rendered checks used Chromium on macOS with isolated phone/tablet/desktop viewports, plus screenshot inspection. Physical iPhone Safari, iPad Safari and Home Screen lifecycle/update behavior still require manual testing; they were not claimed as verified.

Historical working sessions intentionally remain in memory. Reloading/closing never commits their changes or restores their editing permission. The existing unsaved-change warning is retained, but a forced mobile-app termination may discard staged edits without a browser warning. Resubmit before closing to retain approved historical changes.

No automatic legacy-data migration, browser-data clearing, timesheet reset, commit, push or deployment is part of this audit.

Final integrity check: all 19 original untracked/ignored files match their pre-work SHA-256 hashes. JavaScript syntax and `git diff --check` pass. The index is unstaged; `main`, HEAD and the local `origin/main` reference remain at `074a097dafe8e2adcad3939926ff381dd6bbdd50`.
