import db from '../db.js';
import { generateToken } from '../middleware/auth.js';

export function findOrCreateOAuthUser(provider, profile) {
  try {
    const oauthId = `${provider}:${profile.id}`;

    // Check if user exists with this OAuth ID
    let user = db.users.find(u => u.oauthId === oauthId);

    if (user) {
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
          provider: provider
        },
        token: generateToken(user.id),
        isNewUser: false
      };
    }

    // Check if email already exists - but DON'T auto-link
    // Users must explicitly link accounts for security
    const email = profile.emails?.[0]?.value || profile.email;
    const emailExists = db.users.find(u => u.email === email?.toLowerCase());

    if (emailExists) {
      // Email already registered - don't auto-link for security
      throw new Error(`Email ${email} is already registered. Please sign in with the original authentication method, or use a different email for OAuth.`);
    }

    // Create new user from OAuth
    const userId = Math.max(0, ...db.users.map(u => u.id)) + 1;
    const displayName = profile.displayName || profile.name?.familyName || email?.split('@')[0];

    const newUser = {
      id: userId,
      email: email?.toLowerCase() || `${provider}-${profile.id}@oauth`,
      password: null, // OAuth users don't have passwords
      name: displayName,
      oauthId: oauthId,
      oauthProvider: provider,
      profilePicture: profile.photos?.[0]?.value || null,
      createdAt: new Date().toISOString(),
      businessSettings: {
        businessName: displayName || 'My Business',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
        email: email || '',
        taxRate: 8,
        invoicePrefix: 'INV',
        paymentTerms: 14,
        currency: '$'
      }
    };

    db.users.push(newUser);
    db.save();

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        createdAt: newUser.createdAt,
        provider: provider,
        profilePicture: newUser.profilePicture
      },
      token: generateToken(newUser.id),
      isNewUser: true
    };
  } catch (error) {
    throw new Error(`OAuth user creation failed: ${error.message}`);
  }
}

export function unlinkOAuthProvider(userId, provider) {
  try {
    const user = db.users.find(u => u.id === parseInt(userId));
    if (!user) {
      throw new Error('User not found');
    }

    if (user.oauthProvider === provider) {
      user.oauthId = null;
      user.oauthProvider = null;
      user.profilePicture = null;
      db.save();
    }

    return { success: true };
  } catch (error) {
    throw new Error(`Failed to unlink provider: ${error.message}`);
  }
}

export function getLinkedProviders(userId) {
  try {
    const user = db.users.find(u => u.id === parseInt(userId));
    if (!user) {
      throw new Error('User not found');
    }

    const providers = [];
    if (user.password) providers.push('email');
    if (user.oauthProvider) providers.push(user.oauthProvider);

    return {
      linkedProviders: providers,
      primaryProvider: user.oauthProvider || 'email'
    };
  } catch (error) {
    throw new Error(`Failed to get linked providers: ${error.message}`);
  }
}

export default {
  findOrCreateOAuthUser,
  unlinkOAuthProvider,
  getLinkedProviders
};
