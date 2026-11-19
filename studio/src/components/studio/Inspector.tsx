"use client";
import { ArrowDown, ArrowUp, Copy, Save, Trash2 } from "lucide-react";
import { BLOCKS, type FieldDef } from "@/lib/draft/blocks";
import { findNode } from "@/lib/draft/tree";
import { useStudio } from "@/lib/draft/store";
import { PALETTES } from "@/lib/a2ui/catalog-api";
import { MOTIONS, MOTION_LABELS, THEMES, THEME_DEFS } from "@/lib/a2ui/themes";
import { BlockIcon } from "./icons";

const input =
  "w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Inspector() {
  const selectedId = useStudio((s) => s.selectedId);
  const node = useStudio((s) => (s.selectedId ? findNode(s.tree, s.selectedId) : undefined));

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-line bg-panel" aria-label="Propriedades">
      {node && selectedId ? <NodeEditor id={selectedId} /> : <PageSettings />}
    </aside>
  );
}

function NodeEditor({ id }: { id: string }) {
  const node = useStudio((s) => findNode(s.tree, id))!;
  const { update, remove, duplicate, shift, saveAsComponent } = useStudio.getState();
  const def = BLOCKS[node.type];

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <BlockIcon type={node.type} size={18} className="text-brand" />
        <h2 className="font-semibold">{def.label}</h2>
        <span className="ml-auto text-xs text-muted">{def.hint}</span>
      </div>

      <div className="space-y-3">
        {def.fields.map((f) => (
          <Field key={f.key} field={f} value={node.props[f.key] ?? ""} onChange={(v) => update(id, { [f.key]: v })} />
        ))}
        {def.fields.length === 0 ? <p className="text-sm text-muted">Arraste blocos para dentro deste container.</p> : null}
      </div>

      <div className="mt-6 grid grid-cols-4 gap-1.5">
        <IconBtn label="Subir" onClick={() => shift(id, -1)}>
          <ArrowUp size={16} />
        </IconBtn>
        <IconBtn label="Descer" onClick={() => shift(id, 1)}>
          <ArrowDown size={16} />
        </IconBtn>
        <IconBtn label="Duplicar" onClick={() => duplicate(id)}>
          <Copy size={16} />
        </IconBtn>
        <IconBtn label="Apagar" danger onClick={() => remove(id)}>
          <Trash2 size={16} />
        </IconBtn>
      </div>

      <form
        className="mt-6 rounded-lg border border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const name = new FormData(e.currentTarget).get("name") as string;
          saveAsComponent(id, name);
          e.currentTarget.reset();
        }}
      >
        <p className="mb-2 text-xs font-medium">Salvar como componente</p>
        <div className="flex gap-1.5">
          <input name="name" placeholder={`${def.label} personalizado`} className={input} />
          <button className="rounded-md bg-brand px-2.5 text-white" aria-label="Salvar componente">
            <Save size={15} />
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted">Aparece em “Meus componentes”, com tudo que estiver dentro.</p>
      </form>
    </div>
  );
}

function Field({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  const id = `f-${field.key}`;
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">{field.label}</span>
      {field.kind === "select" ? (
        <select id={id} className={input} value={value} onChange={(e) => onChange(e.target.value)}>
          {field.options!.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.kind === "text" ? (
        <input id={id} className={input} value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <textarea id={id} className={`${input} min-h-20`} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center rounded-md border border-line py-2 ${danger ? "hover:border-red-300 hover:bg-red-50 hover:text-red-600" : "hover:bg-gray-50"}`}
    >
      {children}
    </button>
  );
}

function PageSettings() {
  const brief = useStudio((s) => s.brief);
  const palette = useStudio((s) => s.palette);
  const theme = useStudio((s) => s.theme);
  const motion = useStudio((s) => s.motion);
  const { setBrief, setPalette, setTheme, setMotion } = useStudio.getState();
  return (
    <div className="p-4">
      <h2 className="mb-1 font-semibold">Página</h2>
      <p className="mb-4 text-xs text-muted">Nada selecionado. Estas informações guiam o Reimaginar.</p>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-700">Briefing do negócio</span>
        <textarea
          className={`${input} min-h-28`}
          value={brief}
          placeholder="Ex.: cafeteria de bairro em BH, público jovem, quer reservas pelo WhatsApp"
          onChange={(e) => setBrief(e.target.value)}
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-gray-700">Paleta</span>
        <select className={input} value={palette} onChange={(e) => setPalette(e.target.value)}>
          <option value="auto">A IA escolhe</option>
          {PALETTES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-gray-700">Tema (tipografia e formas)</span>
        <select className={input} value={theme ?? "auto"} onChange={(e) => setTheme(e.target.value)} data-testid="theme-select">
          <option value="auto">A IA escolhe</option>
          {THEMES.map((t) => (
            <option key={t} value={t}>
              {THEME_DEFS[t].label}: {THEME_DEFS[t].heading}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-gray-700">Movimento</span>
        <select className={input} value={motion ?? "auto"} onChange={(e) => setMotion(e.target.value)} data-testid="motion-select">
          <option value="auto">A IA escolhe</option>
          {MOTIONS.map((m) => (
            <option key={m} value={m}>
              {MOTION_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-6 text-xs text-muted">
        Dica: clique num bloco para editar. Selecionado um container (Seção, Linha, Coluna, Cartão), o clique na paleta adiciona dentro dele.
      </p>
    </div>
  );
}
