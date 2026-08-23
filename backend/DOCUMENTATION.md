# hi — Complete Technical Documentation

Welcome to the complete technical documentation for **hi**, a premium video conferencing platform built by aiRender. This document serves as an exhaustive guide covering the system's architecture, data flows, tech stack, feature sets, database schema, API endpoints, and a complete step-by-step installation guide.

---

## 📑 Table of Contents
1. [Overview & Core Features](#1-overview--core-features)
2. [Detailed Technology Stack](#2-detailed-technology-stack)
3. [Deep Dive: Architecture & Data Flow](#3-deep-dive-architecture--data-flow)
4. [Backend Infrastructure & API](#4-backend-infrastructure--api)
5. [Database Schema](#5-database-schema)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Step-by-Step API Setup Guide](#7-step-by-step-api-setup-guide)
8. [Installation & Getting Started](#8-installation--getting-started)

---

## 1. Overview & Core Features

**hi** is a modern video conferencing application designed for high security, seamless user experience, and robust scheduling. It bridges the gap between advanced authentication methods and enterprise-grade video conferencing.

### Core Features
- **Advanced Authentication:**
  - **Google Sign-In**: Uses `google-auth-library` to verify OAuth 2.0 tokens securely on the backend.
  - **Passkeys (WebAuthn)**: Passwordless, biometric authentication leveraging device-level security chips (FaceID/TouchID/Windows Hello).
  - **Push Notification Login**: Allows a user to attempt login on Device A and approve it via a push notification sent to Device B (using Service Workers and `web-push`).
  - **Single-Click Login**: Frictionless re-authentication storing a secure token in `localStorage`.
- **Video Conferencing:**
  - Powered by **Jitsi as a Service (JaaS)**, integrated directly via `@jitsi/react-sdk`.
  - The backend securely issues RSA-signed JaaS JWTs. Meeting creators are dynamically assigned `moderator: true` privileges.
- **Smart Scheduling & Notifications:**
  - **Cron Jobs**: `node-cron` checks every minute for upcoming meetings to trigger email reminders.
  - **Transactional Emails**: Beautifully crafted HTML emails for Invites, Reminders, and Cancellations dispatched via the **Brevo API**.
  - **Calendar Sync**: Automatically generates and attaches `.ics` files in outgoing emails for seamless Google/Apple Calendar integration.

---

## 2. Detailed Technology Stack

### Frontend Stack
- **Core**: React 18
- **Build Tool**: Vite (Lightning-fast Hot Module Replacement and optimized production builds)
- **Routing**: `react-router-dom` (v6) for declarative client-side navigation.
- **State Management**: React Context API (`AuthContext` to distribute user state globally) and local React Hooks (`useState`, `useMemo`, `useCallback`).
- **Styling**: Vanilla CSS utilizing CSS Variables for an extensive design system. Supports dynamic themes (Dark Mode, Grey Mode).
- **Authentication Libraries**: `@simplewebauthn/browser` for WebAuthn API wrapping.
- **Video SDK**: `@jitsi/react-sdk` provides the `<JitsiMeeting />` component for an iframe-based embedded experience.
- **Utilities**: `luxon` for precise date and timezone manipulation, `axios` for HTTP requests, `lucide-react` for SVG icons.

### Backend Stack
- **Core**: Node.js & Express.js for REST API creation.
- **Database**: MongoDB (managed via `mongoose` ODM).
- **Security & Headers**: `helmet` for HTTP header security, `cors` for Cross-Origin resource sharing.
- **Authentication**:
  - `google-auth-library` (Google token verification).
  - `@simplewebauthn/server` (FIDO2/WebAuthn server-side logic).
  - `jsonwebtoken` (JWT creation and validation).
- **Background Processes**: `node-cron` for scheduling background jobs.
- **Push Notifications**: `web-push` for encrypting and sending payloads to the browser Push API.
- **External APIs**: Custom `fetch`-based integration with Brevo for sending emails.

---

## 3. Deep Dive: Architecture & Data Flow

### 3.1 Authentication Data Flow
The platform utilizes a multi-layered authentication strategy:

1. **Google Login Flow**: 
   - User clicks "Sign in with Google" on the frontend.
   - Google responds with a `credential` (JWT).
   - Frontend POSTs this to `/api/auth/google`.
   - Backend `authController.js` verifies the credential against Google's public keys. It finds or creates a user record in MongoDB, then issues a custom application JWT back to the client.

2. **Passkey Registration (WebAuthn)**: 
   - Authenticated frontend requests registration options `GET /api/passkeys/register-options`.
   - Backend `passkeyController.js` generates a cryptographic challenge and saves it in the user's session/DB.
   - Frontend calls `startRegistration()`. The OS prompts the user for biometrics.
   - Frontend sends the signed attestation back to `POST /api/passkeys/register-verify`. 
   - Backend verifies the signature and stores the public key and credential ID in the `User` document.

3. **Push Login Flow**: 
   - **Request**: Unauthenticated Device A requests login `POST /api/push-auth/request-login`. Backend creates a `PushLoginRequest` document (status: `pending`) and sends a web-push notification to all devices belonging to that email.
   - **Polling**: Device A begins polling `GET /api/push-auth/status/:requestId` every 2 seconds.
   - **Approval**: The user taps the notification on Device B, opening the app to approve it `POST /api/push-auth/approve`. The document status changes to `approved` and an auth token is generated and stored in the document.
   - **Resolution**: Device A's next poll sees the `approved` status, retrieves the token, and logs the user in.

### 3.2 Video Conferencing & JaaS Flow
1. User navigates to `/room/:meetingId`.
2. Frontend calls `GET /api/jaas/token`.
3. Backend `jaasService.js` constructs a payload. It checks if `meeting.host` matches the currently logged-in user. If true, it sets `features.moderator = true`.
4. Backend signs the payload using the `JAAS_PRIVATE_KEY` (RSA PKCS#8) and `JAAS_API_KEY_ID`.
5. Frontend passes the returned JWT to the `@jitsi/react-sdk` `<JitsiMeeting />` component, which handles the WebRTC connection to 8x8 servers.

### 3.3 Automated Reminders Flow
1. **Scheduling**: A user creates a meeting `POST /api/meetings`. `emailService.js` sends an immediate HTML Invite via Brevo.
2. **Cron Job**: `reminderScheduler.js` runs every 60 seconds (`* * * * *`).
3. **Execution**: It queries MongoDB for meetings where `startTime` is within the notification window (e.g., next 30 mins) AND `reminderSent: false`.
4. **Action**: It calls `sendMeetingReminder` in `emailService.js`, which sends the reminder HTML email. It then updates the meeting `reminderSent = true` to prevent spamming.

---

## 4. Backend Infrastructure & API

The backend is organized into distinct layers to separate routing, business logic, and database interactions.

### Directory Structure
- `/models`: Mongoose Schemas (`User.js`, `Meeting.js`, `PushLoginRequest.js`).
- `/controllers`: Business logic mapping to routes (`authController.js`, `meetingController.js`, `passkeyController.js`).
- `/routes`: Express Router definitions linking HTTP verbs to Controllers.
- `/services`: External API handlers (`emailService.js`, `jaasService.js`, `reminderScheduler.js`).
- `server.js`: Application entry point, middleware setup, database connection, and cron initialization.

### Key API Endpoints
- **Auth**: 
  - `POST /api/auth/google`
  - `GET /api/auth/me` (Validates current JWT)
- **Passkeys**:
  - `GET /api/passkeys/register-options`
  - `POST /api/passkeys/register-verify`
  - `GET /api/passkeys/auth-options`
  - `POST /api/passkeys/auth-verify`
- **Push Auth**:
  - `POST /api/push-auth/subscribe`
  - `POST /api/push-auth/request-login`
  - `POST /api/push-auth/approve`
- **Meetings**:
  - `GET /api/meetings` (Lists user's scheduled & past meetings)
  - `POST /api/meetings` (Creates meeting & sends invite)
  - `DELETE /api/meetings/:id` (Cancels meeting & sends cancellation email)

---

## 5. Database Schema

The platform relies on a NoSQL document structure via MongoDB.

### User Collection (`User.js`)
- `email` (String, Unique)
- `name` (String)
- `picture` (String) - Google profile image URL
- `pushSubscriptions` (Array of Objects) - Stores endpoint and keys for web-push.
- `passkeys` (Array of Objects) - Stores WebAuthn public keys, credential IDs, and counter values.

### Meeting Collection (`Meeting.js`)
- `title` (String)
- `description` (String)
- `startTime` (Date)
- `endTime` (Date)
- `timezone` (String)
- `host` (ObjectId, Ref: 'User')
- `participants` (Array of Strings) - Emails of invitees.
- `link` (String) - The frontend room URL.
- `reminderSent` (Boolean) - Default `false`.

### PushLoginRequest Collection (`PushLoginRequest.js`)
- `email` (String)
- `status` (Enum: 'pending', 'approved', 'denied', 'expired')
- `token` (String) - Populated upon approval for the polling device to retrieve.
- `createdAt` (Date, TTL Index) - Automatically deletes documents after 5 minutes.

---

## 6. Frontend Architecture

The frontend is a Single Page Application (SPA) structured for performance and maintainability.

### Directory Structure
- `/src/components`: 
  - `/layout`: App layout shells (`Navbar`, `Sidebar`).
  - `/meetings`: Meeting grid, creation forms, quick action buttons.
  - `/auth`: Login modals, push notification waiting states.
- `/src/context`:
  - `AuthContext.tsx`: Manages JWT persistence (localStorage), user profile data, and loading states. Wraps the entire application.
- `/src/pages`:
  - `Dashboard.tsx`: Main hub for upcoming meetings and quick actions.
  - `History.tsx`: List of past meetings.
  - `MeetingRoom.tsx`: The full-screen Jitsi iframe wrapper.
  - `Settings.tsx`: User configuration and theme toggles.
- `/src/utils`: Helper functions (`calendarUtils.ts`, `api.ts`).
- `index.css`: Global design system defining CSS variables for typography, colors, and layout utilities.

### Design System Highlights
The UI is heavily reliant on vanilla CSS variables (`:root`). This allows instantaneous theme switching without React re-renders. 
- Themes are applied via `data-theme` attributes on the `html` or `body` tag.
- Animations (`fadeUp`, `toastIn`) are hardware-accelerated using CSS transforms.

---

## 7. Step-by-Step API Setup Guide

To run this project locally, you must provision several external services. Follow these granular instructions carefully.

### A. MongoDB Database Setup (`MONGODB_URI`)
1. Navigate to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and create a free account.
2. Build a new **Cluster** (select the free shared M0 tier).
3. Once provisioned, click **Connect**.
4. Set up a **Database User** by creating a secure username and password. *Copy this password somewhere safe.*
5. Set up **Network Access**. Click "Add IP Address" and select "Allow Access from Anywhere" (`0.0.0.0/0`) to ensure your local dev server can connect.
6. Choose **Connect your application** (Node.js driver).
7. Copy the provided connection string. Replace `<password>` with the password you created in step 4. This complete string is your `MONGODB_URI`.

### B. Google Sign-In Setup (`GOOGLE_CLIENT_ID`)
1. Access the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new Project (e.g., "hi-video-conferencing").
3. Navigate to **APIs & Services > OAuth consent screen**.
   - Select **External** and click Create.
   - Fill in the required fields (App name, user support email, developer contact information). Click Save and Continue through the remaining steps.
4. Navigate to **APIs & Services > Credentials**.
   - Click **+ CREATE CREDENTIALS** -> **OAuth client ID**.
   - Select Application type: **Web application**.
   - Under **Authorized JavaScript origins**, click Add URI and enter: `http://localhost:3000` (and `http://localhost:5173` if you are using Vite defaults).
   - Click **Create**.
5. A modal will appear with your Client ID and Client Secret. Copy the **Client ID**. This is your `GOOGLE_CLIENT_ID`.

### C. Jitsi as a Service (JaaS) Setup
*Required to authenticate hosts and securely embed the video iframe.*
1. Go to [JaaS by 8x8](https://jaas.8x8.vc/) and register for a developer account.
2. Open the **API Keys** section within the JaaS Console.
3. Locate your **App ID** at the top of the screen (it usually starts with `vpaas-magic-cookie-...`). This is your `JAAS_APP_ID`.
4. Click **Add API Key** to generate a new RSA Key Pair.
5. The system will provide an **API Key ID** (e.g., `kid_...`). This is your `JAAS_API_KEY`.
6. Download the generated `.pkcs8` Private Key file. Open this file in a code editor. The entire block of text (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`) is your `JAAS_PRIVATE_KEY`. *Note: When adding this to a `.env` file, ensure newlines are represented as `\n` if required by your environment loader, or wrap the whole string in quotes.*

### D. Brevo Email API Setup (`BREVO_API_KEY`)
*Required for sending the HTML meeting invitations, reminders, and cancellations.*
1. Create a free account at [Brevo (formerly Sendinblue)](https://www.brevo.com/).
2. Complete your account profile and verify your email address to activate the account.
3. Click on your profile name in the top right corner and select **SMTP & API**.
4. Navigate to the **API Keys** tab and click **Generate a new API key**.
5. Name your key (e.g., "Hi App Mailer") and click Generate.
6. Copy the key immediately (it will only be shown once). This is your `BREVO_API_KEY`.
7. Your `SMTP_USER` should be the email address you used to register for Brevo, or an address you have explicitly verified as a sender in the Brevo dashboard.

### E. VAPID Keys for Push Notifications
*Required to cryptographically sign push notification payloads sent to the browser.*
1. Ensure you have Node.js installed.
2. Open your terminal, navigate to your backend directory, and run:
   ```bash
   npx web-push generate-vapid-keys
   ```
3. The command line will output a **Public Key** and a **Private Key**.
4. Save the Public Key as your `VAPID_PUBLIC_KEY` (used in both frontend and backend `.env`).
5. Save the Private Key as your `VAPID_PRIVATE_KEY` (used only in backend `.env`).

---

## 8. Installation & Getting Started

### Step 1: Clone the Repository
```bash
git clone https://github.com/Ayush546230/Video-Conferencing-website.git
cd Video-Conferencing-website
```

### Step 2: Backend Configuration & Startup
Navigate to the backend directory and install the necessary Node modules:
```bash
cd backend
npm install
```

Create a `.env` file in the root of the `backend` directory and populate it with the credentials gathered in Section 7:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=generate_a_random_secure_string_for_jwt_signing

# Frontend URL Context
FRONTEND_URL=http://localhost:5173

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id

# WebAuthn (Passkeys) Context
RP_ID=localhost
EXPECTED_ORIGIN=http://localhost:5173

# Push Notifications (Web-Push)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key

# Jitsi as a Service Configuration
JAAS_APP_ID=your_jaas_app_id
JAAS_API_KEY=your_jaas_api_key_id
# Ensure the private key is wrapped in quotes if it contains newlines
JAAS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...your...key...here...\n-----END PRIVATE KEY-----"

# Brevo Transactional Email Configuration
BREVO_API_KEY=your_brevo_api_key
SMTP_USER=your_sender_email_address
```

Start the backend development server using nodemon:
```bash
npm run dev
```
You should see console logs indicating successful connection to MongoDB and the server running on port 5000.

### Step 3: Frontend Configuration & Startup
Open a new terminal window, navigate to the frontend directory, and install dependencies:
```bash
cd frontend
npm install
```

Create a `.env` file in the root of the `frontend` directory:
```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
VITE_JAAS_APP_ID=your_jaas_app_id
```

Start the Vite development server:
```bash
npm run dev
```

The application will spin up instantly. Open your browser and navigate to `http://localhost:5173` to experience **hi**.

---

## 📝 License & Attribution

This project is licensed under the MIT License. 
Designed and developed as a premium showcase application.

*Powered by aiRender*
