Backend for Literary Lighthouse

This minimal backend provides two dev servers:

- `api-server.js` - serves `/booksData` and `/users` endpoints by reading and writing the frontend db.json. Listens on port 8080 by default (ENV: PORT).
- `otp-server.js` - dev OTP server that provides `/otp/send` and `/otp/verify`. Listens on port 5001 by default (ENV: OTP_PORT).

Quick start (from repo root):

```bash
cd backend
npm install
# start API server (port 8080)
npm start
# in another terminal start OTP server (port 5001)
npm run otp
```

Notes:
- This is a developer convenience: it keeps the same ports the frontend expects (8080 and 5001).
- For production you'd replace db.json with a real database and move uploads to persistent storage.

For sql-lite migration
cd backend
node migrate-to-sqlite.js