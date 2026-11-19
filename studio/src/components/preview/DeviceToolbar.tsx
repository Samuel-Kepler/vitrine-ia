"use client";
import { Maximize2, Monitor, RotateCw, Smartphone, Tablet } from "lucide-react";
import { CUSTOM, DEVICES, FIT, MAX_WIDTH, MIN_WIDTH, QUICK, clampWidth, groupOf, resolveViewport, type DeviceGroup, type ViewportState } from "@/lib/preview/devices";

const ICONS: Record<DeviceGroup, typeof Monitor> = { Celular: Smartphone, Tablet, Desktop: Monitor };
const GROUPS: DeviceGroup[] = ["Celular", "Tablet", "Desktop"];

/** Barra de tamanhos de tela: atalhos, lista de aparelhos, largura livre e girar. */
export function DeviceToolbar({ value, onChange, scale }: { value: ViewportState; onChange: (v: ViewportState) => void; scale: number }) {
  const size = resolveViewport(value);
  const group = groupOf(value);
  const canRotate = !!group && group !== "Desktop";
  const set = (p: Partial<ViewportState>) => onChange({ ...value, ...p });

  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="device-toolbar">
      <button
        title="Ajustar à área"
        aria-label="Ajustar à área"
        aria-pressed={value.device === FIT}
        onClick={() => set({ device: FIT })}
        className={`rounded-md p-1.5 ${value.device === FIT ? "bg-brand-soft text-brand" : "text-gray-500 hover:bg-gray-100"}`}
      >
        <Maximize2 size={15} />
      </button>
      {GROUPS.map((g) => {
        const Icon = ICONS[g];
        return (
          <button
            key={g}
            title={g}
            aria-label={g}
            aria-pressed={group === g}
            onClick={() => set({ device: QUICK[g], rotated: false })}
            className={`rounded-md p-1.5 ${group === g ? "bg-brand-soft text-brand" : "text-gray-500 hover:bg-gray-100"}`}
          >
            <Icon size={15} />
          </button>
        );
      })}
      <select
        value={value.device}
        onChange={(e) => set({ device: e.target.value, rotated: false, ...(e.target.value === CUSTOM && size ? { customWidth: size.width } : {}) })}
        aria-label="Tamanho de tela"
        data-testid="device-select"
        className="ml-1 w-48 rounded-md border border-line bg-white px-1.5 py-1 text-xs"
      >
        <option value={FIT}>Ajustar à área</option>
        {GROUPS.map((g) => (
          <optgroup key={g} label={g}>
            {DEVICES.filter((d) => d.group === g).map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} · {d.width}×{d.height}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM}>Personalizado…</option>
      </select>
      {value.device === CUSTOM ? (
        <label className="flex items-center gap-1 text-xs text-muted">
          <input
            type="number"
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            step={10}
            value={value.customWidth}
            onChange={(e) => set({ customWidth: Number(e.target.value) })}
            onBlur={() => set({ customWidth: clampWidth(value.customWidth) })}
            aria-label="Largura em pixels"
            data-testid="device-width"
            className="w-20 rounded-md border border-line bg-white px-1.5 py-1 font-mono text-xs text-ink"
          />
          px
        </label>
      ) : null}
      {/* Sempre no lugar (invisível quando não se aplica) para os botões não pularem. */}
      <button
        title="Girar"
        aria-label="Girar tela"
        aria-pressed={value.rotated}
        aria-hidden={!canRotate}
        tabIndex={canRotate ? 0 : -1}
        onClick={() => canRotate && set({ rotated: !value.rotated })}
        className={`rounded-md p-1.5 ${canRotate ? "" : "invisible"} ${value.rotated ? "bg-brand-soft text-brand" : "text-gray-500 hover:bg-gray-100"}`}
      >
        <RotateCw size={15} />
      </button>
      <span className="w-28 text-right font-mono text-[11px] text-muted" data-testid="device-size">
        {size ? `${size.width}${size.height ? `×${size.height}` : ""} · ${Math.round(scale * 100)}%` : ""}
      </span>
    </div>
  );
}
