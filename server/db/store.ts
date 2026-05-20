/**
 * Storage adapter — uses MongoDB when MONGODB_URI is set, otherwise a JSON file.
 * Same async API in both cases. Keeps local dev frictionless.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mongoose from "mongoose";

const DATA_FILE = path.resolve(process.cwd(), "data", "db.json");

export type LinkedInAccountDoc = {
  _id: string;
  tenantId: "vbweb" | "ouibo";
  slug: string;
  displayName: string;
  avatarColor: string;
  connected: boolean;
  linkedinUrn?: string | null;
  accessTokenEnc?: string | null;
  refreshTokenEnc?: string | null;
  tokenExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PersonaDoc = {
  accountId: string;
  persona: string;
  audience: string;
  tone: string;
  businessContext: string;
  goals: string;
  writingStyle: string;
  favoriteCTAs: string[];
  topics: string[];
};

export type PostDoc = {
  _id: string;
  accountId: string;
  content: string;
  type: string;
  tone: string;
  status: "draft" | "scheduled" | "published" | "archived" | "failed";
  scheduledAt: string | null;
  publishedAt: string | null;
  linkedinPostId: string | null;
  media: { kind: "image" | "video" | "link"; url: string; alt?: string }[];
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AIHistoryDoc = {
  _id: string;
  accountId: string;
  kind: "generate" | "improve" | "hashtags" | "hooks";
  input: any;
  output: any;
  createdAt: string;
};

export type MediaAssetDoc = {
  _id: string;
  url: string;
  kind: "image" | "video";
  size: number;
  mime: string;
  createdAt: string;
};

type Schema = {
  accounts: LinkedInAccountDoc[];
  personas: PersonaDoc[];
  posts: PostDoc[];
  ai: AIHistoryDoc[];
  media: MediaAssetDoc[];
};

let memo: Schema | null = null;
let useMongo = false;
let mongoReady: Promise<void> | null = null;

const COLORS = ["#3463ff", "#ff5fa2", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4"];

function seed(): Schema {
  const now = new Date().toISOString();
  const accounts: LinkedInAccountDoc[] = [
    {
      _id: cuid(), tenantId: "vbweb",
      slug: "victor-beasse", displayName: "Victor Béasse",
      avatarColor: "#0066CC", connected: false, createdAt: now, updatedAt: now,
    },
    {
      _id: cuid(), tenantId: "ouibo",
      slug: "yannick-beasse", displayName: "Yannick Béasse",
      avatarColor: "#7b2cbf", connected: false, createdAt: now, updatedAt: now,
    },
  ];
  const personas: PersonaDoc[] = [
    {
      accountId: accounts[0]._id,
      persona: "Fondateur de VBweb, agence digitale orientée résultats. Transparent, opinionated.",
      audience: "Dirigeants PME, founders SaaS, head of growth.",
      tone: "professional",
      businessContext: "VBweb — agence digitale (vbweb.fr). Création de sites premium, growth LinkedIn, SaaS B2B.",
      goals: "Générer des leads inbound via LinkedIn, asseoir l'autorité sur le growth digital.",
      writingStyle: "Phrases courtes, hooks forts, listes claires, exemples concrets.",
      favoriteCTAs: ["Écris-moi 'GROWTH' en MP.", "Commente si tu veux le doc."],
      topics: ["Growth", "SaaS B2B", "LinkedIn", "Design système", "Sites premium"],
    },
    {
      accountId: accounts[1]._id,
      persona: "Fondateur de OUIBO, studio créatif. Curieux, sensible à l'esthétique, orienté impact.",
      audience: "Marques DTC, fondateurs early-stage, équipes brand & marketing.",
      tone: "personal",
      businessContext: "OUIBO — studio créatif (ouibo.fr). Direction artistique, identité de marque, growth créatif.",
      goals: "Attirer des clients premium pour des projets brand & growth, construire une signature créative.",
      writingStyle: "Phrases qui respirent, métaphores visuelles, opinions assumées.",
      favoriteCTAs: ["MP 'BRAND' pour voir le case study.", "Dis-moi en commentaire ce que tu en penses."],
      topics: ["Brand", "Direction artistique", "DTC", "Growth créatif", "Storytelling"],
    },
  ];
  return { accounts, personas, posts: [], ai: [], media: [] };
}

function cuid(): string {
  return crypto.randomBytes(12).toString("hex");
}

/* ─── File store ─── */
function load(): Schema {
  if (memo) return memo;
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      memo = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } else {
      memo = seed();
      save();
    }
  } catch {
    memo = seed();
  }
  return memo!;
}
function save() {
  if (!memo) return;
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(memo, null, 2));
}

/* ─── Mongoose models (lazy) ─── */
const accountSchema = new mongoose.Schema<LinkedInAccountDoc>({
  _id: String, tenantId: { type: String, index: true },
  slug: String, displayName: String, avatarColor: String,
  connected: Boolean, linkedinUrn: String,
  accessTokenEnc: String, refreshTokenEnc: String, tokenExpiresAt: String,
  createdAt: String, updatedAt: String,
}, { _id: false });

const personaSchema = new mongoose.Schema<PersonaDoc>({
  accountId: { type: String, index: true },
  persona: String, audience: String, tone: String, businessContext: String,
  goals: String, writingStyle: String,
  favoriteCTAs: [String], topics: [String],
});

const postSchema = new mongoose.Schema<PostDoc>({
  _id: String, accountId: { type: String, index: true },
  content: String, type: String, tone: String, status: String,
  scheduledAt: String, publishedAt: String, linkedinPostId: String,
  media: [{ kind: String, url: String, alt: String }],
  error: String, createdAt: String, updatedAt: String,
}, { _id: false });

const aiSchema = new mongoose.Schema<AIHistoryDoc>({
  _id: String, accountId: { type: String, index: true },
  kind: String, input: Object, output: Object, createdAt: String,
}, { _id: false });

const mediaSchema = new mongoose.Schema<MediaAssetDoc>({
  _id: String, url: String, kind: String, size: Number, mime: String, createdAt: String,
}, { _id: false });

function models() {
  return {
    Account: mongoose.models.LinkedInAccount || mongoose.model("LinkedInAccount", accountSchema),
    Persona: mongoose.models.Persona || mongoose.model("Persona", personaSchema),
    Post:    mongoose.models.Post    || mongoose.model("Post", postSchema),
    AI:      mongoose.models.AIHistory || mongoose.model("AIHistory", aiSchema),
    Media:   mongoose.models.MediaAsset || mongoose.model("MediaAsset", mediaSchema),
  };
}

export async function connect(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) { useMongo = false; load(); return; }
  if (mongoReady) return mongoReady;
  mongoReady = (async () => {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      useMongo = true;
      const { Account, Persona } = models();
      const count = await Account.countDocuments();
      if (count === 0) {
        const s = seed();
        await Account.insertMany(s.accounts);
        await Persona.insertMany(s.personas);
      }
      console.log("[db] ✓ MongoDB Atlas connecté");
    } catch (e: any) {
      console.warn("[db] ⚠ MongoDB indisponible (" + e.message + ")");
      console.warn("[db]   → fallback sur le store fichier data/db.json");
      useMongo = false;
      load();
    }
  })();
  return mongoReady;
}

/* ─── Public API ─── */
export const db = {
  newId: cuid,

  async accounts(tenantId?: string): Promise<LinkedInAccountDoc[]> {
    if (useMongo) {
      const q = tenantId ? { tenantId } : {};
      return (await models().Account.find(q).lean()) as any;
    }
    const all = load().accounts;
    return tenantId ? all.filter((a) => a.tenantId === tenantId) : all;
  },
  async account(id: string) {
    if (useMongo) return (await models().Account.findById(id).lean()) as any;
    return load().accounts.find((a) => a._id === id) || null;
  },
  async updateAccount(id: string, patch: Partial<LinkedInAccountDoc>) {
    patch.updatedAt = new Date().toISOString();
    if (useMongo) {
      await models().Account.updateOne({ _id: id }, { $set: patch });
      return (await models().Account.findById(id).lean()) as any;
    }
    const s = load();
    const a = s.accounts.find((x) => x._id === id);
    if (!a) return null;
    Object.assign(a, patch);
    save();
    return a;
  },

  async persona(accountId: string) {
    if (useMongo) {
      const p = await models().Persona.findOne({ accountId }).lean();
      return p as any;
    }
    return load().personas.find((p) => p.accountId === accountId) || null;
  },
  async upsertPersona(accountId: string, patch: Partial<PersonaDoc>) {
    if (useMongo) {
      await models().Persona.updateOne({ accountId }, { $set: { accountId, ...patch } }, { upsert: true });
      return (await models().Persona.findOne({ accountId }).lean()) as any;
    }
    const s = load();
    let p = s.personas.find((x) => x.accountId === accountId);
    if (!p) {
      p = { accountId, persona: "", audience: "", tone: "professional",
            businessContext: "", goals: "", writingStyle: "",
            favoriteCTAs: [], topics: [] };
      s.personas.push(p);
    }
    Object.assign(p, patch);
    save();
    return p;
  },

  async posts(accountId: string, status?: string): Promise<PostDoc[]> {
    if (useMongo) {
      const q: any = { accountId };
      if (status && status !== "all") q.status = status;
      return (await models().Post.find(q).sort({ updatedAt: -1 }).lean()) as any;
    }
    const s = load();
    let list = s.posts.filter((p) => p.accountId === accountId);
    if (status && status !== "all") list = list.filter((p) => p.status === status);
    return list.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1));
  },
  async post(id: string) {
    if (useMongo) return (await models().Post.findById(id).lean()) as any;
    return load().posts.find((p) => p._id === id) || null;
  },
  async createPost(p: Omit<PostDoc, "_id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const doc: PostDoc = { _id: cuid(), createdAt: now, updatedAt: now, ...p };
    if (useMongo) await models().Post.create(doc);
    else { load().posts.push(doc); save(); }
    return doc;
  },
  async updatePost(id: string, patch: Partial<PostDoc>) {
    patch.updatedAt = new Date().toISOString();
    if (useMongo) {
      await models().Post.updateOne({ _id: id }, { $set: patch });
      return (await models().Post.findById(id).lean()) as any;
    }
    const s = load();
    const p = s.posts.find((x) => x._id === id);
    if (!p) return null;
    Object.assign(p, patch);
    save();
    return p;
  },
  async deletePost(id: string) {
    if (useMongo) { await models().Post.deleteOne({ _id: id }); return; }
    const s = load();
    s.posts = s.posts.filter((p) => p._id !== id);
    save();
  },

  async dueScheduled(now = new Date()) {
    if (useMongo) {
      return (await models().Post.find({
        status: "scheduled",
        scheduledAt: { $lte: now.toISOString() },
      }).lean()) as any;
    }
    return load().posts.filter(
      (p) => p.status === "scheduled" && p.scheduledAt && new Date(p.scheduledAt) <= now
    );
  },

  async addAI(entry: Omit<AIHistoryDoc, "_id" | "createdAt">) {
    const doc: AIHistoryDoc = { _id: cuid(), createdAt: new Date().toISOString(), ...entry };
    if (useMongo) await models().AI.create(doc);
    else { load().ai.push(doc); save(); }
    return doc;
  },

  async addMedia(m: Omit<MediaAssetDoc, "_id" | "createdAt">) {
    const doc: MediaAssetDoc = { _id: cuid(), createdAt: new Date().toISOString(), ...m };
    if (useMongo) await models().Media.create(doc);
    else { load().media.push(doc); save(); }
    return doc;
  },
};
