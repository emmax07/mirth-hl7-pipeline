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
  logger.error("Mirth Transformer Exception: " + e.message);

  var dbConn = null;
  var pstmt = null;

  try {
    var dbHost = java.lang.System.getenv("DB_HOST") || "health_db";
    var dbPort = java.lang.System.getenv("DB_PORT") || "5432";
    var dbName = java.lang.System.getenv("POSTGRES_DB") || "hospital_ehr";
    var dbUser = java.lang.System.getenv("POSTGRES_USER") || "ehr_admin";
    var dbPass =
      java.lang.System.getenv("POSTGRES_PASSWORD") || "ehr_password_123";

    var jdbcUrl = "jdbc:postgresql://" + dbHost + ":" + dbPort + "/" + dbName;
    dbConn = DatabaseConnectionFactory.createDatabaseConnection(
      "org.postgresql.Driver",
      jdbcUrl,
      dbUser,
      dbPass,
    );

    var rawPayload = connectorMessage
      ? connectorMessage.getRawData().toString()
      : "";
    var errorMsg = e.message || "Unknown error";
    var chId =
      typeof channelId !== "undefined" ? channelId.toString() : "UNKNOWN";
    var chName =
      typeof channelName !== "undefined"
        ? channelName.toString()
        : "HL7_Inbound_ADT_To_Postgres";
    var msgId = connectorMessage ? connectorMessage.getMessageId() : -1;

    var dlqSql =
      "INSERT INTO dlq_messages (original_channel_id, original_channel_name, message_id, raw_hl7_message, error_message, created_at, status) " +
      "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'UNRESOLVED');";

    pstmt = dbConn.getConnection().prepareStatement(dlqSql);
    pstmt.setString(1, chId);
    pstmt.setString(2, chName);
    pstmt.setLong(3, msgId);
    pstmt.setString(4, rawPayload);
    pstmt.setString(5, errorMsg);

    pstmt.executeUpdate();
    logger.info(
      "DLQ: Successfully logged corrupted message ID " +
        msgId +
        " to dlq_messages",
    );
  } catch (dlqErr) {
    logger.error("DLQ Write Failed: " + dlqErr.message);
  } finally {
    if (pstmt !== null) {
      try {
        pstmt.close();
      } catch (err) {}
    }
    if (dbConn !== null) {
      try {
        dbConn.close();
      } catch (err) {}
    }
  }

  throw e; // Ensures Mirth marks message status as ERROR
}
