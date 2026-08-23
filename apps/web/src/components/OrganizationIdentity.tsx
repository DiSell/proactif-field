import { useEffect, useState } from "react";
import { useOrganization } from "../api/hooks";
import { apiFetchBlob } from "../api/client";

export default function OrganizationIdentity() {
  const { data: organization } = useOrganization(); const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => { if (!organization?.logoUrl) { setLogo(null); return; } let active = true; let url = ""; apiFetchBlob(organization.logoUrl).then((blob) => { url = URL.createObjectURL(blob); if (active) setLogo(url); }).catch(() => undefined); return () => { active = false; if (url) URL.revokeObjectURL(url); }; }, [organization?.logoUrl, organization?.updatedAt]);
  if (!organization) return null;
  return <div className="organization-identity">{logo ? <img src={logo} alt="" /> : <span>{organization.name.charAt(0).toUpperCase()}</span>}<strong>{organization.name}</strong></div>;
}
