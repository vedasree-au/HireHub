# HireHub — Job Portal & Recruitment Management System

HireHub is a full-stack recruitment platform built with React + TypeScript, FastAPI, SQLAlchemy, and PostgreSQL. It supports candidate and recruiter workflows, a separately provisioned administrator role, private resume uploads, application tracking, recruiter review tools, notifications, and advisory resume-to-job matching.

## Features

### Candidate
- Register and sign in securely.
- Create and update a candidate profile (contact details, skills, education, experience, links, and summary).
- Upload, list, replace by uploading a new default resume, download, and delete PDF/DOCX resumes.
- Search and filter published jobs by keyword, location, work style, employment type, skills, and experience.
- Save jobs, view recommended jobs, and request an advisory resume match.
- Apply to jobs, optionally attach a resume and cover letter, track status, and withdraw eligible applications.
- Receive application status notifications.

### Recruiter
- Register and manage a company/recruiter profile.
- Create, edit, publish, and close job postings.
- View owned jobs and dashboard metrics.
- Review applicants for owned jobs, update application status, add private internal notes, and view AI-assisted resume match explanations.
- Download a resume only when it is attached to an application for one of the recruiter's jobs.
- Receive notifications about new applications.

### Administrator
- Admin accounts are provisioned from environment variables; public registration cannot create an admin.
- View platform metrics, users, and job listings.
- Enable/disable accounts, moderate job status, and review/resolve user-submitted job reports.

### AI-assisted matching
- Uses Sentence Transformers (`all-MiniLM-L6-v2`) for semantic embeddings when the model can be loaded.
- Falls back to TF-IDF cosine similarity when the model package/model is unavailable.
- Returns a similarity score, detected overlapping terms, missing job-description terms, and an explanation.
- The score is advisory only. It is not a hiring probability, validated suitability measure, or automatic selection/rejection mechanism. Human review is required.

## Technology
- Frontend: React 18, TypeScript, Vite, React Router, Axios, Tailwind CSS, Lucide, Recharts dependency
- Backend: Python 3.12, FastAPI, Pydantic, SQLAlchemy 2, Alembic
- Database: PostgreSQL 16; SQLite is supported for local development
- Auth: JWT and bcrypt password hashing
- Resume extraction: pypdf and python-docx
- Matching: Sentence Transformers with TF-IDF fallback
- Tests: Pytest and FastAPI TestClient

## Run with Docker (Windows PowerShell)

1. Install and start Docker Desktop.
2. In this folder, create your local environment file:
   ```powershell
   Copy-Item .env.example .env
   ```
3. Edit `.env`. Set a long random `SECRET_KEY`, a strong `POSTGRES_PASSWORD`, and (optionally) `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Use URL-safe alphanumeric characters for the database password unless you URL-encode special characters in `DATABASE_URL`.
4. Start the application:
   ```powershell
   docker compose up --build
   ```
5. Open:
   - Frontend: http://localhost:5173
   - API documentation: http://localhost:8000/docs
   - Health check: http://localhost:8000/health

The backend container runs `alembic upgrade head` before starting the API. Resume files are stored in `backend/uploads/` and are excluded from Git.

## Run locally without Docker

### Backend (PowerShell)
```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# For a quick local SQLite run, keep DATABASE_URL as sqlite:///./jobportal.db.
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend (second PowerShell terminal)
```powershell
cd frontend
npm install
npm run dev
```

The frontend expects the API at `http://localhost:8000` by default. Set `VITE_API_URL` if your API is hosted elsewhere.

## Administrator setup

Set both `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the backend environment before the first startup. On startup, HireHub creates that administrator account only if the email does not already exist. Admin users cannot be created through public registration. Change the initial password after first use; never commit `.env` files.

## Tests

After installing backend requirements:
```powershell
cd backend
python -m pytest -q
```

The tests cover the matching service, candidate application flow, duplicate application prevention, and role-based job creation restrictions. Add further integration and browser tests before production deployment.

## Main API groups

- Public landing data: `/public/stats`
- Authentication: `/auth/register`, `/auth/login`, `/auth/me`
- Candidate profile: `/candidate/profile`
- Recruiter profile: `/recruiter/profile`
- Jobs: `/jobs`, `/jobs/{job_id}`, recruiter `/recruiter/jobs`
- Resume management: `/resumes`, `/resumes/{resume_id}/download`
- Applications: `/jobs/{job_id}/apply`, `/applications/me`, `/applications/me/details`, `/applications/{application_id}/withdraw`
- Saved jobs and recommendations: `/saved-jobs`, `/jobs/{job_id}/save`, `/recommendations/jobs`
- Recruiter pipeline: `/recruiter/applications`, `/applications/{application_id}/status`, `/applications/{application_id}/notes`
- AI matching: `/ai/match-resume`, `/ai/match-job/{job_id}`, `/applications/{application_id}/resume-match`
- Notifications: `/notifications`
- Dashboards: `/candidate/dashboard`, `/recruiter/dashboard`, `/admin/dashboard`
- Administration: `/admin/users`, `/admin/jobs`, `/admin/reports`; authenticated users can report suspicious listings with `/jobs/{job_id}/report`

## Database and migrations

SQLAlchemy models live in `backend/app/models.py`. Alembic configuration and the initial schema revision are in `backend/alembic/`. For schema changes, update the models and create a new migration using Alembic autogeneration; review the generated migration before applying it.

## Security and deployment checklist

This repository is a portfolio/capstone implementation, not a security-certified production hiring service. Before handling real candidate data or deploying publicly:
- Use HTTPS, strong unique secrets, secure database credentials, and production CORS origins.
- Put resume storage in private object storage, add malware scanning, retention/deletion policies, and backups.
- Add rate limiting, token refresh/revocation, audit logging, monitoring, and alerting.
- Perform a privacy and bias review of AI matching and evaluate it against a representative, consented dataset.
- Expand integration, accessibility, load, and end-to-end tests; perform a security review.
- Configure production database backups and a deployment pipeline.

Never commit `.env`, credentials, database files, or uploaded resumes. The AI score must never be used as an automatic hiring decision.
