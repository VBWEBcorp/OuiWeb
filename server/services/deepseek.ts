import axios from "axios";
import { db, PersonaDoc } from "../db/store";

const TONE_LABELS: Record<string, string> = {
  professional: "professionnel et crédible",
  educational: "éducatif et pédagogique",
  storytelling: "storytelling personnel et immersif",
  startup: "startup, énergique, geek",
  marketing: "marketing direct et orienté conversion",
  clickbait: "putaclic, hooks ultra-forts, controverse mesurée",
  viral: "viral, format LinkedIn 'banger', hooks puissants, format hyper-scannable",
  personal: "personnel et authentique",
};

const TYPE_LABELS: Record<string, string> = {
  storytelling: "storytelling personnel avec arc narratif clair",
  carousel: "carrousel : suite de slides numérotées, chaque slide = une idée forte",
  thread: "thread LinkedIn : 5-9 paragraphes courts, chacun apportant une idée nouvelle",
  experience: "retour d'expérience concret avec leçons claires",
  tutorial: "tutoriel actionnable, étape par étape",
  opinion: "tribune d'opinion assumée et argumentée",
  casestudy: "étude de cas chiffrée avec contexte, action, résultat",
  launch: "lancement produit avec promesse, bénéfices, CTA",
};

export async function callDeepseek(messages: { role: string; content: string }[], opts: { temperature?: number } = {}) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY manquante");
  const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const r = await axios.post(
    `${base}/chat/completions`,
    { model, messages, temperature: opts.temperature ?? 0.85 },
    { headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, timeout: 60_000 }
  );
  return r.data.choices?.[0]?.message?.content as string;
}

function buildSystem(persona: PersonaDoc | null) {
  if (!persona) return "Tu es un expert LinkedIn growth pour un compte personnel.";
  return [
    "Tu es un copywriter LinkedIn premium. Tu rédiges des posts pour le compte suivant :",
    `- Persona : ${persona.persona}`,
    `- Audience cible : ${persona.audience}`,
    `- Contexte business : ${persona.businessContext}`,
    `- Objectifs : ${persona.goals}`,
    `- Style rédactionnel : ${persona.writingStyle}`,
    `- Sujets favoris : ${(persona.topics || []).join(", ")}`,
    `- CTA possibles : ${(persona.favoriteCTAs || []).join(" | ")}`,
    "",
    "Règles :",
    "- Hook puissant dans les 2 premières lignes (avant le 'voir plus').",
    "- Phrases courtes. Aération. Pas de jargon corporate.",
    "- Pas de hashtags dans le corps. Hashtags à la fin uniquement si pertinents (max 5).",
    "- Pas d'emojis sauf si le ton le justifie clairement.",
    "- Ne mets jamais de Markdown : ce sont des posts LinkedIn natifs.",
  ].join("\n");
}

export async function generateVariants(input: {
  accountId: string; topic: string; tone: string; type: string; variants?: number; extra?: string;
}) {
  const persona = await db.persona(input.accountId);
  const sys = buildSystem(persona);
  const count = Math.min(Math.max(input.variants || 3, 1), 5);
  const user = [
    `Génère ${count} variantes d'un post LinkedIn.`,
    `Sujet : ${input.topic}`,
    `Ton : ${TONE_LABELS[input.tone] || input.tone}`,
    `Type : ${TYPE_LABELS[input.type] || input.type}`,
    input.extra ? `Contexte additionnel : ${input.extra}` : "",
    "",
    "Format de sortie STRICT :",
    "Sépare chaque variante par la ligne exacte : ===VARIANT===",
    "Ne numérote pas les variantes. Ne mets aucun texte explicatif autour.",
  ].filter(Boolean).join("\n");

  try {
    const raw = await callDeepseek([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    const variants = raw.split(/===VARIANT===/g).map((s) => s.trim()).filter(Boolean).slice(0, count);
    await db.addAI({ accountId: input.accountId, kind: "generate", input, output: variants });
    return { variants, usedFallback: false };
  } catch (e) {
    const variants = mockVariants(input, persona, count);
    await db.addAI({ accountId: input.accountId, kind: "generate", input, output: { variants, fallback: true } });
    return { variants, usedFallback: true };
  }
}

export async function improveText(text: string, accountId: string, mode: string) {
  const persona = await db.persona(accountId);
  const sys = buildSystem(persona);
  const directives: Record<string, string> = {
    rewrite: "Réécris ce post LinkedIn en gardant l'idée, mais avec un meilleur hook et un meilleur rythme.",
    punchier: "Rends ce post plus punchy : hooks plus forts, phrases plus courtes, fin plus mémorable.",
    shorter: "Raccourcis ce post à 60% de sa longueur sans perdre l'idée centrale.",
    longer: "Allonge ce post avec un exemple concret + une statistique crédible (sans inventer de chiffres précis).",
  };
  const user = `${directives[mode] || directives.rewrite}\n\nPost actuel :\n"""${text}"""\n\nRenvoie UNIQUEMENT le nouveau post.`;
  try {
    const out = (await callDeepseek([
      { role: "system", content: sys },
      { role: "user", content: user },
    ])).trim();
    return { text: out };
  } catch {
    return { text: text + "\n\n(✨ amélioration IA indisponible — clé DeepSeek manquante)" };
  }
}

export async function hashtags(text: string) {
  try {
    const out = await callDeepseek([
      { role: "system", content: "Tu génères des hashtags LinkedIn pertinents." },
      { role: "user", content: `Donne 5 hashtags LinkedIn pour ce post, séparés par des espaces, sans dièse :\n${text}` },
    ], { temperature: 0.4 });
    return { hashtags: out.split(/\s+/).map((s) => s.replace(/[^\w]/g, "")).filter(Boolean).slice(0, 5) };
  } catch {
    return { hashtags: ["growth", "linkedin", "saas", "founder", "marketing"] };
  }
}

export async function hooks(topic: string) {
  try {
    const out = await callDeepseek([
      { role: "system", content: "Tu génères des hooks LinkedIn ultra-percutants." },
      { role: "user", content: `Donne 5 hooks (max 12 mots chacun) pour un post LinkedIn sur : ${topic}. Un par ligne, sans numérotation.` },
    ]);
    return { hooks: out.split("\n").map((s) => s.replace(/^[-•\d\.\)\s]+/, "").trim()).filter(Boolean).slice(0, 5) };
  } catch {
    return { hooks: [
      `J'ai longtemps cru que ${topic} était une question de chance.`,
      `Personne ne te dira ça sur ${topic}.`,
      `${topic} : la leçon que j'aurais aimé apprendre plus tôt.`,
      `Voici ce que j'ai testé sur ${topic} pendant 6 mois.`,
      `${topic} en 3 erreurs (et comment je les ai corrigées).`,
    ]};
  }
}

function mockVariants(input: any, persona: PersonaDoc | null, count: number): string[] {
  const hook = `J'ai passé 6 mois à explorer ${input.topic}.`;
  const body = persona
    ? `Voici 3 leçons utiles pour ${persona.audience || "des founders"} :\n\n1) Le hook compte plus que le contenu.\n2) Le format suit le canal, pas l'inverse.\n3) Tester > prédire.`
    : "Trois leçons que j'aurais aimé apprendre plus tôt.";
  const cta = persona?.favoriteCTAs?.[0] || "Commente si tu veux le doc.";
  const base = `${hook}\n\n${body}\n\n${cta}`;
  return Array.from({ length: count }, (_, i) =>
    base.replace(hook, hook + (i ? ` (v${i + 1})` : ""))
  );
}
