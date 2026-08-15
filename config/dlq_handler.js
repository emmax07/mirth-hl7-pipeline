try {
  // Escape single quotes for raw message and error string safety
  var rawMsg = connectorMessage.getRawData().replace(/'/g, "''");
  var errorDetails = e.toString().replace(/'/g, "''");
  var msgControlId = msg["MSH"]["MSH.10"]["MSH.10.1"].toString();

  // Connect to PostgreSQL container
  var dbConn = DatabaseConnectionFactory.createDatabaseConnection(
    "org.postgresql.Driver",
    "jdbc:postgresql://postgres:5432/healthcare_db",
    "postgres",
    "postgrespassword",
  );

  // Log exception into DLQ table
  var dlqQuery =
    "INSERT INTO dlq_messages (message_control_id, raw_message, error_message) " +
    "VALUES ('" +
    msgControlId +
    "', '" +
    rawMsg +
    "', '" +
    errorDetails +
    "');";
  dbConn.executeUpdate(dlqQuery);

  dbConn.close();
} catch (dlqErr) {
  logger.error("Failed to route message to DLQ: " + dlqErr);
}
