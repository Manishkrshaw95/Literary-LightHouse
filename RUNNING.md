Running the project (backend dev servers)

This repo now includes a minimal `backend/` folder that provides two developer servers:

- `api-server.js` - serves `/booksData` and `/users` endpoints by reading/writing the frontend DB file. Listens on port 8080 by default.
- `otp-server.js` - dev OTP server that provides `/otp/send` and `/otp/verify`. Listens on port 5001 by default.

To start them:

```bash
cd backend
npm install
npm start    # starts api-server on port 8080
npm run otp  # starts otp-server on port 5001
```

If ports are already in use, stop the conflicting process or change the PORT/OTP_PORT environment variables.
