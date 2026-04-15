export interface JwtAccessPayload {
  /** User ID */
  sub: string;
  email: string;
  /** Unique token ID — mirrors sessions.access_jti for revocation checks */
  jti: string;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  /** User ID */
  sub: string;
  /** sessions.id — allows finding the session to rotate tokens */
  sessionId: string;
  iat?: number;
  exp?: number;
}
