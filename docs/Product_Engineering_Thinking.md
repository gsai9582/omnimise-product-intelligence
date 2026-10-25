# Document 2: Product & Engineering Thinking
**Prepared for**: Omnimise Product & Engineering Leadership  
**Author**: Principal Product Engineer & Solution Architect  

---

## 1. Top 5 Real-World Use Cases
1. **Recruitment Background Verification (BGV)**: Job candidates instantly share pre-verified credentials (degrees, employment verification, code badges) via a 5-second QR scan. Cuts traditional 15-day manual HR check cycles down to 0 days.
2. **Corporate & High-Security Office Entry**: Employees bypass manual badge prints and check-in desks by tapping their NFC-enabled *Omnimise Card* or scanning local biometrics. Entry credentials are authenticated locally at the access gate.
3. **Scholarship and Student Discount Verification**: Students instantly prove their university enrollment and GPA using an NFC-enabled *Omnimise Ring* tap at college portals or physical POS terminals, preventing discount fraud.
4. **Decentralized Travel Passport Verification**: Passengers share verified passport details and visa stamps from their local vault to border control kiosks using ephemeral WebRTC channels, protecting their data from centralized hacks.
5. **Biometric Identity Trust in Peer-to-Peer Social Apps**: Users verify their age and name matching on peer-to-peer dating or sales platforms, eliminating catfishing and marketplace scams without exposing home addresses or government IDs.

---

## 2. Ideal Customer Profile (ICP)
* **B2C User**: High-performance remote developers, college graduates, and freelance professionals (aged 18–35) who frequently apply for jobs, value absolute data privacy, and manage multiple digital certificates.
* **B2B Customer**: Fast-growth technology enterprises, remote-first platforms, and high-security fintech/defense companies looking to automate background checks, lower compliance costs (GDPR/SOC2), and eliminate BGV fraud.

---

## 3. Workflow Redesign: Credential Verification Share
* **Current Workflow**: The user generates a static QR code representing their credentials. When scanned, this QR code transmits the entire raw JSON payload of the user's data to the scanner.
* **Pain Points & Friction**: High risk of PII leakage (sharing full date-of-birth or GPA when only age-gate or degree verification was required). Static payloads can be copied or saved by the scanner, leading to unauthorized data retention.
* **Proposed Redesign**: **Selective Attribute & Ephemeral Session Share**.
  1. *Step 1*: User clicks "Verify & Share" and selects specific checkboxes (e.g., only "First Name" and "CS Degree").
  2. *Step 2*: App generates a dynamic QR code containing a temporary WebSocket session token and the scanner's public key.
  3. *Step 3*: The scanner scans the QR. The mobile app encrypts the selected attributes in-memory using JSON Web Encryption (JWE) and sends them via an ephemeral WebSocket tunnel.
  4. *Step 4*: The scanner's browser decrypts and displays the attributes in memory. Once the tab is closed, the data is wiped.
* **Architecture Impact**: 
  * *Backend*: Deploy an ephemeral WebSocket signaling server (built with Socket.io/Node.js) with 0 persistent database storage.
  * *Frontend*: Implement a checklist-based claim selection screen on Flutter/React.
  * *API*: Add an endpoint `/api/v1/sessions/negotiate` to establish temporary key exchanges.
* **Expected KPIs**: User trust score increases; zero-data retention compliance claims satisfied; share completion rates improve by 25%.

---

## 4. Top Priority Technical Improvement
* **Focus**: **Secure Hardware-Backed Cryptographic Vault Key Isolation (Android KeyStore/Secure Enclave)**.
* **Why it provides the highest value**: Omnimise's value proposition is built entirely on cryptographic trust. If a malicious application or an attacker with physical access to a rooted device can scrape the user's private keys or database passwords from software memory, they can forge signatures and steal the user's digital identity. Implementing hardware-level key isolation provides absolute zero-compromise security, validating the "Sovereign" core brand.

---

## 5. Churn Analysis
* **Retention Risk**: **The "Lost Device Lockout" Trap**.
* **Rationale**: Because Omnimise stores all credentials strictly on the user's device, losing or breaking the phone results in permanent data loss. If recovery requires contacting university registrars or past employers to re-verify documents manually, the user faces severe friction and will abandon the platform.
* **Mitigation**: Implement a decentralized, encrypted backup system (e.g., uploading the vault to Arweave/IPFS encrypted with a key derived from a 12-word bip39 recovery phrase) or Shamir's Secret Sharing (SSS) social recovery.

---

## 6. The 10x Idea: The Zero-Knowledge Recruiter Matching Network
* **Concept**: Build an anonymous, bias-free job board built entirely on Zero-Knowledge Proofs (ZKPs).
* **Execution**: Recruiter publishes job criteria (e.g., "Must have B.Tech in CS from tier-1 college + 3 years experience"). The candidate's local Omnimise app checks their credentials, compiles a cryptographic proof, and submits it anonymously to the matching board. The recruiter receives a list of pre-verified, matching candidates without seeing their name, gender, age, or ethnicity. Candidate identity is only revealed once both parties agree to interview.
* **Impact**: Eliminates hiring bias, automates top-of-funnel sourcing, and leverages the network effect: as more verified candidates join, more recruiters join, establishing Omnimise as the ultimate trust network.

---

## 7. Bonus: Technical Audit Observations
* **XSS Vector in Portfolio Web Viewer**: The portfolio page allows custom HTML inputs for styled resumes. If inputs are not sanitized using DOMPurify, it allows Cross-Site Scripting (XSS) attacks.
* **API Rate-Limit Lack on OTP Endpoints**: The signup verification code endpoint (`/api/auth/send-otp`) lacks rate-limiting, allowing malicious scripts to trigger thousands of SMS/email requests, inflating API costs and creating a DoS condition.
* **Uncompressed PDF Storage**: Uploading large multi-megabyte credential images/PDFs eats up local disk space rapidly. Solution: Integrate client-side PDF compression (e.g., Ghostscript-equivalent compression libraries) before local vault encryption.
