// Réglages de la connexion bancaire (Enable Banking). Aucun secret ici : l'App ID et la clé privée restent dans les variables d'environnement.

/**
 * ⚠️ À REMPLIR / VÉRIFIER : l'URL de redirection DOIT être identique, au caractère près (https, « / » final, chemin),
 * à celle enregistrée dans le tableau de bord Enable Banking. Sinon la banque refuse la connexion.
 * Valeur actuelle = l'URL par défaut déduite du domaine de l'app (non confirmée par Ruben) : c'est la route /api/bank/callback de ce projet.
 * Si ton URL enregistrée est différente, change UNIQUEMENT cette ligne (et, si le chemin diffère, déplace la route src/app/api/bank/callback).
 */
export const BANK_REDIRECT_URL = "https://majordome-bice.vercel.app/api/bank/callback";

export const BANK_COUNTRY = "FR";
export const CONSENT_DAYS = 90; // durée de l'accord de lecture demandé (PSD2 : 90 jours maximum, puis il faut reconnecter)
export const EXPIRY_WARNING_DAYS = 14; // l'app prévient quand il reste moins de 14 jours
export const FIRST_SYNC_DAYS = 90; // première synchro : on remonte 90 jours en arrière
export const RESYNC_OVERLAP_DAYS = 7; // synchros suivantes : on repart 7 jours avant la dernière (rattrape les opérations tardives ; les doublons sont écartés)
