<?php
require 'api/db.php';
require 'api/jwt.php';

// Mock request
$_SERVER['REQUEST_METHOD'] = 'GET';
$_SERVER['REQUEST_URI'] = '/api/prescriptions/patient/3';
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . generateJWT(['id' => 1, 'username' => 'admin', 'full_name' => 'Admin', 'role' => 'Admin']);

// Include the router
ob_start();
require 'api/index.php';
$output = ob_get_clean();
echo "OUTPUT: \n" . $output;
