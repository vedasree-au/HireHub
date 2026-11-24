# Architecture

```mermaid
flowchart LR
  Browser[React + TypeScript] -->|HTTPS / JSON| API[FastAPI REST API]
  API --> Auth[JWT + Role Checks]
  API --> ORM[SQLAlchemy]
  ORM --> DB[(PostgreSQL)]
  API --> Match[TF-IDF Matching Service]
  Match --> API
```

## Core entities

```mermaid
erDiagram
  USERS ||--o{ JOBS : posts
  USERS ||--o{ APPLICATIONS : submits
  JOBS ||--o{ APPLICATIONS : receives
  USERS {
    int id PK
    string name
    string email UK
    string password_hash
    string role
  }
  JOBS {
    int id PK
    int recruiter_id FK
    string title
    string company
    text description
    string status
  }
  APPLICATIONS {
    int id PK
    int candidate_id FK
    int job_id FK
    string status
    datetime created_at
  }
```

This ER diagram documents only the entities currently implemented in the MVP. Extend it as profile, resume, skills, company, notes, notification, and AI-result tables are added.
