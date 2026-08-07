import { NextResponse, type NextRequest } from "next/server";

import { VISITOR_COOKIE_MAX_AGE_SECONDS, VISITOR_COOKIE_NAME } from "@/lib/visitor";

// Attribue un identifiant de session anonyme dès la première requête d'un
// visiteur, avant le rendu de toute page — voir add-visitor-session-scoping,
// design.md, Decision "Attribution : middleware Next.js". Point d'attention :
// on mute `request.cookies` (pas seulement `response.cookies`) et on repasse
// `request` à `NextResponse.next({ request })`, pour que la Server Component
// rendue par CETTE même requête voie déjà le cookie — sans ça, un tout
// nouveau visiteur verrait un dashboard vide au premier chargement puis
// "débloqué" seulement après un reload, `getCurrentVisitorId()` n'ayant rien
// à lire tant que seule la réponse porte le cookie.
export function middleware(request: NextRequest): NextResponse {
  if (request.cookies.get(VISITOR_COOKIE_NAME)) {
    return NextResponse.next();
  }

  const visitorId = crypto.randomUUID();
  request.cookies.set(VISITOR_COOKIE_NAME, visitorId);

  const response = NextResponse.next({ request });
  response.cookies.set(VISITOR_COOKIE_NAME, visitorId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return response;
}

export const config = {
  // Exclut les assets statiques et l'optimiseur d'image — inutile de leur
  // attribuer un cookie de session, et évite un aller-retour de plus par
  // ressource statique.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
