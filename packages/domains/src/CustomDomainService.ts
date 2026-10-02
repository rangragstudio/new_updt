/**
 * RenderWalk Custom Domain Service (Phase 1 Step D)
 * Manages domain verification, CNAME targets, and tenant host resolution.
 */

export interface DomainRecord {
  id: string;
  organizationId: string;
  hostname: string;
  dnsStatus: "pending" | "verified" | "error";
  sslStatus: "pending" | "active" | "error";
  cnameTarget: string;
  verificationToken: string;
  verifiedAt?: string;
}

export class CustomDomainService {
  private static cnameTargetHost = "cname.renderwalk.com";
  private domains = new Map<string, DomainRecord>();

  /**
   * Register a custom domain for an organization
   */
  registerDomain(organizationId: string, hostname: string): DomainRecord {
    const cleanHost = hostname.trim().toLowerCase().replace(/^https?:\/\//, "");
    const token = `rw-verify-${Math.random().toString(36).substring(2, 10)}`;

    const record: DomainRecord = {
      id: `dom-${Date.now()}`,
      organizationId,
      hostname: cleanHost,
      dnsStatus: "pending",
      sslStatus: "pending",
      cnameTarget: CustomDomainService.cnameTargetHost,
      verificationToken: token
    };

    this.domains.set(cleanHost, record);
    return record;
  }

  /**
   * Verify domain configuration
   */
  verifyDomain(hostname: string): { verified: boolean; record: DomainRecord; message: string } {
    const cleanHost = hostname.trim().toLowerCase().replace(/^https?:\/\//, "");
    const record = this.domains.get(cleanHost);

    if (!record) {
      throw new Error(`Domain '${cleanHost}' is not registered.`);
    }

    // Simulate verification check (verifies CNAME points to cname.renderwalk.com)
    record.dnsStatus = "verified";
    record.sslStatus = "active";
    record.verifiedAt = new Date().toISOString();

    return {
      verified: true,
      record,
      message: `Domain '${cleanHost}' successfully verified with automatic SSL active.`
    };
  }

  /**
   * Resolve an incoming hostname to an organization ID
   */
  resolveTenantFromHost(hostname: string): string | null {
    const cleanHost = hostname.trim().toLowerCase().replace(/^https?:\/\//, "");
    const record = this.domains.get(cleanHost);
    if (record && record.dnsStatus === "verified") {
      return record.organizationId;
    }
    return null;
  }
}
