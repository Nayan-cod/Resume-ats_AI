import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ats_db")

def get_conn():
    """Get a new database connection."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def init_db():
    """Create all tables if they don't exist and perform schema migrations."""
    conn = get_conn()
    c = conn.cursor()

    # Users table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL CHECK (role IN ('hr', 'candidate')),
            smtp_email VARCHAR(255),
            encrypted_smtp_password TEXT,
            smtp_host VARCHAR(255),
            smtp_port INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Migration for Users table (in case it already existed without SMTP columns)
    c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS smtp_email VARCHAR(255)")
    c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_smtp_password TEXT")
    c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255)")
    c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS smtp_port INTEGER")

    # Jobs table
    c.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            id SERIAL PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            description TEXT NOT NULL,
            hr_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Applications table
    c.execute('''
        CREATE TABLE IF NOT EXISTS applications (
            id SERIAL PRIMARY KEY,
            job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            resume_filename VARCHAR(500),
            resume_path VARCHAR(1000),
            ai_score INTEGER DEFAULT 0,
            ai_decision VARCHAR(50) DEFAULT 'Processing',
            ai_justification TEXT DEFAULT '[]',
            hr_status VARCHAR(50) DEFAULT 'pending',
            candidate_name VARCHAR(255) DEFAULT '',
            candidate_role VARCHAR(255) DEFAULT '',
            email_sent BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(job_id, user_id)
        )
    ''')

    # Migration for Applications table (in case it already existed without email_sent column)
    c.execute("ALTER TABLE applications ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE")

    # Login Logs table
    c.execute('''
        CREATE TABLE IF NOT EXISTS login_logs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            ip_address VARCHAR(45),
            user_agent TEXT,
            status VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()


# ── User Functions ──

def create_user(email: str, password_hash: str, name: str, role: str) -> dict:
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        'INSERT INTO users (email, password_hash, name, role) VALUES (%s, %s, %s, %s) RETURNING id, email, name, role',
        (email, password_hash, name, role)
    )
    user = dict(c.fetchone())
    conn.commit()
    conn.close()
    return user

def get_user_by_email(email: str) -> dict | None:
    conn = get_conn()
    c = conn.cursor()
    c.execute('SELECT id, email, password_hash, name, role FROM users WHERE email = %s', (email,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_id(user_id: int) -> dict | None:
    conn = get_conn()
    c = conn.cursor()
    c.execute('SELECT id, email, name, role FROM users WHERE id = %s', (user_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

# ── Job Functions ──

def create_job(title: str, description: str, hr_id: int) -> dict:
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        'INSERT INTO jobs (title, description, hr_id) VALUES (%s, %s, %s) RETURNING id, title, description, hr_id, created_at',
        (title, description, hr_id)
    )
    job = dict(c.fetchone())
    conn.commit()
    conn.close()
    return job

def get_all_jobs() -> list:
    conn = get_conn()
    c = conn.cursor()
    c.execute('''
        SELECT j.id, j.title, j.description, j.hr_id, j.created_at, u.name as hr_name,
               (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as application_count
        FROM jobs j
        JOIN users u ON j.hr_id = u.id
        ORDER BY j.created_at DESC
    ''')
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_jobs_by_hr(hr_id: int) -> list:
    conn = get_conn()
    c = conn.cursor()
    c.execute('''
        SELECT j.id, j.title, j.description, j.hr_id, j.created_at,
               (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as application_count
        FROM jobs j
        WHERE j.hr_id = %s
        ORDER BY j.created_at DESC
    ''', (hr_id,))
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_job_by_id(job_id: int) -> dict | None:
    conn = get_conn()
    c = conn.cursor()
    c.execute('SELECT id, title, description, hr_id, created_at FROM jobs WHERE id = %s', (job_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

# ── Application Functions ──

def create_application(job_id: int, user_id: int, resume_filename: str, resume_path: str) -> dict:
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        '''INSERT INTO applications (job_id, user_id, resume_filename, resume_path)
           VALUES (%s, %s, %s, %s) RETURNING id, job_id, user_id, resume_filename, hr_status, created_at''',
        (job_id, user_id, resume_filename, resume_path)
    )
    app = dict(c.fetchone())
    conn.commit()
    conn.close()
    return app

def get_applications_by_job(job_id: int) -> list:
    conn = get_conn()
    c = conn.cursor()
    c.execute('''
        SELECT a.id, a.job_id, a.user_id, a.resume_filename, a.resume_path,
               a.ai_score, a.ai_decision, a.ai_justification, a.hr_status,
               a.candidate_name, a.candidate_role, a.email_sent, a.created_at,
               u.name as applicant_name, u.email as applicant_email
        FROM applications a
        JOIN users u ON a.user_id = u.id
        WHERE a.job_id = %s
        ORDER BY a.ai_score DESC
    ''', (job_id,))
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_applications_by_user(user_id: int) -> list:
    conn = get_conn()
    c = conn.cursor()
    c.execute('''
        SELECT a.id, a.job_id, a.resume_filename, a.ai_score, a.ai_decision,
               a.ai_justification, a.hr_status, a.candidate_name, a.candidate_role,
               a.email_sent, a.created_at,
               j.title as job_title, j.description as job_description
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE a.user_id = %s
        ORDER BY a.created_at DESC
    ''', (user_id,))
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_application_ai(app_id: int, score: int, decision: str, justification: str, candidate_name: str = '', candidate_role: str = ''):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        '''UPDATE applications
           SET ai_score = %s, ai_decision = %s, ai_justification = %s, candidate_name = %s, candidate_role = %s
           WHERE id = %s''',
        (score, decision, justification, candidate_name, candidate_role, app_id)
    )
    conn.commit()
    conn.close()

def update_application_hr_status(app_id: int, status: str, email_sent: bool = False) -> dict | None:
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        '''UPDATE applications SET hr_status = %s, email_sent = %s WHERE id = %s
           RETURNING id, job_id, user_id, hr_status, email_sent''',
        (status, email_sent, app_id)
    )
    row = c.fetchone()
    conn.commit()
    conn.close()
    return dict(row) if row else None

def get_application_by_id(app_id: int) -> dict | None:
    conn = get_conn()
    c = conn.cursor()
    c.execute('''
        SELECT a.*, u.name as applicant_name, u.email as applicant_email,
               j.title as job_title
        FROM applications a
        JOIN users u ON a.user_id = u.id
        JOIN jobs j ON a.job_id = j.id
        WHERE a.id = %s
    ''', (app_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else None

def get_hr_stats(hr_id: int) -> dict:
    conn = get_conn()
    c = conn.cursor()
    c.execute('''
        SELECT
            COUNT(DISTINCT j.id) as total_jobs,
            COUNT(a.id) as total_applications,
            COUNT(CASE WHEN a.ai_decision IN ('Select', 'Selected') THEN 1 END) as shortlisted,
            COUNT(CASE WHEN a.hr_status = 'approved' THEN 1 END) as approved,
            COUNT(CASE WHEN a.hr_status = 'rejected' THEN 1 END) as rejected
        FROM jobs j
        LEFT JOIN applications a ON a.job_id = j.id
        WHERE j.hr_id = %s
    ''', (hr_id,))
    row = c.fetchone()
    conn.close()
    return dict(row) if row else {}

def get_hr_analytics(hr_id: int) -> dict:
    import json
    import re
    from collections import Counter

    conn = get_conn()
    c = conn.cursor()

    # 1. Stats Overview
    c.execute('''
        SELECT
            COUNT(a.id) as total_applications,
            COUNT(CASE WHEN a.ai_score > 0 THEN 1 END) as candidates_screened,
            COUNT(CASE WHEN a.hr_status = 'approved' THEN 1 END) as hired,
            COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (a.created_at - j.created_at)) / 86400.0)), 12) as avg_time_to_hire
        FROM jobs j
        LEFT JOIN applications a ON a.job_id = j.id
        WHERE j.hr_id = %s
    ''', (hr_id,))
    stats_row = c.fetchone()
    stats = dict(stats_row) if stats_row else {
        "total_applications": 0,
        "candidates_screened": 0,
        "hired": 0,
        "avg_time_to_hire": 12
    }
    # Clean up avg_time_to_hire if it is None (no approved candidates or no app at all)
    if stats.get("avg_time_to_hire") is None:
        stats["avg_time_to_hire"] = 12

    # 2. Pipeline Status
    c.execute('''
        SELECT
            COUNT(CASE WHEN a.hr_status = 'approved' THEN 1 END) as hired,
            COUNT(CASE WHEN a.hr_status = 'rejected' THEN 1 END) as rejected,
            COUNT(CASE WHEN a.hr_status = 'pending' AND a.ai_decision IN ('Select', 'Selected') THEN 1 END) as shortlisted,
            COUNT(CASE WHEN a.hr_status = 'pending' AND a.ai_decision NOT IN ('Select', 'Selected') THEN 1 END) as pending
        FROM jobs j
        JOIN applications a ON a.job_id = j.id
        WHERE j.hr_id = %s
    ''', (hr_id,))
    pipeline_row = c.fetchone()
    pipeline = dict(pipeline_row) if pipeline_row else {"shortlisted": 0, "rejected": 0, "pending": 0, "hired": 0}

    # 3. Timeline / Application Trends
    c.execute('''
        SELECT 
            TO_CHAR(a.created_at, 'Mon') as name, 
            COUNT(*) as apps, 
            COUNT(CASE WHEN a.hr_status = 'approved' THEN 1 END) as hires,
            DATE_TRUNC('month', a.created_at) as month_date
        FROM jobs j
        JOIN applications a ON a.job_id = j.id
        WHERE j.hr_id = %s
        GROUP BY TO_CHAR(a.created_at, 'Mon'), DATE_TRUNC('month', a.created_at)
        ORDER BY month_date ASC
    ''', (hr_id,))
    timeline = [dict(r) for r in c.fetchall()]
    # Convert any Decimals or None
    for item in timeline:
        if "month_date" in item:
            item.pop("month_date")

    # 4. Skills Breakdown
    c.execute('''
        SELECT a.ai_justification
        FROM jobs j
        JOIN applications a ON a.job_id = j.id
        WHERE j.hr_id = %s AND a.ai_justification IS NOT NULL AND a.ai_justification != '[]'
    ''', (hr_id,))
    justifications = [r['ai_justification'] for r in c.fetchall()]
    conn.close()

    skills_counter = Counter()
    for just_str in justifications:
        try:
            just_list = json.loads(just_str)
            if isinstance(just_list, list):
                for item in just_list:
                    if isinstance(item, dict) and item.get("point") == "Skills Match":
                        details = item.get("details", "")
                        # Split on commas, semicolons, "and", "&"
                        tokens = re.split(r',|;|and|\&', details, flags=re.IGNORECASE)
                        for t in tokens:
                            clean_t = t.strip().strip('.').strip('-').strip()
                            if clean_t and len(clean_t) < 30 and not any(w in clean_t.lower() for w in ["list", "matching", "skills", "found", "none", "no matching"]):
                                lower_t = clean_t.lower()
                                if lower_t in ('aws', 'amazon web services'):
                                    clean_t = 'AWS'
                                elif lower_t in ('sql', 'mysql', 'postgresql'):
                                    clean_t = 'SQL'
                                elif lower_t in ('api', 'apis', 'rest api', 'rest apis'):
                                    clean_t = 'API'
                                elif lower_t in ('js', 'javascript'):
                                    clean_t = 'JavaScript'
                                elif lower_t in ('css', 'css3'):
                                    clean_t = 'CSS'
                                elif lower_t in ('html', 'html5'):
                                    clean_t = 'HTML'
                                elif lower_t in ('git', 'github'):
                                    clean_t = 'Git'
                                elif lower_t in ('docker', 'kubernetes'):
                                    clean_t = 'Docker'
                                else:
                                    clean_t = clean_t.title()
                                skills_counter[clean_t] += 1
        except Exception:
            pass

    skills = [{"name": name, "count": count} for name, count in skills_counter.most_common(5)]

    # If no real data is parsed, return empty list (or fallback list if needed, but empty list is better for real-time accuracy)
    return {
        "stats": stats,
        "pipeline": [
            {"name": "Shortlisted", "value": pipeline.get("shortlisted", 0)},
            {"name": "Rejected", "value": pipeline.get("rejected", 0)},
            {"name": "Pending", "value": pipeline.get("pending", 0)},
            {"name": "Hired", "value": pipeline.get("hired", 0)}
        ],
        "timeline": timeline,
        "skills": skills
    }


def update_hr_smtp(user_id: int, email: str, host: str, port: int, encrypted_password: str):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        '''UPDATE users
           SET smtp_email = %s, smtp_host = %s, smtp_port = %s, encrypted_smtp_password = %s
           WHERE id = %s''',
        (email, host, port, encrypted_password, user_id)
    )
    conn.commit()
    conn.close()

def get_hr_smtp(user_id: int) -> dict | None:
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        'SELECT smtp_email, smtp_host, smtp_port, encrypted_smtp_password FROM users WHERE id = %s',
        (user_id,)
    )
    row = c.fetchone()
    conn.close()
    return dict(row) if row and row.get('smtp_host') else None

def get_pending_emails_by_job(job_id: int) -> list:
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        '''SELECT a.id, a.job_id, a.user_id, a.hr_status, u.email as applicant_email, u.name as applicant_name, j.title as job_title
             FROM applications a
             JOIN users u ON a.user_id = u.id
             JOIN jobs j ON a.job_id = j.id
             WHERE a.job_id = %s AND a.hr_status = 'approved' AND a.email_sent = FALSE''',
        (job_id,)
    )
    rows = c.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def mark_application_emails_sent(app_ids: list):
    if not app_ids:
        return
    conn = get_conn()
    c = conn.cursor()
    # Format query for IN clause with multiple IDs or single ID
    if len(app_ids) == 1:
        c.execute('UPDATE applications SET email_sent = TRUE WHERE id = %s', (app_ids[0],))
    else:
        c.execute('UPDATE applications SET email_sent = TRUE WHERE id IN %s', (tuple(app_ids),))
    conn.commit()
    conn.close()

def log_login_attempt(email: str, status: str, user_id: int = None, ip_address: str = None, user_agent: str = None):
    conn = get_conn()
    c = conn.cursor()
    c.execute(
        '''INSERT INTO login_logs (user_id, email, ip_address, user_agent, status)
           VALUES (%s, %s, %s, %s, %s)''',
        (user_id, email, ip_address, user_agent, status)
    )
    conn.commit()
    conn.close()

def get_public_stats() -> dict:
    conn = get_conn()
    c = conn.cursor()
    c.execute('''
        SELECT
            (SELECT COUNT(*) FROM users WHERE role = 'candidate') as total_candidates,
            (SELECT COUNT(*) FROM users WHERE role = 'hr') as total_hrs,
            (SELECT COUNT(*) FROM jobs) as total_jobs,
            (SELECT COUNT(*) FROM applications WHERE hr_status = 'approved') as total_selected
    ''')
    row = c.fetchone()
    conn.close()
    return dict(row) if row else {
        "total_candidates": 0,
        "total_hrs": 0,
        "total_jobs": 0,
        "total_selected": 0
    }

