import axios from 'axios';
import { CveFinding } from '../types.js';
import { Logger } from '../utils/logger.js';
import { osvLimiter } from '../utils/rate-limiter.js';

/**
 * Client for the OSV.dev API (https://api.osv.dev).
 * Queries known vulnerabilities for open-source packages.
 */
export class OsvClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://api.osv.dev/v1') {
    this.baseUrl = baseUrl;
  }

  /**
   * Check for known vulnerabilities in a package.
   * @param packageName - npm package name (e.g. '@modelcontextprotocol/sdk')
   * @param version - Optional version string
   * @returns Array of CVE findings
   */
  async check(packageName: string, version?: string): Promise<CveFinding[]> {
    try {
      await osvLimiter.acquire();
      // Normalize to purl-compatible format
      const purl = this.toPurl(packageName, version);
      const response = await axios.post(`${this.baseUrl}/query`, {
        package: { purl },
      }, {
        timeout: 10000,
      });
      const vulns: any[] = response.data?.vulns ?? [];
      return vulns.map((v: any) => ({
        id: v.id ?? 'unknown',
        severity: this.mapSeverity(v.severity),
        summary: v.summary ?? v.details?.substring(0, 200) ?? 'No description',
        fixedVersion: v.affected?.[0]?.ranges?.[0]?.events?.find((e: any) => e.fixed)?.fixed,
      }));
    } catch (error: any) {
      Logger.warn(`OSV lookup failed for ${packageName}: ${error?.message ?? 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Construct a Package URL (purl).
   * Defaults to npm ecosystem; set ecosystem to 'pypi' for Python/uvx packages.
   */
  private toPurl(packageName: string, version?: string, ecosystem: 'npm' | 'pypi' = 'npm'): string {
    const encoded = encodeURIComponent(packageName);
    const versionSuffix = version ? `@${encodeURIComponent(version)}` : '';
    return `pkg:${ecosystem}/${encoded}${versionSuffix}`;
  }

  /**
   * Detect the correct package ecosystem from the MCP server command.
   * 'uvx' and 'python -m' indicate a Python/PyPI package.
   */
  static detectEcosystem(command?: string, args?: string[]): 'npm' | 'pypi' {
    if (!command) return 'npm';
    const cmd = command.toLowerCase();
    if (cmd === 'uvx' || cmd === 'uv' || cmd.includes('python')) return 'pypi';
    // Check args for uvx/python patterns
    if (args && args.length > 0) {
      const joined = args.join(' ').toLowerCase();
      if (joined.includes('uvx ') || joined.includes('python -m')) return 'pypi';
    }
    return 'npm';
  }

  /** Check with explicit ecosystem (for Python/uvx MCP servers). */
  async checkEcosystem(packageName: string, ecosystem: 'npm' | 'pypi', version?: string): Promise<CveFinding[]> {
    try {
      await osvLimiter.acquire();
      const purl = this.toPurl(packageName, version, ecosystem);
      const response = await axios.post(`${this.baseUrl}/query`, {
        package: { purl },
      }, {
        timeout: 10000,
      });
      const vulns: any[] = response.data?.vulns ?? [];
      return vulns.map((v: any) => ({
        id: v.id ?? 'unknown',
        severity: this.mapSeverity(v.severity),
        summary: v.summary ?? v.details?.substring(0, 200) ?? 'No description',
        fixedVersion: v.affected?.[0]?.ranges?.[0]?.events?.find((e: any) => e.fixed)?.fixed,
      }));
    } catch (error: any) {
      Logger.warn(`OSV lookup failed for ${packageName} (${ecosystem}): ${error?.message ?? 'Unknown error'}`);
      return [];
    }
  }

  private mapSeverity(severity?: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    if (!severity) return 'MEDIUM';
    const map: Record<string, 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = {
      CRITICAL: 'CRITICAL',
      HIGH: 'HIGH',
      MODERATE: 'MEDIUM',
      LOW: 'LOW',
    };
    return map[severity.toUpperCase()] ?? 'MEDIUM';
  }
}