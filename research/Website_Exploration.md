# Web Platform Exploration Logs

## 1. Feature Map
* **Web Portal Sign Up**: Standard email activation links.
* **Portfolio Viewer**: Responsive webpage template showcasing verified portfolios and credentials.
* **Resume Export**: Web-based CSS print styling to export to clean Harvard-style resumes.
* **Verification Portal**: Scan page for third parties to verify user-shared credential signatures.

## 2. Security & Performance Findings
* **Stored XSS**: Portfolio text fields do not sanitize raw HTML input, allowing script injections to run within custom portfolios.
* **Plaintext LocalStorage**: Decryption keys and JWT tokens are saved directly in standard browser `localStorage` (accessible by any XSS script).
* **No API Rate Limiting**: The `/api/auth/send-otp` endpoint does not implement rate limits, allowing automated email spamming.

## 3. Accessibility & Layout
* **Keyboard Navigation**: Inactive elements (modals, dropdowns) do not trap focus, allowing users to keyboard-tab behind active overlays.
* **Contrast Ratios**: The dark mode theme uses dark gray text on black panels, falling below the WCAG AA 4.5:1 contrast requirement.
