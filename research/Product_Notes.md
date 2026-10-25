# Omnimise Platform Product Notes
**Architectural Constraints & Security Models**  

---

## 1. Decentralized Identity Standards
To build a premium, compliant engineering product, Omnimise aligns with standard decentralized identity protocols:

* **W3C Verifiable Credentials (VC)**: Structured JSON-LD payloads containing claims verified by an issuer (e.g., a university verifying a degree). It uses cryptographic signatures (e.g., Ed25519) to guarantee tamper-resistance.
* **W3C Decentralized Identifiers (DIDs)**: Globally unique identifiers that can be resolved without a centralized registry. DIDs point to DID Documents containing public keys for signature verification.
* **Verifiable Presentations (VP)**: Temporary packages compiled by the user’s wallet, containing one or more VCs (or parts of them) signed with the user’s private key to prove ownership.

---

## 2. Client-Side Cryptographic Mechanics
In a local-first application, cryptographic tasks operate client-side:

* **Key Generation**: Typically uses Ed25519 (for fast signature verification) or Secp256k1 (compatible with Ethereum/Web3 ecosystems).
* **Database Encryption**: Enforced via **SQLCipher**, which transparently encrypts standard SQLite databases using AES-256-CBC. Key derivation functions like PBKDF2 stretch user passwords into cryptographic keys.
* **Data Minimization (Zero-Knowledge Proofs)**: Modern identity wallets utilize **zk-SNARKs** to prove statements about private data (e.g., proving birth year is before 2008 without disclosing birth day) using witness generation and verification keys.

---

## 3. Communication Protocols for Ephemeral Sharing
To prevent third-party databases from harvesting PII, data transmission must be ephemeral:

* **WebRTC Data Channels**: Peer-to-peer, encrypted TLS connection between two clients (e.g., user mobile app and verifier browser) established via a brief WebSocket signaling handshake. Allows direct transmission of credential presentations without hitting backend servers.
* **JSON Web Encryption (JWE)**: Encrypting the payload with the receiver's temporary public key before transmission. Even if the WebSocket server is compromised, it cannot read the credentials (acting as a "blind broker").
* **QR Session Negotiation**: The QR code acts as a bootstrap containing:
  ```json
  {
    "type": "VerificationRequest",
    "sessionId": "ws-room-82019b",
    "verifierPublicKey": "04a6f23b...",
    "requiredClaims": ["degree", "name"]
  }
  ```
