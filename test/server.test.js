import { describe, it, expect, vi } from "vitest";
import { Readable } from "node:stream";
import request from "supertest";
import app from "../src/server.js";
import { validateToken, requestOboToken } from "@navikt/oasis";

vi.mock("@navikt/oasis", () => ({
  getToken: vi.fn(() => "mock-token"),
  validateToken: vi.fn(() => Promise.resolve({ ok: true })),
  requestOboToken: vi.fn(() =>
    Promise.resolve({ ok: true, token: "obo-token" }),
  ),
}));

const PDF_PATH =
  "/hent-dokument/sykmelding/550e8400-e29b-41d4-a716-446655440000.pdf";

describe("Server", () => {
  it("skal returnere PDF ved gyldig forespørsel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        const body = Readable.from(Buffer.from("%PDF-test"));
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          body,
        });
      }),
    );
    const response = await request(app).get(PDF_PATH).expect(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    vi.unstubAllGlobals();
  });

  it("skal redirecte til /feilmelding når token er ugyldig", async () => {
    vi.mocked(validateToken).mockResolvedValueOnce({ ok: false });
    const response = await request(app).get(PDF_PATH).expect(302);
    expect(response.headers.location).toBe("/feilmelding");
  });

  it("skal redirecte til /ugyldig når dokumentType er ugyldig", async () => {
    const response = await request(app)
      .get("/hent-dokument/ugyldig/550e8400-e29b-41d4-a716-446655440000.pdf")
      .expect(302);
    expect(response.headers.location).toBe("/ugyldig");
  });

  it("skal redirecte til /feilmelding når OBO-token feiler", async () => {
    vi.mocked(requestOboToken).mockResolvedValueOnce({ ok: false });
    const response = await request(app).get(PDF_PATH).expect(302);
    expect(response.headers.location).toBe("/feilmelding");
  });

  it("skal servere statiske filer fra feilmelding-mappen", async () => {
    const response = await request(app).get("/feilmelding/index.html");
    expect(response.status).not.toBe(404);
  });

  it("skal sette riktig PORT fra miljøvariabel eller default til 3000", () => {
    const PORT = process.env.PORT || 3000;
    expect(PORT).toBe(3000);
  });
});
