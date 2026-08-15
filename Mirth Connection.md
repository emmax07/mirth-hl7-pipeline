# Mirth Connect HL7 v2 ADT Integration Setup

This guide provides step-by-step instructions for configuring, deploying, and exporting the **HL7_Inbound_ADT_To_Postgres** channel in NextGen Connect (Mirth Connect).

---

## Architecture Overview

- **Protocol:** MLLP (Minimum Lower Layer Protocol) over TCP Port `6661`
- **Data Format:** Inbound HL7 v2.x ADT (Admit, Discharge, Transfer) messages
- **Transformer:** JavaScript engine extracting `PID` (Patient ID, Name, DOB, Gender) and `PV1` (Patient Location)
- **Destination:** PostgreSQL (`hospital_ehr` database, `patients` table) via JDBC

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

### Step 4: Configure the Destination (PostgreSQL Writer)

1. Click the **Destinations** tab at the top.
2. Set the following fields:
   - **Connector Type:** `Database Writer`
   - **Driver:** `PostgreSQL` (`org.postgresql.Driver`)
   - **URL:** `jdbc:postgresql://postgres:5432/hospital_ehr`
   - **Username:** `${POSTGRES_USER}` (or `ehr_admin`)
   - **Password:** `${POSTGRES_PASSWORD}`
3. Under **Database Writer Settings**, set **Use JavaScript** to **No**.
4. In the **SQL** box, paste:

```sql
INSERT INTO patients (patient_id, first_name, last_name, dob, gender, assigned_patient_location, updated_at)
VALUES (${patient_id}, ${first_name}, ${last_name}, ${dob}::DATE, ${gender}, ${location}, CURRENT_TIMESTAMP)
ON CONFLICT (patient_id) DO UPDATE
SET assigned_patient_location = EXCLUDED.assigned_patient_location,
    updated_at = CURRENT_TIMESTAMP;
```

---

### Step 5: Add the JavaScript Transformer

1. On the left sidebar under **Channel Tasks** (or **Destination Tasks**), click **Edit Transformer** (or right-click `Destination 1` $\rightarrow$ **Edit Transformer**).
2. On the left task menu, click **Add New Step**.
3. Set **Type** to **JavaScript**.
4. In the code editor pane, paste:

```javascript
try {
  // Extract PID (Patient Identification) Segment
  var mrn = msg["PID"]["PID.3"]["PID.3.1"].toString();
  var lastName = msg["PID"]["PID.5"]["PID.5.1"].toString();
  var firstName = msg["PID"]["PID.5"]["PID.5.2"].toString();
  var dobRaw = msg["PID"]["PID.7"]["PID.7.1"].toString(); // Format: YYYYMMDD
  var gender = msg["PID"]["PID.8"]["PID.8.1"].toString();

  if (!dobRaw || dobRaw.length < 8) {
    throw new Error("Invalid or missing Date of Birth (PID.7): " + dobRaw);
  }

  // Extract PV1 (Patient Visit) Segment
  var location = msg["PV1"]["PV1.3"]["PV1.3.1"]
    ? msg["PV1"]["PV1.3"]["PV1.3.1"].toString()
    : "UNASSIGNED";

  // Format Date for SQL (YYYY-MM-DD)
  var formattedDob =
    dobRaw.substring(0, 4) +
    "-" +
    dobRaw.substring(4, 6) +
    "-" +
    dobRaw.substring(6, 8);

  // Map variables for SQL Writer
  channelMap.put("patient_id", mrn);
  channelMap.put("last_name", lastName);
  channelMap.put("first_name", firstName);
  channelMap.put("dob", formattedDob);
  channelMap.put("gender", gender);
  channelMap.put("location", location);
} catch (err) {
  logger.error("Transformer Error in ADT Pipeline: " + err.message);
  throw err;
}
```

5. Click **Back to Destination** in the left sidebar.

---

### Step 6: Save, Deploy, and Export XML

1. **Save:** In the left sidebar under **Channel Tasks**, click **Save Changes**.
2. **Deploy:** Click **Deploy Channel** in the left sidebar to start the listener.
3. **Export XML File:**
   - Return to the **Channels** list view (click **Channels** under **Navigation** in the top-left menu).
   - Click once on `HL7_Inbound_ADT_To_Postgres` to highlight it.
   - In the left sidebar under **Channel Tasks**, click **Export Channel**.
   - Save the file as `HL7_Inbound_ADT_To_Postgres.xml` inside your repository's `mirth_channels/` directory.
