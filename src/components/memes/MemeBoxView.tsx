"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { inspectClientImageMagicBytes } from "@/components/admin/admin-demo-data";
import {
  MEME_CATEGORIES,
  submitCommunityMeme,
  type MemeCategory,
} from "@/lib/memes/meme-bank";
import { useMemeBankStore } from "@/lib/memes/use-meme-bank";
import {
  CheckIcon,
  MegaphoneIcon,
  ProjectorScreenIcon,
} from "@/components/icons/Icons";

function compressMemeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture image impossible."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Format non lisible."));
        return;
      }
      const raw = reader.result;
      const img = new Image();
      img.onerror = () => resolve(raw);
      img.onload = () => {
        const maxSide = 720;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxSide || h > maxSide) {
          if (w >= h) {
            h = Math.round((h * maxSide) / w);
            w = maxSide;
          } else {
            w = Math.round((w * maxSide) / h);
            h = maxSide;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx === null) {
          resolve(raw);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

function getCategoryLabel(cat: MemeCategory): string {
  for (const item of MEME_CATEGORIES) {
    if (item.id === cat) {
      return item.label;
    }
  }
  return cat;
}

export function MemeBoxView() {
  const { bank } = useMemeBankStore();
  const [filterCategory, setFilterCategory] = useState<MemeCategory | "all">(
    "all",
  );
  const [selectedCategory, setSelectedCategory] =
    useState<MemeCategory>("coinche");
  const [caption, setCaption] = useState<string>("");
  const [authorName, setAuthorName] = useState<string>("");
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const approvedMemes = useMemo(() => {
    return bank.items.filter((m) => {
      if (m.status !== "approved") {
        return false;
      }
      if (filterCategory === "all") {
        return true;
      }
      return m.category === filterCategory;
    });
  }, [bank.items, filterCategory]);

  const pendingCount = useMemo(
    () => bank.items.filter((m) => m.status === "pending").length,
    [bank.items],
  );

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }
    setUploadError(null);
    setUploadNotice(null);

    const check = await inspectClientImageMagicBytes(file);
    if (!check.valid) {
      setUploadError(check.reason ?? "Format image refusé (JPEG/PNG/WebP).");
      return;
    }

    try {
      const compressed = await compressMemeImage(file);
      setPreviewDataUrl(compressed);
    } catch {
      setUploadError("Impossible de charger cette image.");
    }
  }

  function handleSubmitMeme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    setUploadNotice(null);

    if (previewDataUrl === null) {
      setUploadError("Choisis d'abord une photo ou un meme.");
      return;
    }

    try {
      const res = submitCommunityMeme({
        imageUrl: previewDataUrl,
        caption,
        authorName,
        category: selectedCategory,
      });
      setPreviewDataUrl(null);
      setCaption("");
      if (res.item.status === "pending") {
        setUploadNotice(
          "Meme envoyé ! Il passera sur /live dès validation dans /admin.",
        );
      } else {
        setUploadNotice(
          "Meme ajouté en direct dans la rotation des pop-ups /live !",
        );
      }
    } catch (err) {
      let msg = "Erreur lors de l'enregistrement.";
      if (err instanceof Error) {
        msg = err.message;
      }
      setUploadError(msg);
    }
  }

  return (
    <div className="memes-shell">
      <header className="memes-hero">
        <div>
          <span className="eyebrow" style={{ color: "#e8a628" }}>
            <MegaphoneIcon size={13} />
            <span>Rotation aléatoire anti-répétition · /live</span>
          </span>
          <h1 className="memes-title">Boîte à Memes &amp; Photos</h1>
        </div>
        <div style={{ display: "inline-flex", gap: "8px", flexWrap: "wrap" }}>
          <Link href="/live" className="btn btn-sm btn-primary">
            <ProjectorScreenIcon size={15} />
            <span>Voir sur /live</span>
          </Link>
          {pendingCount > 0 && (
            <Link href="/admin" className="btn btn-sm btn-secondary">
              <span>{pendingCount} à valider (/admin)</span>
            </Link>
          )}
        </div>
      </header>

      <section className="card-ruled" aria-labelledby="upload-meme-heading">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "10px",
          }}
        >
          <h2 id="upload-meme-heading" className="section-title">
            Ajouter un meme ou une photo du BAR
          </h2>
          {bank.moderationRequired && (
            <span className="badge badge-neutral">
              Validation admin avant /live
            </span>
          )}
          {!bank.moderationRequired && (
            <span className="badge badge-pass">Diffusion directe sur /live</span>
          )}
        </div>

        <form className="memes-upload-grid" onSubmit={handleSubmitMeme} noValidate>
          <div className="memes-preview-box">
            {previewDataUrl === null && (
              <span style={{ fontSize: "12.5px", color: "#9a8c7e" }}>
                Aperçu 100 % non rogné
              </span>
            )}
            {previewDataUrl !== null && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewDataUrl}
                alt="Aperçu du meme"
                className="memes-preview-img"
              />
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label
              htmlFor="community-meme-file"
              className="btn btn-secondary btn-full"
              style={{ cursor: "pointer" }}
            >
              <span>Choisir une photo / un meme (JPEG, PNG, WebP)</span>
            </label>
            <input
              id="community-meme-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />

            <div>
              <label htmlFor="meme-category-select" className="field-label">
                Quand l&apos;afficher sur /live ?
              </label>
              <select
                id="meme-category-select"
                className="field-input"
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value as MemeCategory)
                }
              >
                {MEME_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              <input
                type="text"
                className="field-input"
                placeholder="Légende drôle..."
                maxLength={80}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
              <input
                type="text"
                className="field-input"
                placeholder="Ton prénom"
                maxLength={40}
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
              />
            </div>

            {uploadError !== null && (
              <div className="banner banner-fail">{uploadError}</div>
            )}
            {uploadNotice !== null && (
              <div className="banner banner-pass">
                <CheckIcon size={15} />
                <span>{uploadNotice}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-full">
              <span>Envoyer dans la banque</span>
            </button>
          </div>
        </form>
      </section>

      <div className="memes-filter-row" role="group" aria-label="Filtrer memes">
        <button
          type="button"
          className="pool-pill-btn"
          data-active={String(filterCategory === "all")}
          onClick={() => setFilterCategory("all")}
        >
          Tous ({bank.items.filter((m) => m.status === "approved").length})
        </button>
        {MEME_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="pool-pill-btn"
            data-active={String(filterCategory === cat.id)}
            onClick={() => setFilterCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <section className="memes-grid" aria-label="Galerie de memes validés">
        {approvedMemes.map((meme) => (
          <figure key={meme.id} className="meme-card">
            <div className="meme-card-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={meme.imageUrl}
                alt={meme.caption}
                className="meme-card-img"
              />
            </div>
            <figcaption className="meme-card-body">
              <span className="meme-card-caption">{meme.caption}</span>
              <div className="meme-card-meta">
                <span>Par {meme.authorName}</span>
                <span className="badge badge-neutral">
                  {getCategoryLabel(meme.category)}
                </span>
              </div>
            </figcaption>
          </figure>
        ))}
      </section>
    </div>
  );
}
