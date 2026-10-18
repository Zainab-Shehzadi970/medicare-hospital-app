# Medicare Hospital: Patient Appointment App

Android app (React Native) that lets patients book doctor appointments online. Bookings are stored in Supabase and appear on the doctor's web dashboard in real time.

## Features
- Patient sign up and login (email format validation)
- Single-screen booking form: Department > Doctor > Date > Time > Reason
- Doctors and departments are loaded from the database
- Date options show only the days the selected doctor is available
- Time slots are generated from the doctor's schedule
- Already booked slots are disabled for other patients
- Double booking is prevented at database level (unique index)
- Each patient can only access their own records (Row Level Security)

## Tech Stack
- React Native 0.87 (CLI, not Expo), Android
- Supabase: Auth, PostgreSQL, Row Level Security, Realtime

## Related Repository
Doctor dashboard (Next.js web app): add link to the `medicare-web` repo here.

## Getting Started

### Prerequisites
- Node.js 22 or newer
- JDK 17
- Android Studio with Android SDK, and `ANDROID_HOME` set
- An Android phone with USB debugging on (or an emulator)

### Setup
1. Clone the repo and install packages:
```bash
   npm install
```
2. Open `src/lib/supabase.js` and set your Supabase project URL and **publishable (anon) key**:
```js
   const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR-PUBLISHABLE-KEY';
```
   Never put the `service_role` / secret key in the app.

### Run
```bash
adb reverse tcp:8081 tcp:8081
npx react-native start
```
In a second terminal:
```bash
npx react-native run-android
```

## Database
Supabase tables: `profiles`, `departments`, `doctors`, `doctor_schedules`, `appointments`, plus a `get_booked_slots` function. Row Level Security is enabled on all tables.

## Status
Completed: authentication, appointment booking, real-time sync with the doctor dashboard.
Planned: "My Appointments" screen (view and cancel bookings).