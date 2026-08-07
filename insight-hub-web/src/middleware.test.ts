import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "@/middleware";
import { VISITOR_COOKIE_NAME } from "@/lib/visitor";

function requestWithCookie(cookieValue?: string): NextRequest {
  const headers = new Headers();
  if (cookieValue) {
    headers.set("cookie", `${VISITOR_COOKIE_NAME}=${cookieValue}`);
  }
  return new NextRequest("https://example.test/dashboard", { headers });
}

describe("middleware (attribution de l'identifiant de session visiteur)", () => {
  it("attribue un nouvel identifiant quand le cookie est absent", () => {
    const response = middleware(requestWithCookie());

    const cookie = response.cookies.get(VISITOR_COOKIE_NAME);
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
  });

  it("rend le nouvel identifiant visible dans la requête transmise au rendu (même requête)", () => {
    const response = middleware(requestWithCookie());

    // La requête interne réécrite par NextResponse.next({ request }) doit déjà
    // porter le cookie, pour que la Server Component de cette même requête le
    // lise via cookies() sans attendre un second aller-retour — voir
    // design.md, Decision "Attribution : middleware Next.js".
    const forwardedCookie = response.headers.get("x-middleware-request-cookie");
    expect(forwardedCookie).toContain(VISITOR_COOKIE_NAME);
  });

  it("conserve un identifiant déjà présent, sans en générer un nouveau", () => {
    const response = middleware(requestWithCookie("existing-visitor-id"));

    // Aucun nouveau cookie posé sur la réponse : le navigateur garde celui
    // qu'il avait déjà envoyé.
    expect(response.cookies.get(VISITOR_COOKIE_NAME)).toBeUndefined();
  });
});
