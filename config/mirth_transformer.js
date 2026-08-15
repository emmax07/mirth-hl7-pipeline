try {
  // Extract PID Segment Fields
  var mrn = msg["PID"]["PID.3"]["PID.3.1"].toString();
  var lastName = msg["PID"]["PID.5"]["PID.5.1"].toString();
  var firstName = msg["PID"]["PID.5"]["PID.5.2"].toString();
  var dobStr = msg["PID"]["PID.7"]["PID.7.1"].toString(); // YYYYMMDD
  var gender = msg["PID"]["PID.8"]["PID.8.1"].toString();
  var address = msg["PID"]["PID.11"]["PID.11.1"].toString();

  // Reformat DOB to YYYY-MM-DD
  var formattedDOB =
    dobStr.substring(0, 4) +
    "-" +
    dobStr.substring(4, 6) +
    "-" +
    dobStr.substring(6, 8);

  // Extract PV1 Segment Fields
  var visitNumber = msg["PV1"]["PV1.19"]["PV1.19.1"].toString();
  var patientClass = msg["PV1"]["PV1.2"]["PV1.2.1"].toString();
  var location = msg["PV1"]["PV1.3"]["PV1.3.1"].toString();
  var doctor =
    msg["PV1"]["PV1.7"]["PV1.7.2"].toString() +
    " " +
    msg["PV1"]["PV1.7"]["PV1.7.1"].toString();
  var admitStr = msg["PV1"]["PV1.44"]["PV1.44.1"].toString(); // YYYYMMDDHHMMSS

  // Reformat Admit Date to YYYY-MM-DD HH:MM:SS
  var formattedAdmit =
    admitStr.substring(0, 4) +
    "-" +
    admitStr.substring(4, 6) +
    "-" +
    admitStr.substring(6, 8) +
    " " +
    admitStr.substring(8, 10) +
    ":" +
    admitStr.substring(10, 12) +
    ":" +
    admitStr.substring(12, 14);

  // JDBC Connection using the 'postgres' container service name
  var dbConn = DatabaseConnectionFactory.createDatabaseConnection(
    "org.postgresql.Driver",
    "jdbc:postgresql://postgres:5432/healthcare_db",
    "postgres",
    "postgrespassword",
  );

  // Idempotent UPSERT into Patients
  var patientQuery =
    "INSERT INTO patients (mrn, first_name, last_name, date_of_birth, gender, address, updated_at) " +
    "VALUES ('" +
    mrn +
    "', '" +
    firstName +
    "', '" +
    lastName +
    "', '" +
    formattedDOB +
    "', '" +
    gender +
    "', '" +
    address +
    "', NOW()) " +
    "ON CONFLICT (mrn) DO UPDATE SET " +
    "first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, " +
    "date_of_birth = EXCLUDED.date_of_birth, gender = EXCLUDED.gender, " +
    "address = EXCLUDED.address, updated_at = NOW();";
  dbConn.executeUpdate(patientQuery);

  // Idempotent UPSERT into Visits
  var visitQuery =
    "INSERT INTO visits (visit_number, mrn, patient_class, assigned_location, attending_doctor, admit_date, updated_at) " +
    "VALUES ('" +
    visitNumber +
    "', '" +
    mrn +
    "', '" +
    patientClass +
    "', '" +
    location +
    "', '" +
    doctor +
    "', '" +
    formattedAdmit +
    "', NOW()) " +
    "ON CONFLICT (visit_number) DO UPDATE SET " +
    "patient_class = EXCLUDED.patient_class, assigned_location = EXCLUDED.assigned_location, " +
    "attending_doctor = EXCLUDED.attending_doctor, admit_date = EXCLUDED.admit_date, updated_at = NOW();";
  dbConn.executeUpdate(visitQuery);

  dbConn.close();
} catch (e) {
  throw e;
}
