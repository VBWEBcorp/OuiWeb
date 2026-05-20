import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 60_000,
});

api.interceptors.request.use((cfg) => {
  try {
    const raw = localStorage.getItem("ouiweb.session");
    if (raw) {
      const s = JSON.parse(raw);
      const tenantId = s?.state?.tenantId;
      if (tenantId) cfg.headers.set("x-tenant-id", tenantId);
    }
  } catch { /* ignore */ }
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err?.response?.data?.error || err.message || "Unknown error";
    return Promise.reject(new Error(msg));
  }
);

export type ID = string;

export type LinkedInAccount = {
  _id: ID;
  slug: string;
  displayName: string;
  avatarColor: string;
  connected: boolean;
  linkedinUrn?: string;
};

export type Persona = {
  accountId: ID;
  persona: string;
  audience: string;
  tone: string;
  businessContext: string;
  goals: string;
  writingStyle: string;
  favoriteCTAs: string[];
  topics: string[];
};

export type PostStatus = "draft" | "scheduled" | "published" | "archived" | "failed";

export type Post = {
  _id: ID;
  accountId: ID;
  content: string;
  type: string;
  tone: string;
  status: PostStatus;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  linkedinPostId?: string | null;
  media: { kind: "image" | "video" | "link"; url: string; alt?: string }[];
  createdAt: string;
  updatedAt: string;
  error?: string | null;
};

export type AIGenerateInput = {
  accountId: ID;
  topic: string;
  tone: string;
  type: string;
  variants?: number;
  extra?: string;
};

export const Api = {
  accounts: () => api.get<LinkedInAccount[]>("/accounts").then((r) => r.data),
  persona: (accountId: ID) => api.get<Persona>(`/accounts/${accountId}/persona`).then((r) => r.data),
  updatePersona: (accountId: ID, p: Partial<Persona>) =>
    api.put<Persona>(`/accounts/${accountId}/persona`, p).then((r) => r.data),

  listPosts: (accountId: ID, status?: PostStatus | "all") =>
    api.get<Post[]>(`/posts`, { params: { accountId, status } }).then((r) => r.data),
  getPost: (id: ID) => api.get<Post>(`/posts/${id}`).then((r) => r.data),
  createPost: (data: Partial<Post>) => api.post<Post>(`/posts`, data).then((r) => r.data),
  updatePost: (id: ID, data: Partial<Post>) => api.put<Post>(`/posts/${id}`, data).then((r) => r.data),
  deletePost: (id: ID) => api.delete(`/posts/${id}`).then((r) => r.data),
  schedulePost: (id: ID, scheduledAt: string) =>
    api.post<Post>(`/posts/${id}/schedule`, { scheduledAt }).then((r) => r.data),
  publishNow: (id: ID) => api.post<Post>(`/posts/${id}/publish`).then((r) => r.data),

  aiGenerate: (input: AIGenerateInput) =>
    api.post<{ variants: string[]; usedFallback?: boolean }>("/ai/generate", input).then((r) => r.data),
  aiImprove: (text: string, accountId: ID, mode: string) =>
    api.post<{ text: string }>("/ai/improve", { text, accountId, mode }).then((r) => r.data),
  aiHashtags: (text: string) =>
    api.post<{ hashtags: string[] }>("/ai/hashtags", { text }).then((r) => r.data),
  aiHooks: (topic: string) =>
    api.post<{ hooks: string[] }>("/ai/hooks", { topic }).then((r) => r.data),

  linkedinAuthUrl: (accountId: ID) =>
    api.get<{ url: string; mock?: boolean }>("/linkedin/authorize", { params: { accountId } }).then((r) => r.data),
  linkedinStatus: () => api.get<{ mock: boolean }>("/linkedin/status").then((r) => r.data),
  linkedinDisconnect: (accountId: ID) =>
    api.delete(`/accounts/${accountId}/linkedin`).then((r) => r.data),

  storageStatus: () =>
    api.get<{ provider: "r2" | "local"; bucket?: string; publicUrl?: string }>(
      "/storage/status"
    ).then((r) => r.data),

  uploadMedia: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post<{ url: string; kind: "image" | "video" }>("/media/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },

  analytics: (accountId: ID) =>
    api.get<{
      total: number; drafts: number; scheduled: number; published: number;
      perDay: { date: string; count: number }[];
    }>(`/analytics`, { params: { accountId } }).then((r) => r.data),
};
