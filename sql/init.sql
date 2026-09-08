-- 1. Patients Table
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

-- 2. Visits Table
CREATE TABLE IF NOT EXISTS visits (
    visit_number VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) REFERENCES patients(patient_id) ON DELETE CASCADE,
    patient_class VARCHAR(50),
    assigned_location VARCHAR(100),
    attending_doctor VARCHAR(150),
    admit_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Dead-Letter Queue (DLQ) Table
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

-- 4. DLQ Compatibility View (Maps dead_letter_queue to dlq_messages for test suites)
CREATE OR REPLACE VIEW dlq_messages AS 
SELECT 
    dlq_id AS id, 
    original_channel_name AS channel_name,
    raw_hl7_message AS raw_message,
    error_message, 
    failed_at AS created_at 
FROM dead_letter_queue;