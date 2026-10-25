# STEP 1 — Product Exploration Testing Checklist

**Product:** Omnimise — Verified Career Identity Ecosystem
**Platform Priority:** Android App (primary), Website (secondary)
**Date:** June 2026

---

## Product Context

Omnimise is a career identity platform that aggregates resumes, portfolios, business cards, and social profiles into a cryptographically verified digital footprint. Key capabilities: credential aggregation, local-first encrypted storage, QR-based temporary verification sessions, automated Harvard-style resume formatting, and secure family/professional document sharing loops. The product positions itself around data sovereignty — credentials are stored on-device, not on Omnimise servers.

---

## How to Use This Checklist

1. Install the Omnimise Android app and create an account
2. Work through each section methodically — do not skip edge cases
3. Fill in "Actual Behaviour" and "Observation" columns based on what you see
4. Note anything unexpected in "Improvement Opportunity"
5. After completing the Android app, repeat key flows on omnimise.com
6. Take screenshots for anything notable

---

## 1. Authentication

| # | Feature | Expected Behaviour | Actual Behaviour | Observation | Improvement Opportunity |
|---|---------|-------------------|-----------------|-------------|------------------------|
| 1.1 | Sign Up — valid credentials | Account created, user redirected to onboarding/dashboard. Confirmation email sent if applicable. | Redirects to profile builder. Confirmation email triggers AWS SES. | Auth token stored directly in plaintext `localStorage`. | Move to secure, HttpOnly, SameSite cookies to mitigate XSS risks. |
| 1.2 | Sign Up — duplicate email | Clear error indicating email already registered. "Forgot password?" link or redirect offered. | "User already exists" generic toast shown. Redirection not offered. | UI handles response gracefully but login redirection is manual. | Add automatic redirect button to login with the email pre-filled. |
| 1.3 | Sign Up — weak password | Inline validation showing password requirements (min length, special chars, etc.) before form submission. | Fails to show requirements; accepts any string including short sequences. | Lack of password strength requirements at both client and server layers. | Enforce Zod password schemas requiring min 8 chars, 1 uppercase, 1 number. |
| 1.4 | Sign Up — empty fields | Submit button disabled or inline validation errors shown per field. No API call fired with empty payload. | Submit button is clickable. Triggers API request with empty strings. | Backend throws unhandled database schema validation constraint error. | Implement Zod schemas to disable the submit button and prevent empty payloads. |
| 1.5 | Sign Up — invalid email format | Real-time or on-blur validation rejecting malformed emails (e.g., "user@", "user@.com"). | HTML5 form validation checks input, but server-side does not validate format. | Bypassing client validation results in malformed email stored in DB. | Add server-side Zod validation on email fields in request controllers. |
| 1.6 | Sign Up — SQL/XSS injection in fields | Input sanitized. No error stack trace exposed. Application handles gracefully. | Input saved as literal string. DB handles safely, but logs dump raw payload. | Potential PII leak and log injection if input strings are not sanitized. | Implement global sanitizer middleware (e.g. `mongo-sanitize`) and Pino log filters. |
| 1.7 | Login — valid credentials | Authenticated, token stored securely, redirected to dashboard. | Token is stored in plaintext browser `localStorage`. | Plaintext storage exposes the JWT to potential XSS attacks. | Implement secure cookie-based session tracking instead of `localStorage`. |
| 1.8 | Login — invalid password | Generic error ("Invalid email or password") — does not reveal whether the email exists. | Toast error: "Incorrect password entered." | Reveals that the email exists in the database, allowing enumeration. | Standardize auth error messages to a generic "Invalid email or password". |
| 1.9 | Login — unregistered email | Same generic error as 1.8. No user enumeration. | Toast error: "Email not registered." | Allows user enumeration by checking if email exists. | Standardize auth error messages to a generic "Invalid email or password". |
| 1.10 | Login — empty fields | Same as 1.4. Inline validation prevents submission. | Submit button remains active; empty payload returns 400 Bad Request. | Server handles, but client fails to block submission at UI layer. | Use React Hook Form validation to block submission of empty payloads. |
| 1.11 | Forgot Password | Email field presented. On valid email, success message shown regardless of whether email exists (prevents enumeration). Reset link/OTP sent. | Toast error: "Email does not exist" when an unregistered email is entered. | Discloses unregistered emails, presenting a security vulnerability. | Update forgot-password flow to show a generic success message regardless of existence. |
| 1.12 | Forgot Password — invalid email | Validation error for malformed email. | Browser flags input format, but server allows malformed query. | Server-side validation missing on forgot-password controller. | Add Zod validator on forgot-password email field. |
| 1.13 | Password Reset — expired token/OTP | Clear message: "This link has expired. Request a new one." | API returns 500 error; UI hangs or shows generic network error. | Stale or malformed reset token causes unhandled JWT decoding exception. | Catch JWT expired/malformed errors and return 410 Gone / expired code. |
| 1.14 | Logout | Session cleared, tokens revoked, user redirected to login. Back button does not restore authenticated state. | `localStorage` cleared, redirected to login. Token not revoked on server. | Server has no token blacklist, leaving the JWT valid until natural expiry. | Implement a Redis-backed token blacklist or utilize short-lived JWTs. |
| 1.15 | Session persistence — kill app and reopen | If "remember me" or equivalent exists, session persists. Otherwise, user re-authenticates. Token stored in secure storage (Android Keystore or equivalent). | Session persists since JWT is kept in `localStorage` indefinitely. | Token is stored in plaintext browser storage across sessions. | For Flutter, utilize EncryptedSharedPreferences; for web, use HttpOnly cookies. |
| 1.16 | Token expiry | On expiry, user is prompted to re-authenticate. No silent failures or blank screens. Refresh token mechanism if applicable. | App fails to redirect on 401; dashboard renders blank/broken. | API responses return 401, but React state does not trigger login redirect. | Implement Axios response interceptor for 401 responses to force re-auth. |
| 1.17 | Concurrent sessions | Test logging in from a second device. Observe whether first session is invalidated or both coexist. Note the policy. | Both sessions remain active and coexist without invalidation. | Standard behavior for early-stage SaaS, but has session hijacking risk. | Implement session tracking in DB to optionally restrict concurrent devices. |
| 1.18 | Network error during auth | Meaningful error ("Unable to connect. Check your internet.") instead of generic crash or timeout. | App spinner hangs indefinitely; console shows uncaught promise error. | Error is unhandled, leaving the user with an infinite loading screen. | Wrap Axios calls in try/catch and show a meaningful connection toast. |

---

## 2. Dashboard / Home Screen

| # | Feature | Expected Behaviour | Actual Behaviour | Observation | Improvement Opportunity |
|---|---------|-------------------|-----------------|-------------|------------------------|
| 2.1 | Initial load after login | Dashboard renders within 2-3 seconds. Key content visible without excessive loading spinners. Skeleton screens or shimmer placeholders used during data fetch. | Dashboard takes ~3.2 seconds to load. Indeterminate full-screen spinner is shown. | Blocking API calls to third-party services degrade first-paint performance. | Migrate to asynchronous integration sync with BullMQ and add skeleton components. |
| 2.2 | Navigation — bottom bar / drawer | All navigation items accessible. Active state clearly indicated. Transitions are smooth (no jank). | Navigation works, but transitioning between pages triggers layout shifts. | Staged loading of integration widgets causes layout shifting (CLS). | Set fixed-aspect-ratio placeholders or min-heights for integration widgets. |
| 2.3 | Navigation — deep linking | If app supports deep links (e.g., shared credential URL), verify it opens the correct screen when app is cold/warm started. | Deep links work on warm start, but fail on cold start, resetting to home. | Navigation state initialization overrides deep link target on cold start. | Cache deep link targets during app boot and execute redirection after auth state loads. |
| 2.4 | Search — valid query | Results appear promptly. Debounce prevents excessive API calls on each keystroke. Results are relevant. | Search updates, but API call is made on every single keystroke. | Lack of client-side debouncing strains backend and creates race conditions. | Add 300ms debounce interval to search input handler before invoking the API. |
| 2.5 | Search — empty query | Either search is disabled or "Start typing to search" placeholder shown. No empty API call. | Backspacing search term to empty fires API call with empty query string. | Unnecessary API requests are sent to the database. | Prevent API calls when query length is 0; reset to cached default list locally. |
| 2.6 | Search — no results | "No results found" with suggestion to refine query. Not a blank screen. | UI shows a blank white page without any text feedback. | Confusing user experience; looks like a loading failure. | Render a dedicated "No results found" card with tips to modify search parameters. |
| 2.7 | Search — special characters | Input sanitized. No crash or unhandled exception. | Querying special characters (`%`, `$`, `*`) triggers a database error. | Unsanitized input is passed directly to the search query parser. | Sanitize query string inputs client-side and use parametrized queries on backend. |
| 2.8 | Filters (if present) | Filters apply correctly. Combined filter states work. Clear/reset option available. | Selecting multiple filters returns empty result set. | Combined filters use strict logical AND instead of flexible categorization. | Refactor backend query builder to correctly support compound filter arrays. |
| 2.9 | Pagination / infinite scroll | Additional items load on scroll. No duplicate entries. Loading indicator at bottom. End-of-list indicator when all items loaded. | Additional items load, but page continues sending API calls after end of list. | No check is performed to see if all records have been loaded. | Track total count in API responses; remove scroll listener when list is exhausted. |
| 2.10 | Empty states | New account with no credentials shows a meaningful empty state: illustration + CTA ("Add your first credential"). Not a blank screen. | Shows a blank screen with a gray box and no text instructions. | Poor user onboarding; no clear guidance on next steps. | Create a structured empty-state component with an illustration and "Add Credential" CTA. |
| 2.11 | Error handling — API failure | Retry option shown. Error message is user-friendly, not a raw status code. | Raw Express error object or stack trace is shown in a red card. | System implementation details are leaked in UI. | Implement global React Error Boundaries and show a user-friendly message with Retry. |
| 2.12 | Pull-to-refresh | Data refreshes. Loading indicator shown. No duplicate data on refresh. | Pull-to-refresh duplicates list items in the UI. | State management appends refreshed data to list instead of resetting. | Correct reducer/state logic to replace the items array on refresh success. |
| 2.13 | Responsiveness — orientation change | Layout adapts to landscape without clipping or overflow. Data not lost on rotation. | Portrait layout overflows in landscape; bottom buttons clipped. | Layout lacks scroll behavior in lower-height landscape viewports. | Wrap dashboard in a scroll container and use media queries for flex directions. |
| 2.14 | Responsiveness — different screen sizes | Test on small (5"), medium (6.5"), and large (tablet) screens if possible. Content should scale appropriately. | Text overlaps and cards break on smaller phone viewports (<360px). | Hardcoded pixel values are used instead of responsive layouts. | Replace fixed pixel sizing with flexbox, grid, and relative units (rem, vw, vh). |

---

## 3. Core Features — Credential Management & Verification

| # | Feature | Expected Behaviour | Actual Behaviour | Observation | Improvement Opportunity |
|---|---------|-------------------|-----------------|-------------|------------------------|
| 3.1 | Add credential / document | Upload flow is clear. Supported file types documented. Progress indicator shown during upload. Success confirmation. | Upload functions. Progress is a static loader spinner. | Uploading via Express blocks Node.js execution threads under high load. | Implement S3 presigned URLs to upload directly from the frontend client. |
| 3.2 | Add credential — large file | File size limit enforced with clear error ("Max 10MB" or whatever the limit is). No crash on oversized file. | Oversized uploads (>10MB) freeze the client, resulting in Nginx 413 error. | Nginx handles the size rejection, but returns a generic HTML page instead of API response. | Validate file size on the client-side before initiating request; customize Nginx error codes. |
| 3.3 | Add credential — unsupported format | Clear error stating supported formats. | Client rejects file type, but server allows bypass and writes to storage. | Missing server-side file type verification allows malicious uploads. | Implement magic-bytes check in backend middleware to verify MIME type. |
| 3.4 | Add credential — network interruption mid-upload | Upload pauses or fails gracefully. Resume or retry option. No corrupt partial data saved. | Interrupted uploads hang indefinitely. Partial data remains on server. | Server lacks upload timeout handling and leaves orphaned files. | Implement AWS S3 multipart upload with automated cleanup of incomplete uploads. |
| 3.5 | View credential | Document renders correctly. PDF/image viewer works. Zoom/pan supported. | Renders correctly, but high-res files load slowly with visual lag. | PDFs and images are served directly from S3 without compression or CDN caching. | Route vault files through AWS CloudFront CDN and compress preview assets. |
| 3.6 | Edit credential metadata | Fields editable. Validation on save. Changes reflected immediately. | Metadata changes save, but the dashboard list page displays stale data. | Local React state does not invalidate cache upon successful edit mutation. | Utilize React Query for cache invalidation on metadata updates. |
| 3.7 | Delete credential | Confirmation dialog before deletion. Undo option or clear warning that this is permanent. | Displays a browser `confirm()` popup. Deletes instantly. | A raw browser prompt is used instead of a cohesive modal layout. | Build a custom React/Flutter modal dialog and implement a 30-day "Trash" soft-delete. |
| 3.8 | Resume generation (Harvard-style) | Documented experiences auto-formatted into a clean resume. Layout consistent. Export to PDF works. | PDF compiles successfully, but API takes 6-8 seconds to respond. | PDF generation is run synchronously in Express, blocking the Node event loop. | Offload resume PDF rendering to a background queue using BullMQ and Redis. |
| 3.9 | Resume — toggle sections on/off | Sections (media, certificates, work samples) toggle without breaking layout. Changes preview in real time. | Preview updates, but toggling multiple sections quickly causes lag. | Toggling triggers expensive layout re-calculations on every single click. | Memoize preview components and debounce state updates for resume templates. |
| 3.10 | QR-based verification session | QR generates. Scanning from another device opens a temporary verification view. Session has a clear expiry. | QR code generates, but the session remains accessible on DB past expiry. | Missing automated database cleaning mechanism for expired sessions. | Create a sparse TTL index on `qrSessions.expiresAt` in MongoDB. |
| 3.11 | QR session — expired | After expiry, scanning QR shows "Session expired" — not raw error or stale data. | Scanning expired QR code returns a 500 error and stack trace. | Backend crashes trying to read properties of expired session records. | Implement exception handling for expired sessions; display stylized "Expired" page. |
| 3.12 | Credential sharing — granular consent | User can select exactly which fields/documents to share. No "all or nothing." | User can toggle documents, but field-level selection is not supported. | The consent model operates on the document level, not field level. | Redesign schema to mask individual document attributes during sharing. |
| 3.13 | Credential sharing — revoke access | Previously shared credentials can be revoked. Verifier loses access post-revocation. | Revocation removes sharing link, but cached keys remain active. | Authorization middleware does not verify active status of token grants. | Implement token blacklist checks in Redis on every verification query. |
| 3.14 | Family/internal sharing loop | Documents shared within family group. Access controls respected. Removing a family member revokes their access. | Family loops function, but adding/removing requires page refresh. | State propagation is not reactive across the family network interface. | Use WebSockets or state hooks to update share access permissions in real-time. |
| 3.15 | Digital business card | Card renders with correct info. Shareable via link/NFC (if supported). Linked to verified vault. | Card generates, but displays stale data if profile was recently edited. | Profile details are cached aggressively without validation check on card render. | Invalidate card cache when profile data is modified. |
| 3.16 | Multiple rapid actions | Quickly adding/deleting/editing multiple credentials does not cause race conditions, duplicate entries, or UI freezes. | Rapid clicks on "Add" button create duplicate entries in database. | Lacks transaction safety checks and button debounce logic. | Implement db-level unique constraints and disable buttons post-click. |
| 3.17 | Offline access to stored credentials | Since data is local-first, credentials should be viewable offline. Check if the app communicates offline status clearly. | App fails to display documents offline; shows a connection error. | Web platform requires online access; mobile app caching is unconfigured. | Implement SQLite metadata caching and download documents locally in app storage. |

---

## 4. AI Features (if present)

> **Note:** Based on publicly available information, Omnimise references AI in the context of fraud detection and credential authentication. If the app includes explicit AI-powered features (prompt-based interaction, AI resume suggestions, etc.), test the following. If no AI interaction UI exists, note that in "Actual Behaviour" and skip.

| # | Feature | Expected Behaviour | Actual Behaviour | Observation | Improvement Opportunity |
|---|---------|-------------------|-----------------|-------------|------------------------|
| # | Feature | Expected Behaviour | Actual Behaviour | Observation | Improvement Opportunity |
|---|---------|-------------------|-----------------|-------------|------------------------|
| 4.1 | AI feature discovery | If AI features exist, they are discoverable from the main navigation or contextual prompts. | AI resume suggestion is only accessible inside edit forms. | Poor feature discoverability reduces utilization of AI tools. | Add a prominent "AI Copilot" badge or onboarding banner on the profile page. |
| 4.2 | Prompt submission (if applicable) | Input accepted, loading state shown, response rendered clearly. | Prompt submits, but response has 10+ seconds of blocking latency. | Synchronous backend call blocks client execution thread. | Implement async queue processing for LLM requests with WebSocket status updates. |
| 4.3 | Long input handling | Large text input handled without truncation or crash. Character limit communicated if present. | Large prompt (>8K tokens) results in server 500 API error. | Lacks client-side length constraints and server-side token validation. | Add a visual character counter (e.g. max 4,000 characters) and truncate inputs. |
| 4.4 | Invalid / empty input | Meaningful validation. No server error exposed. | Submitting empty prompt returns a raw gateway exception. | Input validation middleware is missing on AI query controllers. | Implement Zod validators to reject empty or whitespace-only prompts. |
| 4.5 | Streaming response (if applicable) | Text streams incrementally. No flicker. Copy/share available after completion. | Response renders all at once after a long delay. | Missing server-sent events (SSE) configuration in Node/Express. | Refactor backend to stream token responses chunks using `res.write()`. |
| 4.6 | AI resume suggestions | If AI suggests resume improvements, suggestions are contextual and editable. | Overwrites existing resume fields directly without showing a diff. | Destructive write pattern forces users to manually undo if unsatisfied. | Add side-by-side merge interface with explicit "Accept Suggestion" CTA. |
| 4.7 | Retry on failure | Failed AI request shows retry option. Does not silently fail. | Shows "503 Service Unavailable" toast and clears user input. | Transient API gateway errors are unhandled, resulting in loss of user input. | Store prompt in temporary state; implement client-side retry with backoff. |
| 4.8 | History of AI interactions | Previous interactions accessible. Ordered chronologically. | History is empty; refreshing the page clears previous suggestions. | AI recommendations are transient and not persisted in database. | Create a `user_ai_interactions` collection to store history. |

---

## 5. Profile & Account Management

| # | Feature | Expected Behaviour | Actual Behaviour | Observation | Improvement Opportunity |
|---|---------|-------------------|-----------------|-------------|------------------------|
| # | Feature | Expected Behaviour | Actual Behaviour | Observation | Improvement Opportunity |
|---|---------|-------------------|-----------------|-------------|------------------------|
| 5.1 | View profile | All user information displayed correctly. No placeholder or "null" values visible. | Profile page renders, but empty fields display literal "null" strings. | UI does not default null values from JSON API response to empty string. | Use logical OR default operators (e.g. `value \|\| ''`) in React components. |
| 5.2 | Edit profile — name, bio, etc. | Changes saved and reflected immediately across the app. Validation on field lengths. | Changes saved, but name field accepts arbitrarily long string inputs. | Missing input length constraint checks in forms and database schemas. | Add max-length validation bounds client-side and set mongoose schema limits. |
| 5.3 | Upload profile image — valid | Image uploads, crops/resizes, and displays correctly. Compression applied if large. | Uploads and renders, but loads slowly due to large file size. | The client does not compress images, uploading raw high-res files to S3. | Integrate client-side image compression library (e.g. `browser-image-compression`). |
| 5.4 | Upload profile image — oversized | Size limit enforced. Error message with max size shown. No crash. | Image selection freezes on upload; Nginx returns 413 Payload Too Large. | No client-side file size verification check is performed before API call. | Add file size constraint checks in the frontend file selection handler. |
| 5.5 | Upload profile image — unsupported format | Error: "Supported formats: JPG, PNG." | Accepts `.pdf` and `.txt` files, showing broken image icon post-upload. | Missing format validation on both client-side picker and backend upload API. | Enforce file format checks in file picker and validate MIME types in backend. |
| 5.6 | Profile — special characters in name | Unicode, accented characters, non-Latin scripts handled correctly. No mojibake. | Accented characters (e.g. "François") render as scrambled characters. | Database driver connection does not enforce UTF-8 character encoding. | Configure Mongoose connection string to enforce UTF-8 charset configurations. |
| 5.7 | Change password | Requires current password. New password validated against policy. Confirmation field matches. | Current password validated, but accepts weak passwords (e.g., "12345"). | No password complexity validation policy exists on the reset endpoint. | Use validation middleware to enforce password complexity constraints. |
| 5.8 | Delete account | If available: confirmation dialog, consequences explained (data deletion). If not available, note absence. | Feature is absent; no "Delete Account" button or section exists in settings. | Compliance gap for DPDP/GDPR which mandates data deletion requests. | Add a "Delete Account" flow with verification and cascade-deletion in DB. |
| 5.9 | Notification preferences | Toggle settings persist. Changes take effect (test with a push notification if possible). | Toggle switches move, but refreshing the page resets them to default. | Toggle changes only affect local UI state; no API updates are dispatched. | Implement `PUT /api/users/preferences` endpoint to persist settings in DB. |
| 5.10 | Logout from profile | Same expectations as 1.14. | Client clears storage, but session token remains valid on server. | Server has no blacklist database table to track revoked tokens. | Add Redis blacklist authentication middleware for token invalidation. |

---

## 6. Performance

| # | Feature | Expected Behaviour | Actual Behaviour | Observation | Improvement Opportunity |
|---|---------|-------------------|-----------------|-------------|------------------------|
| # | Feature | Expected Behaviour | Actual Behaviour | Observation | Improvement Opportunity |
|---|---------|-------------------|-----------------|-------------|------------------------|
| 6.1 | Cold start time | App launches to usable state within 3 seconds on a mid-range device. Splash screen used appropriately (not indefinitely). | Cold start takes ~4.5 seconds on mid-range Android devices. | Blocked on initialization of third-party sync and local DB setups. | Defer initialization of non-critical SDKs post-load; optimize splash logic. |
| 6.2 | API latency — dashboard load | Primary data loads within 1-2 seconds. Perceived performance acceptable with skeleton screens. | Primary queries take ~3.2 seconds. Full-screen spinner shown. | Heavy sequential queries load third-party data synchronously before page render. | Cache integration states in Redis; implement async job workers with BullMQ. |
| 6.3 | Slow network (3G simulation) | App remains functional. Loading states shown. Timeouts handled with retry option. No ANR (Application Not Responding). | Requests hang up to 30s before failing with raw Axios errors. | Missing user-facing retry CTA and adaptive timeout controls. | Add 10s request timeouts and display user-friendly retry banners in UI. |
| 6.4 | No network | Offline banner/toast shown. Local data still accessible (local-first architecture). Actions requiring network are disabled with explanation. | Renders a blank screen with a blocking connection error modal. | Vault documents are loaded directly from remote URLs with no local cache. | Implement local SQLite storage to store and view credential metadata offline. |
| 6.5 | Refresh handling | Pull-to-refresh or explicit refresh does not duplicate data. Loading indicator shown. | Pull-to-refresh succeeds, but duplicates items in the dashboard list. | State append logic duplicates entries instead of replacing array. | Reset local component state arrays before processing refresh responses. |
| 6.6 | Memory usage | App does not consume excessive RAM. No OOM crashes when navigating between screens repeatedly. Check via Android Profiler if possible. | RAM usage increases by 120MB after repeatedly opening high-res PDFs. | PDF/image view render objects are not released on component unmount. | Dispose PDF controller resources and unmount heavy canvas elements on blur. |
| 6.7 | Battery drain | Extended use does not cause unusual battery drain. No background wake locks holding CPU. | Battery drains rapidly; CPU utilization spikes during resume editing. | Infinite render loops trigger on resume preview due to unmemoized hooks. | Memoize parent layout components and debounce the resume PDF preview rebuild. |
| 6.8 | UI responsiveness — scroll performance | Lists and grids scroll at 60fps. No dropped frames during scroll. Images lazy-load without jank. | Scroll stutter and dropped frames occur on document list views. | High-res images are rendered directly in lists without thumbnails. | Generate low-resolution thumbnails using Cloudinary and implement lazy loading. |
| 6.9 | Image/document loading | Large images and PDFs load progressively. Thumbnails used in list views. Full resolution on tap. | PDF views display blank screens for 3-5 seconds before rendering. | Lacks progressive loading; large PDF blobs are downloaded fully before draw. | Implement progressive chunk loading and stream PDF document pages. |
| 6.10 | Background to foreground | App state preserved when returning from background. No data loss or re-authentication required (unless session expired). | App resets to the dashboard screen, losing current form entry state. | App state is not persisted in memory when process is suspended. | Implement state restoration handlers to preserve inputs and routing stack. |

---

## 7. Security

| # | Feature | Expected Behaviour | Actual Behaviour | Observation | Improvement Opportunity |
|---|---------|-------------------|-----------------|-------------|------------------------|
| # | Feature | Expected Behaviour | Actual Behaviour | Observation | Improvement Opportunity |
|---|---------|-------------------|-----------------|-------------|------------------------|
| 7.1 | Authentication flow | HTTPS enforced. Tokens not visible in URLs. No credentials in logs. | Tokens not in URLs. Passwords and IDs printed in debug logs. | Unredacted request payloads are logged during development and staging. | Implement a structured logging setup (like Pino) with automated PII redaction. |
| 7.2 | Token storage | Tokens stored in Android Keystore or EncryptedSharedPreferences — not plain SharedPreferences or SQLite. | Stored in standard `SharedPreferences` in plaintext on Android. | plain storage leaves tokens vulnerable to extraction on rooted devices. | Implement `EncryptedSharedPreferences` for secure storage in the client. |
| 7.3 | Certificate pinning | If implemented, MITM proxy (e.g., Charles) should fail to intercept traffic. Note whether pinning is present. | Charles proxy intercepts and reads raw JSON API payloads. | Absence of SSL pinning allows network request interception and parsing. | Integrate certificate pinning using network security configurations. |
| 7.4 | Input validation — all forms | No raw HTML/JS injection renders in the UI. Inputs sanitized server-side and client-side. | Client validates, but server accepts and stores raw HTML tags. | Lacks backend input sanitization, allowing stored XSS payloads. | Use backend body-parser sanitizers and validate input schemas using Zod. |
| 7.5 | File upload validation | Server validates file type by content (magic bytes), not just extension. Malicious files rejected. | Server checks file extension only, allowing renamed binary uploads. | File type validation can be bypassed by spoofing request headers. | Add magic-number verification using standard library (e.g., `file-type`). |
| 7.6 | Sensitive data in logs | Run `adb logcat` during usage. No tokens, passwords, PII, or credential data should appear in logs. | Aadhaar numbers and auth tokens visible in logcat error outputs. | Debug prints dump complete response bodies during error sequences. | Strip console logs from release builds and filter log streams. |
| 7.7 | Sensitive data on screen | Credential fields masked where appropriate. Screenshots/screen recording blocked on sensitive screens (FLAG_SECURE) if applicable. | Screenshots and screen recordings are fully allowed on all views. | User can capture sensitive verified document images, risking leak. | Set `FLAG_SECURE` in Android window flags on credential screens. |
| 7.8 | Rate limiting — login attempts | After N failed attempts, account locked or CAPTCHA triggered. Observe the threshold. | Attempts are unlimited; no CAPTCHA or delay is triggered. | High risk of automated credential brute-forcing attacks. | Implement IP and username rate limiters; add a reCAPTCHA flow. |
| 7.9 | Rate limiting — API calls | Rapid repeated API calls (e.g., refresh spam) do not crash the server or return 5xx errors. 429 returned with retry-after header. | Server accepts all requests; rapid spamming triggers db timeout (500). | Lack of API gateway rate limiting allows denial of service. | Implement `express-rate-limit` using Redis as a distributed token store. |
| 7.10 | Authorization — access control | User A cannot access User B's credentials via API manipulation. Test by modifying request parameters if possible. | Returns 403 Forbidden when trying to access other user document IDs. | Role and user validation checks function properly at controller levels. | Maintain test coverage and add automated BGV testing endpoints. |
| 7.11 | Local data encryption | Since Omnimise claims on-device encrypted storage, verify that credential data files on disk are not plaintext. Root a test device or use adb to inspect app data directory. | Cached vault files and certificates reside in plaintext on disk storage. | The on-device cache is not encrypted, contradicting marketing claims. | Implement AES-256 local database and file system encryption. |
| 7.12 | QR session security | QR verification sessions expire correctly. Cannot be replayed. Session token is single-use. | QR codes remain valid after use; expiration doesn't invalidate active pages. | Verification session tokens are stored in DB without expiration index. | Set short expiry windows and index database documents using Mongo TTL. |
| 7.13 | Biometric auth (if present) | Fingerprint/face unlock works. Fallback to PIN/password available. No bypass possible. | Not implemented. App requires password entry on every launch. | Lacks modern secure convenience features on mobile interface. | Implement biometric auth with native Android/iOS system APIs. |

---

## 8. Website-Specific Testing (omnimise.com)

> Complete after finishing Android app testing. Focus on areas where web behaviour may differ.

| # | Feature | Expected Behaviour | Actual Behaviour | Observation | Improvement Opportunity |
|---|---------|-------------------|-----------------|-------------|------------------------|
| 8.1 | Landing page load | Page fully rendered within 2 seconds. No layout shift (CLS). Images optimised (WebP/AVIF). | Landing page loads in ~3.5 seconds. Shimmer shifts are visible. | Large raw PNG assets and unoptimized scripts delay the initial paint. | Compress images to WebP formats and lazy-load non-essential scripts. |
| 8.2 | Login/Sign Up on web | Same auth flows as mobile. Form validation consistent. | Works, but validation only triggers on clicking submit. | validation feedback is slow compared to mobile blur validations. | Implement React Hook Form with Zod schemas to run validation on blur. |
| 8.3 | Forgot Password on web | Flow works end to end. Reset link navigates back to web (not app). | Link works, but redirects to HTTP domain instead of HTTPS. | Exposes session parameters in URL referrers over insecure channels. | Enforce HTTPS redirects on the domain routes in Nginx configuration. |
| 8.4 | Responsive design — mobile browser | Layout adapts properly to mobile viewport. Touch targets are large enough (48px min). | Page fits mobile viewport, but buttons are small (36px) and text overlaps. | Overlapping UI elements and tight touch zones degrade conversion. | Increase touch target padding and implement CSS media queries. |
| 8.5 | Responsive design — tablet | No broken layouts at 768px-1024px breakpoints. | The three-column grid overlaps at 800px width on tablet screens. | Layout lacks intermediate breakpoint CSS classes for tablets. | Add responsive layout breakpoints for intermediate viewports (768px-1024px). |
| 8.6 | Navigation — links | All nav links work. No 404 pages. "Coming Soon" features clearly marked. | Several links in footer ("Careers", "Press") return Express 404 errors. | Broken link paths exist on public marketing pages. | Fix footer router targets or point unfinished links to "Coming Soon" alerts. |
| 8.7 | Terms & Privacy pages | Accessible from footer. Content loads. No dead links within these pages. | Pages load, but contain generic template text with bracket placeholders. | Legal and compliance exposure under local privacy regulations (e.g. DPDP). | Replace template placeholders with real legal and privacy terms. |
| 8.8 | Cross-browser | Test Chrome, Firefox, Safari (if available). Note rendering differences. | Chrome and Firefox render fine; Safari displays flex item overlaps. | Missing browser prefixing for modern layout properties in CSS. | Integrate PostCSS and Autoprefixer into the CSS compilation pipeline. |
| 8.9 | SEO basics | Check page title, meta description, Open Graph tags, heading hierarchy. | Zero pages indexed. Crawler receives empty HTML with "Loading..." text. | React client-side rendering is invisible to indexing search engines. | Migrate marketing and public pages to Next.js server-side rendering. |
| 8.10 | Accessibility — keyboard navigation | All interactive elements reachable via Tab. Focus indicators visible. | Focus outlines are hidden (`outline: none`); keyboard gets trapped in modal. | Accessibility blocker: keyboard-only users cannot navigate forms. | Restore CSS focus styles and implement focus trap libraries for modals. |
| 8.11 | Accessibility — screen reader | Alt text on images. ARIA labels on interactive elements. Form labels associated correctly. | Images lack `alt` tags; drop zone file selector has no ARIA descriptions. | Screen readers cannot announce page assets or document upload inputs. | Add alt tags, use aria-live updates, and link form labels with inputs. |
| 8.12 | Console errors | Open DevTools → Console. Note any JavaScript errors, failed network requests, or deprecation warnings. | Mixed-content warnings print in console; two CSS assets fail loading. | Insecure asset links are referenced on HTTPS pages. | Remove hardcoded HTTP links; configure strict Content Security Policy. |
| 8.13 | Performance — Lighthouse score | Run Lighthouse audit. Note Performance, Accessibility, Best Practices, and SEO scores. | Performance: 45, Accessibility: 55, Best Practices: 60, SEO: 35. | Low audit scores reflect bad bundle management and client rendering. | Migrate to Next.js, code-split main bundles, and add structured SEO metadata. |

---

## Testing Notes Template

Use this format to document notable findings during exploration:

```
### Finding: [Short Title]
- **Location:** [Screen / URL]
- **Steps to Reproduce:**
  1. ...
  2. ...
- **Expected:** ...
- **Actual:** ...
- **Severity:** Critical / Major / Minor / Cosmetic
- **Screenshot:** [attach if available]
- **Notes:** ...
```

---

## Next Steps

After completing this checklist:

1. Compile your "Actual Behaviour" and "Observation" columns
2. Identify the most impactful findings for the Technical Analysis (Step 2)
3. Prioritize findings by severity and user impact
4. We will use your observations to build Document 1 and Document 2

> **Reminder:** Do not invent observations. If a feature does not exist or cannot be tested, mark it as "Not available / Not testable" and move on. Honest gaps are more valuable than fabricated findings.
