# Omnimise QA Exploration & Testing Checklist (Populated Run)

This document is the QA evidence sheet. It logs functional, performance, security, and accessibility test scenarios executed on the Omnimise Android App and Web platform, transforming raw observations into engineering audit notes.

---

## Part 1: Android Application Test Suite

### 1. Authentication

| ID | Feature / Scenario | Expected Behaviour | Actual Behaviour | Observation | Severity (L/M/H/C) | Engineering Notes / Improvement Opportunity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A-1** | **Sign Up** | User can enter details (Email/Phone/Password) and trigger secure registration. Vault key pair generated. | **Success** | Account created. Screen frozen for ~450ms during Ed25519 key generation. | **M** | Offload asymmetric key generation to a background Dart Isolate to prevent UI thread lock. |
| **A-2** | **Login** | Biometric prompt logs user in without password entry. | **Success** | Biometric fingerprint unlock works. | **L** | Ensure biometric tokens are cryptographic signature keys, not simple boolean checks. |
| **A-3** | **Forgot Password** | Recovery phrase verification. | **Success** | Restored vault via bip39 12-word recovery phrase. | **L** | Keep recovery process entirely client-side. |
| **A-4** | **Logout** | Session destroyed. Database locked. | **Success** | Local cache locked; redirect to login. | **L** | Clear raw decryption keys from volatile memory on logout. |
| **A-5** | **Session Persistence** | App force-close persists session securely. | **Success** | Token persisted. | **H** | Session token stored in standard SharedPreferences. Needs migration to EncryptedSharedPreferences. |
| **A-6** | **Invalid Credentials** | Clear validation errors without DB leak. | **Success** | Displays "Invalid Username/Password" error. | **L** | Clean error handling on login API. |
| **A-7** | **Password Validation** | Blocks weak passwords. | **Success** | Enforces min 8 chars with digit/symbol regex. | **L** | Enforced client-side and verified server-side. |
| **A-8** | **Email Validation** | Blocks malformed emails. | **Success** | Regex validation rejects malformed emails. | **L** | Standard frontend form validation. |

---

### 2. Navigation

| ID | Feature / Scenario | Expected Behaviour | Actual Behaviour | Observation | Severity (L/M/H/C) | Engineering Notes / Improvement Opportunity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **N-1** | **Dashboard** | Displays primary credentials and quick buttons. | **Success** | Dashboard loads immediately. | **L** | No major issues. Layout is clean. |
| **N-2** | **Sidebar / Menus** | Drawer slides open smoothly. | **Success** | Drawer menu works, transition is clean. | **L** | Good framerates. |
| **N-3** | **User Flow** | Vault to sharing takes <3 taps. | **Success** | Tapping credential -> Share -> Generate QR takes 2 taps. | **L** | UI flow optimized for quick verification. |
| **N-4** | **Back Stack Handling** | Back button goes to previous view. | **Partial Success**| Pressing Back on Dashboard exits the app immediately instead of showing exit confirm dialog. | **M** | Wrap root Dashboard in `WillPopScope` to handle back button intercept and double-press to exit. |

---

### 3. Core Features

| ID | Feature / Scenario | Expected Behaviour | Actual Behaviour | Observation | Severity (L/M/H/C) | Engineering Notes / Improvement Opportunity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **C-1** | **Document Upload / Vault**| Files upload and encrypt locally. | **Success** | Documents encrypted (AES-256) and saved in local database. | **M** | Large uploads (>15MB) cause UI freeze. Offload file hashing and encryption to background worker. |
| **C-2** | **AI Resume Generation** | Toggle sections to compile Harvard-style resume. | **Success** | Compiled PDF resume. | **M** | Compilation happens server-side, takes 3.8s. Move rendering to local device or add skeleton loader. |
| **C-3** | **Credential Sharing / QR**| QR reveals only selected attributes. | **Fail** | Scanning generated QR reveals the entire raw credential JSON payload (PII leak). | **H** | Implement selective attribute disclosure (Verifiable Presentations) and dynamic in-memory sharing. |
| **C-4** | **Consent Management** | Revoke previously shared credentials. | **Partial Success**| Shares can be toggled to inactive, but validator can still view already cached data. | **H** | Move sharing to ephemeral sessions so that data is never stored/cached on the validator's end. |
| **C-5** | **Search & Filters** | Instant search by keyword. | **Success** | Text filters update vault items instantly. | **L** | Local SQLite index performs well. |
| **C-6** | **Notifications** | Alerts when third parties access shared credentials. | **Success** | Firebase cloud messages received. | **L** | Notifications work correctly. |
| **C-7** | **Profile Management** | Modify personal data and biometrics. | **Success** | Settings saved. | **L** | Settings menu responsive. |

---

### 4. Performance

| ID | Feature / Scenario | Expected Behaviour | Actual Behaviour | Observation | Severity (L/M/H/C) | Engineering Notes / Improvement Opportunity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **P-1** | **Slow Network (3G)** | Skeletons display, timeout handled. | **Success** | UI remains responsive; timeouts trigger after 15s. | **L** | API calls use proper timeout settings. |
| **P-2** | **Offline Mode (Airplane)** | Vault accessible offline. | **Partial Success**| Vault loads offline. But local updates cause constraint collisions when app reconnects. | **M** | Integrate CRDT-based synchronization to handle concurrent offline edits cleanly. |
| **P-3** | **API Latency** | Slow API call does not allow multiple clicks. | **Success** | Submit buttons disable during API calls. | **L** | Proper loading indicators on primary buttons. |
| **P-4** | **Pagination / Large Lists**| Smooth scrolling with 50+ items. | **Success** | Progressive list loading works without lag. | **L** | Recycler views handle cell reuse well. |
| **P-5** | **Repeated Requests** | Double taps don't double-submit. | **Success** | Buttons debounce clicks (300ms window). | **L** | Good debouncing implementation. |

---

### 5. Edge Cases

| ID | Feature / Scenario | Expected Behaviour | Actual Behaviour | Observation | Severity (L/M/H/C) | Engineering Notes / Improvement Opportunity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **E-1** | **Empty Inputs** | Blocks empty submissions. | **Success** | Form validation blocks blank entries. | **L** | No empty db rows. |
| **E-2** | **Maximum Inputs** | 10k character inputs don't crash UI. | **Success** | Text fields handle long inputs; scrolling works. | **L** | No text overflow or crash. |
| **E-3** | **Invalid Files** | Rejects .exe/malicious files. | **Success** | System throws error for unsupported mime-types. | **L** | Proper client-side file extension white-listing. |
| **E-4** | **Mid-Upload Disconnect**| Upload disconnect rolls back state. | **Success** | Partially uploaded items deleted; retry state shown. | **L** | Database transaction rolls back correctly. |
| **E-5** | **App Backgrounding** | Backgrounding doesn't corrupt crypt. | **Success** | Android OS backgrounding suspends task, resumes on foreground. | **L** | Handled by OS state restoration. |

---

### 6. Security & Local Encryption

| ID | Feature / Scenario | Expected Behaviour | Actual Behaviour | Observation | Severity (L/M/H/C) | Engineering Notes / Improvement Opportunity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **S-1** | **SQL Injection** | SQL commands treated as literals. | **Success** | Escape characters implemented. | **L** | parameterized queries used. |
| **S-2** | **Secure Storage (DB)** | DB encrypted via SQLCipher. | **Fail** | SQLCipher is used, but the database password key is stored in plaintext SharedPreferences. | **C** | Move the database encryption key generation and storage inside the Android Keystore (biometric-backed). |
| **S-3** | **Screen Mirroring Block** | Blocks screenshots on credentials view.| **Success** | App screens display black when screenshotted. | **L** | `FLAG_SECURE` enabled on sensitive routes. |
| **S-4** | **Token Expiry** | Auto-logs out on expiry. | **Success** | User redirected to login. | **L** | JWT expiry handles cleanly. |

---

## Part 2: Web Platform Test Suite

### 7. Web Authentication & Session

| ID | Feature / Scenario | Expected Behaviour | Actual Behaviour | Observation | Severity (L/M/H/C) | Engineering Notes / Improvement Opportunity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **WA-1**| **Sign Up & Email Link** | Verification link activates account. | **Success** | Clickable link logs in and directs to profile. | **L** | standard verification flow. |
| **WA-2**| **Credentials Persistence**| Closing tab persists session securely. | **Success** | Session remains authenticated. | **L** | Persistent sessions work. |
| **WA-3**| **Token Storage Review** | Session tokens not in localStorage. | **Fail** | Auth JWT and decryption key stored in browser `localStorage`. | **C** | Store JWT in an HTTPOnly secure cookie. Store vault keys using WebAuthn bound keys. |

### 8. Web Core Features & Security

| ID | Feature / Scenario | Expected Behaviour | Actual Behaviour | Observation | Severity (L/M/H/C) | Engineering Notes / Improvement Opportunity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **WC-1**| **File Drag & Drop** | Dropping PDF uploads and hashes. | **Success** | Drag and drop works smoothly. | **L** | Drop-zone component is responsive. |
| **WC-2**| **Resume PDF Export** | Harvard resume exports with correct font. | **Success** | PDF renders correctly on Chrome, Firefox, Safari.| **L** | Clean export layout. |
| **WC-3**| **QR Verification Portal**| Portal reads signed proof and validates. | **Success** | Verification checks green on valid signature. | **L** | Signature validation operates correctly. |
| **WP-2**| **XSS Injection** | Text fields sanitize script tags. | **Fail** | Custom HTML resume view executes `<script>alert(1)</script>` tags injected in the text fields. | **C** | Integrate DOMPurify sanitizer on the web client before rendering user-inputted rich text or custom HTML. |
| **WP-3**| **Page Reload / Refresh** | Refresh does not corrupt state. | **Success** | Refresh reloads the app index without session loss. | **L** | Session persistence handles reload. |
