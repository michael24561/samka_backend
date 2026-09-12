import jwt from "jsonwebtoken";
import { env } from "../env.js";

export type AuthPayload = {
  userId: string;
  email: string;
  role: string;
};

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, env.jwtSecret) as AuthPayload;
}
