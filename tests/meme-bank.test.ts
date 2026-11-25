import { describe, expect, it } from "vitest";
import {
  createDefaultMemeBankState,
  isSafeMemeImageUrl,
  pickNonRepeatingMeme,
  submitCommunityMeme,
  type CommunityMemeItem,
} from "@/lib/memes/meme-bank";

describe("Boite a Memes communautaire & rotation anti-repetition", () => {
  it("ne rejoue jamais deux fois de suite le meme visuel dans une categorie a >= 2 memes", () => {
    const bank = createDefaultMemeBankState();
    let prevId: string | null = null;

    for (let i = 0; i < 40; i += 1) {
      const picked = pickNonRepeatingMeme(bank.items, "coinche", prevId);
      expect(picked).not.toBeNull();
      if (prevId !== null) {
        expect(picked?.id).not.toBe(prevId);
      }
      prevId = picked?.id ?? null;
    }
  });

  it("ignore strictement les memes en attente de moderation admin", () => {
    const customItems: CommunityMemeItem[] = [
      {
        id: "m-approved",
        imageUrl: "/assets/media/meme-generale.jpg",
        caption: "Valide",
        authorName: "Angèle",
        category: "generale",
        status: "approved",
        isBuiltin: false,
        createdAt: "2026-11-25T20:00:00.000Z",
      },
      {
        id: "m-pending",
        imageUrl: "/assets/media/meme-capri-seum.jpg",
        caption: "En attente",
        authorName: "Chahe",
        category: "generale",
        status: "pending",
        isBuiltin: false,
        createdAt: "2026-11-25T20:01:00.000Z",
      },
    ];

    for (let i = 0; i < 10; i += 1) {
      const picked = pickNonRepeatingMeme(customItems, "generale", null);
      expect(picked?.id).toBe("m-approved");
    }
  });

  it("refuse strictement les URLs dangereuses (SVG XSS, javascript:, path traversal)", () => {
    expect(isSafeMemeImageUrl("/assets/media/meme-generale.jpg")).toBe(true);
    expect(isSafeMemeImageUrl("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
    expect(isSafeMemeImageUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isSafeMemeImageUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMemeImageUrl("/assets/../../etc/passwd")).toBe(false);
    expect(() =>
      submitCommunityMeme({
        imageUrl: "data:image/svg+xml;base64,PHN2Zz4=",
        caption: "XSS",
        authorName: "Test",
        category: "coinche",
      }),
    ).toThrow();
  });
});
