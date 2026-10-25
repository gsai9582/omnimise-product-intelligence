# Step 2 — Technical Analysis: Omnimise

**Product:** Omnimise — Verified Career Identity Ecosystem
**Entity:** Equanimity Career Solutions Private Limited (Bengaluru)
**Stack:** MERN / Flutter / AWS / RAG
**Date:** June 2026

---

## Backend Architecture Analysis

### 1. Asynchronous Processing for Resume Generation and Third-Party Sync

**Current Behaviour:** The platform generates Harvard-style resumes from documented experiences and syncs data from 15+ third-party platforms (GitHub, LinkedIn, LeetCode, etc.). Based on the MERN stack and typical early-stage patterns, these operations likely run synchronously within Express.js request handlers.

**Problem:** Resume PDF generation is CPU-intensive — parsing structured data, applying layout templates, rendering fonts, and exporting to PDF. Running this in the Node.js event loop blocks other requests. Third-party API calls (GitHub, LinkedIn OAuth token refresh, profile data fetch) add variable latency. If LinkedIn's API takes 8 seconds to respond, the user's request is blocked for that duration. At scale, a handful of concurrent resume generation requests can degrade API responsiveness for all users.

**Technical Solution:** Introduce a message queue (BullMQ with Redis, or AWS SQS) to offload resume generation and third-party sync to dedicated worker processes. The API endpoint accepts the request, enqueues it, and returns a 202 Accepted with a job ID. Workers process jobs independently. The client polls or subscribes via WebSocket for completion.

**Implementation Approach:**
1. Set up Redis (ElastiCache on AWS) as the queue backend
2. Create a BullMQ queue for `resume-generation` and `integration-sync` job types
3. Refactor resume generation into a standalone worker service
4. Add a `/jobs/:id/status` endpoint for polling
5. Implement dead-letter queues for failed jobs with retry policies (3 retries, exponential backoff)

**Expected Impact:** API response times for resume generation drop from 5-15s to <500ms (returns job ID immediately). Node.js event loop stays free for real-time requests like credential verification and QR sessions.

**Engineering Effort:** M — 2-3 weeks for a single engineer. BullMQ has good Node.js integration, so the migration path is straightforward.

**Business Value:** Faster perceived performance directly affects user retention. Users who toggle resume sections on/off and expect instant preview will not tolerate multi-second waits.

---

### 2. Structured Logging with PII Redaction

**Current Behaviour:** The platform processes Aadhaar numbers, PAN, UAN, salary slips, and government IDs. The privacy policy confirms these are stored in masked/encrypted format. However, application logs (Express.js console output, error stack traces, request/response logging) may inadvertently capture PII in plaintext — particularly in error scenarios where the full request body gets dumped.

**Problem:** A single unredacted log entry containing an Aadhaar number creates a DPDP Act compliance violation. Beyond regulatory risk, PII in logs is a security liability — anyone with log access (developers, ops, third-party log aggregators) can view sensitive data. The privacy policy specifically claims adherence to DPDP, GDPR, and CCPA, which makes this an enforceable obligation.

**Technical Solution:** Implement structured JSON logging with automatic PII redaction. Use a logging library like `pino` (faster than Winston for Node.js) with custom serializers that detect and mask known PII patterns (12-digit Aadhaar, 10-char PAN format ABCDE1234F, email addresses) before writing to any output.

**Implementation Approach:**
1. Replace `console.log` and unstructured logging with `pino`
2. Write redaction serializers for Aadhaar (mask to `XXXX-XXXX-1234`), PAN, email, and phone patterns
3. Configure request logging middleware to redact headers (`Authorization`, `Cookie`) and body fields (`aadhaar`, `pan`, `password`)
4. Route logs to CloudWatch Logs (already on AWS) with retention policies matching the 5-year data retention policy
5. Add log correlation IDs per request for traceability

**Expected Impact:** Eliminates the risk of PII exposure through logs. Structured JSON logs enable efficient querying in CloudWatch Insights for debugging without reading raw text dumps.

**Engineering Effort:** S — 1 week. The `pino` migration is mostly mechanical. Writing redaction patterns for known Indian ID formats is well-defined work.

**Business Value:** Regulatory compliance is table stakes for a platform handling Aadhaar and PAN. A single DPDP breach notification (mandated within 72 hours) could damage trust irrecoverably for an early-stage product.

---

### 3. Rate Limiting on Credential Verification Endpoints

**Current Behaviour:** The QR-based verification system creates temporary sessions where an employer scans a QR code to view a candidate's pre-verified credentials. This endpoint is likely unauthenticated from the verifier's side (they scan a QR, not log in). The terms mention audit trails for employer access, but no public indication of rate limiting exists.

**Problem:** Without rate limiting, the verification endpoint is vulnerable to enumeration attacks. If QR session tokens are short or predictable, an attacker could brute-force valid session IDs. Even with cryptographically strong tokens, the absence of rate limiting means the endpoint can be used for denial-of-service. Additionally, the 15+ third-party integration sync endpoints (GitHub, LinkedIn, etc.) could be abused to trigger excessive outbound API calls, burning through OAuth rate limits on those platforms.

**Technical Solution:** Implement tiered rate limiting using `express-rate-limit` with a Redis-backed store for distributed deployments. Apply different limits per endpoint class: auth endpoints (strict — 5 attempts/minute), verification endpoints (moderate — 30 requests/minute per IP), integration sync (10 requests/hour per user).

**Implementation Approach:**
1. Add `express-rate-limit` middleware with `rate-limit-redis` store
2. Define rate limit tiers in a config file (not hardcoded)
3. Return proper `429 Too Many Requests` with `Retry-After` header
4. Log rate-limit violations as security events (ties into structured logging from item 2)
5. Add IP-based and user-based limits (dual key)

**Expected Impact:** Blocks brute-force attacks on QR session tokens. Prevents integration sync abuse. Reduces the risk of getting OAuth tokens revoked by GitHub/LinkedIn due to excessive API calls.

**Engineering Effort:** S — 3-5 days. Express-rate-limit is drop-in middleware. The Redis store reuses infrastructure from the queue system.

**Business Value:** For a product that stores government-issued IDs, demonstrating rate limiting is a minimum security expectation. Enterprises evaluating the HRTMS module will audit this.

---

### 4. MongoDB Indexing Strategy for Document Vault

**Current Behaviour:** The document vault stores academic certificates, government IDs, employment proof, salary slips, and portfolio documents. Users search, filter by type, and share specific documents. MongoDB is the primary database. In early-stage products, collections often start with default `_id` indexing and no compound indexes.

**Problem:** As users accumulate documents (10-50 per active user), queries like "find all certificates for user X sorted by upload date" or "find all documents shared with employer Y" perform full collection scans without proper indexes. This is invisible with 100 users but becomes a latency problem at 10K+ users with 500K+ documents.

**Technical Solution:** Audit existing queries using MongoDB's `explain()` plan, then add targeted indexes. At minimum: compound index on `{userId: 1, documentType: 1, createdAt: -1}` for vault browsing, a sparse index on `{sharedWith: 1}` for shared document lookups, and a TTL index on QR session tokens for automatic expiration.

**Implementation Approach:**
1. Enable MongoDB profiler (level 1) in staging to capture slow queries (>100ms)
2. Run `explain("executionStats")` on the top 10 query patterns
3. Create indexes via migration scripts (not ad-hoc shell commands)
4. Add TTL index on `qrSessions.expiresAt` — this automates session cleanup without a cron job
5. Monitor index usage with `$indexStats` aggregation monthly

**Expected Impact:** Document vault queries drop from O(n) collection scans to O(log n) index lookups. QR sessions auto-expire without background job overhead.

**Engineering Effort:** S — 3-4 days. The work is mostly analysis (finding slow queries) followed by straightforward index creation.

**Business Value:** Users opening their vault expect sub-second response. Vault performance directly correlates with daily active usage — if it feels slow, users stop opening it.

---

### 5. Granular Authorization Model for Consent-Based Sharing

**Current Behaviour:** Omnimise's core value proposition is granular consent — "share only the exact data you want." The privacy policy confirms this. Implementing this requires a fine-grained authorization layer: user A shares their PAN with employer B but not their Aadhaar, and shares their GitHub profile with employer C but not their salary history. Based on typical early-stage MERN implementations, this is likely handled by a permissions array on each document or a sharing settings object per user.

**Problem:** Simple permission arrays do not scale well for the consent model Omnimise promises. Consider: User shares 5 documents with employer A, 3 with employer B, and 2 with family member C — each with different expiration times. Revoking consent must be instantaneous and auditable. A flat permissions model becomes a nested query nightmare and is difficult to audit reliably.

**Technical Solution:** Introduce a dedicated `consent_grants` collection (or table) that acts as an access control ledger. Each grant record: `{grantId, grantorId, granteeId, granteeType: 'employer'|'family'|'individual', resourceIds: [...], expiresAt, createdAt, revokedAt, auditLog: [...]}`. Authorization middleware checks this collection on every resource access. Revocation is a single update to `revokedAt`.

**Implementation Approach:**
1. Design the `consent_grants` schema with indexes on `{granteeId, revokedAt}` and `{grantorId}`
2. Build authorization middleware that intercepts document access and checks active grants
3. Add a `POST /consents` endpoint for creating grants and `PATCH /consents/:id/revoke` for revocation
4. Append to the `auditLog` array on every access (immutable append-only pattern)
5. Expose a consent management UI (frontend work in a separate phase)

**Expected Impact:** Consent operations become atomic and auditable. Revocation is instant (single field update) instead of cascading permission removals. The audit log satisfies DPDP and GDPR data access recording requirements.

**Engineering Effort:** L — 3-4 weeks. This touches the authorization layer across the entire API surface. Needs thorough testing.

**Business Value:** Granular consent is the product's differentiator. If it does not work flawlessly, the core value proposition collapses. Enterprise HRTMS customers will specifically test this before signing.

---

### 6. Retry Mechanisms for Third-Party Integration Sync

**Current Behaviour:** Omnimise integrates with GitHub, LinkedIn, Dribbble, LeetCode, Codeforces, HackerRank, and 9+ other platforms. Each integration involves OAuth token management and periodic data sync. Third-party APIs are inherently unreliable — rate limits, downtime, token expiration, and schema changes are routine.

**Problem:** Without retry logic, a single failed sync (e.g., GitHub returns 503 for maintenance) leaves the user's profile data stale with no indication of when it will update. If the user notices their GitHub contributions are outdated, they lose trust in the platform's "authenticated" claim. Worse, if an OAuth token expires during sync and the refresh fails, the integration silently breaks.

**Technical Solution:** Implement retries with exponential backoff and circuit breaker patterns. Use the BullMQ queue (from item 1) to schedule sync jobs with built-in retry policies. Add a circuit breaker (e.g., `opossum` library) per integration — if GitHub fails 5 times in 10 minutes, stop hitting it for 30 minutes and notify affected users.

**Implementation Approach:**
1. Each third-party sync becomes a BullMQ job with `attempts: 3, backoff: {type: 'exponential', delay: 5000}`
2. Wrap each integration client in an `opossum` circuit breaker
3. On circuit open, write a status record: `{integration: 'github', status: 'degraded', since: timestamp}`
4. Surface integration health on the user's settings page
5. Auto-refresh expired OAuth tokens before sync attempts (pre-flight check)

**Expected Impact:** Transient third-party failures are handled silently. Persistent outages are surfaced to users transparently rather than as stale data.

**Engineering Effort:** M — 2 weeks. Most of this builds on the queue infrastructure from item 1.

**Business Value:** Integration reliability directly affects the "verified" claim. A platform that shows outdated GitHub data undermines its own trust model.

---

### 7. Input Validation for Government ID Fields

**Current Behaviour:** The platform accepts Aadhaar (12 digits), PAN (10 alphanumeric, format ABCDE1234F), and UAN (12 digits). The privacy policy states these are stored in masked/encrypted format. Client-side validation likely exists for basic format checks.

**Problem:** Client-side validation alone is insufficient. Without server-side validation, malformed IDs can enter the database and corrupt downstream verification processes. Additionally, Aadhaar numbers have a built-in Verhoeff checksum — a valid Aadhaar number is not just any 12-digit string. If the platform does not validate the checksum, users can store invalid Aadhaar numbers that will fail during actual verification.

**Technical Solution:** Implement server-side validation middleware with format validation (regex), Verhoeff checksum validation for Aadhaar, and PAN structure validation (first 5 letters: specific character rules). Reject invalid IDs at the API layer with clear error messages.

**Implementation Approach:**
1. Create a `validators/government-ids.js` module with pure functions: `isValidAadhaar(num)`, `isValidPAN(pan)`, `isValidUAN(uan)`
2. Implement the Verhoeff algorithm for Aadhaar checksum (well-documented, ~50 lines)
3. Add as Express middleware on all routes that accept government ID input
4. Return structured validation errors: `{field: 'aadhaar', error: 'INVALID_CHECKSUM', message: 'The Aadhaar number failed verification check'}`
5. Never log the actual ID value in error responses (ties into PII redaction from item 2)

**Expected Impact:** Eliminates invalid government IDs from entering the system. Prevents downstream verification failures that waste processing time and confuse users.

**Engineering Effort:** S — 2-3 days. The Verhoeff algorithm is standard and well-documented for Indian ID systems.

**Business Value:** Accepting and storing invalid Aadhaar numbers is both a compliance issue and a trust issue. When an employer tries to verify a candidate and the Aadhaar is malformed, it reflects poorly on the platform.

---

### 8. API Error Response Standardization

**Current Behaviour:** In early-stage MERN applications, error handling is typically inconsistent — some routes return `{error: 'message'}`, others return `{message: 'error'}`, and unhandled exceptions return Express's default HTML error page. The platform likely has a mix of error formats across its credential management, auth, vault, and integration endpoints.

**Problem:** Inconsistent error responses make client-side error handling fragile. The Flutter app and React web app each need to handle multiple error formats. This leads to generic "Something went wrong" messages instead of actionable feedback. It also makes debugging harder — without error codes, correlating a frontend error to a backend log entry requires guessing.

**Technical Solution:** Define a standard error envelope: `{status: number, code: 'ERROR_CODE', message: 'Human readable', details?: object, requestId: string}`. Create a centralized error handler middleware in Express that catches all thrown errors and formats them consistently. Use error code enums (e.g., `AUTH_TOKEN_EXPIRED`, `VAULT_DOCUMENT_NOT_FOUND`, `CONSENT_REVOKED`).

**Implementation Approach:**
1. Define an `AppError` class extending `Error` with `statusCode`, `errorCode`, and `details`
2. Create `errors/codes.js` with all error code constants
3. Add a global error handler middleware as the last Express middleware
4. Refactor existing routes to throw `AppError` instead of `res.status(500).json({...})`
5. Include `requestId` from the logging correlation ID (item 2)

**Expected Impact:** Client applications get predictable error formats. Error codes enable specific UI handling (e.g., `CONSENT_REVOKED` shows a "access revoked" screen instead of a generic error). Debugging time decreases because errors are traceable via `requestId`.

**Engineering Effort:** M — 2 weeks. Touches every route handler, but the changes per route are small (replace ad-hoc error responses with `throw new AppError(...)`).

**Business Value:** Professional error handling is visible to integrators and HRTMS customers. Raw stack traces or HTML error pages in API responses signal engineering immaturity.

---

### 9. Document Upload Pipeline Reliability

**Current Behaviour:** Users upload academic certificates, salary slips, government IDs, and portfolio documents. These likely go through the Express server to S3 (or Cloudinary for images). The privacy policy mentions "secure vault" storage.

**Problem:** Direct-to-server uploads for large files (multi-page transcripts, high-resolution certificates) block Express.js request handling. If the upload takes 30 seconds over a slow mobile connection and the server process restarts (deployment, OOM), the upload is lost with no recovery. The user has to start over with no indication of what went wrong.

**Technical Solution:** Use S3 presigned URLs for direct browser/app-to-S3 uploads. The server generates a time-limited presigned URL, the client uploads directly to S3, and on completion, notifies the server to record the document metadata. This removes the server from the upload data path entirely.

**Implementation Approach:**
1. Create a `POST /vault/upload-url` endpoint that returns a presigned S3 PUT URL (5-minute expiry)
2. Client uploads directly to S3 using the presigned URL with progress tracking
3. S3 event notification (via SQS or Lambda) triggers metadata recording in MongoDB
4. Add server-side validation of uploaded file (size, MIME type by magic bytes — not extension) via a Lambda trigger
5. Client shows upload progress bar since the XHR/fetch goes directly to S3

**Expected Impact:** Server is no longer a bottleneck for uploads. Users get real progress bars instead of indeterminate spinners. Failed uploads can be retried without server intervention.

**Engineering Effort:** M — 2 weeks. S3 presigned URLs are well-documented. The main work is refactoring the client-side upload flow.

**Business Value:** Document upload is the first action new users take. If it fails or feels slow, they do not return.

---

### 10. Deployment and Infrastructure Hardening

**Current Behaviour:** The application runs on AWS (EC2, S3). As an early-stage product, it likely runs on a single or small number of EC2 instances behind a load balancer, with manual or basic CI/CD deployment.

**Problem:** Single-instance deployments have zero fault tolerance. A deployment or instance failure means downtime. For a platform that stores government IDs and promises "always secure, always private," any downtime undermines the trust claim. Additionally, without infrastructure-as-code, environment drift between staging and production is likely.

**Technical Solution:** Containerize the Node.js application with Docker, deploy via ECS Fargate (eliminates EC2 management), and define infrastructure with Terraform or AWS CDK. Set up a minimum of 2 tasks across 2 availability zones for high availability.

**Implementation Approach:**
1. Create a `Dockerfile` for the Node.js application and worker processes
2. Set up an ECR repository for container images
3. Define ECS Fargate task definitions and service (2 min tasks, ALB health checks)
4. Use AWS CDK (TypeScript — aligns with the Node.js stack) for infrastructure definitions
5. Set up a GitHub Actions pipeline: test -> build image -> push to ECR -> deploy to ECS
6. Add CloudWatch alarms for CPU/memory, 5xx rate, and task health

**Expected Impact:** Zero-downtime deployments via rolling updates. Automatic recovery from instance failures. Reproducible infrastructure eliminates "works on my machine" and staging/prod drift.

**Engineering Effort:** L — 3-4 weeks for initial setup. Ongoing maintenance cost is low once established.

**Business Value:** Enterprise HRTMS customers will ask about uptime SLAs. Without HA deployment, the answer is "we don't have one," which is a deal-breaker for any organization handling employee data.

---

## Frontend Analysis

### 1. Server-Side Rendering for Search Engine Visibility

**Current Behaviour:** The website (omnimise.com) is a React single-page application. A `site:omnimise.com` Google search returns zero indexed pages. The initial HTML response contains a `Loading...` placeholder and an empty `<div id="root">` — content is rendered entirely by JavaScript after the bundle loads.

**Problem:** Search engines cannot index client-rendered content reliably. Google's crawler does execute JavaScript, but with a crawl budget that deprioritizes heavy JS rendering. For a product that depends on organic discovery (job seekers searching for credential verification, employers searching for BGV solutions), zero indexing means zero organic traffic. Every user acquisition currently depends on direct referrals or paid channels.

**Technical Solution:** Migrate the React SPA to Next.js with static generation (SSG) for marketing pages (landing, pricing, features) and server-side rendering (SSR) for dynamic pages (public portfolio views, shared credential pages). This ensures Google receives fully rendered HTML on first request.

**Implementation Approach:**
1. Initialize a Next.js project alongside or replacing the existing React app
2. Move marketing pages to `getStaticProps` — these change infrequently and can be statically generated
3. Public portfolio/resume pages use `getServerSideProps` — they need current data
4. Add proper `<title>`, `<meta description>`, Open Graph tags per page
5. Submit sitemap.xml to Google Search Console
6. Retain the existing React SPA for authenticated dashboard views (no SEO need)

**Expected Impact:** Pages become indexable. Organic traffic from searches like "verified resume India" or "background verification platform" becomes possible. First contentful paint improves from ~3s (JS parse + execute) to <1s (server-rendered HTML).

**Engineering Effort:** L — 3-4 weeks. Next.js migration is the largest frontend initiative but has well-documented migration paths from Create React App.

**Business Value:** Without SEO, the product is invisible to its target market. This single change likely has the highest ROI of any frontend work.

---

### 2. Skeleton Loading States for Document-Heavy Views

**Current Behaviour:** The vault and portfolio views load documents (images, PDFs, metadata) from S3/Cloudinary. During loading, users likely see either a blank screen, a full-page spinner, or a brief flash of unstyled content. Based on the SPA architecture, there is a single loading indicator rather than per-component loading states.

**Problem:** Full-page spinners give no indication of progress or layout structure. Users cannot predict what the page will look like or how long loading will take. On slow mobile networks (common in India's tier-2/3 cities — a key market for credential verification), a 3-5 second spinner with no visual progress feels broken. Users interpret "nothing visible" as "not working" and close the app.

**Technical Solution:** Implement skeleton screens (content-shaped placeholder animations) for the vault list, credential cards, and portfolio sections. Each component renders its own skeleton variant while data loads, preserving the page layout structure.

**Implementation Approach:**
1. Create a reusable `<Skeleton>` component with configurable width/height/border-radius
2. Build skeleton variants for: credential card, document list item, portfolio section, resume preview
3. Use React Suspense boundaries or conditional rendering based on data-fetching state
4. Add shimmer animation (CSS `@keyframes` with gradient translate — no JS animation library needed)
5. Ensure skeletons match the exact dimensions of real content to prevent layout shift (CLS = 0)

**Expected Impact:** Perceived loading time drops significantly. Users see the page structure immediately, which reduces bounce rate during slow loads. Layout shift is eliminated, improving Core Web Vitals.

**Engineering Effort:** S — 1 week. Skeleton components are straightforward to build. The work is primarily creating variants that match existing component dimensions.

**Business Value:** Indian users on mobile networks are the primary audience. Perceived performance on 3G/4G directly determines whether a first-time user completes their credential upload.

---

### 3. Form Validation UX for Sensitive Fields

**Current Behaviour:** The platform collects Aadhaar (12 digits), PAN (ABCDE1234F format), UAN (12 digits), phone numbers, and addresses. Form validation likely exists but, based on typical React form implementations, may only trigger on submit rather than inline.

**Problem:** Submitting a form and then discovering that the Aadhaar number is wrong is frustrating — especially when the user has already filled 10+ fields. For government ID fields, the stakes are higher: users may not know the exact format required. A PAN number has a specific structure (5 letters, 4 digits, 1 letter) that is not obvious to everyone. Without inline guidance, users enter malformed data, submit, get a generic error, and must figure out what went wrong.

**Technical Solution:** Implement real-time inline validation with progressive disclosure. Validate on blur (not on every keystroke — too aggressive) with clear error messages that explain the expected format. Add input masks for structured fields (Aadhaar: `XXXX XXXX XXXX`, PAN: auto-uppercase).

**Implementation Approach:**
1. Use a form library with per-field validation support (React Hook Form with Zod schemas)
2. Add Zod schemas for: Aadhaar (12 digits, Verhoeff checksum), PAN (regex + structure), UAN (12 digits), phone (10 digits with optional +91)
3. Implement input masks using a lightweight library (`react-input-mask` or custom) for Aadhaar spacing and PAN uppercasing
4. Show validation state inline: green checkmark on valid, red border + message on invalid
5. Add helper text below sensitive fields: "Format: ABCDE1234F" for PAN

**Expected Impact:** Form completion rate increases because users get immediate feedback. Invalid submissions drop, reducing server-side validation errors and support queries about "why my Aadhaar isn't working."

**Engineering Effort:** S-M — 1-2 weeks. Depends on how many forms exist across the application.

**Business Value:** Government ID entry is a high-stakes moment in the onboarding flow. A bad experience here (confusing errors, unclear formats) causes users to abandon signup.

---

### 4. Consistent Error States for Third-Party Integration Failures

**Current Behaviour:** The platform connects to 15+ third-party services (GitHub, LinkedIn, Dribbble, etc.). Each integration can fail independently — OAuth token expiry, API changes, rate limiting, or service outage. The current error handling for these failures likely varies per integration: some may show a generic toast, others may silently fail, and some may show a blank card where data should appear.

**Problem:** Inconsistent error presentation confuses users. A blank GitHub activity card looks the same as "no GitHub activity" — the user cannot tell if it is a data issue or a sync failure. Without clear error states, users may think the platform is not working when it is actually a third-party issue outside Omnimise's control.

**Technical Solution:** Create a standardized integration error component with three states: (1) loading (skeleton), (2) error with retry (explicit "Reconnect" button and explanation), (3) degraded (partial data with "last synced" timestamp). Apply this component to all integration cards.

**Implementation Approach:**
1. Create an `<IntegrationCard>` wrapper component with `status` prop: `loading | error | degraded | ready`
2. Error state shows: integration icon, "Unable to connect to GitHub" message, "Reconnect" button, and "Last synced: 2 hours ago" if stale data is available
3. Degraded state shows stale data with a warning banner: "Showing data from Jun 24. Sync in progress."
4. Add a global integration health indicator on the dashboard (green/yellow/red per service)
5. Store last sync timestamp and status per integration in local state and the backend

**Expected Impact:** Users can distinguish between "no data" and "sync failed." The "Reconnect" button gives them agency instead of waiting for an invisible background process. Reduces support tickets about "missing" integration data.

**Engineering Effort:** M — 2 weeks. Building the wrapper component is quick; retrofitting it across 15+ integrations takes time.

**Business Value:** Integration reliability is a core part of the "verified" promise. Transparent error handling builds trust, while silent failures erode it.

---

### 5. Responsive Layout Refinement for Mobile Web

**Current Behaviour:** The website serves a React SPA to all viewport sizes. The landing page content (hero, feature sections, testimonials, footer) likely uses basic CSS media queries but may not be optimized for intermediate breakpoints (600-900px range common on tablets and large phones).

**Problem:** Users who discover Omnimise on mobile (the likely majority in India) experience the website before the app is available on the Play Store. If the mobile web experience has overlapping elements, truncated text, or touch targets smaller than 48px, these users will not convert to sign-ups. The "Loading..." initial state visible in the HTML source is particularly problematic on mobile — first-time visitors on slow networks see "Loading..." for several seconds and may leave.

**Technical Solution:** Audit and fix responsive layouts at three breakpoints: 375px (mobile), 768px (tablet), 1024px+ (desktop). Ensure all touch targets are 48px minimum, text is readable without zoom (16px minimum body font), and no horizontal scrolling occurs at any viewport width.

**Implementation Approach:**
1. Run Lighthouse mobile audit and fix flagged accessibility/performance issues
2. Test all pages at 375px, 414px, 768px, 1024px, and 1440px using Chrome DevTools
3. Replace fixed-width containers with `max-width` + percentage-based or CSS Grid layouts
4. Ensure all buttons and interactive elements are 48x48px minimum
5. Add the `<meta name="viewport" content="width=device-width, initial-scale=1">` tag if missing
6. Optimize hero images for mobile (serve smaller variants via `srcset` or Cloudinary transforms)

**Expected Impact:** Mobile web conversion rate (visit -> signup) improves. Eliminates frustrating interactions on smaller screens.

**Engineering Effort:** S-M — 1-2 weeks depending on the current state of responsive CSS.

**Business Value:** Until the Flutter app ships to the Play Store, mobile web is the only mobile experience. If it is broken, the product is effectively inaccessible to mobile-only users.

---

### 6. Accessible Document Upload Flow

**Current Behaviour:** The vault upload flow likely uses a file input or drag-and-drop zone for document uploads. Accessibility for these components (screen reader support, keyboard navigation, focus management) is rarely prioritized in early-stage products.

**Problem:** Users with visual impairments cannot navigate the upload flow if the file picker has no ARIA labels, the drag-and-drop zone has no keyboard equivalent, and upload progress is only communicated visually (progress bar with no `aria-valuenow`). Beyond accessibility compliance, this excludes users who rely on assistive technology — relevant given that Omnimise targets a broad user base including government document management.

**Technical Solution:** Add ARIA attributes to the upload component: `aria-label` on the drop zone, `role="button"` with keyboard activation, `aria-live="polite"` for upload progress announcements, and `aria-describedby` for file format requirements. Ensure the entire upload flow is completable via keyboard only.

**Implementation Approach:**
1. Add `role="button"` and `tabIndex={0}` to the drop zone with `onKeyDown` handler for Enter/Space
2. Add `aria-label="Upload document. Accepted formats: PDF, JPG, PNG. Maximum size: 10MB"`
3. Wrap the progress indicator with `aria-live="polite"` and announce percentage changes
4. On upload complete, announce "Document uploaded successfully" via an `aria-live` region
5. Ensure focus moves logically: file picker -> upload button -> progress -> success confirmation

**Expected Impact:** The upload flow becomes usable for screen reader users and keyboard-only users. Satisfies WCAG 2.1 Level AA criteria for form inputs.

**Engineering Effort:** S — 3-5 days. The changes are additive (ARIA attributes and keyboard handlers) and do not require visual redesign.

**Business Value:** Accessibility compliance is increasingly a legal requirement (India's Rights of Persons with Disabilities Act, 2016). For a platform targeting government document management, this is not optional.

---

### 7. State Management for Consent Controls

**Current Behaviour:** The granular consent feature allows users to select exactly which documents to share with specific recipients, set expiration times, and revoke access. This involves complex UI state: multi-select checkboxes, per-document permission toggles, recipient selection, and expiry date pickers — all for a single share action. Based on typical React implementations, this state may live in local component state or be partially managed by a global store (Context or Redux).

**Problem:** Complex multi-step consent forms are prone to state bugs. If the user selects 5 documents, chooses an expiry, then navigates back to change a document selection, the expiry state may reset. If the form state is only in component state, navigating away and returning loses all selections. These bugs are subtle and only appear in non-linear user flows.

**Technical Solution:** Use a dedicated state management approach for the consent flow — either a reducer pattern (useReducer) with a well-defined state shape or a state machine library (XState) that models the consent flow as explicit states: `idle -> selecting_documents -> setting_permissions -> confirming -> submitted`. State machines prevent impossible transitions and make the consent logic testable.

**Implementation Approach:**
1. Model the consent flow as an XState machine with states and transitions
2. Define the state shape: `{documents: [{id, selected, permissions}], recipients: [...], expiresAt, status}`
3. Each UI action dispatches an event to the state machine (e.g., `TOGGLE_DOCUMENT`, `SET_EXPIRY`, `ADD_RECIPIENT`)
4. Persist draft consent state to sessionStorage so navigating away does not lose progress
5. Write unit tests for the state machine transitions independently of the UI

**Expected Impact:** Eliminates state-related bugs in the consent flow. The state machine prevents invalid states (e.g., submitting without any documents selected). Draft persistence improves UX for users who need to check something mid-flow.

**Engineering Effort:** M — 2 weeks. XState has a learning curve, but the consent flow is a contained scope.

**Business Value:** Consent is the product's core interaction. State bugs in the sharing flow directly cause failed or incorrect data sharing — the worst possible outcome for a privacy-focused platform.
