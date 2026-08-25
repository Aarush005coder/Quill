# 🪶 Quill

<p align="center">
  <strong>Translate, transform, and manage your content from one simple, intelligent workspace.</strong>
</p>

<p align="center">
  <a href="https://quill-aarush01.vercel.app">
    <img src="https://img.shields.io/badge/Live%20Demo-Visit%20Quill-2563EB?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo">
  </a>
  <img src="https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Django-4.x-092E20?style=for-the-badge&logo=django&logoColor=white" alt="Django">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome">
  <img src="https://img.shields.io/badge/Maintained-Yes-success?style=flat-square" alt="Maintained">
</p>

---

## 📸 App Preview

> 💡 *Replace the image below with a high-quality screenshot or a short GIF of your app in action!*

<p align="center">
  <img src="https://via.placeholder.com/800x450/1e293b/ffffff?text=Quill+Dashboard+Preview" alt="Quill App Preview" width="100%" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
</p>

---

## ✨ Key Features

### 🌐 Core Translation
- **Multi-Mode Translation**: Text-to-Text, Text-to-Speech, Speech-to-Text, and Speech-to-Speech.
- **Smart Engine Fallback**: Automatically switches between Google, DeepL, Microsoft, MyMemory, and LibreTranslate if one fails.
- **Document Support**: Upload and translate PDFs and documents seamlessly.

### 🎙️ Advanced Audio
- **Neural Text-to-Speech**: High-quality, natural-sounding voice generation using Edge TTS (with gTTS fallback).
- **Accurate Speech Recognition**: Real-time audio transcription with background noise filtering via FFmpeg.

### 🛡️ Security & User Experience
- **Secure Authentication**: JWT-based auth with optional Two-Factor Authentication (2FA).
- **Real-time Notifications**: In-app, Email (via Brevo), and Browser Push Notifications.
- **Customizable Workspace**: Dark/Light/System themes, compact mode, font sizing, and animation toggles.
- **Activity Tracking**: Detailed dashboard with translation history, favorites, and usage analytics.

---

## 🛠️ Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend** | React, TypeScript, Tailwind CSS, Lucide React, Vercel |
| **Backend** | Python, Django, Django REST Framework, SimpleJWT |
| **Database** | PostgreSQL (Production) / SQLite (Development) |
| **AI / Media** | Edge TTS, gTTS, SpeechRecognition, FFmpeg, Deep Translator |
| **Services** | Brevo (Email), Web Push API, GitHub Actions |

---

## 🚀 Getting Started

Follow these steps to run Quill locally on your machine.

### Prerequisites
- Node.js (v18+) & npm
- Python (v3.10+) & pip
- FFmpeg installed on your system

### 1. Clone the Repository
```bash
git clone https://github.com/Aarush005coder/Quill.git
cd Quill
