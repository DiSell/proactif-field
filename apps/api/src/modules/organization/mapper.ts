import { Organization } from "@prisma/client";
import { OrganizationDTO } from "@proactif-field/shared";

export function toOrganizationDTO(organization: Organization): OrganizationDTO {
  const preferences = organization.notificationPreferences;
  return { id: organization.id, name: organization.name, legalName: organization.legalName, logoUrl: organization.logoPath ? "/api/organization/logo" : null, address: organization.address, postalCode: organization.postalCode, city: organization.city, country: organization.country, phone: organization.phone, contactEmail: organization.contactEmail, notificationEmail: organization.notificationEmail, responsibleName: organization.responsibleName, website: organization.website, timezone: organization.timezone, locale: organization.locale, notificationPreferences: preferences && typeof preferences === "object" && !Array.isArray(preferences) ? preferences as Record<string, boolean> : {}, createdAt: organization.createdAt.toISOString(), updatedAt: organization.updatedAt.toISOString() };
}
