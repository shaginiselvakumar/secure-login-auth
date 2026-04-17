# Database Schema

All collections/tables used by the application. In-memory fallback mirrors these structures exactly.

---

## users

Stores registered user accounts.

| Field            | Type      | Required | Notes                                              |
|------------------|-----------|----------|----------------------------------------------------|
| id               | String    | Yes      | Unique user ID, e.g. `user_<16 hex chars>`         |
| name             | String    | No       | Display name                                       |
| email            | String    | Yes      | Unique, lowercase, trimmed                         |
| password_hash    | String    | Yes      | Argon2id hash (bcrypt fallback)                    |
| mfa_enabled      | Boolean   | No       | Default: false                                     |
| totp_secret      | String    | No       | Base32 TOTP secret (null if MFA not enrolled)      |
| phone            | String    | No       | E.164 format for SMS OTP                           |
| failed_attempts  | Number    | No       | Consecutive failed login count; reset on success   |
| locked_until     | Date      | No       | Account locked until this timestamp (null = open)  |
| backup_codes     | Array     | No       | Array of `{ id: String, code_hash: String }`       |
| passkeys         | Array     | No       | Array of WebAuthn credential objects (see below)   |
| created_at       | Date      | No       | Account creation timestamp                         |

### backup_codes element

| Field      | Type   | Notes                                    |
|------------|--------|------------------------------------------|
| id         | String | Random 8-byte hex ID (for deletion)      |
| code_hash  | String | SHA-256 hex hash of the plain backup code|

### passkeys element

| Field                | Type   | Notes                                         |
|----------------------|--------|-----------------------------------------------|
| credentialID         | String | Base64url-encoded WebAuthn credential ID      |
| credentialPublicKey  | String | Base64url-encoded COSE public key             |
| counter              | Number | Signature counter (replay protection)         |
| userId               | String | Owner user ID                                 |
| createdAt            | Date   | Registration timestamp                        |

---

## reset_tokens

Single-use password reset tokens. Expire after 15 minutes.

| Field      | Type   | Required | Notes                                      |
|------------|--------|----------|--------------------------------------------|
| token_hash | String | Yes      | SHA-256 hex hash of the raw token          |
| user_id    | String | Yes      | References `users.id`                      |
| expires_at | Date   | Yes      | Token expiry (15 minutes from creation)    |

---

## remember_tokens

Persistent login tokens for "Remember Me" functionality. Expire after 30 days.
Tokens are rotated on each use (old token deleted, new one issued).

| Field      | Type   | Required | Notes                                      |
|------------|--------|----------|--------------------------------------------|
| token_hash | String | Yes      | SHA-256 hex hash of the raw cookie value   |
| user_id    | String | Yes      | References `users.id`                      |
| expires_at | Date   | Yes      | Token expiry (30 days from creation)       |
| created_at | Date   | No       | Creation timestamp                         |

---

## devices

Tracks known IP + user-agent combinations per user for new-device alerts.

| Field      | Type   | Required | Notes                                              |
|------------|--------|----------|----------------------------------------------------|
| key        | String | Yes      | Composite: `${userId}_${ip}_${userAgent}`          |
| created_at | Date   | No       | First seen timestamp                               |

---

## sessions (managed by connect-mongo / MemoryStore)

Managed automatically by `express-session`. Not directly accessed by application code.

| Field     | Type   | Notes                                    |
|-----------|--------|------------------------------------------|
| _id       | String | Session ID (cookie value)                |
| session   | Object | Serialised session data                  |
| expires   | Date   | TTL — 8 hours (30 days with remember-me) |

### Session object fields

| Field          | Type    | Notes                                         |
|----------------|---------|-----------------------------------------------|
| userId         | String  | Authenticated user ID                         |
| email          | String  | User email                                    |
| name           | String  | User display name                             |
| mfaVerified    | Boolean | True after MFA step completed                 |
| loginTimestamp | Number  | Unix ms timestamp of login                    |
| userAgent      | String  | Browser user-agent at login                   |
| ip             | String  | IP address at login                           |
| ssoState       | String  | Temporary CSRF state for SSO flow             |
| pendingTotpSecret | String | Temporary TOTP secret during MFA enrollment |
| passkeyChallenge | String | Temporary WebAuthn challenge                 |
| passkeyRegistrationChallenge | String | Temporary registration challenge  |
