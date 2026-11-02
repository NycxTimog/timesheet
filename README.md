# Timesheet — Attendance Management

Initial GitHub Pages project scaffold for a multi-employee attendance system.

## Current status
This is a starter shell only. It does not yet provide real login, shared records,
attendance calculations, leave approvals, or employee permissions.

## Planned features
- Employer and employee accounts
- Role-based access and employee-specific records
- Time in/out and break tracking
- Regular hours capped at scheduled daily hours
- Separate overtime, undertime, and offset records
- Paid leave and unpaid absence tracking
- Historical timesheets, notes, and exports
- Audit history for changes

## Project structure
- `index.html` — website entry page
- `assets/css/` — styles
- `assets/js/` — application modules
- `config/supabase.js` — public client configuration placeholder
- `database/schema.sql` — database schema placeholder

## Security note
GitHub Pages serves static files publicly. Never put passwords, private keys,
or Supabase service-role keys in this repository. Employee privacy must be
enforced by Supabase authentication and Row Level Security policies before
real records are added.

## GitHub Pages
After uploading the files, open **Settings → Pages** and choose **Deploy from a branch**,
then select `main` and `/(root)`. The site entry file must be at the repository root.
