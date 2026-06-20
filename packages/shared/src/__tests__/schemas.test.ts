import { describe, expect, it } from "vitest";
import {
  registerSchema,
  loginSchema,
  createProjectSchema,
  clipGenerationConfigSchema,
  createSocialProfileSchema,
} from "../schemas.js";

describe("registerSchema", () => {
  it("accetta una registrazione valida", () => {
    const result = registerSchema.safeParse({
      email: "rebecca@example.com",
      password: "password123",
      name: "Rebecca",
    });
    expect(result.success).toBe(true);
  });

  it("rifiuta una password troppo corta", () => {
    const result = registerSchema.safeParse({
      email: "rebecca@example.com",
      password: "1234567", // 7 caratteri, minimo richiesto 8
      name: "Rebecca",
    });
    expect(result.success).toBe(false);
  });

  it("rifiuta un'email malformata", () => {
    const result = registerSchema.safeParse({
      email: "non-è-una-email",
      password: "password123",
      name: "Rebecca",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("rifiuta una password vuota", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("createProjectSchema", () => {
  it("applica il default CREATOR quando contentType non è specificato", () => {
    const result = createProjectSchema.parse({ title: "Il mio progetto" });
    expect(result.contentType).toBe("CREATOR");
  });

  it("rifiuta un titolo vuoto", () => {
    expect(createProjectSchema.safeParse({ title: "" }).success).toBe(false);
  });
});

describe("clipGenerationConfigSchema", () => {
  it("applica i default documentati quando non specificato altro", () => {
    const result = clipGenerationConfigSchema.parse({});
    expect(result).toMatchObject({
      mode: "AUTO",
      minClipDurationSeconds: 15,
      maxClipDurationSeconds: 90,
      formats: ["VERTICAL_9_16"],
    });
  });

  it("rifiuta una durata minima maggiore della durata massima", () => {
    const result = clipGenerationConfigSchema.safeParse({
      minClipDurationSeconds: 100,
      maxClipDurationSeconds: 50,
    });
    expect(result.success).toBe(false);
  });

  it("accetta una combinazione valida di durate personalizzate", () => {
    const result = clipGenerationConfigSchema.safeParse({
      minClipDurationSeconds: 20,
      maxClipDurationSeconds: 60,
    });
    expect(result.success).toBe(true);
  });
});

describe("createSocialProfileSchema", () => {
  it("rifiuta una piattaforma non valida", () => {
    const result = createSocialProfileSchema.safeParse({
      type: "OWN",
      platform: "SNAPCHAT", // non è nell'enum supportato
      handle: "@rebecca",
    });
    expect(result.success).toBe(false);
  });

  it("applica il default MANUAL per connectedVia", () => {
    const result = createSocialProfileSchema.parse({
      type: "OWN",
      platform: "TIKTOK",
      handle: "@rebecca",
    });
    expect(result.connectedVia).toBe("MANUAL");
  });
});
