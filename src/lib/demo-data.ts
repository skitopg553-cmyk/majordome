// DONNÉES FICTIVES — uniquement pour les sections pas encore codées (« coquilles »).
// Aucun backend, aucune table. Tout ce qui vient d'ici doit être affiché avec <DemoBanner phase={…} />.
// Quand une phase est codée, on supprime son bloc ici et on branche les vraies données.

export const DEMO_PHASE = { agenda: 2, finances: 4, forme: 5 } as const;

/** Date relative à aujourd'hui (heure du téléphone) : la démo reste crédible chaque jour. */
function at(dayOffset: number, h: number, m = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export type DemoEvent = { id: string; title: string; start: string; end: string; place?: string };

// Agenda — phase 2 (Google Calendar en lecture seule + RDV détectés dans les mails)
export function demoEvents(): DemoEvent[] {
  return [
    { id: "e1", title: "Dentiste — Dr Martin", start: at(0, 17, 30), end: at(0, 18, 0), place: "12 rue de Rivoli" },
    { id: "e2", title: "Point projet avec Léa", start: at(1, 10, 0), end: at(1, 11, 0), place: "Visio" },
    { id: "e3", title: "Déjeuner avec Thomas", start: at(1, 12, 30), end: at(1, 14, 0), place: "Le Comptoir" },
    { id: "e4", title: "Rendez-vous banque", start: at(2, 9, 30), end: at(2, 10, 0), place: "Agence Opéra" },
    { id: "e5", title: "Anniversaire de Sarah", start: at(4, 20, 0), end: at(4, 23, 0) },
  ];
}

// « À valider » — phase 2 : propositions détectées (mails, agenda) que Ruben accepte ou refuse.
// Rien n'est fait sans son accord.
export type DemoProposal = { id: string; kind: "agenda" | "mail" | "task"; title: string; detail: string };
export const DEMO_PROPOSALS: DemoProposal[] = [
  { id: "p1", kind: "agenda", title: "Ajouter le RDV coiffeur à ton agenda ?", detail: "Trouvé dans un mail · samedi 10 h" },
  { id: "p2", kind: "mail", title: "Répondre à Léa pour décaler le point ?", detail: "Elle propose jeudi 14 h" },
  { id: "p3", kind: "task", title: "Créer la tâche « Payer la facture EDF » ?", detail: "Échéance dans le mail : le 25" },
];

// Finances — phase 4 (import CSV + catégorisation)
export const DEMO_FINANCES = {
  balance: 2847.32,
  // Solde en fin de journée, 30 derniers jours (mini-courbe de l'Accueil)
  balanceHistory: [
    2512, 2498, 2530, 2521, 2560, 2548, 2575, 2602, 2590, 2621, 2655, 2640, 2668, 2690, 2684, 2712, 2705, 2733, 2758, 2749, 2771,
    2795, 2788, 2806, 2820, 2814, 2831, 2826, 2840, 2847,
  ],
  monthSpent: 1236.4,
  monthBudget: 1800,
  budgets: [
    { label: "Courses", spent: 312, limit: 400 },
    { label: "Restaurants", spent: 168, limit: 150 },
    { label: "Transport", spent: 64, limit: 90 },
    { label: "Loisirs", spent: 95, limit: 120 },
  ],
  // image_url : prévu dans le futur modèle de données des objectifs (image de fond de la carte).
  goals: [
    { label: "Voyage en Australie", saved: 1850, target: 4000, due: "Avril", image_url: "/objectif.jpg" as string | null },
    { label: "Épargne de précaution", saved: 5200, target: 6000, due: "Décembre", image_url: null as string | null },
  ],
  transactions: [
    { label: "Carrefour City", category: "Courses", amount: -23.4, when: "Aujourd'hui" },
    { label: "Navigo", category: "Transport", amount: -86.4, when: "Hier" },
    { label: "Salaire", category: "Revenu", amount: 2350, when: "Lundi" },
    { label: "Le Comptoir", category: "Restaurants", amount: -42, when: "Dimanche" },
  ],
};

// Forme — phase 5 (sommeil, pas, séances, discipline, temps d'écran)
export const DEMO_FORME = {
  sleep: { hours: 7.2, score: 82, bedtime: "23:40", week: [6.4, 7.1, 6.8, 7.6, 5.9, 8.2, 7.2] },
  steps: { count: 8432, goal: 10000 },
  workouts: { done: 3, goal: 4, last: "Course 5,2 km · mardi" },
  discipline: { score: 78, streak: 6 },
  screenTime: { today: "3 h 41", trend: "−12 % sur 7 jours" },
};
