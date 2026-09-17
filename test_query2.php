<?php
require 'api/db.php';
$identifier = '3';
$stmt = $pdo->prepare("
    SELECT p.*, COALESCE(c.patient_name, pat.patient_name) as patient_name, COALESCE(c.patient_mobile, pat.mobile, p.patient_mobile) as mobile
    FROM prescriptions p
    LEFT JOIN consultations c ON p.id = c.prescription_id
    LEFT JOIN patients pat ON p.patient_token = pat.token
    WHERE (p.patient_token = ? OR p.patient_mobile = ? OR pat.mobile = ? OR c.patient_mobile = ?) AND p.status = 'Pending'
    ORDER BY p.id DESC
    LIMIT 1
");
$stmt->execute([$identifier, $identifier, $identifier, $identifier]);
$prescription = $stmt->fetch();
var_dump($prescription);

if ($prescription) {
    $stmtItems = $pdo->prepare("SELECT * FROM prescription_items WHERE prescription_id = ?");
    $stmtItems->execute([$prescription['id']]);
    $items = $stmtItems->fetchAll();
    var_dump($items);
}
