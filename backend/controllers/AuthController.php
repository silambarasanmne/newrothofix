<?php

require_once __DIR__ . '/../models/UserModel.php';

class AuthController {
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

    private static function getAuthUser(): ?array {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

        if (!preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            return null;
        }

        $token = $matches[1];
        $decoded = base64_decode($token);
        if (!$decoded) {
            return null;
        }

        $parts = explode(':', $decoded);
        $userId = $parts[0] ?? null;

        if (!$userId) {
            return null;
        }

        return UserModel::findById($userId);
    }

    public static function login(): void {
        try {
            $input = self::getJsonInput();
            $username = isset($input['username']) ? trim($input['username']) : '';
            $password = $input['password'] ?? '';

            if (empty($username)) {
                self::jsonResponse(['success' => false, 'message' => 'Username is required'], 400);
            }

            if (empty($password)) {
                self::jsonResponse(['success' => false, 'message' => 'Password is required'], 400);
            }

            $user = UserModel::findByUsername($username);

            if (!$user || $user['password'] !== $password) {
                self::jsonResponse([
                    'success' => false,
                    'message' => 'Invalid credentials. Please check your username and password.'
                ], 401);
            }

            $mockToken = base64_encode("{$user['id']}:{$user['username']}:" . (int)(microtime(true) * 1000));

            self::jsonResponse([
                'success' => true,
                'message' => 'Authentication successful',
                'token' => $mockToken,
                'user' => [
                    'id' => (int)$user['id'],
                    'username' => $user['username'],
                    'name' => $user['name'],
                    'role' => $user['role']
                ]
            ], 200);

        } catch (\Throwable $e) {
            self::jsonResponse([
                'success' => false,
                'message' => 'Server error during authentication',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public static function getCurrentUser(): void {
        try {
            $user = self::getAuthUser();

            if (!$user) {
                self::jsonResponse(['success' => false, 'message' => 'No session active or invalid token'], 401);
            }

            self::jsonResponse([
                'success' => true,
                'user' => [
                    'id' => (int)$user['id'],
                    'username' => $user['username'],
                    'name' => $user['name'],
                    'role' => $user['role'],
                    'created_at' => $user['created_at']
                ]
            ], 200);

        } catch (\Throwable $e) {
            self::jsonResponse(['success' => false, 'message' => 'Invalid or expired session'], 401);
        }
    }

    public static function createUser(): void {
        try {
            $requestingUser = self::getAuthUser();

            if (!$requestingUser || ($requestingUser['role'] ?? '') !== 'Admin') {
                self::jsonResponse(['success' => false, 'message' => 'Access denied. Only Admin users can create new accounts.'], 403);
            }

            $input = self::getJsonInput();
            $username = isset($input['username']) ? trim($input['username']) : '';
            $password = $input['password'] ?? '';
            $name = isset($input['name']) ? trim($input['name']) : '';
            $role = isset($input['role']) ? trim($input['role']) : 'Receptionist';

            if (empty($username)) {
                self::jsonResponse(['success' => false, 'message' => 'Username is required'], 400);
            }
            if (strlen($username) < 3) {
                self::jsonResponse(['success' => false, 'message' => 'Username must be at least 3 characters'], 400);
            }

            if (empty($password)) {
                self::jsonResponse(['success' => false, 'message' => 'Password is required'], 400);
            }
            if (strlen($password) < 4) {
                self::jsonResponse(['success' => false, 'message' => 'Password must be at least 4 characters'], 400);
            }

            $existing = UserModel::findByUsername($username);
            if ($existing) {
                self::jsonResponse(['success' => false, 'message' => "Username '{$username}' is already taken."], 400);
            }

            $newUser = UserModel::create([
                'username' => $username,
                'password' => $password,
                'name' => $name ?: $username,
                'role' => ($role === 'Admin') ? 'Admin' : 'Receptionist'
            ]);

            self::jsonResponse([
                'success' => true,
                'message' => 'New user created successfully',
                'user' => $newUser
            ], 201);

        } catch (\Throwable $e) {
            self::jsonResponse([
                'success' => false,
                'message' => 'Server error while creating user',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
