export type UserRole = "OWNER" | "EMPLOYEE";

export interface UserSession {
 id: string;
 userId: string;
 email: string;
 name: string;
 fullName: string;
 role: UserRole;
 googleToken: string;
 token: string;
 expiresAt: number;
 pharmacyId: string; // Currently active (legacy alias)
 tenantId: string; // Currently active tenant
 ownedPharmacyIds: string[]; // Legacy
 associatedTenantIds: string[]; // Updated mapping
}
