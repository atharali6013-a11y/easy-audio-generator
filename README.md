# Easy Audio Generator (Urdu Conversational Podcast) 🎙️

Easy Audio Generator is a full-stack PWA application that transforms uploaded documents (PDFs, DOCX, TXT, PPT, PPTX) in **any language** into engaging, two-speaker Urdu audio conversations (similar to Google NotebookLM's Audio Overview)—all completely **FREE**.

The application uses local AI models (via LM Studio) and free-tier cloud services to offer a zero-cost, unlimited-character audio generation experience.

---

## 🛠️ Tech Stack & Services

1. **Frontend & Backend**: Next.js (App Router), React, Tailwind CSS.
2. **AI Dialogue generation**: **Gemma 4** running locally via **LM Studio** (OpenAI-compatible server at `http://localhost:1234/v1`).
3. **Text-To-Speech**: **Microsoft Edge TTS** (`msedge-tts` package) using `ur-PK-UzmaNeural` (female Host) and `ur-PK-AsadNeural` (male Expert) neural voices.
4. **Auth & Database**: **Firebase Auth** (Google Sign-In) & **Clouder Firestore** (Spark Plan - Free).
5. **Storage**: **Cloudflare R2** (S3-compatible, 10GB free tier with zero egress fees).
6. **Hosting**: Designed for **Vercel** (Hobby Plan).

---

## 📋 Prerequisites

To run this application locally or deploy it, you will need:
- [Node.js](https://nodejs.org) (v18.0.0 or higher)
- [LM Studio](https://lmstudio.ai/) running locally with **Gemma 4** (or any model capable of generating JSON scripts)
- A **Firebase** project (Free Spark Plan)
- A **Cloudflare** account with an R2 Bucket set up

---

## 🚀 Setting Up the Application

### 1. Clone the Project & Install Dependencies
Navigate to the directory and run:
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```
Fill in the configuration parameters:
- **Firebase client keys**: From your Firebase Console (Project Settings > General > SDK setup).
- **Firebase Admin SDK keys**: Generated from Firebase Console (Project Settings > Service Accounts). Copy the private key structure and email.
- **Cloudflare R2 credentials**: From Cloudflare Console (R2 page > Manage R2 API tokens). Include Account ID, Access Key ID, Secret Access Key, Bucket Name, and a public URL for files.
- **LM Studio Server URL**: Default is `http://localhost:1234/v1`.

### 3. Start LM Studio
1. Open LM Studio.
2. Download and load the **Gemma 2 9B** or **Gemma 4** model (or another instruction-following model).
3. Start the **Local Server** (typically on port `1234`). Make sure to enable CORS and check the API endpoint path.

### 4. Run the Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔄 How it Works (Under the Hood)

1. **Document Import**: The document is parsed to clean text on the server (using libraries like `pdf-parse`, `mammoth`, `officeparser`).
2. **Urdu Dialog Scripting**: The text is chunked and summarized before sending to LM Studio. The model outputs a JSON structure detailing speaker turns (`host` vs `expert`) in natural, conversational Urdu.
3. **Speech Synthesis**: The server connects to Microsoft Edge's translation-free TTS streams. Host sentences are voiced using `Uzma` (female) and expert replies using `Asad` (male).
4. **Stitching & Silence**: Individual audio streams are merged together with slight silence breaks (500ms between lines, 800ms when speakers swap) to produce a cohesive podcast MP3 file.
5. **Upload & Share**: The resulting MP3 is uploaded to Cloudflare R2 and registered in Firestore. Users receive an interactive custom audio player and a public sharing link.

---

## 👤 Development Credits
Developed by **Mr. Ali Athar**, platform: **Accessible Life Interface**.
