document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const btnGenerate = document.getElementById('btn-generate');
  const btnDisconnect = document.getElementById('btn-disconnect');
  const btnClearLogs = document.getElementById('btn-clear-logs');
  
  const qrSection = document.getElementById('qr-section');
  const timerDisplay = document.getElementById('timer');
  const statusText = document.getElementById('session-status-text');
  
  const verifierEmpty = document.getElementById('verifier-empty');
  const verifierLoaded = document.getElementById('verifier-loaded');
  const claimsList = document.getElementById('claims-list');
  const logContainer = document.getElementById('log-container');
  
  const togglePassport = document.getElementById('toggle-passport');
  const passportAttrs = document.getElementById('passport-attrs');

  let sessionTimer = null;
  let simulatedScanTimeout = null;

  // Log Helper
  function log(message, type = 'system') {
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${timestamp}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  // Toggle Passport credential group
  togglePassport.addEventListener('change', (e) => {
    const credCard = togglePassport.closest('.cred-card');
    const inputs = passportAttrs.querySelectorAll('input[type="checkbox"]');
    
    if (e.target.checked) {
      credCard.classList.add('active');
      passportAttrs.classList.remove('disabled');
      inputs.forEach(input => {
        input.removeAttribute('disabled');
        input.checked = true;
      });
      log('Passport credential decrypted in mobile memory for consent configuration.', 'system');
    } else {
      credCard.classList.remove('active');
      passportAttrs.classList.add('disabled');
      inputs.forEach(input => {
        input.setAttribute('disabled', 'true');
        input.checked = false;
      });
      log('Passport credential locked; zeroed out transient memory caches.', 'system');
    }
  });

  // Clear Logs
  btnClearLogs.addEventListener('click', () => {
    logContainer.innerHTML = '';
    log('Logs cleared.', 'system');
  });

  // Start TTL Countdown (5 minutes)
  function startTimer() {
    let timeLeft = 300; // 5 minutes
    clearInterval(sessionTimer);
    
    sessionTimer = setInterval(() => {
      const minutes = Math.floor(timeLeft / 60);
      let seconds = timeLeft % 60;
      seconds = seconds < 10 ? '0' + seconds : seconds;
      
      timerDisplay.textContent = `0${minutes}:${seconds}`;
      
      if (timeLeft <= 0) {
        clearInterval(sessionTimer);
        expireSession();
      }
      timeLeft--;
    }, 1000);
  }

  // Handle Session Expiration
  function expireSession() {
    log('Session TTL expired. Socket handshake token revoked.', 'network');
    resetUI();
  }

  // Reset UI elements to original state
  function resetUI() {
    clearInterval(sessionTimer);
    clearTimeout(simulatedScanTimeout);
    
    qrSection.classList.add('hidden');
    btnGenerate.textContent = 'Generate Ephemeral QR';
    btnGenerate.removeAttribute('disabled');
    
    verifierLoaded.classList.add('hidden');
    verifierEmpty.classList.remove('hidden');
    claimsList.innerHTML = '';
    
    statusText.textContent = 'Waiting for Verifier scan...';
    statusText.className = 'status-value waiting';
  }

  // Generate QR & Initiate Ephemeral Tunnel Simulation
  btnGenerate.addEventListener('click', () => {
    // 1. Gather Selected Consent Claims
    const claims = [];
    document.querySelectorAll('.card-attributes input[type="checkbox"]').forEach(checkbox => {
      if (checkbox.checked && !checkbox.disabled) {
        const row = checkbox.closest('.attr-row');
        const name = row.querySelector('.attr-name').textContent;
        const val = row.querySelector('.attr-val').textContent;
        claims.push({ label: name, value: val });
      }
    });

    if (claims.length === 0) {
      alert('Please check at least one claim attribute to share.');
      return;
    }

    // 2. Lock UI & Generate QR
    btnGenerate.textContent = 'Active Sharing Session';
    btnGenerate.setAttribute('disabled', 'true');
    qrSection.classList.remove('hidden');
    
    log('Compiling selected attributes into W3C Verifiable Presentation (VP)...', 'crypto');
    log(`Selected claims: ${claims.map(c => c.label).join(', ')}`, 'crypto');
    
    // Simulate main thread non-blocking offloaded signature (as proposed in Isolates recommendation)
    log('Offloading cryptographic signature (Ed25519) to Dart Isolate / Web Worker...', 'crypto');
    
    setTimeout(() => {
      log('Signature generated (0ms main-thread blockage). VP compiled successfully.', 'crypto');
      log('Establishing dynamic socket token room: ws://auth.omnimise.com/room-8f192b', 'network');
      
      startTimer();
      simulateVerifierScan(claims);
    }, 400);
  });

  // Simulate scanning of QR by Third-Party Verifier
  function simulateVerifierScan(claims) {
    log('Awaiting verifier scan transaction...', 'network');
    
    simulatedScanTimeout = setTimeout(() => {
      statusText.textContent = 'Verifier Linked! Negotiating keys...';
      statusText.className = 'status-value active';
      log('QR scanned. Verifier client initiated WebRTC signaling.', 'network');
      
      // Simulate ephemeral JWE key exchange (ECDH)
      log('Exchanging ephemeral ECDH public keys (X25519)...', 'crypto');
      
      setTimeout(() => {
        log('Secret key established. Encrypting presentation payload using AES-256-GCM JWE...', 'crypto');
        log('Transmitting encrypted JWE tunnel packet through WebSocket broker...', 'network');
        
        // Render claims on the verifier panel
        claimsList.innerHTML = '';
        claims.forEach(claim => {
          const li = document.createElement('li');
          li.innerHTML = `
            <span class="claim-label">${claim.label}</span>
            <span class="claim-value">${claim.value}</span>
          `;
          claimsList.appendChild(li);
        });

        // Toggle Panels
        verifierEmpty.classList.add('hidden');
        verifierLoaded.classList.remove('hidden');
        
        log('Verifier client received presentation envelope. Decrypted in-memory.', 'system');
        log('Cryptographic trust verification passed: Signature Valid.', 'crypto');
        
        statusText.textContent = 'Session Tunnel Connected (Encrypted)';
      }, 800);

    }, 2500); // 2.5 seconds wait for scan simulation
  }

  // Disconnect & Wipe Session
  btnDisconnect.addEventListener('click', () => {
    log('Client triggered connection teardown. Terminating socket tunnel.', 'network');
    log('Wiping transient decryption buffers from verifier memory context...', 'crypto');
    resetUI();
    log('Session wiped successfully. Ready for next transaction.', 'system');
  });
});
