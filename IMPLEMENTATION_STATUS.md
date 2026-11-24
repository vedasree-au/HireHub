# HireHub implementation and verification status

## Implemented in this build
- Candidate/recruiter registration and login with JWT; public admin registration is blocked.
- Server-side role checks and active-account checks.
- Candidate and recruiter profile create/update/read endpoints.
- Job create/edit/close, public listing, keyword/location/skills/employment/workplace/experience/salary filtering, sorting, and pagination.
- Candidate resume upload for PDF/DOCX, file size/signature checks, text extraction, private storage, list/delete/download authorization, and default-resume behavior.
- Job applications, duplicate prevention, application history, status updates, withdrawal, recruiter ownership enforcement, and private recruiter notes.
- Saved jobs, candidate recommendations, notifications, candidate/recruiter/admin dashboard metrics.
- Recruiter resume access restricted to applications for the recruiter's own jobs.
- Admin provisioning through environment variables, user activation controls, job moderation, reported-job review/resolution, and platform metrics.
- AI-assisted semantic matching using Sentence Transformers when available, with TF-IDF fallback and explicit advisory-only messaging.
- React pages for landing, job search, registration/login, candidate workspace, recruiter workspace, admin workspace, and notifications.
- Docker Compose, PostgreSQL, SQLite local configuration, Alembic initial schema revision, environment examples, and documentation.

## Verification performed for this generated archive
- Python source compilation completed successfully (`python -m compileall`).
- The standalone matching test passed in the available runtime.
- Full API integration tests could not be executed in the generation environment because `python-jose` and other pinned runtime packages were not installed and network access was unavailable. They are declared in `backend/requirements.txt`; run `python -m pip install -r requirements.txt` followed by `python -m pytest -q` locally.
- Frontend production build could not be verified in this environment because npm dependency installation did not complete. Run `npm install` and `npm run build` locally.

## Important distinction
This is a substantially expanded, runnable academic/portfolio implementation, but it is not certified or hardened for production hiring operations. Follow the security and deployment checklist in `README.md` before using real candidate data or deploying publicly. Do not claim tests passed unless you run them in your environment.
