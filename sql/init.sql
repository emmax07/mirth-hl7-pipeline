-- Target Electronic Health Record (EHR) Patient Database
CREATE TABLE IF NOT EXISTS patients (
    patient_id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    dob DATE,
    gender VARCHAR(10),
    assigned_patient_location VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dead-Letter Queue (DLQ) for Failed / Corrupted Messages
CREATE TABLE IF NOT EXISTS dead_letter_queue (
    dlq_id SERIAL PRIMARY KEY,
    original_channel_id VARCHAR(100),
    original_channel_name VARCHAR(100),
    message_id BIGINT,
    raw_hl7_message TEXT,
    error_message TEXT,
    failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'UNRESOLVED' -- UNRESOLVED, RETRIED, DISCARDED
);