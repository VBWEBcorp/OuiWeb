export const TONES = [
  { id: "professional", label: "Professionnel", emoji: "🎯" },
  { id: "educational", label: "Éducatif", emoji: "📚" },
  { id: "storytelling", label: "Storytelling", emoji: "📖" },
  { id: "startup", label: "Startup", emoji: "🚀" },
  { id: "marketing", label: "Marketing", emoji: "📈" },
  { id: "clickbait", label: "Putaclic", emoji: "🔥" },
  { id: "viral", label: "Viral", emoji: "💥" },
  { id: "personal", label: "Personnel", emoji: "💬" },
] as const;

export const POST_TYPES = [
  { id: "storytelling", label: "Storytelling" },
  { id: "carousel", label: "Carrousel" },
  { id: "thread", label: "Thread LinkedIn" },
  { id: "experience", label: "Retour d'expérience" },
  { id: "tutorial", label: "Tutoriel" },
  { id: "opinion", label: "Opinion" },
  { id: "casestudy", label: "Étude de cas" },
  { id: "launch", label: "Lancement produit" },
] as const;

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:     { label: "Brouillon", color: "bg-zinc-500/15 text-zinc-300 border-zinc-500/20" },
  scheduled: { label: "Programmé", color: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
  published: { label: "Publié",    color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
  archived:  { label: "Archivé",   color: "bg-zinc-700/30 text-zinc-400 border-zinc-700/40" },
  failed:    { label: "Échec",     color: "bg-rose-500/10 text-rose-300 border-rose-500/20" },
};
