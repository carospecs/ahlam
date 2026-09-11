import assert from "node:assert/strict";
import { publicSignInError } from "./auth-signin.ts";

const rateLimited = publicSignInError({
  code: "over_request_rate_limit",
  status: 429,
  message: "Request rate limit reached",
});
assert.deepEqual(rateLimited, {
  status: 429,
  error: "Too many sign-in attempts. Please wait a few minutes, then try again.",
  code: "rate_limited",
  retryAfterSec: 180,
});

assert.equal(publicSignInError({ status: 429 }).code, "rate_limited");
assert.equal(publicSignInError({ message: "request RATE LIMIT reached" }).code, "rate_limited");

assert.deepEqual(publicSignInError({ code: "invalid_credentials", status: 400 }), {
  status: 401,
  error: "Email or password is incorrect. Try again or use Forgot password.",
  code: "invalid_credentials",
});

assert.equal(publicSignInError({ code: "email_not_confirmed", status: 400 }).code, "email_not_confirmed");

const unknown = publicSignInError({ status: 500, message: "internal provider detail" });
assert.equal(unknown.status, 503);
assert.equal(unknown.code, "signin_failed");
assert.ok(!unknown.error.includes("provider detail"));

console.log("auth-signin: customer-safe auth errors and rate-limit retry metadata pass");
