# hi — Premium Video Conferencing by aiRender

Welcome to **hi**, a modern, secure, and feature-rich video conferencing platform designed to provide a seamless meeting experience. Built with React, Node.js, and powered by Jitsi as a Service (JaaS), **hi** combines high-quality video communication with cutting-edge authentication mechanisms.

---

## 🚀 Features

### 🔐 Advanced Security & Authentication
- **Google Sign-In**: Quick and secure login using your Google account.
- **Passkeys (WebAuthn)**: Passwordless, biometric authentication for maximum security and convenience.
- **Single-Click Login**: Frictionless entry for returning users.
- **Push Notification Login**: Approve login requests securely via mobile push notifications.

### 🎥 Premium Video Conferencing
- **Jitsi as a Service (JaaS) Integration**: Reliable, high-definition video and audio communication.
- **Meeting Dashboard**: Intuitive interface to schedule new meetings, view upcoming ones, and check your meeting history.
- **Host Privileges**: Meeting creators are automatically assigned Moderator roles with full control.

### ⏱️ Timed Consultation Meetings
- **Time-bound Sessions**: Schedule meetings with strict durations.
- **Synchronized Global Timer**: Both host and guests see a live countdown timer seamlessly integrated into the meeting interface.
- **Smart Warning System**: The host receives unobtrusive inline warnings when the meeting is nearing its end.
- **On-the-fly Extension**: The host can easily extend the meeting duration (+5 mins, +10 mins, or custom) dynamically without interrupting the ongoing session.
- **Auto-Termination**: Consultations end automatically for all participants when the time expires, ensuring precise time management.

### 📅 Smart Scheduling & Notifications
- **Automated Emails**: Beautifully designed email templates for meeting invitations, reminders, and cancellations.
- **Brevo API Integration**: Reliable email delivery ensuring your participants never miss an update.
- **Calendar Attachments**: Includes `.ics` files in emails so participants can easily add meetings to their personal calendars.
- **Automated Reminders**: Built-in cron jobs automatically notify participants before a meeting starts.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS / Custom CSS, Jitsi React SDK, SimpleWebAuthn
- **Backend**: Node.js, Express, MongoDB, Mongoose, JWT, Node-Cron, Web-Push, Brevo API

---

## 🔑 Step-by-Step API & Services Setup Guide

To run this project locally, you need to set up several third-party services. Follow these detailed steps to obtain all the necessary credentials.

### 1. MongoDB Database Setup (`MONGODB_URI`)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and create a free account.
2. Create a new **Cluster** (the free shared tier is fine).
3. Once the cluster is ready, click **Connect**.
4. Set up a Database User (create a username and password). *Save this password.*
5. Allow access from anywhere (Network Access -> Add IP Address -> `0.0.0.0/0`) for local development.
6. Choose **Connect your application** and copy the connection string.
7. Replace `<password>` in the connection string with the password you created. This is your `MONGODB_URI`.

### 2. Google Sign-In Setup (`GOOGLE_CLIENT_ID`)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new Project (e.g., "hi-video-conferencing").
3. Go to **APIs & Services > OAuth consent screen**.
   - Choose **External** and click Create.
   - Fill in the required fields (App name, support email, developer email) and click Save and Continue.
4. Go to **APIs & Services > Credentials**.
   - Click **+ CREATE CREDENTIALS** -> **OAuth client ID**.
   - Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add: `http://localhost:3000` (and `http://localhost:5173` if using Vite defaults).
   - Click **Create**.
5. Copy the generated **Client ID**. This is your `GOOGLE_CLIENT_ID`.

### 3. Jitsi as a Service (JaaS) Setup
*Required for the video conferencing room and host authentication.*
1. Go to [JaaS by 8x8](https://jaas.8x8.vc/) and sign up for an account.
2. Go to the **API Keys** section in the JaaS Console.
3. Click **Add API Key**.
4. Generate an RSA Key Pair:
   - **App ID**: Your unique App ID is displayed at the top of the console (e.g., `vpaas-magic-cookie-...`). This is your `JAAS_APP_ID`.
   - **API Key ID**: When you generate a new key, you will get an API Key ID (e.g., `kid_...`). This is your `JAAS_API_KEY`.
   - **Private Key**: Download the `.pkcs8` private key file. Open it in a text editor. The entire block of text (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`) is your `JAAS_PRIVATE_KEY`.

### 4. Brevo Email API Setup (`BREVO_API_KEY`)
*Required for sending meeting invites, reminders, and cancellations.*
1. Go to [Brevo (formerly Sendinblue)](https://www.brevo.com/) and create a free account.
2. Complete your profile and verify your account.
3. In the top right corner, click your profile name and select **SMTP & API**.
4. Go to the **API Keys** tab and click **Generate a new API key**.
5. Name your key and click Generate.
6. Copy the key immediately. This is your `BREVO_API_KEY`.
7. Your `SMTP_USER` is simply the email address you used to register your Brevo account (or an authorized sender email).

### 5. VAPID Keys for Push Notifications
*Required for sending push notifications for login.*
1. You can generate these keys directly from your terminal using the `web-push` library.
2. Run the following command in your backend directory:
   ```bash
   npx web-push generate-vapid-keys
   ```
3. The command will output a **Public Key** and a **Private Key**.
4. Save these as your `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.

---

## 💻 Getting Started (Installation & Running)

### 1. Clone the repository
```bash
git clone https://github.com/Ayush546230/Video-Conferencing-website.git
cd Video-Conferencing-website
```

### 2. Backend Setup
Navigate to the backend directory and install dependencies:
```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory and fill it with the keys you gathered above:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=generate_a_random_secret_string_here

# Frontend URL (Update if Vite runs on a different port)
FRONTEND_URL=http://localhost:5173

# Google Auth
GOOGLE_CLIENT_ID=your_google_client_id

# WebAuthn (Passkeys)
RP_ID=localhost
EXPECTED_ORIGIN=http://localhost:5173

# Push Notifications
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key

# Jitsi as a Service
JAAS_APP_ID=your_jaas_app_id
JAAS_API_KEY=your_jaas_api_key_id
JAAS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...your...key...here...\n-----END PRIVATE KEY-----"

# Brevo Emails
BREVO_API_KEY=your_brevo_api_key
SMTP_USER=your_sender_email_address
```

Start the backend development server:
```bash
npm run dev
```

### 3. Frontend Setup
Open a new terminal window, navigate to the frontend directory, and install dependencies:
```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory:
```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
VITE_JAAS_APP_ID=your_jaas_app_id
```

Start the frontend development server:
```bash
npm run dev
```

The application should now be running at `http://localhost:5173`. Open this URL in your browser to start using **hi**.

---

## 📝 License

This project is licensed under the MIT License.

---
*Powered by aiRender*
