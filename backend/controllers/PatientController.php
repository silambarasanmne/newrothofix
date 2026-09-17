<?php

require_once __DIR__ . '/../models/PatientModel.php';

class PatientController {
    private static function getJsonInput(): array {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    private static function jsonResponse(array $data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    private static function validatePatientInput(array $data): array {
        $errors = [];

        $patientName = isset($data['patient_name']) ? trim((string)$data['patient_name']) : '';
        $age = $data['age'] ?? null;
        $mobile = isset($data['mobile']) ? trim((string)$data['mobile']) : '';
        $symptoms = isset($data['symptoms']) ? trim((string)$data['symptoms']) : '';

        // Patient Name
        if (empty($patientName)) {
            $errors['patient_name'] = 'Patient Name is required';
        } elseif (strlen($patientName) < 3) {
            $errors['patient_name'] = 'Patient Name must be at least 3 characters long';
        } elseif (!preg_match('/^[a-zA-Z\s]+$/', $patientName)) {
            $errors['patient_name'] = 'Patient Name must contain alphabets and spaces only';
        }

        // Age
        if ($age === null || $age === '') {
            $errors['age'] = 'Age is required';
        } elseif (!is_numeric($age) || (int)$age != $age) {
            $errors['age'] = 'Age must be a valid whole number';
        } else {
            $ageNum = (int)$age;
            if ($ageNum < 0 || $ageNum > 120) {
                $errors['age'] = 'Age must be between 0 and 120';
            }
        }

        // Mobile Number
        if (empty($mobile)) {
            $errors['mobile'] = 'Mobile Number is required';
        } elseif (!preg_match('/^\d{10}$/', $mobile)) {
            $errors['mobile'] = 'Mobile Number must be exactly 10 digits';
        }

        // Symptoms / Issues
        if (empty($symptoms)) {
            $errors['symptoms'] = 'Issues / Symptoms is required';
        } elseif (strlen($symptoms) < 5) {
            $errors['symptoms'] = 'Issues / Symptoms must be at least 5 characters long';
        }

        return [
            'isValid' => empty($errors),
            'errors' => $errors
        ];
    }

    public static function registerPatient(): void {
        try {
            $input = self::getJsonInput();
            $validation = self::validatePatientInput($input);

            if (!$validation['isValid']) {
                self::jsonResponse([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $validation['errors']
                ], 400);
            }

            $newPatient = PatientModel::create([
                'patient_name' => trim($input['patient_name']),
                'age' => (int)$input['age'],
                'mobile' => trim($input['mobile']),
                'symptoms' => trim($input['symptoms'])
            ]);

            self::jsonResponse([
                'success' => true,
                'message' => 'Patient registered successfully',
                'token' => (int)$newPatient['token'],
                'data' => $newPatient
            ], 201);

        } catch (\Throwable $e) {
            error_log('Error registering patient: ' . $e->getMessage());
            self::jsonResponse([
                'success' => false,
                'message' => 'Server error while registering patient',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public static function getPatients(): void {
        try {
            $params = $_GET;
            $result = PatientModel::findAll($params);

            self::jsonResponse(array_merge(['success' => true], $result), 200);
        } catch (\Throwable $e) {
            error_log('Error fetching patients: ' . $e->getMessage());
            self::jsonResponse([
                'success' => false,
                'message' => 'Server error while fetching patients',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public static function getPatientByToken($token): void {
        try {
            if (!$token || !ctype_digit((string)$token)) {
                self::jsonResponse(['success' => false, 'message' => 'Invalid token number parameter'], 400);
            }

            $patient = PatientModel::findByToken((int)$token);

            if (!$patient) {
                self::jsonResponse(['success' => false, 'message' => "No patient found with token #{$token}"], 404);
            }

            self::jsonResponse(['success' => true, 'data' => $patient], 200);
        } catch (\Throwable $e) {
            error_log('Error fetching patient by token: ' . $e->getMessage());
            self::jsonResponse([
                'success' => false,
                'message' => 'Server error while fetching patient record',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public static function exportPatientsCSV(): void {
        try {
            $params = $_GET;
            $patients = PatientModel::exportAll($params);

            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="Orthofix_Registered_Patient_Records.csv"');

            $output = fopen('php://output', 'w');
            fputcsv($output, ['Token', 'Patient Name', 'Patient ID', 'Age', 'Mobile Number', 'Symptoms / Issues', 'Registration Date']);

            foreach ($patients as $p) {
                fputcsv($output, [
                    $p['token'],
                    $p['patient_name'],
                    'OP-' . $p['id'],
                    $p['age'],
                    $p['mobile'],
                    $p['symptoms'],
                    $p['created_at']
                ]);
            }

            fclose($output);
            exit;
        } catch (\Throwable $e) {
            error_log('Error exporting CSV: ' . $e->getMessage());
            self::jsonResponse([
                'success' => false,
                'message' => 'Server error while exporting patient records',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public static function getStats(): void {
        try {
            $stats = PatientModel::getStats();
            self::jsonResponse(['success' => true, 'data' => $stats], 200);
        } catch (\Throwable $e) {
            error_log('Error fetching stats: ' . $e->getMessage());
            self::jsonResponse([
                'success' => false,
                'message' => 'Server error while fetching stats',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
