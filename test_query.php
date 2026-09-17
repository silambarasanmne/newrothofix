<?php
require 'api/db.php';
$stmt = $pdo->query("SELECT p.*, COALESCE(c.patient_name, pat.patient_name) as patient_name FROM prescriptions p LEFT JOIN consultations c ON p.id = c.prescription_id LEFT JOIN patients pat ON p.patient_token = pat.token");
var_dump($stmt->fetchAll());
echo "--- ALL PRESCRIPTIONS ---\n";
$stmt2 = $pdo->query("SELECT * FROM prescriptions");
var_dump($stmt2->fetchAll());
