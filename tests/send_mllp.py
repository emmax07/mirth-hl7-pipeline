import os
import socket
import sys
import time
from dotenv import load_dotenv
import psycopg2

# Load environment variables from .env file
load_dotenv()

MLLP_HOST = os.getenv("MLLP_HOST", "localhost")
MLLP_PORT = int(os.getenv("MLLP_PORT", "6661"))

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("POSTGRES_USER", "ehr_admin")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "ehr_password_123")
DB_NAME = os.getenv("POSTGRES_DB", "hospital_ehr")

VT = "\x0b"
FS_CR = "\x1c\r"

VALID_HL7 = (
    VT +
    "MSH|^~\\&|SENDING_APP|SENDING_FAC|REC_APP|REC_FAC|20260820120000||ADT^A01|MSG00001|P|2.3\r"
    "EVN|A01|20260820120000\r"
    "PID|1||MRN12345678||DOE^JANE||19900101|F|||123 MAIN ST^^FORT WAYNE^IN^46802\r"
    "PV1|1|I|ICU^BED01||||12345^SMITH^ROBERT|||||||||||V99001||||||||||||||||||||||||20260820113000\r" +
    FS_CR
)

CORRUPT_HL7 = (
    VT +
    "MSH|^~\\&|BAD_APP||||20260820||ADT^A01|MSG_ERR|P|2.3\r"
    "PID|BROKEN_STRUCTURE_NO_DOB\r" +
    FS_CR
)

def send_mllp_message(payload: str):
    """Sends raw MLLP payload over TCP socket."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(10)
    try:
        sock.connect((MLLP_HOST, MLLP_PORT))
        sock.sendall(payload.encode("latin-1"))
        ack = sock.recv(1024)
        print(f"[MLLP] Transmitted successfully to {MLLP_HOST}:{MLLP_PORT}")
        return ack
    except Exception as e:
        print(f"[MLLP Error] Failed to send message: {e}")
        sys.exit(1)
    finally:
        sock.close()

def verify_database(retries=5, delay=2):
    """Queries PostgreSQL with poll-retries to account for Mirth execution queueing."""
    print("[DB] Verifying records in PostgreSQL...")
    
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, dbname=DB_NAME
    )
    # Enable autocommit so every SELECT sees fresh commits from Mirth
    conn.autocommit = True
    cursor = conn.cursor()

    # 1. Poll for Valid Patient Record
    patient = None
    for attempt in range(1, retries + 1):
        cursor.execute("SELECT patient_id, first_name, last_name FROM patients WHERE patient_id = 'MRN12345678';")
        patient = cursor.fetchone()
        if patient:
            break
        print(f"  [Attempt {attempt}/{retries}] Waiting for patient 'MRN12345678' in database...")
        time.sleep(delay)

    assert patient is not None, "Test Failed: MRN12345678 missing from patients table."
    print(f"[SUCCESS] Ingested Patient: {patient[0]} - {patient[1]} {patient[2]}")

    # 2. Poll for DLQ Exception Entry
    dlq_entry = None
    for attempt in range(1, retries + 1):
        cursor.execute("SELECT id, error_message FROM dlq_messages ORDER BY created_at DESC LIMIT 1;")
        dlq_entry = cursor.fetchone()
        if dlq_entry:
            break
        print(f"  [Attempt {attempt}/{retries}] Waiting for DLQ entry in database...")
        time.sleep(delay)

    assert dlq_entry is not None, "Test Failed: Expected error record missing from dlq_messages table."
    print(f"[SUCCESS] DLQ Entry Found ID {dlq_entry[0]}: {dlq_entry[1]}")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    print(f"[Config] Connecting to Database '{DB_NAME}' as User '{DB_USER}' on {DB_HOST}:{DB_PORT}")
    print("=== STARTING END-TO-END MLLP INTEGRATION TEST ===")
    
    print("1. Sending Valid ADT^A01 Message...")
    send_mllp_message(VALID_HL7)
    time.sleep(1)
    
    print("2. Sending Corrupted Message to Test DLQ...")
    send_mllp_message(CORRUPT_HL7)
    time.sleep(1)
    
    print("3. Validating PostgreSQL Database State...")
    verify_database(retries=5, delay=2)
    print("=== ALL INTEGRATION TESTS PASSED ===")