# Mirth Connect HL7 v2 ADT Integration Setup

This guide provides step-by-step instructions for configuring, deploying, and exporting the **HL7_Inbound_ADT_To_Postgres** channel in NextGen Connect (Mirth Connect).

---

## Architecture Overview

- **Protocol:** MLLP (Minimum Lower Layer Protocol) over TCP Port `6661`
- **Data Format:** Inbound HL7 v2.x ADT (Admit, Discharge, Transfer) messages
- **Transformer:** JavaScript engine extracting `PID` (Patient ID, Name, DOB, Gender) and `PV1` (Visit Number, Class, Location, Doctor, Admit Date) into Mirth channel map variables
- **Destinations:** PostgreSQL (`hospital_ehr` database) via twin native Database Writer connectors:
  1. `Postgres - Patients Upsert` (`patients` table)
  2. `Postgres - Visits Upsert` (`visits` table)

---

## Step-by-Step Configuration Guide

### Step 1: Log Into Mirth Connect Administrator

1. Open the **Mirth Connect Administrator Launcher** application.
2. Click **Add Server** (or select your existing connection) and enter:
   - **Server URL:** `https://localhost:8443`
   - **Username:** `admin`
   - **Password:** `admin` (or your configured admin password)
3. Click **Launch** to open the main desktop Administrator interface.

---

### Step 2: Create a New Channel

1. In the left navigation panel, click **Channels** under **Navigation**.
2. In the lower-left sidebar under **Channel Tasks**, click **New Channel**.
3. In the **Summary** tab:
   - **Name:** `HL7_Inbound_ADT_To_Postgres`
   - Click **Set Data Types** $\rightarrow$ Ensure **Inbound Data Type** and **Outbound Data Type** are both set to **HL7 v2.x** $\rightarrow$ Click **OK**.

---

### Step 3: Configure the Source Listener

1. Click the **Source** tab at the top.
2. Set the following fields:
   - **Connector Type:** `TCP Listener`
   - **Local Port:** `6661`
   - **Transmission Mode:** `MLLP`
   - **Mode:** `Server`

---

### Step 4: Add the JavaScript Transformer

1. Click the **Destinations** tab at the top.
2. On the left sidebar under **Destination Tasks**, click **Edit Transformer**.
3. On the left task menu, click **Add New Step**.
4. Set **Type** to **JavaScript**.

```javascript
try {
  // Helper function for safe string extraction
  function getHL7Value(node) {
    return node && node.toString() ? node.toString().trim() : "";
  }

  // Extract PID Fields
  var mrn = getHL7Value(msg["PID"]["PID.3"]["PID.3.1"]);
  var lastName = getHL7Value(msg["PID"]["PID.5"]["PID.5.1"]);
  var firstName = getHL7Value(msg["PID"]["PID.5"]["PID.5.2"]);
  var dobStr = getHL7Value(msg["PID"]["PID.7"]["PID.7.1"]); // YYYYMMDD
  var gender = getHL7Value(msg["PID"]["PID.8"]["PID.8.1"]) || "U";

  if (!mrn) {
    throw new Error("Validation Failed: Missing MRN/Patient ID in PID-3");
  }

  // Format DOB -> YYYY-MM-DD
  var formattedDOB =
    dobStr.length >= 8
      ? dobStr.substring(0, 4) +
        "-" +
        dobStr.substring(4, 6) +
        "-" +
        dobStr.substring(6, 8)
      : "1900-01-01";

  // Extract PV1 Fields
  var visitNumber = getHL7Value(msg["PV1"]["PV1.19"]["PV1.19.1"]);
  var patientClass = getHL7Value(msg["PV1"]["PV1.2"]["PV1.2.1"]);
  var location = getHL7Value(msg["PV1"]["PV1.3"]["PV1.3.1"]);
  var docLast = getHL7Value(msg["PV1"]["PV1.7"]["PV1.7.2"]);
  var docFirst = getHL7Value(msg["PV1"]["PV1.7"]["PV1.7.1"]);
  var doctor =
    docLast || docFirst ? (docLast + " " + docFirst).trim() : "UNASSIGNED";
  var admitStr = getHL7Value(msg["PV1"]["PV1.44"]["PV1.44.1"]); // YYYYMMDDHHMMSS

  // Format Admit Date -> YYYY-MM-DD HH:MM:SS
  var formattedAdmit =
    admitStr.length >= 14
      ? admitStr.substring(0, 4) +
        "-" +
        admitStr.substring(4, 6) +
        "-" +
        admitStr.substring(6, 8) +
        " " +
        admitStr.substring(8, 10) +
        ":" +
        admitStr.substring(10, 12) +
        ":" +
        admitStr.substring(12, 14)
      : new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(
          new java.util.Date(),
        );

  // Map variables for Database Writer destinations
  channelMap.put("patient_id", mrn);
  channelMap.put("first_name", firstName);
  channelMap.put("last_name", lastName);
  channelMap.put("dob", formattedDOB);
  channelMap.put("gender", gender);
  channelMap.put("location", location);

  channelMap.put("visit_number", visitNumber);
  channelMap.put("patient_class", patientClass);
  channelMap.put("attending_doctor", doctor);
  channelMap.put("admit_date", formattedAdmit);
} catch (e) {
  logger.error("Mirth Transformer Error: " + e.message);
  throw e;
}
```

5. In the code editor pane, paste the transformer code to map HL7 fields into Mirth channel map variables (`channelMap`):

### Step 5: Configure the Destinations (Database Writers)

#### Destination 1: Postgres - Patients Upsert

In the Destinations tab, set Name to Postgres - Patients Upsert.

1. Configure settings:
   Connector Type: Database Writer
   Driver: PostgreSQL (org.postgresql.Driver)
   URL: jdbc:postgresql://health_db:5432/hospital_ehr
   Username: ${POSTGRES_USER} (or ehr_admin)
   Password: ${POSTGRES_PASSWORD}

Under Database Writer Settings, ensure Use JavaScript is set to No.

2. SQL for patient:

INSERT INTO patients (
patient_id,
first_name,
last_name,
dob,
gender,
assigned_patient_location,
updated_at
)
VALUES (
${patient_id},${first_name},
${last_name},${dob}::DATE,
${gender},${location},
CURRENT_TIMESTAMP
)
ON CONFLICT (patient_id) DO UPDATE SET
first_name = EXCLUDED.first_name,
last_name = EXCLUDED.last_name,
dob = EXCLUDED.dob,
gender = EXCLUDED.gender,
assigned_patient_location = EXCLUDED.assigned_patient_location,
updated_at = CURRENT_TIMESTAMP;

#### Destination 1: Postgres - Patients Upsert

In the Destinations tab, set Name to Postgres - Visits Upsert.

3. Configure settings:
   Connector Type: Database Writer
   Driver: PostgreSQL (org.postgresql.Driver)
   URL: jdbc:postgresql://health_db:5432/hospital_ehr
   Username: ${POSTGRES_USER} (or ehr_admin)
   Password: ${POSTGRES_PASSWORD}

Under Database Writer Settings, ensure Use JavaScript is set to No.

4. SQL for visits:

INSERT INTO visits (
visit_number,
patient_id,
patient_class,
assigned_location,
attending_doctor,
admit_date,
updated_at
)
VALUES (
${visit_number},${patient_id},
${patient_class},${location},
${attending_doctor},${admit_date}::TIMESTAMP,
CURRENT_TIMESTAMP
)
ON CONFLICT (visit_number) DO UPDATE SET
patient_class = EXCLUDED.patient_class,
assigned_location = EXCLUDED.assigned_location,
attending_doctor = EXCLUDED.attending_doctor,
admit_date = EXCLUDED.admit_date,
updated_at = CURRENT_TIMESTAMP;

### Step 6: Save, Deploy, and Export XML

1. Save: In the left sidebar under Channel Tasks, click Save Changes.
2. Deploy: Click Deploy Channel in the left sidebar to start the listener.
3. Export XML File:
   - Return to the Channels list view (click Channels under Navigation in the top-left menu).
   - Click once on HL7_Inbound_ADT_To_Postgres to highlight it.
4. In the left sidebar under Channel Tasks, click Export Channel.
5. Save the file as HL7_Inbound_ADT_To_Postgres.xml inside your repository's mirth_channels/ directory.
