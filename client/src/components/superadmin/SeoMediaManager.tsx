// ─── Super Admin: imagens das páginas públicas (SEO) ─────────────────────────
// Por página (funcionalidade): capa, galeria (várias) e prints de celular
// (exibidos na moldura da página). Upload do dispositivo ou URL.
import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  SEO_PAGES,
  SEO_MEDIA_KIND_LABELS,
  type SeoMediaKind,
} from "@shared/seo";
import { ImagePlus, Link2, Loader2, Smartphone, Trash2, Upload } from "lucide-react";

const KINDS: SeoMediaKind[] = ["cover", "gallery", "mobile", "desktop"];
const MAX_FILE = 5 * 1024 * 1024;

const KIND_HINTS: Record<SeoMediaKind, string> = {
  cover: "Imagem principal exibida no card e no topo da página.",
  gallery: "Imagens adicionais exibidas na seção “Por dentro do sistema”.",
  mobile: "Prints exibidos na moldura de celular desta funcionalidade.",
  desktop: "Prints exibidos na moldura de notebook (versão web).",
};

export function SeoMediaManager() {
  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.superAdmin.listSeoMedia.useQuery();

  const pages = useMemo(
    // Páginas públicas de conteúdo + Página inicial (a Capa da home vira a imagem do topo da landing)
    () => SEO_PAGES.filter((p) => !["signup", "login", "legal"].includes(p.kind)),
    []
  );
  const [pagePath, setPagePath] = useState(
    () => pages.find((p) => p.path === "/funcionalidades")?.path || pages[0]?.path || "/funcionalidades"
  );
  const [urlDraft, setUrlDraft] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const invalidateAll = () => {
    utils.superAdmin.listSeoMedia.invalidate();
    // Reflete na hora nas páginas públicas abertas na mesma sessão
    utils.publicData.getSeoMedia.invalidate();
  };

  const createMutation = trpc.superAdmin.createSeoMedia.useMutation({
    onSuccess: invalidateAll,
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.superAdmin.updateSeoMedia.useMutation({
    onSuccess: invalidateAll,
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.superAdmin.deleteSeoMedia.useMutation({
    onSuccess: () => {
      toast.success("Imagem removida.");
      invalidateAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const pageItems = useMemo(
    () => (items as any[]).filter((i) => i.pagePath === pagePath),
    [items, pagePath]
  );

  const itemsOf = (kind: SeoMediaKind) =>
    pageItems.filter((i) => i.kind === kind).sort((a, b) => (a.order || 0) - (b.order || 0) || a.id - b.id);

  const nextOrder = (kind: SeoMediaKind) =>
    Math.max(0, ...pageItems.filter((i) => i.kind === kind).map((i) => Number(i.order) || 0));

  const handleFiles = (kind: SeoMediaKind, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const base = nextOrder(kind);
    let queued = 0;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name}: formato não suportado (use PNG/JPG/WebP).`);
        return;
      }
      if (file.size > MAX_FILE) {
        toast.error(`${file.name}: maior que 5MB.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        const url = String(evt.target?.result || "");
        if (!url) return;
        createMutation.mutate({
          pagePath,
          kind,
          url,
          alt: file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 200),
          order: base + queued + 1,
          isActive: true,
        });
      };
      reader.readAsDataURL(file);
      queued++;
    });
    if (queued > 0) toast.success(`Enviando ${queued} imagem(ns)...`);
  };

  const handleAddUrl = (kind: SeoMediaKind) => {
    const url = (urlDraft[kind] || "").trim();
    if (!url) return toast.error("Cole a URL da imagem.");
    createMutation.mutate({ pagePath, kind, url, alt: "", order: nextOrder(kind) + 1, isActive: true });
    setUrlDraft((prev) => ({ ...prev, [kind]: "" }));
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Imagens das Páginas Públicas (site)</h2>
          <p className="text-sm text-muted-foreground">
            Capa, galeria e prints de celular por página pública. Na <strong>Página inicial</strong>, a Capa é a imagem
            principal do topo da landing. As imagens de celular aparecem na moldura de cada funcionalidade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Página</span>
          <select
            value={pagePath}
            onChange={(e) => setPagePath(e.target.value)}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 max-w-[22rem]"
          >
            {pages.map((p) => (
              <option key={p.path} value={p.path}>
                {p.h1} ({p.path})
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="animate-spin mx-auto text-primary" />
        </div>
      ) : (
        KINDS.map((kind) => {
          const kindItems = itemsOf(kind);
          return (
            <section key={kind} className="rounded-2xl border border-border/60 bg-card/50 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black flex items-center gap-2">
                    {kind === "mobile" ? <Smartphone size={15} className="text-primary" /> : <ImagePlus size={15} className="text-primary" />}
                    {SEO_MEDIA_KIND_LABELS[kind]}
                    <span className="text-xs font-bold text-muted-foreground">({kindItems.length})</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{KIND_HINTS[kind]}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => { fileRefs.current[kind] = el; }}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleFiles(kind, e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    disabled={isSaving}
                    onClick={() => fileRefs.current[kind]?.click()}
                    className="h-9 rounded-xl text-[11px] font-black uppercase tracking-widest"
                  >
                    <Upload size={14} className="mr-1.5" /> Enviar imagens
                  </Button>
                </div>
              </div>

              {/* Adicionar por URL */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-lg">
                  <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={urlDraft[kind] || ""}
                    onChange={(e) => setUrlDraft((prev) => ({ ...prev, [kind]: e.target.value }))}
                    placeholder="Ou cole a URL de uma imagem..."
                    className="pl-8 h-9 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving || !(urlDraft[kind] || "").trim()}
                  onClick={() => handleAddUrl(kind)}
                  className="h-9 rounded-xl text-[11px] font-black uppercase tracking-widest"
                >
                  Adicionar URL
                </Button>
              </div>

              {kindItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  Nenhuma imagem {kind === "mobile" ? "de celular" : ""} cadastrada para esta página.
                </p>
              ) : (
                <div className={cn("grid gap-4", kind === "mobile" ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
                  {kindItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/60 bg-background p-3 space-y-2.5">
                      <div className={cn("rounded-lg border border-border/50 overflow-hidden bg-muted/30", kind === "mobile" ? "aspect-[9/19.2]" : "aspect-video")}>
                        <img src={item.url} alt={item.alt || ""} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <Input
                        defaultValue={item.alt || ""}
                        placeholder="Texto alternativo (alt)"
                        onBlur={(e) => {
                          const alt = e.target.value.trim();
                          if (alt !== (item.alt || "")) updateMutation.mutate({ id: item.id, alt: alt || null });
                        }}
                        className="h-8 text-[11px]"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            defaultValue={item.order ?? 0}
                            onBlur={(e) => {
                              const order = Number(e.target.value) || 0;
                              if (order !== Number(item.order || 0)) updateMutation.mutate({ id: item.id, order });
                            }}
                            className="h-8 w-16 text-[11px]"
                            title="Ordem de exibição"
                          />
                          <Switch
                            checked={item.isActive !== false}
                            onCheckedChange={(checked) => updateMutation.mutate({ id: item.id, isActive: checked })}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Remover esta imagem?")) deleteMutation.mutate({ id: item.id });
                          }}
                          className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
