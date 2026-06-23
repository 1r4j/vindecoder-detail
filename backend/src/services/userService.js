import bcrypt from 'bcryptjs';
import db from '../db.js';

export function createUser(email, password, name) {
  try {
    // Check if user already exists
    const existingUser = db.users.find(u => u.email === email.toLowerCase());
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

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

    db.users.push(user);
    db.save();

    // Return user without password
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    };
  } catch (error) {
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
