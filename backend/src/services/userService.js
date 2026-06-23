import bcrypt from 'bcryptjs';
import db from '../db.js';

export function createUser(email, password, name) {
  try {
    console.log('[AUTH] Creating user:', { email, name, passwordLength: password.length });
    console.log('[AUTH] Current users in database:', db.users.length);

    // Check if user already exists
    const existingUser = db.users.find(u => u.email === email.toLowerCase());
    if (existingUser) {
      console.log('[AUTH] User already exists:', email);
      throw new Error('User with this email already exists');
    }

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    console.log('[AUTH] Password hashed successfully');

    // Create user
    const userId = Math.max(0, ...db.users.map(u => u.id)) + 1;
    const user = {
      id: userId,
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name || email.split('@')[0],
      oauthId: null,
      oauthProvider: null,
      profilePicture: null,
      createdAt: new Date().toISOString(),
      businessSettings: {
        businessName: `${name || 'Business'}`,
        address: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        email: email,
        taxRate: 8,
        invoicePrefix: 'INV',
        paymentTerms: 14,
        currency: '$'
      }
    };

    console.log('[AUTH] User object created with ID:', userId);
    db.users.push(user);
    console.log('[AUTH] User pushed to db.users, total users:', db.users.length);

    db.save();
    console.log('[AUTH] Database saved');

    // Verify user was saved
    const savedUser = db.users.find(u => u.email === email.toLowerCase());
    console.log('[AUTH] User verification after save:', savedUser ? 'FOUND' : 'NOT FOUND');

    // Return user without password
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    };
  } catch (error) {
    console.error('[AUTH] Error creating user:', error.message);
    throw new Error(`Failed to create user: ${error.message}`);
  }
}

export function getUserByEmail(email) {
  try {
    return db.users.find(u => u.email === email.toLowerCase());
  } catch (error) {
    throw new Error(`Failed to get user: ${error.message}`);
  }
}

export function getUserById(userId) {
  try {
    const user = db.users.find(u => u.id === parseInt(userId));
    if (!user) return null;

    // Return user without password
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      businessSettings: user.businessSettings
    };
  } catch (error) {
    throw new Error(`Failed to get user: ${error.message}`);
  }
}

export function verifyPassword(email, password) {
  try {
    const user = getUserByEmail(email.toLowerCase());
    if (!user) {
      throw new Error('User not found');
    }

    // Check if this is an OAuth user without password
    if (!user.password) {
      throw new Error('This account uses social login. Please sign in with Google or Apple.');
    }

    const isValid = bcrypt.compareSync(password, user.password);
    return isValid ? user : null;
  } catch (error) {
    throw new Error(`Failed to verify password: ${error.message}`);
  }
}

export function updateUserBusinessSettings(userId, settings) {
  try {
    const user = db.users.find(u => u.id === parseInt(userId));
    if (!user) {
      throw new Error('User not found');
    }

    user.businessSettings = {
      ...user.businessSettings,
      ...settings
    };

    db.save();

    return user.businessSettings;
  } catch (error) {
    throw new Error(`Failed to update settings: ${error.message}`);
  }
}

export function deleteUser(userId) {
  try {
    const index = db.users.findIndex(u => u.id === parseInt(userId));
    if (index === -1) {
      throw new Error('User not found');
    }

    db.users.splice(index, 1);
    db.save();

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to delete user: ${error.message}`);
  }
}

export default {
  createUser,
  getUserByEmail,
  getUserById,
  verifyPassword,
  updateUserBusinessSettings,
  deleteUser
};
