# MediCare+ 🏥

A complete healthcare management platform built as a single-page React application — covering AI-assisted symptom checking, recovery tracking with computer vision, medication adherence, doctor booking, medicine price comparison, insurance claims, and emergency alerts.

**Live app:** [medicare-pluse-2lvl.vercel.app](https://medicare-pluse-2lvl.vercel.app)

## Screenshots
Login<img width="1315" height="611" alt="image" src="https://github.com/user-attachments/assets/cac8a07a-f92e-4751-901f-afe778c9698d" />
Dashboard<img width="1887" height="882" alt="image" src="https://github.com/user-attachments/assets/8bb35e0b-9a56-4a89-b109-19d588ab8188" />
AI Assistant<img width="1600" height="743" alt="image" src="https://github.com/user-attachments/assets/77972dc6-8932-4a4a-81e4-64e251b28f3b" />
Healing Tracker<img width="1600" height="752" alt="image" src="https://github.com/user-attachments/assets/61c5682c-288c-441f-8b08-12e3fb6d7754" />


---

## Overview

MediCare+ was built to explore what a unified healthcare experience could look like — instead of juggling separate apps for booking doctors, tracking medication, and monitoring recovery, everything lives in one place with a shared patient profile.

The standout feature is the **AI-powered healing photo tracker**: patients upload a daily photo of a wound or surgical site, and a vision model analyzes swelling, discoloration, rashes, and estimated healing progress — flagging concerns before they become complications.

## Features

| Feature | Description |
|---|---|
| 🔐 **Authentication** | Email/password auth via Firebase, with per-user data isolation |
| 💬 **AI Health Assistant** | Conversational symptom checker with urgency triage, powered by Groq |
| 📷 **Healing Photo Tracker** | Daily photo uploads analyzed by a vision LLM — tracks swelling, rashes, healing % over time |
| ⏰ **Medication Reminder** | Add medications with custom dose times, daily check-off tracking with adherence percentage |
| 📋 **Patient History** | Centralized record of allergies, current medications, and a timeline of medical records |
| 🩺 **Doctor Booking** | Browse and book consultations by specialty, rating, and price |
| 💊 **Medicine Marketplace** | Compare prices across pharmacies, order with one click |
| 🥗 **Diet Plan** | Condition-aware nutrition suggestions (diabetes, hypertension, cardiac, general) |
| 🚨 **Emergency Alert** | One-tap alert flow that shares medical profile with emergency contacts and nearest hospital |
| 🗂️ **Insurance Claims** | Submit claims with automatic deductible/co-pay reimbursement calculation |

## Tech Stack

- **Frontend:** React (Create React App), plain CSS utility classes
- **Backend:** Firebase Authentication + Firestore (real-time, per-user data)
- **AI:** Groq API — `openai/gpt-oss-120b` for chat, `qwen/qwen3.6-27b` for vision analysis
- **Hosting:** Vercel (auto-deploys on push to `main`)
- **Design:** Custom design system — Fraunces (display) + Inter (body) + IBM Plex Mono (data)

## Architecture Notes

- All patient data is scoped under `patients/{uid}` in Firestore, with subcollections for records, bookings, orders, healing photos, and claims — enforcing per-user isolation.
- The AI chatbot and vision analysis run client-side against Groq's API using an environment variable (`REACT_APP_GROQ_API_KEY`), keeping the app fully serverless.
- Diet plans are rule-based (condition → meal plan mapping) rather than AI-generated, prioritizing reliability and zero API cost for a frequently-used feature.

## Running Locally

```bash
git clone https://github.com/akshayasivagami3-droid/Medicare-Pluse.git
cd Medicare-Pluse/medicare
npm install
```

Create a `.env` file in the project root:
```
REACT_APP_GROQ_API_KEY=your_groq_api_key_here
```

```bash
npm start
```

You'll also need your own Firebase project — update the `firebaseConfig` object in `src/App.js` with your project's credentials, and enable Email/Password Authentication and Firestore Database in test mode.

## Roadmap

- [ ] Video consultation integration
- [ ] Push notifications for medication reminders
- [ ] Multi-language support (Tamil, Hindi)
- [ ] Caregiver/family profile sharing
- [ ] Wearable device sync (Fitbit, Google Fit)

## Author

Built by M.Akshaya Sivagami — a project exploring full-stack development, AI integration, and product design as part of a transition from ECE into software engineering.

---

*This project uses free-tier services (Firebase Spark plan, Groq free tier, Vercel Hobby plan) and is intended as a portfolio/demo project, not a production medical application. It does not provide medical diagnoses and should not be used as a substitute for professional healthcare advice.*
