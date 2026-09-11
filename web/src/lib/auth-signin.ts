export type SignInErrorLike = {
  code?: unknown;
  status?: unknown;
  message?: unknown;
};

export type PublicSignInError = {
  status: number;
  error: string;
  code: "rate_limited" | "invalid_credentials" | "email_not_confirmed" | "signin_failed";
  retryAfterSec?: number;
};

/**
 * Converts Supabase Auth failures into stable, customer-friendly responses.
 * Never send an upstream provider's technical error text to the sign-in form.
 */
export function publicSignInError(error: SignInErrorLike): PublicSignInError {
  const code = typeof error.code === "string" ? error.code : "";
  const status = typeof error.status === "number" ? error.status : 0;
  const message = typeof error.message === "string" ? error.message : "";

  if (status === 429 || code === "over_request_rate_limit" || /rate limit/i.test(message)) {
    return {
      status: 429,
      error: "Too many sign-in attempts. Please wait a few minutes, then try again.",
      code: "rate_limited",
      retryAfterSec: 180,
    };
  }

  if (code === "email_not_confirmed") {
    return {
      status: 403,
      error: "Please verify your email before signing in. Check your inbox for the verification email.",
      code: "email_not_confirmed",
    };
  }

  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return {
      status: 401,
      error: "Email or password is incorrect. Try again or use Forgot password.",
      code: "invalid_credentials",
    };
  }

  return {
    status: status >= 500 ? 503 : 401,
    error: "We couldn't sign you in right now. Please try again in a moment.",
    code: "signin_failed",
  };
}
