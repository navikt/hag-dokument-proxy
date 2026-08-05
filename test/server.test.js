import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/server.js";

describe("server", () => {
  it("redirects dev URL to production URL", async () => {
    const res = await request(app)
      .get("/dokument/sykmelding/ab8e7e6a-8649-4da2-b060-4181d156160b.pdf")
      .set("host", "arbeidsgiver.ekstern.dev.nav.no");

    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(
      "https://arbeidsgiver.nav.no/dokument/sykmelding/ab8e7e6a-8649-4da2-b060-4181d156160b.pdf",
    );
  });
});
