# BedFlow

BedFlow is a staff-facing hospital bed coordination workspace for a Rabat hospital. It helps teams coordinate departments, rooms, beds, admissions, and bed-status changes through role-aware workflows. Patient identifiers should remain anonymous codes.

## Live Demo

**[Open BedFlow](https://my-chantan-app-self.vercel.app)**

The hosted demo requires an authorized account. Request demo access from the project owner; never enter real patient information into the demo.

## User Roles

- **Administrator:** Manages departments, rooms, beds, and staff accounts.
- **Doctor:** Uses the workspace for bed and admission coordination within assigned permissions.
- **Nurse:** Coordinates assigned bed operations and patient-flow updates.
- **Cleaning staff:** Receives and updates cleaning-related bed status within the assigned workflow.

Access is enforced by the server-side `bedflow-action` function using the signed-in user's server-issued role. Do not grant privileges by editing client-side profile data.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **UI and routing:** React Router, Radix UI, Lucide icons
- **Backend services:** Supabase Auth, managed PostgreSQL, database Row Level Security, Realtime
- **Server-side operations:** Supabase Edge Functions, including `bedflow-action`
- **Build tooling:** Node.js, npm, Vite, TypeScript

This is a React + Vite application backed by Supabase. It does not use Next.js or Prisma in the current hosted workspace.

## Local Setup

### Prerequisites

- Node.js and npm
- Access to the Supabase project used by this app, or a separately configured Supabase project

### Install and configure

1. Clone the repository and enter the project folder:

   ```bash
   git clone https://github.com/yassirdev1/my-chantan-app.git
   cd my-chantan-app
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` using the values from your Supabase project settings. Never put `SUPABASE_SERVICE_ROLE_KEY` or another privileged secret in a `VITE_*` variable or commit it to Git.

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:5173](http://localhost:5173).

### Production build

```bash
npm run build
npm run preview
```

The hosted Chantan workspace has its managed database schema, sample records, and Realtime configuration provisioned separately. A fresh Supabase project needs the corresponding schema, policies, seed data, and Edge Functions deployed before all workflows will operate; do not assume that setting the two public client environment variables alone provisions the backend.

## Data and Operational Safety

- Use anonymous identifiers such as `PAT-A12B34`; do not enter names, diagnoses, or clinical notes.
- Treat BedFlow as an operational coordination prototype, not a medical-record system or a replacement for an institution-approved patient system.
- Before any real hospital deployment, obtain institutional review of access controls, database visibility, audit logs, retention, backups, and applicable Moroccan Law 09-08/CNDP requirements.
- Never commit `.env`, service-role keys, or other credentials.

## Demo Data

The configured workspace was seeded with six departments, 25 rooms, 80 beds, anonymous demo admissions, and a bed-status audit trail. Live bed changes use Supabase Realtime.
