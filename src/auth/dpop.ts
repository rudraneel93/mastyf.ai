import * as jose from 'jose';
import { Logger } from '../utils/logger.js';

/**
 * DPoP (Demonstrating Proof of Possession) — RFC 9449.
 * Validates sender-constrained tokens to prevent token replay.
 * The client must include a DPoP proof JWT in the DPoP header.
 */
export interface DPoPProof {
  /** The access token hash (ath) claim */
  ath?: string;
  /** The HTTP method of the request */
  htm: string;
  /** The HTTP URI of the request */
  htu: string;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Unique JWT ID for replay detection */
  jti: string;
}

export class DPoPValidator {
  private usedNonces: Set<string> = new Set();
  private readonly nonceTtlMs: number;
  private lastCleanup: number = Date.now();

  constructor(nonceTtlMs: number = 10 * 60 * 1000) {
    this.nonceTtlMs = nonceTtlMs;
  }

  /**
   * Validate a DPoP proof JWT.
   * Checks: signature (JWK), htm, htu, iat freshness (60s window), ath (if access token provided), nonce replay.
   */
  async validate(proofToken: string, jwk: jose.JWK, httpMethod: string, httpUri: string, accessToken?: string): Promise<{ valid: boolean; error?: string }> {
    try {
      // Verify the proof JWT is signed by the client's private key matching the JWK
      const publicKey = await jose.importJWK(jwk, 'ES256');
      const { payload } = await jose.jwtVerify(proofToken, publicKey, {
        algorithms: ['ES256', 'RS256', 'EdDSA'],
        clockTolerance: 10,
      });

      const proof = payload as unknown as DPoPProof;

      // Validate htm (HTTP method)
      if (proof.htm !== httpMethod.toUpperCase()) {
        return { valid: false, error: `DPoP: htm mismatch (expected ${httpMethod.toUpperCase()}, got ${proof.htm})` };
      }

      // Validate htu (HTTP URI) — must match the request URI
      if (proof.htu !== httpUri) {
        return { valid: false, error: `DPoP: htu mismatch (expected ${httpUri}, got ${proof.htu})` };
      }

      // Validate iat freshness (must be within last 60 seconds)
      const now = Math.floor(Date.now() / 1000);
      if (proof.iat < now - 60) {
        return { valid: false, error: 'DPoP: proof too old (iat > 60s ago)' };
      }
      if (proof.iat > now + 10) {
        return { valid: false, error: 'DPoP: proof from the future' };
      }

      // Validate nonce (jti) for replay detection
      if (this.usedNonces.has(proof.jti)) {
        Logger.warn(`[dpop] Replay detected: jti ${proof.jti}`);
        return { valid: false, error: 'DPoP: nonce already used (replay detected)' };
      }
      this.usedNonces.add(proof.jti);

      // Validate ath (access token hash) if access token provided
      if (accessToken && proof.ath) {
        const expectedAth = await this.computeAth(accessToken);
        if (proof.ath !== expectedAth) {
          return { valid: false, error: 'DPoP: ath mismatch (access token hash does not match)' };
        }
      }

      // Periodic cleanup of old nonces
      if (Date.now() - this.lastCleanup > 60000) {
        this.usedNonces.clear();
        this.lastCleanup = Date.now();
      }

      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: `DPoP validation failed: ${err?.message}` };
    }
  }

  /**
   * Compute the access token hash (ath) as per RFC 9449 §4.2.
   * ath = base64url(sha256(access_token))
   */
  private async computeAth(accessToken: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken));
    return Buffer.from(digest).toString('base64url');
  }
}