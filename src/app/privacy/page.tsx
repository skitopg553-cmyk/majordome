import type { Metadata } from "next";
import { H2, LegalPage, Mail, Ul } from "../legal";

export const metadata: Metadata = { title: "Politique de confidentialité — majordome.", description: "Comment majordome. traite les données de son propriétaire." };

export default function Privacy() {
  return (
    <LegalPage title="Politique de confidentialité" updated="16 octobre 2026">
      <p>
        majordome. est une application personnelle, créée et utilisée par une seule personne : son propriétaire, Ruben. Ce n&apos;est pas un service ouvert au public et personne d&apos;autre n&apos;a de
        compte. Cette page explique simplement ce que l&apos;application fait des données.
      </p>

      <H2>Quelles données</H2>
      <Ul>
        <li>Les tâches, notes et informations que son propriétaire écrit ou dicte à l&apos;application.</li>
        <li>Les données de santé qu&apos;il saisit lui-même : séances de sport, nuits de sommeil, pas.</li>
        <li>
          Ses données bancaires, en <strong>lecture seule</strong> : comptes, soldes et opérations, récupérés via le service d&apos;agrégation bancaire <strong>Enable Banking</strong>, ou importés
          depuis un relevé.
        </li>
      </Ul>

      <H2>Lecture seule : aucun mouvement d&apos;argent</H2>
      <p>
        L&apos;application ne fait que <strong>lire</strong> les données bancaires. Elle ne déplace jamais d&apos;argent : elle ne fait aucun virement, aucun paiement et n&apos;initie aucune
        opération sur les comptes.
      </p>

      <H2>Où sont-elles stockées</H2>
      <p>
        Dans la base de données <strong>Supabase</strong> du propriétaire (hébergée en Europe, à Paris), protégée par des clés secrètes et un code d&apos;accès personnel. L&apos;application est hébergée
        sur Vercel.
      </p>

      <H2>Avec qui elles sont partagées</H2>
      <p>
        <strong>Avec personne.</strong> Elles ne sont ni vendues, ni louées, ni utilisées pour de la publicité. Seuls interviennent les services techniques nécessaires au fonctionnement, qui traitent
        les données pour le compte du propriétaire et uniquement pour cela :
      </p>
      <Ul>
        <li>Supabase (stockage) et Vercel (hébergement) ;</li>
        <li>Enable Banking (accès en lecture seule aux données bancaires, avec l&apos;accord de la banque et du propriétaire) ;</li>
        <li>
          le fournisseur d&apos;intelligence artificielle de l&apos;application (OpenAI ou Anthropic), à qui sont transmis les messages de la conversation et un résumé des informations utiles pour y
          répondre (par exemple des tâches ou des montants), afin de produire la réponse.
        </li>
      </Ul>

      <H2>Durée de conservation et suppression</H2>
      <p>
        Les données sont conservées tant que le propriétaire utilise l&apos;application. Il peut à tout moment supprimer des données depuis l&apos;application ou directement dans sa base, et retirer
        l&apos;accès bancaire en révoquant le consentement auprès de sa banque ou d&apos;Enable Banking.
      </p>

      <H2>Cookies et suivi</H2>
      <p>Aucun outil de suivi, aucune publicité, aucun cookie de mesure d&apos;audience. L&apos;application garde seulement sur l&apos;appareil son code d&apos;accès et quelques préférences.</p>

      <H2>Contact</H2>
      <p>
        Pour toute question : <Mail />
      </p>
    </LegalPage>
  );
}
