# BedFlow

BedFlow is a staff-facing hospital bed coordination workspace for a Rabat hospital. It keeps patient identifiers to anonymous codes and provides role-aware operations for administrators, doctors, nurses, and cleaning staff.

## Live Demo

**[Open BedFlow](https://my-chantan-app-self.vercel.app)**

The demo requires an authorized account. Use demo credentials supplied by the project owner; do not enter real patient data.

## Current Workspace Setup

This project runs on its supported React + Vite + TypeScript workspace and connected managed PostgreSQL database (Supabase). It does **not** use Next.js or Prisma in this hosted workspace; the database schema and seed data are provisioned directly in the managed backend. Authentication is handled by Supabase Auth, passwords are securely hashed by the auth service, and staff roles are carried in server-granted app metadata.

The initial setup creates six departments, 25 rooms, 80 beds, active anonymous demo admissions, and a status audit trail. Live bed changes are delivered through database Realtime. The `bedflow-action` server function enforces staff-role rules for assignments, discharges, status updates, and administrator CRUD.

## Sign In

Open the live demo and sign in with one of the demo accounts shared by the project owner. Administrators can manage departments, rooms, beds, and staff accounts in Administration.

## Local Development

1. Install dependencies with `npm install`.
2. Use the configured Chantan database connection provided by the project. Do not copy service-role credentials into browser code.
3. Run the app with `npm run dev`.
4. The managed database schema, sample rows, and realtime publication were created during setup. Edge functions are deployed by Chantan when their source is saved.

## Privacy and Operational Safety

- Store only a code such as `PAT-A12B34` in patient-code fields; never enter a name, diagnosis, or clinical note.
- Staff roles are checked from the signed-in account's server-issued role. Do not grant access by editing a profile row.
- Keep a separate, institution-approved patient system for clinical records. BedFlow is an operational coordination prototype and is not a substitute for hospital security, CNDP review, or a medical record system.
- Before using real hospital operations, the hospital must review database visibility and access settings, access logs, retention, backups, and Moroccan Law 09-08/CNDP requirements.

## Environment

No local browser secrets are required for the hosted preview. The managed database connection is configured by the platform; never place a service-role key in a `VITE_*` variable.

## Screenshots

Add reviewed screenshots of the app interface here.
