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
Doctor dashboard (Next.js web app): https://github.com/Zainab-Shehzadi970/medicare-web

## Project Structure
```
App.tsx                  Session check: shows login or booking screen
src/
  lib/supabase.js        Supabase client
  screens/
    AuthScreen.js        Login and signup
    HomeScreen.js        Booking form (department, doctor, date, time, reason)
  theme.js               Shared colors
```

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
1. Start Metro:
```bash
   adb reverse tcp:8081 tcp:8081
   npx react-native start
```
2. In a second terminal, build and install the app (first time, or after adding a native package):
```bash
   npx react-native run-android --active-arch-only
```

### Release APK
```bash
cd android
gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```
The APK is created at `android/app/build/outputs/apk/release/app-release.apk` and runs without Metro or a laptop.

## Database
Supabase tables: `profiles`, `departments`, `doctors`, `doctor_schedules`, `appointments`, plus a `get_booked_slots` function. Row Level Security is enabled on all tables. Doctor accounts are created in Supabase Auth and linked to a row in the `doctors` table. The same database is used by the doctor dashboard.

## Status
Completed: authentication, appointment booking, real-time sync with the doctor dashboard.
Planned: "My Appointments" screen (view and cancel bookings).