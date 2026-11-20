# 777 Fruit 

Virtual-points-only fruit slot demo. It has no deposits, withdrawals, cash prizes, or real-money wagering.

## Requirements
- Node.js 20 or newer
- npm

## Run locally
```bash
npm install
```

Set environment variables (recommended):
```bash
# macOS/Linux
export DEMO_ACCESS_CODE="7777"
export ADMIN_PASSWORD="change-this-admin-password"
export SESSION_SECRET="$(openssl rand -hex 32)"
npm start
```

On Windows PowerShell:
```powershell
$env:DEMO_ACCESS_CODE="7777"
$env:ADMIN_PASSWORD="change-this-admin-password"
$env:SESSION_SECRET="replace-with-a-long-random-secret"
npm start
```

Open http://localhost:3000

For local testing only, if `DEMO_ACCESS_CODE` is not set, the default access code is `7777`.
For production hosting, set `DEMO_ACCESS_CODE`, `ADMIN_PASSWORD`, and `SESSION_SECRET` as secret environment variables. Do not commit secrets to GitHub.

## Security and demo limitations
- The server validates bets and calculates every result; the browser cannot choose a result.
- Login and spin endpoints are rate-limited.
- Helmet security headers and HTTP-only, SameSite session cookies are enabled.
- The included Express MemoryStore is for demo/testing only. It is not suitable for production or multiple server instances; use a maintained persistent session store before any public deployment.
- Player points are stored in the in-memory session and reset when the server restarts or the session expires.
- The admin password check endpoint is only a placeholder demonstration, not a full admin dashboard.
- This project is not a real-money gambling platform.

## Audit
```bash
npm audit
npm audit fix
```
Review the audit report before applying updates. Avoid `npm audit fix --force` unless you have reviewed potentially breaking major-version changes.
