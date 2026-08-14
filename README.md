# Enterprise Healthcare Data Integration Pipeline (HL7 v2 -> Mirth Connect -> PostgreSQL)

An enterprise-grade hospital integration pipeline simulating real-time Patient Admission, Discharge, and Transfer (ADT) data routing between clinical systems, an Interface Engine (Mirth Connect), and an Electronic Health Record (EHR) database.

## Status: Day 1 Complete (Infrastructure Setup)

- \*\* Docker containerization setup (PostgreSQL + Mirth Connect) and relational EHR schema initialization.
- \*\* Inbound MLLP Listener channel and JavaScript HL7 ADT^A01 parser.
- \*\* Synchronous MLLP ACK/NACK handshake and asynchronous Dead-Letter Queue.
- \*\* End-to-end Python MLLP socket test suite and documentation polish.

## Infrastructure Execution

docker-compose up -d

## Launch and Test Services

- \*\* Spin up containers & verify SQL
  docker-compose up -d
- \*\* Verify both containers are running (UP status):
  docker ps
- \*\* Verify PostgreSQL initialized both tables (patients and dead_letter_queue):
  docker exec -it health_db psql -U ehr_admin -d hospital_ehr -c "\dt"
