<?php

require_once __DIR__ . '/../database/db.php';

class PatientModel {
    /**
     * Create a new patient with auto-incrementing sequential token starting from 1
     */
    public static function create(array $data): array {
        $db = Database::getConnection();

        try {
            $db->beginTransaction();

            // Get current max token and compute next token (starts from 1)
            $stmt = $db->query('SELECT COALESCE(MAX(token), 0) AS maxToken FROM patients');
            $maxTokenRow = $stmt->fetch();
            $nextToken = (int)($maxTokenRow['maxToken'] ?? 0) + 1;

            $insertStmt = $db->prepare('
                INSERT INTO patients (token, patient_name, age, mobile, symptoms)
                VALUES (?, ?, ?, ?, ?)
            ');

            $insertStmt->execute([
                $nextToken,
                trim($data['patient_name']),
                (int)$data['age'],
                trim($data['mobile']),
                trim($data['symptoms'])
            ]);

            $id = (int)$db->lastInsertId();
            $db->commit();

            $fetchStmt = $db->prepare('SELECT * FROM patients WHERE id = ?');
            $fetchStmt->execute([$id]);
            return $fetchStmt->fetch();
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Get paginated list of patients with search, sorting, and pagination
     */
    public static function findAll(array $params = []): array {
        $db = Database::getConnection();

        $search = isset($params['search']) ? trim($params['search']) : '';
        $fromDate = isset($params['fromDate']) ? trim($params['fromDate']) : '';
        $toDate = isset($params['toDate']) ? trim($params['toDate']) : '';
        $date = isset($params['date']) ? trim($params['date']) : '';
        $page = isset($params['page']) ? (int)$params['page'] : 1;
        $limit = isset($params['limit']) ? (int)$params['limit'] : 10;
        $sortBy = isset($params['sortBy']) ? trim($params['sortBy']) : 'created_at';
        $order = isset($params['order']) ? strtoupper(trim($params['order'])) : 'DESC';

        $pageNum = max(1, $page);
        $limitNum = max(1, min(100, $limit));
        $offset = ($pageNum - 1) * $limitNum;

        $allowedSortFields = [
            'created_at' => 'created_at',
            'token' => 'token',
            'patient_name' => 'patient_name',
            'age' => 'age'
        ];

        $sortColumn = $allowedSortFields[$sortBy] ?? 'created_at';
        $sortOrder = ($order === 'ASC') ? 'ASC' : 'DESC';

        $whereConditions = [];
        $queryParams = [];

        if ($search !== '') {
            if (ctype_digit($search)) {
                $whereConditions[] = '(token = ? OR mobile LIKE ? OR patient_name LIKE ?)';
                $queryParams[] = (int)$search;
                $queryParams[] = "%{$search}%";
                $queryParams[] = "%{$search}%";
            } else {
                $whereConditions[] = '(patient_name LIKE ? OR symptoms LIKE ?)';
                $queryParams[] = "%{$search}%";
                $queryParams[] = "%{$search}%";
            }
        }

        $effectiveFrom = $fromDate !== '' ? $fromDate : $date;
        $effectiveTo = $toDate !== '' ? $toDate : $date;

        if ($effectiveFrom !== '') {
            $whereConditions[] = 'DATE(created_at) >= DATE(?)';
            $queryParams[] = $effectiveFrom;
        }

        if ($effectiveTo !== '') {
            $whereConditions[] = 'DATE(created_at) <= DATE(?)';
            $queryParams[] = $effectiveTo;
        }

        $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';

        // Count total matching records
        $countSql = "SELECT COUNT(*) AS total FROM patients {$whereClause}";
        $countStmt = $db->prepare($countSql);
        $countStmt->execute($queryParams);
        $totalRow = $countStmt->fetch();
        $total = (int)($totalRow['total'] ?? 0);

        // Fetch data with limit and offset
        $dataSql = "
            SELECT * FROM patients
            {$whereClause}
            ORDER BY {$sortColumn} {$sortOrder}
            LIMIT ? OFFSET ?
        ";

        $dataStmt = $db->prepare($dataSql);
        $dataParams = array_merge($queryParams, [$limitNum, $offset]);
        $dataStmt->execute($dataParams);
        $data = $dataStmt->fetchAll();

        $totalPages = (int)ceil($total / $limitNum) ?: 1;

        return [
            'data' => $data,
            'total' => $total,
            'page' => $pageNum,
            'limit' => $limitNum,
            'totalPages' => $totalPages
        ];
    }

    /**
     * Find a single patient by token number
     */
    public static function findByToken($token): ?array {
        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT * FROM patients WHERE token = ?');
        $stmt->execute([(int)$token]);
        $patient = $stmt->fetch();
        return $patient ?: null;
    }

    /**
     * Get all patient records for export with date range and search filters
     */
    public static function exportAll(array $params = []): array {
        $db = Database::getConnection();

        $search = isset($params['search']) ? trim($params['search']) : '';
        $fromDate = isset($params['fromDate']) ? trim($params['fromDate']) : '';
        $toDate = isset($params['toDate']) ? trim($params['toDate']) : '';
        $date = isset($params['date']) ? trim($params['date']) : '';

        $whereConditions = [];
        $queryParams = [];

        if ($search !== '') {
            if (ctype_digit($search)) {
                $whereConditions[] = '(token = ? OR mobile LIKE ? OR patient_name LIKE ?)';
                $queryParams[] = (int)$search;
                $queryParams[] = "%{$search}%";
                $queryParams[] = "%{$search}%";
            } else {
                $whereConditions[] = '(patient_name LIKE ? OR symptoms LIKE ?)';
                $queryParams[] = "%{$search}%";
                $queryParams[] = "%{$search}%";
            }
        }

        $effectiveFrom = $fromDate !== '' ? $fromDate : $date;
        $effectiveTo = $toDate !== '' ? $toDate : $date;

        if ($effectiveFrom !== '') {
            $whereConditions[] = 'DATE(created_at) >= DATE(?)';
            $queryParams[] = $effectiveFrom;
        }

        if ($effectiveTo !== '') {
            $whereConditions[] = 'DATE(created_at) <= DATE(?)';
            $queryParams[] = $effectiveTo;
        }

        $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';
        $sql = "SELECT id, token, patient_name, age, mobile, symptoms, created_at FROM patients {$whereClause} ORDER BY token ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute($queryParams);
        return $stmt->fetchAll();
    }

    /**
     * Get summary dashboard stats
     */
    public static function getStats(): array {
        $db = Database::getConnection();

        $totalRow = $db->query('SELECT COUNT(*) AS total FROM patients')->fetch();
        $todayRow = $db->query("
            SELECT COUNT(*) AS today 
            FROM patients 
            WHERE DATE(created_at) = DATE('now', 'localtime')
        ")->fetch();
        $latestRow = $db->query('SELECT COALESCE(MAX(token), 0) AS latestToken FROM patients')->fetch();

        return [
            'totalPatients' => (int)($totalRow['total'] ?? 0),
            'todayPatients' => (int)($todayRow['today'] ?? 0),
            'latestToken' => (int)($latestRow['latestToken'] ?? 0)
        ];
    }
}
