export type TenantType = "RETAIL_PHARMACY" | "WHOLESALE_WAREHOUSE";
export type TenantStatus = "ACTIVE" | "SUSPENDED";

export interface TenantLocation {
  city: string;
  zone: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface Tenant {
  id: string; // The tenantId
  tenantId: string; // explicitly tracked for B2B
  tenantType: TenantType;
  isAdmin?: boolean; // Controls whether this tenant can modify the global reference catalog
  name: string; // Used by UI
  nameAr?: string; // Arabic name
  displayName: string; // For B2B
  address?: string; // Street address
  addressAr?: string; // Arabic address
  verifiedLocation: string; // For B2B
  contactPhone: string; // For B2B
  licenseNumber: string;
  tier: string;
  location: TenantLocation;
  locationAr?: string;
  status?: TenantStatus;
  createdAt?: string;
  createdByUid?: string;
 authorizedUsers: string[];
 profileCompleted?: boolean;
 /** Business operating hours, free-form (e.g. "Sat–Thu 9:00–21:00"). */
 workingHours?: string;
 updatedAt?: string;
}

export interface RetailPharmacy extends Tenant {
  tenantType: "RETAIL_PHARMACY";
  posRegisters?: string[];
}

export interface WholesaleWarehouse extends Tenant {
  tenantType: "WHOLESALE_WAREHOUSE";
  deliveryZones: string[];
}

// Backward compatibility or legacy alias if needed (e.g., during migration)
export type PharmacyProfile = Tenant;

/**
 * Validates whether an organization (Pharmacy or Warehouse) tenant has completed
 * all required organization profile fields.
 * Belongs to the TENANT/ORGANIZATION, not an individual user.
 */
export function isTenantProfileComplete(tenant: Tenant | null | undefined): boolean {
  if (!tenant) return false;
  if (tenant.profileCompleted === true) return true;

  const orgName = (tenant.name || tenant.displayName || '').trim();
  const nameValid = Boolean(
    orgName.length >= 2 &&
    orgName.toLowerCase() !== 'untitled organization'
  );

  const locAddress = (
    tenant.address || 
    tenant.verifiedLocation || 
    tenant.location?.address || 
    tenant.location?.zone || 
    ''
  ).trim();
  const addressValid = Boolean(
    locAddress.length >= 2 && 
    locAddress !== 'Dev Local'
  );

  const city = (
    tenant.location?.city || 
    (typeof tenant.location === 'string' ? tenant.location : '')
  ).trim();
  const cityValid = Boolean(
    city.length >= 2 && 
    city !== 'Dev'
  );

  const phone = (tenant.contactPhone || '').trim();
  const phoneValid = Boolean(
    phone.length >= 4 && 
    phone !== '555-0000' &&
    phone !== '0000'
  );

  return nameValid && addressValid && cityValid && phoneValid;
}
