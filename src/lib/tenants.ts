export type TenantId = "vbweb" | "ouibo";

export type Tenant = {
  id: TenantId;
  name: string;
  tagline: string;
  logo: string;
  website: string;
  primary: string;
  primarySoft: string;
  /** Optional secondary accent (gradients, sparkles) */
  accent: string;
  accountSlugs: string[];
};

export const TENANTS: Record<TenantId, Tenant> = {
  vbweb: {
    id: "vbweb",
    name: "VBweb",
    tagline: "Agence digitale · LinkedIn growth & SaaS",
    logo: "https://i.ibb.co/C3ZJ3z59/VBWEB-LOGO-BLEU-BLANC.png",
    website: "https://vbweb.fr",
    primary: "#0066CC",
    primarySoft: "rgba(0,102,204,0.18)",
    accent: "#3b9dff",
    accountSlugs: ["victor-beasse"],
  },
  ouibo: {
    id: "ouibo",
    name: "OUIBO",
    tagline: "Studio créatif · Brand & growth",
    logo: "https://ouibo.fr/logo_ouibo-removebg-preview.png",
    website: "https://ouibo.fr",
    primary: "#7b2cbf",
    primarySoft: "rgba(123,44,191,0.18)",
    accent: "#ff6b9d",
    accountSlugs: ["yannick-beasse"],
  },
};

export const TENANT_LIST = Object.values(TENANTS);
