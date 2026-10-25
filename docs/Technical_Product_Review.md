# Technical Product Review – Omnimise

---

## Section 1 — Backend / System Improvements (3)

### 1. Hardware-Backed Cryptographic Key Storage (Android KeyStore & WebAuthn)
* **Current Observation**: SQLCipher is used to encrypt the local vault database, but key materials (private keys and database passwords) reside in plaintext memory, standard Android `SharedPreferences`, or browser `localStorage`.
* **Technical Issue**: Plaintext storage exposes master keys and database passwords to root extraction, memory dumping, or Cross-Site Scripting (XSS) attacks, compromising the entire decentralized identity vault.
* **Engineering Recommendation**: Transition to hardware-backed key storage. On Android, utilize the **Android Keystore System** to generate the master key inside the device's Secure Enclave/TEE (Trusted Execution Environment) with biometric authorization (`BiometricPrompt`). For the web portal, implement **WebAuthn (FIDO2)** via the Web Crypto API to bind private keys to the hardware TPM (Trusted Platform Module).
* **Business/User Impact**: Ensures zero-compromise cryptographic security. Prevents key theft even if a device is rooted or the web client suffers an XSS exploit, establishing absolute user data sovereignty.

### 2. Asymmetric Cryptography Offloading via Worker Threads and Dart Isolates
* **Current Observation**: Heavy CPU-bound asymmetric cryptographic operations—like Ed25519 key generation, document SHA-256 hashing, and signing JSON-LD payloads—run directly on the single-threaded Dart Event Loop (Flutter app) or the browser's main JS thread.
* **Technical Issue**: Executing heavy synchronous cryptography on the main thread blocks UI rendering, causing frame drops (jank) and frozen interactive states (300ms–1500ms freezes), degrading user experience during critical trust operations.
* **Engineering Recommendation**: Offload cryptographic tasks to background threads. On Android, utilize **Dart Isolates** to spawn separate worker loops. On the Web, execute key generation and signature logic within **Web Workers**.
* **Business/User Impact**: Maintains a smooth, responsive 60fps/120fps UI. Users experience instant responsiveness during credential signing and key generation, eliminating perceived app crashes.

### 3. Asynchronous Processing for Resume and Integration Sync
* **Current Observation**: Formatting Harvard-style resumes and syncing data from 15+ third-party integrations (GitHub, LinkedIn, LeetCode) execute synchronously within Express.js request handlers.
* **Technical Issue**: Synchronous PDF rendering and blocking third-party API calls (taking up to 15s) freeze the Node.js event loop, exhausting the database and Express connection pools and degrading API responsiveness for all concurrent users under load.
* **Engineering Recommendation**: Introduce **BullMQ** with a Redis-backed queue. The API returns `202 Accepted` with a job ID immediately. Offload resume rendering and integration syncing to background worker processes, implementing automatic retries with exponential backoff.
* **Business/User Impact**: Lowers initial API latency from seconds to <500ms. Eliminates event loop blocks, improving platform scaling capacity and reliability during peak recruitment periods.

---

## Section 2 — Frontend / UI-UX Improvements (3)

### 1. Server-Side Rendering (SSR) for Search Engine Visibility
* **Current experience**: The landing page (omnimise.com) returns zero indexed pages on Google (`site:omnimise.com`). The initial HTML response from the server is empty (`Loading...` and a blank root div), with all content rendered by React client-side.
* **Problem**: Search engine crawlers have limited JavaScript execution budgets, causing the fully client-rendered landing page and public portfolios to remain unindexed, preventing organic customer acquisition.
* **Improvement**: Migrate the marketing site and public-facing pages (shared credentials, public portfolios) to **Next.js** using Static Site Generation (SSG) for static pages and Server-Side Rendering (SSR) for dynamic profiles. Keep the authenticated dashboard client-side.
* **Expected outcome**: Public pages and portfolios become fully indexable by search engines within 1-2 weeks. First Contentful Paint (FCP) drops from ~3s to <1s, improving SEO score and organic reach.

### 2. Granular Consent Interface for Selective Disclosure
* **Current experience**: The credential sharing interface operates at the document level (e.g., sharing a whole passport or transcript). Users cannot select which specific fields are shared, leading to an "all-or-nothing" disclosure model.
* **Problem**: Violates the core privacy principle of data minimization. Sharing an entire document exposes unnecessary PII (such as showing date of birth or home address when only verifying a degree title).
* **Improvement**: Build a checklist-based claim selection screen on the frontend. The UI dynamically builds a W3C **Verifiable Presentation (VP)** mapping only the checked fields (e.g., verifying "Degree: CS" while hiding GPA), and signs only that minimized payload.
* **Expected outcome**: Users gain complete control over their shared data, minimizing PII exposure. Encourages adoption among privacy-conscious professionals and complies with DPDP/GDPR principles.

### 3. Skeleton Loading States for Document-Heavy Views
* **Current experience**: Document-heavy views (e.g., the vault and portfolio sections loading assets from S3/Cloudinary) display full-screen spinner overlays or blank pages, which block user interaction for 3-5 seconds on slower mobile networks.
* **Problem**: Screen-blocking spinners increase perceived latency, cause visual layout shifts (CLS) when content finally loads, and make users believe the app has frozen, leading to early session abandonment.
* **Improvement**: Build a reusable `<Skeleton>` React/Flutter component with animated CSS shimmers. Replace the screen-blocking spinners with content-shaped placeholder cards that match the dimensions of the final loaded elements.
* **Expected outcome**: Perceived loading times decrease. Layout shifts drop to zero, and users remain engaged with a visual representation of the page structure during data fetches.

---

## Section 3 — Full Stack Feature Suggestions (3)

### 1. Ephemeral WebSockets Verification Session (Zero-PII Storage Broker)
* **Feature Name**: Ephemeral WebSockets Verification Session
* **Problem it solves**: Third-party verifiers need to inspect user credentials, but storing these credentials on a third-party server or a centralized broker exposes the data to breaches and violates user sovereignty.
* **Frontend implementation**: The verifier portal displays a WebSocket-linked QR code. The user's mobile app scans it, prompts for granular consent, encrypts the selected credentials locally using JSON Web Encryption (JWE) with the verifier's public key, and transmits it.
* **Backend implementation**: An ephemeral Socket.io signaling server facilitates the connection and relays the encrypted credentials in-memory. The server operates as a blind broker, storing zero data in persistent databases.
* **Database/API requirements**: Ephemeral Socket rooms mapped to temporary session IDs. No persistent database records. Webhook callbacks notify the verifier's system upon successful session closure.
* **Expected value to users**: Guarantees that personal documents are only viewed in-memory by the verifier and are never saved on any intermediate server, ensuring complete privacy.
* **Expected value to the business**: Minimizes the platform's compliance scope under GDPR/DPDP since no PII is stored or transmitted in plaintext. Lowers data hosting costs.

### 2. Decentralized Social Recovery via Shamir's Secret Sharing (SSS)
* **Feature Name**: Decentralized Social Recovery via Shamir's Secret Sharing (SSS)
* **Problem it solves**: In a local-first system, if a user loses or breaks their phone, they lose their cryptographic vault forever. Centralized backups violate self-sovereignty, but having no backup leads to catastrophic data loss and user churn.
* **Frontend implementation**: A recovery wizard splits the vault master decryption key into three shards. The user assigns these shards to three trusted contacts. The frontend uses WebRTC to securely transmit the shards to the contacts' apps.
* **Backend implementation**: Coordinates signaling for secure WebRTC connection setup. If peer-to-peer connection is offline, the backend acts as an encrypted relay using ephemeral message envelopes that expire after delivery.
* **Database/API requirements**: Endpoints `POST /api/v1/recovery/handshake` and `GET /api/v1/recovery/signal`. A `recovery_configurations` table storing shard mappings and public keys (no private keys or vault data).
* **Expected value to users**: Eliminates the risk of permanent identity lockout without trusting a central authority with their vault password.
* **Expected value to the business**: Resolves the main driver of customer churn (lost device lockout) while maintaining the platform's "local-first, zero-knowledge" marketing claims.

### 3. Zero-Knowledge Proof (ZKP) Recruiter Matching Network
* **Feature Name**: Zero-Knowledge Proof (ZKP) Recruiter Matching Network
* **Problem it solves**: Job screening is slow, manual, and prone to demographic bias. Recruiters want to screen for verified qualification criteria without candidates having to share full, unredacted resumes or personal data at the initial sourcing stage.
* **Frontend implementation**: The mobile app runs a local ZK proof compiler (using `Snarkjs`). It checks local credentials (e.g. B.Tech degree, 3+ years experience) and generates a cryptographic proof (witness) confirming eligibility without exposing identities.
* **Backend implementation**: The job board receives the cryptographic proof. It verifies the proof against the target circuit and lists the candidate anonymously on the recruiter dashboard as "Verified Match" with credentials confirmed.
* **Database/API requirements**: `POST /api/v1/zkp/verify` to validate incoming proofs; `GET /api/v1/jobs/:id/matches` to list verified candidates. Storage of ZK circuit definition files (`.wasm`, `.zkey`).
* **Expected value to users**: Complete privacy during job searches. Candidates prove their qualifications without exposing names, gender, age, or GPA, eliminating bias.
* **Expected value to the business**: Establishes a highly secure, high-trust recruitment marketplace. Monetizable through premium recruiter access to pre-verified talent pools.
