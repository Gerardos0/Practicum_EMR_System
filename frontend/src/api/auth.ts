import type { User } from "../types";
import { ApiError, clone, latency, uid } from "./client";
import { db } from "./mockDb";
import { recordAudit } from "./audit";

export type CodeChannel = "sms" | "email";

interface Challenge { userId: string; channel?: CodeChannel }
const challenges = new Map<string, Challenge>();

/** Dev-only code for the mock. The real backend sends a random code by SMS or email. */
export const DEV_CODE = "123456";

const ALLOWED = /@(miners\.)?utep\.edu$/i;

export async function startSignIn(email: string, password: string) {
  await latency(350);
  if (!ALLOWED.test(email.trim())) {
    throw new ApiError(400, "Use your UTEP email address (@utep.edu or @miners.utep.edu).");
  }
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || password.length === 0) {
    throw new ApiError(401, "That email and password don't match an EMR account. Ask your instructor to confirm you're on the course roster.");
  }
  const challengeId = uid("ch");
  challenges.set(challengeId, { userId: user.id });
  return {
    challengeId,
    phoneLast4: user.phoneLast4,
    emailMasked: user.email.replace(/^(.).*(@.*)$/, "$1•••$2"),
  };
}

export async function sendCode(challengeId: string, channel: CodeChannel) {
  await latency(300);
  const ch = challenges.get(challengeId);
  if (!ch) throw new ApiError(410, "Your sign-in expired. Start again.");
  ch.channel = channel;
}

export async function verifyCode(challengeId: string, code: string): Promise<User> {
  await latency(300);
  const ch = challenges.get(challengeId);
  if (!ch) throw new ApiError(410, "Your sign-in expired. Start again.");
  if (code !== DEV_CODE) throw new ApiError(401, "That code isn't right. Check the latest message and try again.");
  challenges.delete(challengeId);
  const user = db.users.find((u) => u.id === ch.userId)!;
  recordAudit(user, "auth.sign_in", `user/${user.id}`, "ok", `code via ${ch.channel ?? "sms"}`);
  return clone(user);
}
