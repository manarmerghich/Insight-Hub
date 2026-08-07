import { cookies } from "next/headers";

// Voir add-visitor-session-scoping (design.md) : identifiant de session
// anonyme, aucun compte, aucune donnée d'identification personnelle.
export const VISITOR_COOKIE_NAME = "ih_vid";
export const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 an

// Le cookie est posé par `middleware.ts` dès la toute première requête
// (avant tout rendu) — cette fonction ne devrait donc jamais être appelée
// sans cookie présent. Si ça arrive malgré tout (route non couverte par le
// matcher du middleware, appel depuis un contexte inattendu), on lève une
// erreur explicite plutôt que de laisser filtrer silencieusement des
// données non scopées : voir design.md, Decision "Scoping en lecture".
export async function getCurrentVisitorId(): Promise<string> {
  const store = await cookies();
  const visitorId = store.get(VISITOR_COOKIE_NAME)?.value;

  if (!visitorId) {
    throw new Error(
      `Cookie de session visiteur ("${VISITOR_COOKIE_NAME}") absent — le middleware aurait dû l'attribuer avant le rendu de cette page.`,
    );
  }

  return visitorId;
}
