/**
 * Length of the SMS one-time login code. Shared by the server (code generation) and the login and checkout forms.
 * Six digits gives 900,000 possible codes, ten times more than five, on top of the attempt and rate limits.
 */
export const OTP_LENGTH = 6;
