const UserModel = require('../models/userModel');

exports.login = (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const user = UserModel.findByUsername(username.trim());

    if (!user || user.password !== password) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials. Please check your username and password.' 
      });
    }

    // Generate mock token for local session
    const mockToken = Buffer.from(`${user.id}:${user.username}:${Date.now()}`).toString('base64');

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      token: mockToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error during authentication:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication',
      error: error.message
    });
  }
};

exports.getCurrentUser = (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No session active' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [userId] = decoded.split(':');

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid session token' });
    }

    const user = UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found' });
    }

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
};

exports.createUser = (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Admin authorization token required.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [userId] = decoded.split(':');

    const requestingUser = UserModel.findById(userId);
    if (!requestingUser || requestingUser.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Only Admin users can create new accounts.' });
    }

    const { username, password, name, role } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }
    if (username.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }
    if (password.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters' });
    }

    const existingUser = UserModel.findByUsername(username.trim());
    if (existingUser) {
      return res.status(400).json({ success: false, message: `Username '${username.trim()}' is already taken.` });
    }

    const newUser = UserModel.create({
      username: username.trim(),
      password,
      name: name ? name.trim() : username.trim(),
      role: role === 'Admin' ? 'Admin' : 'Receptionist'
    });

    return res.status(201).json({
      success: true,
      message: 'New user created successfully',
      user: newUser
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating user',
      error: error.message
    });
  }
};
