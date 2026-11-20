"use client";
import { useRef, useState } from "react";
import { ImagePlus, Images, Loader2, Search, X } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { compressImage, dataUrlKb, IMAGE_ACCEPT, isAssetUrl, resolveAssets } from "@/lib/assets/assets";
import { importStock, searchStock, SOURCE_LABEL, type Photo, type PhotoSource } from "./photos-client";

const input =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

/** Campos de imagem dos blocos: hero.image, image.url, team.photo (uma) e gallery.images (várias). */
export const IMAGE_KEYS = new Set(["image", "url", "photo", "images"]);

function useUpload() {
  const addAsset = useStudio((s) => s.addAsset);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (files: File[]): Promise<string[]> => {
    setBusy(true);
    setError(null);
    const out: string[] = [];
    try {
      for (const f of files) out.push(addAsset(await compressImage(f)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
    return out;
  };
  return { upload, busy, error };
}

function Thumb({ src, label, onRemove }: { src: string; label: string; onRemove: () => void }) {
  const assets = useStudio((s) => s.assets);
  const real = resolveAssets(src, assets);
  const missing = isAssetUrl(real);
  return (
    <div className="group relative overflow-hidden rounded-md border border-line bg-canvas">
      {missing ? (
        <div className="flex aspect-[4/3] items-center justify-center p-1 text-center text-[10px] text-muted">imagem não encontrada</div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={real} alt={label} className="aspect-[4/3] w-full object-cover" />
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded bg-white/90 p-0.5 opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100"
        aria-label={`Remover ${label}`}
      >
        <X size={12} />
      </button>
      {isAssetUrl(src) && !missing ? <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[9px] text-white">{dataUrlKb(real)} KB</span> : null}
    </div>
  );
}

/** Busca no banco de fotos gratuito; ao clicar, baixa, comprime e guarda no projeto. */
function StockPicker({ id, suggest, onPick, keepOpen }: { id: string; suggest?: string; onPick: (url: string) => void; keepOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(suggest ?? "");
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [source, setSource] = useState<PhotoSource | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const search = async () => {
    if (!q.trim()) return;
    setBusy("search");
    setError(null);
    try {
      const r = await searchStock(q.trim());
      setPhotos(r.photos);
      setSource(r.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  const pick = async (p: Photo) => {
    setBusy(p.id);
    setError(null);
    try {
      onPick(await importStock(p));
      if (!keepOpen) setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 flex items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs hover:bg-gray-50"
        data-testid={`${id}-stock`}
      >
        <Images size={13} /> Banco de fotos grátis
      </button>
    );
  return (
    <div className="mt-1.5 rounded-md border border-line bg-canvas p-2" data-testid={`${id}-stock-panel`}>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ex.: coffee shop counter" aria-label="Buscar foto" autoFocus />
        <button type="submit" className="rounded-md border border-line bg-white px-2 hover:bg-gray-50 disabled:opacity-50" disabled={busy === "search"} aria-label="Buscar">
          {busy === "search" ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
        </button>
        <button type="button" className="rounded-md px-1 text-muted hover:text-gray-900" onClick={() => setOpen(false)} aria-label="Fechar banco de fotos">
          <X size={13} />
        </button>
      </form>
      <p className="mt-1 text-[10px] text-muted">Termos em inglês trazem mais resultados.</p>
      {photos ? (
        photos.length ? (
          <div className="mt-1.5 grid max-h-64 grid-cols-3 gap-1 overflow-y-auto">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void pick(p)}
                disabled={!!busy}
                title={`${p.title}${p.creator ? ` — ${p.creator}` : ""} (${p.license})`}
                className="relative overflow-hidden rounded border border-line bg-white hover:ring-2 hover:ring-brand disabled:opacity-60"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt={p.title} loading="lazy" className="aspect-[4/3] w-full object-cover" referrerPolicy="no-referrer" />
                {busy === p.id ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                    <Loader2 size={14} className="animate-spin" />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted">Nada encontrado. Tente outras palavras (em inglês).</p>
        )
      ) : null}
      {source ? <p className="mt-1 text-[10px] text-muted">{SOURCE_LABEL[source]}</p> : null}
      {error ? <p className="mt-1 text-[11px] text-red-700">{error}</p> : null}
    </div>
  );
}

/** Uma imagem: do computador (comprimida e guardada no projeto) ou URL https. */
export function SingleImageField({ id, label, value, onChange, suggest }: { id: string; label: string; value: string; onChange: (v: string) => void; suggest?: string }) {
  const file = useRef<HTMLInputElement>(null);
  const { upload, busy, error } = useUpload();
  const fromComputer = isAssetUrl(value);
  return (
    <div className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      {value ? <Thumb src={value} label={label} onRemove={() => onChange("")} /> : null}
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          onClick={() => file.current?.click()}
          disabled={busy}
          className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
          data-testid={`${id}-upload`}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} {value ? "Trocar" : "Do computador"}
        </button>
        <input
          id={id}
          className={input}
          // A URL interna da imagem enviada não ajuda ninguém: mostra um rótulo.
          value={fromComputer ? "" : value}
          placeholder={fromComputer ? "imagem do computador" : "ou cole uma URL https://"}
          onChange={(e) => onChange(e.target.value.trim())}
          aria-label={`${label}: URL`}
        />
      </div>
      {error ? <p className="mt-1 text-[11px] text-red-700">{error}</p> : null}
      <StockPicker id={id} suggest={suggest} onPick={onChange} />
      <input
        ref={file}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) {
            const [url] = await upload([f]);
            if (url) onChange(url);
          }
        }}
      />
    </div>
  );
}

/** Galeria: várias imagens (uma por linha no rascunho). */
export function GalleryImagesField({ id, label, value, onChange, suggest }: { id: string; label: string; value: string; onChange: (v: string) => void; suggest?: string }) {
  const file = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const { upload, busy, error } = useUpload();
  const list = value.split("\n").map((l) => l.trim()).filter(Boolean);
  const set = (next: string[]) => onChange(next.join("\n"));
  return (
    <div className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      {list.length ? (
        <div className="grid grid-cols-3 gap-1.5">
          {list.map((src, i) => (
            <Thumb key={`${i}-${src.slice(-12)}`} src={src} label={`${label} ${i + 1}`} onRemove={() => set(list.filter((_, k) => k !== i))} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted">Sem imagens: a galeria mostra espaços com as legendas.</p>
      )}
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          onClick={() => file.current?.click()}
          disabled={busy}
          className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
          data-testid={`${id}-upload`}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} Adicionar
        </button>
        <form
          className="flex min-w-0 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^https?:\/\/\S+$/.test(url.trim())) {
              set([...list, url.trim()]);
              setUrl("");
            }
          }}
        >
          <input id={id} className={input} value={url} placeholder="ou cole uma URL e Enter" onChange={(e) => setUrl(e.target.value)} aria-label={`${label}: adicionar URL`} />
        </form>
      </div>
      {error ? <p className="mt-1 text-[11px] text-red-700">{error}</p> : null}
      {/* Galeria: o painel fica aberto para escolher várias (um download por vez). */}
      <StockPicker id={id} suggest={suggest} keepOpen onPick={(u) => set([...list, u])} />
      <input
        ref={file}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={async (e) => {
          const fs = [...(e.target.files ?? [])];
          e.target.value = "";
          if (fs.length) {
            const urls = await upload(fs);
            if (urls.length) set([...list, ...urls]);
          }
        }}
      />
    </div>
  );
}
