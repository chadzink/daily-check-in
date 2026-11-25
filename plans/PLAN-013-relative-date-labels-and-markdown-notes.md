# PLAN-013: Relative Date Labels & Markdown Daily Notes

- **Branch Reference:** `feat/PLAN-013-relative-date-labels-and-markdown-notes`
- **Document Reference:** `plans/PLAN-013-relative-date-labels-and-markdown-notes.md`
- **Lead Agent:** `@product-owner`
- **Collaborating Agents:** `@ui-designer`, `@developer`, `@tester`
- **Status:** **Implemented & Verified (Pending Sprint Review Sign-Off)**

---

## 1. Overview & User Stories

1. **Story 1 (UX — P1):** *As a user viewing a date other than today, I want the "Yesterday" and "Today" section headers on the board and in the Standup Export to display formatted dates relative to the selected date (e.g., `"Sunday, Nov 22, 2026"` and `"Monday, Nov 23, 2026"`), so that historical standups and reviews read accurately.*
2. **Story 2 (Feature — P1):** *As a user, I want a Daily Notes icon in the Day Session Action Bar that appears empty when no notes exist and green-filled when notes are present, so that I can see at a glance whether a day has notes and click to view or edit them in a popup modal.*
3. **Story 3 (UX — P1):** *As a user, I want a Markdown-enabled editor with a Write / Preview tab toggle in the Daily Notes popup, Morning Check-In wizard, and End-of-Day Check-Out wizard, so that I can format and preview rich daily notes.*

---

## 2. Architecture & Component Impacts

### 2.1 Story 1: Relative Date Labels (Board & Standup Export)
- **Date Label Helper (`frontend/src/utils/dateLabels.ts`):**
  - Given `selectedDate` (`YYYY-MM-DD`) and `isHistorical` (or comparing `selectedDate !== format(new Date(), 'yyyy-MM-dd')`):
    - When viewing today's date: returns `{ yesterdayLabel: 'Yesterday', todayLabel: 'Today' }`.
    - When viewing a different date (e.g., `2026-11-23`): parses `selectedDate` in local time (`parseISO(selectedDate)`) and returns `{ yesterdayLabel: format(subDays(parsed, 1), 'EEEE, MMM d, yyyy'), todayLabel: format(parsed, 'EEEE, MMM d, yyyy') }` (e.g., `"Sunday, Nov 22, 2026"` and `"Monday, Nov 23, 2026"`).
- **Board Row Headers (`YesterdayRow.tsx`, `TodayRow.tsx`, `DailyBoard.tsx`):**
  - Pass `title` prop (or `date` prop) to `YesterdayRow` and `TodayRow` so their `ExecutionRow` headers display the relative labels when `isHistorical` is true, while keeping `droppableId` / `data-testid="execution-row-yesterday"` and `data-testid="execution-row-today"` unchanged.
- **Standup Export (`frontend/src/utils/standupGenerator.ts` & `StandupExportModal.tsx`):**
  - Update `generateStandupMarkdown` to accept `dateStr` (or read `data.session.date`) and `StandupExportOptions` so non-today dates emit `**Sunday, Nov 22, 2026:**` and `**Monday, Nov 23, 2026:**` instead of `**Yesterday:**` and `**Today:**`.

### 2.2 Story 2 & 3: Daily Notes Icon, Modal & Markdown Editor with Preview
- **Day Session Action Bar (`frontend/src/components/board/DaySessionActionBar.tsx`):**
  - Replace the truncated inline `session?.notes` quote with a dedicated **Daily Notes** icon button (`data-testid="daily-notes-btn"`):
    - **Empty state** (no notes / whitespace only): outline `StickyNote` (or `NotebookPen`) icon in muted slate (`text-slate-400 border-slate-700 bg-slate-800`).
    - **Filled state** (`session?.notes?.trim()` non-empty): green-filled/accented icon (`bg-emerald-500/20 border-emerald-500/40 text-emerald-400` with filled dot/highlight).
- **Markdown Editor & Preview Component (`frontend/src/components/common/MarkdownNotesEditor.tsx`):**
  - Reusable component with **Write** and **Preview** tabs:
    - **Write tab:** Styled `<textarea>` with Markdown formatting hint (supports headings, bold, italic, bullet/numbered lists, inline code, links, blockquotes).
    - **Preview tab:** Lightweight, XSS-safe React Markdown renderer (zero raw `dangerouslySetInnerHTML`, rendering headings, bold/italic, inline code, lists, blockquotes, and safe `http(s)` links cleanly in Tailwind typography).
  - Integrated into:
    1. `DailyNotesModal.tsx` (new modal opened from `DaySessionActionBar`; editable on today's session via `PATCH /api/days/:date` (`updateDaySession`), read-only preview on historical dates).
    2. `Step4PrioritizeCommit.tsx` (Morning Check-In wizard).
    3. `Step2DailyReflection.tsx` (End-of-Day Check-Out wizard).
- **Hooks (`frontend/src/hooks/useBoard.ts`):**
  - Add `useUpdateDayNotes(date)` calling `updateDaySession(date, { notes })` and invalidating `queryKeys.daySession(date)`.

---

## 3. Acceptance Criteria (Gherkin Scenarios)

- **Scenario 1.1: Relative labels on a historical date**
  - **Given** today's local date is Wednesday, Nov 25, 2026 and the user selects Monday, Nov 23, 2026
  - **When** the board and Standup Export modal render
  - **Then** the Yesterday section header and standup heading read `"Sunday, Nov 22, 2026"`
  - **And** the Today section header and standup heading read `"Monday, Nov 23, 2026"`.
- **Scenario 1.2: Standard labels on current date**
  - **Given** the selected date is today's local date
  - **Then** the headers and standup headings remain `"Yesterday"` and `"Today"`.
- **Scenario 2.1: Empty vs. green-filled Daily Notes icon**
  - **Given** a day session with empty `notes`
  - **Then** the Daily Notes icon in `DaySessionActionBar` renders in its empty/neutral state
  - **When** notes are saved on today's session via `DailyNotesModal`
  - **Then** `PATCH /api/days/:date` persists the notes and the icon turns green-filled.
- **Scenario 2.2: Historical read-only Daily Notes**
  - **Given** a historical date session
  - **When** the user clicks the Daily Notes icon
  - **Then** `DailyNotesModal` opens in read-only preview mode without Save/Edit controls.
- **Scenario 3.1: Markdown Write / Preview toggle**
  - **Given** the user is in `DailyNotesModal`, Morning Check-In Step 4, or Check-Out Step 2
  - **When** the user types Markdown (e.g. `**Done**` and `- item 1`) and switches to the **Preview** tab
  - **Then** formatted HTML elements (`<strong>`, `<ul>/<li>`) are rendered safely.

---

## 4. Definition of Done (DoD)
- [x] `dateLabels.ts` implemented and wired to `YesterdayRow`, `TodayRow`, `DailyBoard`, and `standupGenerator.ts`.
- [x] `MarkdownNotesEditor.tsx` (Write / Preview tabs) implemented and integrated into `DailyNotesModal.tsx`, `Step4PrioritizeCommit.tsx`, and `Step2DailyReflection.tsx`.
- [x] `DaySessionActionBar.tsx` displays empty vs. green-filled Daily Notes icon button opening `DailyNotesModal`.
- [x] `docs/SPECIFICATION.md`, `README.md`, and `plans/ROADMAP.md` updated.
- [x] `go test -v ./...`, `npm test -- --run`, `npm run build`, and `go build -o bin/dailycheckin ./cmd/server` pass.
- [x] QA report archived in `test-reports/QA-REPORT-013-relative-date-labels-and-markdown-notes-2026-11-25.md`.
