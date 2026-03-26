import jwt from "jsonwebtoken";
import { normalizePem } from "./env.js";
import type { AuthContext } from "./types.js";

interface TokenClaims {
  sub: string;
  email: string;
  roles: string[];
}

export function signAccessToken(
  user: AuthContext,
  privateKey: string,
  issuer: string,
  audience: string
): string {
  return jwt.sign(
    {
      email: user.email,
      roles: user.roles
    },
    normalizePem(privateKey),
    {
      algorithm: "RS256",
      subject: user.id,
      issuer,
      audience,
      expiresIn: "8h"
    }
  );
}

export function verifyAccessToken(
  token: string,
  publicKey: string,
  issuer: string,
  audience: string
): AuthContext {
  const claims = jwt.verify(token, normalizePem(publicKey), {
    algorithms: ["RS256"],
    issuer,
    audience
  }) as TokenClaims;

  return {
    id: claims.sub,
    email: claims.email,
    roles: claims.roles as AuthContext["roles"]
  };
}
