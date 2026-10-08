# Fix sign-in email code + finish all pages

## 1. Sign-in email shows a 6-digit code
- Set up branded sign-in emails for the app (requires an email sending domain; you'll get a setup card if one isn't configured).
- Edit the sign-in email template so it shows the 6-digit code prominently, with the link as a backup.
- Add a "Continue with Google" button as a faster alternative (managed Google sign-in, no setup needed).

## 2. Complete the app (all pages are currently placeholders)
- **Scan**: upload chest X-ray, image quality check, run your model in the browser, show result (Normal / Pneumonia + probability) with disclaimers, save to history.
- **Dashboard**: recent scans, quick "New scan" action, counts.
- **History**: list of saved scans, open/delete, filter by result.
- **Reports**: download a PDF report per scan.
- **Doctors**: browse verified doctors; **Appointments**: request/cancel, see status.
- **Doctor portal**: doctors see their appointment requests and shared scans, accept/decline, add notes.
- **Profile / Settings**: name, age, sign out, delete my data.
- **Admin**: approve doctor applications, assign roles, view usage counts.

## 3. Checks
- Tests for the threshold rule (0.71 → Pneumonia) and that no label shows without a valid result.
- Click-through test of sign-in page, scan flow and history.

## Technical details
- Auth email via scaffold_auth_email_templates; OTP template uses `{{ .Token }}`. Google via configure_social_auth + lovable.auth.signInWithOAuth.
- Reuse existing tables/RLS (scans, appointments, doctors, user_roles); add migrations only where missing.
- Pages use loader + useSuspenseQuery; existing classifier/pdf/scans libs.
