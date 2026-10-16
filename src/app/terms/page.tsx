import type { Metadata } from "next";
import { H2, LegalPage, Mail, Ul } from "../legal";

export const metadata: Metadata = { title: "Conditions d'utilisation — majordome.", description: "Conditions d'utilisation de l'application personnelle majordome." };

export default function Terms() {
  return (
    <LegalPage title="Conditions d'utilisation" updated="16 octobre 2026">
      <H2>Une application personnelle</H2>
      <p>
        majordome. est une application <strong>personnelle et non commerciale</strong>, développée par Ruben pour son propre usage. Elle n&apos;est pas proposée au public : aucun abonnement, aucune
        vente, aucune publicité.
      </p>

      <H2>Accès réservé</H2>
      <p>
        L&apos;accès est <strong>réservé à son propriétaire</strong>, protégé par un code d&apos;accès personnel. Toute autre personne n&apos;a pas le droit de l&apos;utiliser ni d&apos;essayer d&apos;y
        accéder.
      </p>

      <H2>Fournie telle quelle</H2>
      <p>
        L&apos;application est fournie <strong>« telle quelle »</strong>, sans garantie d&apos;aucune sorte : elle peut contenir des erreurs, être indisponible ou changer à tout moment. Les réponses
        de l&apos;assistant et les calculs qu&apos;elle affiche sont indicatifs ; ils ne constituent ni un conseil financier, ni un conseil médical, et doivent être vérifiés avant toute décision
        importante.
      </p>

      <H2>Données bancaires : lecture seule</H2>
      <p>
        Lorsque l&apos;accès bancaire est activé, l&apos;application lit les données du propriétaire en <strong>lecture seule</strong> et ne déplace jamais d&apos;argent. Le traitement des données
        est détaillé dans la <a href="/privacy" className="text-accent underline underline-offset-2">politique de confidentialité</a>.
      </p>

      <H2>Responsabilité</H2>
      <Ul>
        <li>Son propriétaire reste seul responsable de l&apos;usage qu&apos;il en fait.</li>
        <li>L&apos;application dépend de services tiers (hébergement, base de données, banque, intelligence artificielle) dont elle ne maîtrise pas la disponibilité.</li>
      </Ul>

      <H2>Contact</H2>
      <p>
        Pour toute question : <Mail />
      </p>
    </LegalPage>
  );
}
