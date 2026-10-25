# Android App Exploration Logs

## 1. Feature Map
* **Authentication**: Email/OTP and Password setup. Key generation executes immediately after signup. Biometric integration (fingerprint) is available in settings.
* **Local Vault**: Users can upload files (PDFs, JPEGs). Encrypted using SQLCipher before being written to disk.
* **QR Generator**: Compiles a QR code displaying user verification links.
* **Resume Compiler**: Aggregates verified data and formats into a standardized CV.

## 2. Functional & Performance Findings
* **Main Thread Freeze**: Key pair generation blocks the UI thread for roughly 450ms, causing noticeable frame drops.
* **Large File Import Lag**: Uploading 15MB+ files causes UI jank as SHA hashing and AES cipher calculations block the event loop.
* **SharedPreferences Storage**: SQLCipher password keys are stored in plaintext in the app's internal XML preferences.

## 3. Accessibility & Layout
* **Touch Target Violations**: Dashboard action buttons measure 36x36dp, causing misclicks.
* **Back Stack Handle**: Pressing "Back" on the main dashboard exits the app instantly without warning or exit confirmation dialog.
