/** Email ownership must be verified for every account, including demos and owners. */
export function requiresEmailVerification(emailVerified: boolean): boolean {
  return !emailVerified;
}

/** Public unauthenticated screens stay open; every signed-in user is gated. */
export function shouldShowEmailVerification(
  user: { emailVerified: boolean } | null | undefined,
): boolean {
  return Boolean(user && requiresEmailVerification(user.emailVerified));
}
