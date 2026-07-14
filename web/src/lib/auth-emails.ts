// Branded auth emails (verification codes, password resets, email changes),
// sent through our own Gmail SMTP instead of Supabase's default templates so
// they come from ahlam.io and aren't rate-limited by Supabase.
// Copy rule: no em dashes in user-facing strings.

const SIGNATURE = "\n\nAhlam\nhttps://ahlam.io\nQuestions? Just reply to this email.";

export function verifyCodeEmail(code: string): { subject: string; text: string } {
  return {
    subject: `${code} is your Ahlam verification code`,
    text:
      "Welcome to Ahlam.\n\n" +
      `Your verification code is: ${code}\n\n` +
      "Enter it on the sign-up screen to activate your account. The code " +
      "expires in about an hour. If you didn't create an Ahlam account, you " +
      "can ignore this email." +
      SIGNATURE,
  };
}

export function resetCodeEmail(code: string): { subject: string; text: string } {
  return {
    subject: `${code} is your Ahlam password reset code`,
    text:
      `Your password reset code is: ${code}\n\n` +
      "Enter it on the reset screen together with your new password. The " +
      "code expires in about an hour. If you didn't ask to reset your " +
      "password, you can ignore this email and your password stays the same." +
      SIGNATURE,
  };
}

export function emailChangeEmail(confirmUrl: string): { subject: string; text: string } {
  return {
    subject: "Confirm your new Ahlam email address",
    text:
      "You asked to move your Ahlam account to this email address.\n\n" +
      "Click to confirm the change:\n\n" +
      `${confirmUrl}\n\n` +
      "The link expires in about an hour. If you didn't request this, you " +
      "can ignore this email and nothing changes." +
      SIGNATURE,
  };
}
