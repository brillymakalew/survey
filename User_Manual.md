# 🚀 Survey App: The Ultimate Flight Manual!

Welcome aboard! This manual is your trusty guide to navigating every corner of this application. Whether you're a respondent taking the survey or an admin analyzing the treasure trove of data, we've got you covered.

Let's dive in! 🌊

---

## 🎭 Part 1: The Respondent Experience (Front-End)

This is what your audience sees. It's designed to be smooth, mobile-friendly, and engaging to ensure maximum completion rates!

### 1. The Welcome Screen & Onboarding
- **The Pitch:** Before seeing any questions, users are greeted with a beautiful welcome screen. It sets the stage, explains the purpose of the survey, and gets them ready.
- **Getting Started:** They enter their basic details (Name, Phone Number, Email) so they can pick up exactly where they left off if they get disconnected. We use their phone number as their unique ID!

### 2. The Three Panels
The survey is broken down into easily digestible chunks to prevent survey fatigue:
- **Panel 1 (The Basics):** Gathers baseline demographic info. *Pro Tip: Affiliation and Country Base questions are tracked closely by the system!*
- **Panel 2 (The Meat):** Deeper dives into specific survey topics.
- **Panel 3 (The Details):** The final stretch of core questions.

### 3. The Closing Act
- **Collaboration Intent:** We ask them straight up if they want to collaborate in the future.
- **Completion!** A satisfying thank-you screen lets them know their voice has been heard.

*(Psst... if a user closes the tab midway through Panel 2, don't panic! The system remembers them. When they log back in with the same phone number, they jump right back to Panel 2!)* 🧠

---

## 🕵️‍♂️ Part 2: The Admin Command Center (Back-End)

This is where the magic happens. Navigate to `/admin/login` to access your secret lair.

### 📊 Tab 1: Overview
Your 10,000-foot view of how the survey is performing.
- **The KPI Cards:** Instantly see how many people have Registered, Started, and Completed each Panel.
- **Overall Progression (Funnel):** A beautiful horizontal bar chart showing exactly where drop-offs are happening.
- **Demographic Pies:** See your audience breakdown at a glance (Collaboration Intent, Affiliation, Country Base).
- *Cool Feature:* Click the little expand icon on any chart to view it in **Glorious Full Screen!**

### 👥 Tab 2: Respondents
The digital rolodex of everyone taking your survey.
- **Live Tracking:** See exactly who is stuck on which phase and when they were last seen.
- **Quick Search:** Looking for someone specific? The search bar updates instantly.

### 📈 Tab 3: Questions
Deep dive into the data! This page analyzes *everything*.
- **Smart Filters:** Want to see how only *Academics from the UK* answered a specific question? Use the dropdown filters at the top!
- **Multiple Choice Breakdowns:** Neon-glowing, hovering bar charts show you exactly how many people selected each option.
- **Likert Scales:** See the average score, min, and max for those 1-7 rating questions. (Hover over the cards to see the cool particle effects!) ✨

### 💾 Tab 4: Exports & Imports
Your data portability hub.
- **Export Data:** Download your raw `Respondents` or detailed `Responses` instantly to beautifully formatted Excel (`.xlsx`) or `.csv` files.
- **Import Data:** Did you clean up some data in Excel? Need to upload a batch of old responses? Use the Import tool! *Just make sure your file matches the exact format of the Export tool.*
- **DANGER ZONE (Clear Data):** Need to start fresh for a new round of surveys? The "Clear Data" button will wipe the database clean. Don't worry, there's a safety lock—you have to literally type "saya setuju" to pull the trigger! 💥

---

## 🎉 You're Ready!
You are now fully certified to operate this survey application. Go forth and gather that data! 🚀
