# BedFlow

BedFlow is a staff-facing hospital bed coordination workspace for a Rabat hospital. It keeps patient identifiers to anonymous codes and provides role-aware operations for administrators, doctors, nurses, and cleaning staff.

## Current workspace setup

This Chantan project runs on its supported React + Vite + TypeScript workspace and the connected managed PostgreSQL database (Supabase). It does **not** run Next.js or Prisma in this hosted workspace; the database schema and seed data are provisioned directly in the managed backend. Authentication is handled by Supabase Auth, passwords are securely hashed by the auth service, and staff roles are carried in server-granted app metadata.

The initial setup creates six departments, 25 rooms, 80 beds, active anonymous demo admissions, and a status audit trail. Live bed changes are delivered through database Realtime. The `bedflow-action` server function enforces staff-role rules for assignments, discharges, status updates, and administrator CRUD.

## Sign in

Open the BedFlow preview and sign in with one of the demo accounts shared by the project owner. Administrators can manage departments, rooms, beds, and staff accounts in Administration.

## Local development

1. Install the project dependencies with `npm install`.
2. Use the configured Chantan database connection already provided by this project. Do not copy service-role credentials into browser code.
3. Run the app with `npm run dev`.
4. The managed database schema, sample rows, and realtime publication were created during setup. Edge functions are deployed by Chantan when their source is saved.

## Privacy and operational safety

- Store only a code such as `PAT-A12B34` in patient-code fields; never enter a name, diagnosis, or clinical note.
- Staff roles are checked from the signed-in account's server-issued role. Do not grant access by editing a profile row.
- Keep a separate, institution-approved patient system for clinical records. BedFlow is an operational coordination prototype and is not a substitute for hospital security, CNDP review, or a medical record system.
- Before using real hospital operations, the hospital must review database visibility and access settings, access logs, retention, backups, and Moroccan Law 09-08/CNDP requirements.

## `.env.example`

No local browser secrets are required for the hosted preview. The managed database connection is configured by the platform; never place a service-role key in a `VITE_*` variable.