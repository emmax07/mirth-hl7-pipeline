try {
  // Read environment variables or fallback to Configuration Map
  var dbHost =
    java.lang.System.getenv("DB_HOST") ||
    configurationMap.get("db_host") ||
    "health_db";
  var dbPort =
    java.lang.System.getenv("DB_PORT") ||
    configurationMap.get("db_port") ||
    "5432";
  var dbName =
    java.lang.System.getenv("POSTGRES_DB") ||
    configurationMap.get("db_name") ||
    "hospital_ehr";
  var dbUser =
    java.lang.System.getenv("POSTGRES_USER") ||
    configurationMap.get("db_user") ||
    "ehr_admin";
  var dbPass =
    java.lang.System.getenv("POSTGRES_PASSWORD") ||
    configurationMap.get("db_password") ||
    "ehr_password_123";

  // Construct JDBC URL dynamically
  var jdbcUrl = "jdbc:postgresql://" + dbHost + ":" + dbPort + "/" + dbName;

  // Safe extraction of raw message text
  var rawMsg = "";
  try {
    rawMsg = connectorMessage.getRawData();
  } catch (rawErr) {
    rawMsg =
      typeof msg !== "undefined" && msg ? msg.toString() : "UNKNOWN_PAYLOAD";
  }

  // Safe extraction of Message Control ID (MSH-10)
  var msgControlId = "UNKNOWN";
  try {
    if (
      msg &&
      msg["MSH"] &&
      msg["MSH"]["MSH.10"] &&
      msg["MSH"]["MSH.10"]["MSH.10.1"]
    ) {
      msgControlId = msg["MSH"]["MSH.10"]["MSH.10.1"].toString().trim();
    }
  } catch (mshErr) {
    msgControlId = "MALFORMED_HEADER";
  }

  // Extract parent exception message
  var errorDetails =
    typeof e !== "undefined" && e
      ? e.toString()
      : "Unspecified Processing Error";

  // Escape single quotes for SQL insertion
  var safeRaw = rawMsg.replace(/'/g, "''");
  var safeError = errorDetails.replace(/'/g, "''");
  var safeControlId = msgControlId.replace(/'/g, "''");

  // Connect and Insert into dlq_messages
  var dbConn = DatabaseConnectionFactory.createDatabaseConnection(
    "org.postgresql.Driver",
    jdbcUrl,
    dbUser,
    dbPass,
  );

  var dlqQuery =
    "INSERT INTO dlq_messages (message_control_id, raw_message, error_message, created_at) " +
    "VALUES ('" +
    safeControlId +
    "', '" +
    safeRaw +
    "', '" +
    safeError +
    "', CURRENT_TIMESTAMP);";

  dbConn.executeUpdate(dlqQuery);
  dbConn.close();

  logger.info(
    "Successfully logged corrupt payload to DLQ (Control ID: " +
      safeControlId +
      ")",
  );
} catch (dlqErr) {
  logger.error("Failed to route message to DLQ: " + dlqErr.toString());
}
