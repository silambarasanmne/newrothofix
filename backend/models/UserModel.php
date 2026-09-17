<?php

require_once __DIR__ . '/../database/db.php';

class UserModel {
    public static function findByUsername(string $username): ?array {
        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT id, username, password, name, role, created_at FROM users WHERE LOWER(username) = LOWER(?)');
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public static function findById($id): ?array {
        $db = Database::getConnection();
        $stmt = $db->prepare('SELECT id, username, name, role, created_at FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public static function create(array $data): array {
        $db = Database::getConnection();
        $username = trim($data['username']);
        $password = $data['password'];
        $name = !empty($data['name']) ? trim($data['name']) : $username;
        $role = (!empty($data['role']) && $data['role'] === 'Admin') ? 'Admin' : 'Receptionist';

        $stmt = $db->prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)');
        $stmt->execute([$username, $password, $name, $role]);

        $id = (int)$db->lastInsertId();

        return [
            'id' => $id,
            'username' => $username,
            'name' => $name,
            'role' => $role
        ];
    }
}
