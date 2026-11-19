"use client";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { compressImage, dataUrlKb, IMAGE_ACCEPT, isAssetUrl, resolveAssets } from "@/lib/assets/assets";

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

/** Uma imagem: do computador (comprimida e guardada no projeto) ou URL https. */
export function SingleImageField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
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
export function GalleryImagesField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
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
