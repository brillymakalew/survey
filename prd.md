# PRD - Multi-Phase Questionnaire Web App (Supabase)

## 1. Product Overview

### Product Name
Multi-Phase Questionnaire Web App

### Purpose
Build a web-based questionnaire application that allows respondents to complete a survey in multiple phases over time, while preserving progress across refreshes, expired sessions, interruptions, and even browser changes, as long as the same respondent can be identified through their name and normalized phone number.

The system must also provide a secure backend dashboard for administrators to monitor results, analyze aggregated responses, and filter findings by affiliation type and country base.

### Primary Goals
- Allow respondents to complete surveys across 3 main phases plus a final closing survey.
- Preserve respondent progress reliably across sessions.
- Reconnect interrupted users using normalized phone number matching.
- Support partial completion and continuation without data loss.
- Provide a password-protected admin analytics dashboard.
- Store all data in Supabase.

### Non-Goals (Initial Version)
- OTP / SMS verification.
- Multi-admin role hierarchy.
- Public respondent accounts with passwords.
- Real-time collaboration between multiple admins.
- Complex BI exports beyond CSV/XLSX for MVP.

## 2. Context and Problem Statement
Respondents will not necessarily complete the questionnaire in one sitting. They may:
- refresh the page,
- close the browser,
- get disconnected,
- have their session expire,
- log out and come back later,
- continue from another browser or device.

A normal browser-only session is not sufficient. Therefore, the application must persist progress to the database and restore the latest valid survey state when the respondent re-identifies themselves using their name and phone number.

Phone number input is inconsistent and may include:
- leading `0`
- `62`
- `+62`
- spaces or no spaces
- mixed formatting entered by different users at different times

To avoid duplicate identities, the system must normalize phone numbers into one canonical format and use that canonical value for respondent matching.

## 3. User Types

### 3.1 Respondent
A public user who fills in the questionnaire in stages.

### 3.2 Admin
A protected backend user who can:
- access dashboard and analytics,
- review response progress,
- filter data,
- inspect raw responses,
- export data.

## 4. High-Level User Flow

### Respondent Flow
1. Open application.
2. Enter Name and Phone Number.
3. System normalizes phone number.
4. If a matching respondent already exists, system restores the latest saved session and phase progress.
5. If no matching respondent exists, create a new respondent record.
6. Respondent completes the currently available phase.
7. Each answer is auto-saved (or saved per page/step).
8. If interrupted, respondent can re-enter later with same name and phone number and resume.
9. After final main phase, respondent completes closing survey (`questionnaire action`).
10. Submission is marked complete after closing survey is finished.

### Admin Flow
1. Open admin login page.
2. Enter password.
3. Access analytics dashboard.
4. Filter data by survey set, affiliation type, country base, phase, completion status, date, and other dimensions.
5. View charts, distributions, funnel progression, raw responses, and exports.

## 5. Functional Requirements

## 5.1 Phase Structure
The questionnaire is organized into 4 sequential blocks:
- Phase 1: respondent identity + T0-T1
- Phase 2: T2-T3
- Phase 3: T4-T5
- Closing Survey: questionnaire action

### 5.1.1 Phase 1
- First screen collects:
  - Name
  - Phone Number
- After clicking Next, user proceeds to questionnaire T0-T1.
- T0-T1 does not need to be on a single page; it may be split across multiple pages/steps.
- Progress must be saved while filling.

### 5.1.2 Phase 2
- User completes T2-T3.
- Prior progress from Phase 1 must remain available.
- Refresh must not erase progress in the current browser.
- If user logs out and returns, they re-enter Name + Phone Number.
- If normalized phone number matches an existing respondent, the system restores the previous saved state and resumes from the appropriate point.

### 5.1.3 Phase 3
- User completes T4-T5.
- All previous progress must be retained.
- Restore rules are identical to Phase 2.
- T4-T5 questions are not yet defined; the system must support adding them later from the admin configuration or seeded questionnaire definitions.

### 5.1.4 Closing Survey
- After final phase, user fills `questionnaire action`.
- All previous progress must still be retained.
- Same restoration rules apply if the user disconnects or returns later.
- Completion is only considered final after this closing survey is submitted.

## 5.2 Session Persistence and Recovery

### 5.2.1 Same Browser Refresh
- If the user refreshes the page, in-progress answers must remain visible.
- The application should restore from local draft state immediately, then reconcile with server state.

### 5.2.2 Same Browser, Logged Out
- If the user logs out, browser-side local session may be cleared.
- On next login-like entry (Name + Phone Number), the system must check the database for an existing respondent record.
- If found, restore the latest unfinished or latest valid response set.

### 5.2.3 Session Expired / Disconnected
- If the browser session expires or connection is lost, the user must still be able to continue later by re-entering Name + Phone Number.
- Server-side progress is the source of truth.

### 5.2.4 Different Browser / Device
- If the user switches browser/device, previously saved progress must still be restorable after Name + Phone Number re-entry.
- Matching is based on normalized phone number.

### 5.2.5 Recovery Rules
When a returning respondent is detected:
- load respondent profile,
- load latest response session,
- determine highest completed phase,
- reopen the latest incomplete page if any,
- otherwise route to next required phase.

## 5.3 Phone Number Normalization
To prevent duplicates and ensure recovery works reliably, phone numbers must be normalized before matching.

### 5.3.1 Input Variants to Support
Examples of equivalent inputs:
- `0812 3456 7890`
- `081234567890`
- `+62 812 3456 7890`
- `6281234567890`

### 5.3.2 Canonical Storage Rule
Recommended canonical format for Indonesia-based normalization:
- remove spaces, dashes, and non-numeric characters except leading `+`
- convert:
  - `+62xxxxxxxxxx` -> `62xxxxxxxxxx`
  - `0xxxxxxxxxx` -> `62xxxxxxxxxx` (replace leading `0` with `62`)
  - `62xxxxxxxxxx` -> keep as is
- store both:
  - `phone_raw` (original user input)
  - `phone_normalized` (canonical lookup key)

### 5.3.3 Validation Rules
- Minimum length after normalization: configurable (default 10 digits after country code handling)
- Reject clearly invalid numbers.
- Show user-friendly validation message.

## 5.4 Questionnaire Engine
The application should not hardcode all questions directly into page components. It should support a questionnaire definition model so phases and questions can be maintained more easily.

### 5.4.1 Supported Question Types
- Single choice
- Multi select (pick N)
- Likert scale (1-7)
- Short text
- Long text
- Optional free text when `Other` is selected
- Conditional field display

### 5.4.2 Question Configuration Requirements
Each question definition should support:
- phase assignment
- section label
- question code
- prompt text
- helper text
- response type
- options list
- min/max selections
- required flag
- ordering
- conditional logic
- active/inactive flag

### 5.4.3 Save Behavior
- Auto-save on answer change where possible.
- Also save on Next/Previous navigation.
- Use debounced save to reduce excessive write calls.
- On save success, update `last_saved_at`.

## 5.5 Question Content Requirements (Current Known Content)

### 5.5.1 T0-T1 (Ideation)
Must include, at minimum, the following content from the uploaded questionnaire:
- Affiliation type (Pick 1): Academia / Industry / Government / Other (free text)
- Country base: Indonesia / UK / Both / Other
- After Panel 1, my understanding of research translation is clearer (Likert 1-7)
- Top 2 bottlenecks at initiation of research (Pick 2)
- Top 2 enabling conditions to produce a discovery (Pick 2)

Reference source used: Questionnaire T0-T1 (Ideation).

### 5.5.2 T2-T3 (Prototype - Trials)
Must include, at minimum, the following content from the uploaded questionnaire:
- Affiliation type (Pick 1): Academia / Industry / Government / Other (free text)
- Country base: Indonesia / UK / Both / Other
- After Panel 2, my understanding of research translation is clearer (Likert 1-7)
- Top 2 biggest challenges (Pick 2)
- Top 2 enablers (Pick 2)

Reference source used: Questionnaire T2-T3 (Prototyping_Lab to Trials).

### 5.5.3 T4-T5
- Question content is not yet available.
- System must allow future insertion of T4-T5 question definitions without schema redesign.

### 5.5.4 Closing Survey (Questionnaire Action)
Must include, at minimum, the following content from the uploaded questionnaire:
- Affiliation type (Pick 1): Academia / Industry / Government / Other (free text)
- Country base: Indonesia / UK / Both / Other
- After the whole sessions, my understanding of research translation is clearer (Likert 1-7)
- Which breakout group did you join? (Pick 1)
- Top 3 priorities to build equitable UK-ID pathways (Pick 3)
- Do you intend to pursue a collaboration/proposal after this forum? Yes / No / Maybe
- If Yes/Maybe: Proposal idea title (optional)
- Permission to share this idea with organizers for follow-up matchmaking Yes / No
- If Yes: Email (text)

Reference source used: Questionnaire Action (Potential Collaboration).

## 5.6 Navigation and Resume Logic
- User may only access the current eligible phase and previously completed phases in review mode.
- Future phases remain locked until prior required phases are submitted.
- If a phase is partially filled, resume should return to the first incomplete required question or the last viewed step.
- On completion of a phase, mark `phase_status = completed` and unlock the next phase.

## 5.7 Admin Authentication
- Admin area must be password protected.
- Requested initial password: `password123`.

### 5.7.1 Security Note
For implementation:
- Do not hardcode the plain password in frontend code.
- Store an environment variable such as `ADMIN_PASSWORD_HASH` in the server layer.
- For MVP seeding, initialize the effective admin password to `password123`.
- Compare using hashed verification.

### 5.7.2 Session Rules for Admin
- Admin session should expire after configurable inactivity window (default 8 hours).
- Logout button required.

## 5.8 Admin Dashboard and Analytics
The backend dashboard must provide advanced and complete analysis for selected surveys.

### 5.8.1 Core Dashboard Capabilities
- Overview metrics:
  - total respondents
  - started respondents
  - respondents per phase
  - completed respondents
  - completion rate
  - dropout count per phase
  - return rate / resumed sessions
- Response funnel:
  - identity entered
  - Phase 1 started
  - Phase 1 completed
  - Phase 2 completed
  - Phase 3 completed
  - Closing survey completed
- Time metrics:
  - average completion time per phase
  - median completion time
  - average pause gap between phases
  - last activity time

### 5.8.2 Filter Requirements
Dashboard must support filtering by:
- selected survey / phase set
- affiliation type
- country base
- completion status
- date range
- breakout group (if applicable)
- intent to collaborate (Yes / No / Maybe)

At minimum, the user explicitly requested filters for:
- affiliation type
- country base

### 5.8.3 Analytical Views
- Distribution charts for single-choice questions
- Ranked counts for multi-select questions
- Likert score averages and distributions
- Cross-tab analysis, such as:
  - affiliation type vs top bottlenecks
  - country base vs top enablers
  - country base vs collaboration intent
- Completion trend over time
- Heatmap / matrix view for option popularity by segment
- Respondent-level detail table

### 5.8.4 Export Capabilities
- Export filtered raw response data to CSV
- Export aggregated analytics tables to CSV/XLSX
- Export respondent progress table

## 5.9 Data Quality and Deduplication
- A respondent should be uniquely identified by `phone_normalized`.
- If same normalized phone is used again, system should attach activity to the same respondent unless an admin manually merges/splits records.
- Keep audit trail of updates and resumed sessions.
- Avoid duplicate response sessions for the same phase unless versioning is intentionally enabled.

## 5.10 Error Handling
- Graceful message if save fails due to network interruption.
- Retry save automatically where safe.
- Prevent double submission on repeated clicks.
- On conflicting updates, prefer latest server-confirmed revision and notify the user if needed.

## 6. Suggested UX / UI Requirements

## 6.1 Respondent Frontend
- Clean, mobile-friendly, low-friction interface.
- Progress indicator showing phase and step.
- Clear Save / Saved status.
- Resume-friendly design with minimal re-entry burden.
- Buttons: Back, Next, Save & Exit (optional), Resume.
- Validation errors should be inline and easy to understand.

## 6.2 Admin Dashboard UI
- Protected login page.
- Executive summary cards.
- Filter bar at top.
- Tabs for:
  - Overview
  - Funnel
  - Per Phase Analysis
  - Crosstabs
  - Raw Responses
  - Exports
- Responsive tables with pagination and search.

## 7. Technical Requirements

## 7.1 Recommended Tech Stack
- Frontend: Next.js (App Router) or React-based web app
- Styling: Tailwind CSS
- Backend: Next.js server routes / server actions or equivalent Node backend
- Database + Auth/Storage: Supabase
- Analytics queries: PostgreSQL views / materialized views / RPC as needed
- Hosting: Vercel / self-hosted Node / equivalent

## 7.2 Supabase Usage
Supabase will be used for:
- PostgreSQL database
- Row-level security (if needed)
- Session persistence tables
- Admin analytics queries
- Optional Edge Functions for advanced processing

## 8. Data Model (Supabase)

## 8.1 Core Tables

### 8.1.1 respondents
Stores master identity of public survey respondents.

Fields:
- `id` UUID PK
- `full_name` text not null
- `phone_raw` text not null
- `phone_normalized` text not null unique
- `latest_session_id` UUID nullable
- `current_phase` text not null default `'phase_1'`
- `status` text not null default `'active'`
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()
- `last_seen_at` timestamptz nullable

### 8.1.2 response_sessions
Tracks resumable survey sessions.

Fields:
- `id` UUID PK
- `respondent_id` UUID FK -> respondents.id
- `session_token` text unique
- `status` text not null default `'active'`
- `resume_key_version` integer not null default 1
- `last_phase` text nullable
- `last_step_code` text nullable
- `started_at` timestamptz not null default now()
- `last_activity_at` timestamptz not null default now()
- `completed_at` timestamptz nullable
- `client_fingerprint` text nullable
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

### 8.1.3 survey_phases
Defines the phase blocks.

Fields:
- `id` UUID PK
- `phase_code` text unique not null (`phase_1`, `phase_2`, `phase_3`, `closing`)
- `phase_name` text not null
- `sort_order` integer not null
- `is_active` boolean not null default true
- `created_at` timestamptz not null default now()

### 8.1.4 survey_questions
Stores configurable question definitions.

Fields:
- `id` UUID PK
- `phase_id` UUID FK -> survey_phases.id
- `question_code` text unique not null
- `section_code` text nullable
- `prompt` text not null
- `help_text` text nullable
- `question_type` text not null
- `options_json` jsonb nullable
- `selection_min` integer nullable
- `selection_max` integer nullable
- `is_required` boolean not null default true
- `conditional_logic_json` jsonb nullable
- `sort_order` integer not null
- `is_active` boolean not null default true
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

### 8.1.5 survey_responses
Stores one answer per question per respondent.

Fields:
- `id` UUID PK
- `respondent_id` UUID FK -> respondents.id
- `session_id` UUID FK -> response_sessions.id
- `phase_id` UUID FK -> survey_phases.id
- `question_id` UUID FK -> survey_questions.id
- `answer_value_json` jsonb not null
- `answer_text` text nullable
- `is_finalized` boolean not null default false
- `answered_at` timestamptz not null default now()
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Unique constraint recommendation:
- unique (`respondent_id`, `question_id`)
for latest-state model.

If version history is needed later, remove this unique and add versioning.

### 8.1.6 phase_progress
Tracks completion state by phase.

Fields:
- `id` UUID PK
- `respondent_id` UUID FK -> respondents.id
- `phase_id` UUID FK -> survey_phases.id
- `status` text not null (`not_started`, `in_progress`, `completed`)
- `started_at` timestamptz nullable
- `completed_at` timestamptz nullable
- `last_step_code` text nullable
- `completion_percent` numeric(5,2) not null default 0
- `updated_at` timestamptz not null default now()

Unique constraint:
- unique (`respondent_id`, `phase_id`)

### 8.1.7 admin_users (optional, recommended)
If using database-backed admin instead of single env-only password.

Fields:
- `id` UUID PK
- `username` text unique not null
- `password_hash` text not null
- `is_active` boolean not null default true
- `created_at` timestamptz not null default now()

Seed for MVP:
- username: `admin`
- password equivalent: `password123` (stored as hash)

### 8.1.8 audit_logs
Stores key events.

Fields:
- `id` UUID PK
- `actor_type` text not null (`respondent`, `admin`, `system`)
- `actor_id` text nullable
- `event_type` text not null
- `entity_type` text not null
- `entity_id` text nullable
- `payload_json` jsonb nullable
- `created_at` timestamptz not null default now()

## 8.2 Suggested Views for Analytics
Create PostgreSQL views / materialized views for faster dashboard rendering:
- `vw_response_funnel`
- `vw_phase_completion_stats`
- `vw_question_option_counts`
- `vw_likert_summary`
- `vw_affiliation_country_breakdown`
- `vw_collaboration_intent_summary`

## 9. API / Backend Requirements

## 9.1 Public Endpoints
- `POST /api/respondent/start`
  - create or resume respondent by name + phone
- `GET /api/respondent/resume`
  - fetch current progress
- `POST /api/responses/save`
  - save one or batch answers
- `POST /api/phase/complete`
  - mark phase completed
- `POST /api/logout`
  - end local session reference

## 9.2 Admin Endpoints
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/dashboard/overview`
- `GET /api/admin/dashboard/funnel`
- `GET /api/admin/dashboard/questions`
- `GET /api/admin/dashboard/respondents`
- `GET /api/admin/export`

## 10. Detailed Business Rules

## 10.1 Respondent Matching Rule
When user submits Name + Phone Number:
1. Normalize phone.
2. Search `respondents.phone_normalized`.
3. If found:
   - update `full_name` if desired (configurable; default keep latest non-empty input)
   - set `last_seen_at`
   - attach or create active session
   - return resume point
4. If not found:
   - create new respondent
   - create new active session

## 10.2 Resume Priority Rule
Resume target should be determined in this order:
1. latest incomplete step in active phase
2. latest incomplete phase
3. first step of next unlocked phase
4. closing confirmation page if fully complete

## 10.3 Multi-Select Validation Rule
- T0-T1 bottlenecks: exactly or at most 2 based on final questionnaire policy (recommended exactly 2 if wording says Pick 2)
- T0-T1 enablers: exactly or at most 2
- T2-T3 biggest challenges: exactly or at most 2
- T2-T3 enablers: exactly or at most 2
- Closing priorities: exactly or at most 3

Recommended MVP behavior:
- enforce exactly N for `Pick N` wording.

## 10.4 Conditional Field Rule
- If `Other` is selected and the question supports free text, show required companion text field.
- If collaboration intent is `Yes` or `Maybe`, show optional `Proposal idea title`.
- If permission to share idea is `Yes`, require `Email`.

## 11. Security Requirements
- Admin password must never be exposed client-side.
- Use server-side verification only.
- Use HTTPS in production.
- Sanitize all text inputs.
- Rate limit public start/resume endpoint to reduce abuse.
- Use CSRF-safe patterns where relevant.
- Apply RLS or server-side access restriction to prevent direct unauthorized reads.
- Store only required PII.

## 12. Privacy and Compliance Considerations
- Name and phone number are personal data.
- If collecting email in the closing survey, it is also personal data.
- Provide a brief privacy notice before respondent starts.
- Explain that data is used for survey follow-up and analytics.
- Log consent where needed, especially for idea-sharing permission.
- Allow admin export with care, limited to authorized backend access.

## 13. Reporting Requirements

### 13.1 Standard KPI Metrics
- total unique respondents
- completion rate overall
- completion rate per phase
- average clarity score by phase
- most selected bottlenecks
- most selected enablers
- collaboration intent distribution
- breakout group distribution
- top priorities ranking

### 13.2 Recommended Advanced Analytics
- segment comparison by affiliation type
- segment comparison by country base
- dropout hotspots by question/step
- response latency by phase
- resumed-session rate
- distribution of `Other` free-text responses (table view; optional keyword clustering later)

## 14. Performance Requirements
- Save response action should feel near real-time (target under 1 second perceived response under normal conditions).
- Dashboard filter interactions should return within 2-3 seconds for normal dataset size.
- Support at least hundreds to low thousands of responses comfortably in MVP.

## 15. Acceptance Criteria

### 15.1 Respondent Journey
- A new user can enter Name + Phone Number and start Phase 1.
- The same user can refresh and not lose progress.
- The same user can log out, re-enter later, and resume where they stopped.
- The same user can resume from another browser/device using same phone number.
- Equivalent phone formats map to the same respondent record.
- User cannot access locked future phases.
- User can complete closing survey after final phase.

### 15.2 Data Integrity
- Answers are saved to Supabase.
- Duplicate respondent creation is prevented for same normalized phone number.
- Phase completion status updates correctly.
- Conditional questions behave correctly.

### 15.3 Admin Dashboard
- Admin login requires password.
- Password configured for MVP is `password123` (stored securely in practice).
- Admin can see overview metrics.
- Admin can filter by affiliation type and country base.
- Admin can view raw responses and exports.

## 16. Open Items / Assumptions
- T4-T5 question content is still pending and will be added later.
- It is assumed that one normalized phone number represents one respondent identity.
- It is assumed there is no need for SMS verification in MVP.
- It is assumed only one admin credential is needed for MVP unless expanded.

## 17. Recommended Implementation Phases

### Phase A - Core Foundation
- Supabase schema
- phone normalization utility
- respondent start/resume flow
- Phase 1 form flow
- save/resume logic

### Phase B - Multi-Phase Completion
- Phase 2 and Phase 3 support
- phase locking/unlocking
- closing survey flow
- audit logging

### Phase C - Admin Analytics
- admin login
- dashboard widgets
- filtering
- exports
- advanced aggregations

### Phase D - Hardening
- better validation
- rate limiting
- improved analytics performance
- optional text analytics for open-ended responses

## 18. Suggested Seed Questionnaire Mapping

### Phase 1
- identity screen
- T0-T1 question set

### Phase 2
- T2-T3 question set

### Phase 3
- T4-T5 question set (placeholder until provided)

### Closing
- Questionnaire Action question set

## 19. Implementation Notes for Developers
- Treat the database as the source of truth for progress.
- Use local storage only as a temporary convenience cache, not primary persistence.
- Build question rendering from metadata so T4-T5 can be inserted later without frontend rewrites.
- Separate respondent app and admin app logic clearly.
- Prefer server-side aggregation for dashboard performance.

## 20. Source Inputs Used for This PRD
This PRD incorporates the uploaded questionnaire content currently available for:
- T0-T1 (Ideation)
- T2-T3 (Prototype - Trials)
- Closing Survey / Questionnaire Action (Potential Collaboration)

T4-T5 remains intentionally designed as a configurable placeholder until the final question set is provided.
