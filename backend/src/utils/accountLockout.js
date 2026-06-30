const failedAttempts = new Map(); // { email: { count: 0, lockedUntil: timestamp } }

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export function recordFailedAttempt(email) {
  const normalizedEmail = email.toLowerCase();
  const now = Date.now();

  if (!failedAttempts.has(normalizedEmail)) {
    failedAttempts.set(normalizedEmail, { count: 1, lockedUntil: null });
  } else {
    const attempt = failedAttempts.get(normalizedEmail);
    attempt.count += 1;

    if (attempt.count >= MAX_FAILED_ATTEMPTS) {
      attempt.lockedUntil = now + LOCKOUT_DURATION;
      console.warn(`🔒 Account locked: ${normalizedEmail}`);
    }

    failedAttempts.set(normalizedEmail, attempt);
  }
}

export function isAccountLocked(email) {
  const normalizedEmail = email.toLowerCase();
  const now = Date.now();

  if (!failedAttempts.has(normalizedEmail)) {
    return { locked: false };
  }

  const attempt = failedAttempts.get(normalizedEmail);

  if (attempt.lockedUntil && now < attempt.lockedUntil) {
    const minutesRemaining = Math.ceil((attempt.lockedUntil - now) / 60000);
    return {
      locked: true,
      minutesRemaining,
      message: `Account is locked. Try again in ${minutesRemaining} minute(s).`
    };
  }

  return { locked: false };
}

export function clearFailedAttempts(email) {
  const normalizedEmail = email.toLowerCase();
  failedAttempts.delete(normalizedEmail);
}

export function getFailedAttemptCount(email) {
  const normalizedEmail = email.toLowerCase();
  return failedAttempts.get(normalizedEmail)?.count || 0;
}

export default {
  recordFailedAttempt,
  isAccountLocked,
  clearFailedAttempts,
  getFailedAttemptCount
};
