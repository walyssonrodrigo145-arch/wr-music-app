import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ExternalLink, ShieldCheck, Star, Sparkles, X, Quote } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';

// Dados padrão caso o banco ainda tenha poucos itens cadastrados
const DEFAULT_PARTNERS = [
  {
    id: 'def-1',
    name: 'Espaço Musical Edu Oliveira',
    logoUrl: '/img/piano-trans.png',
    websiteUrl: 'https://instagram.com',
    category: 'Escola & Estúdio',
    location: 'São Paulo - SP',
    testimonial: 'A MusicPro revolucionou a gestão dos nossos 180 alunos e reduziu a inadimplência a quase zero.',
  },
  {
    id: 'def-2',
    name: 'Harmonia Escola de Música',
    logoUrl: '/img/guitar-trans.png',
    websiteUrl: 'https://instagram.com',
    category: 'Conservatório',
    location: 'Belo Horizonte - MG',
    testimonial: 'O agendamento de turmas e o controle de presença automática poupam mais de 10 horas semanais da nossa equipe.',
  },
  {
    id: 'def-3',
    name: 'Conservatório Tom Maior',
    logoUrl: '/img/piano-trans.png',
    websiteUrl: 'https://instagram.com',
    category: 'Centro Musical',
    location: 'Rio de Janeiro - RJ',
    testimonial: 'Interface moderna e portal do aluno impecável. Nossos alunos e pais adoram acompanhar o progresso.',
  },
  {
    id: 'def-4',
    name: 'Studio Ritmo & Arte',
    logoUrl: '/img/guitar-trans.png',
    websiteUrl: 'https://instagram.com',
    category: 'Estúdio de Bateria & Percussão',
    location: 'Curitiba - PR',
    testimonial: 'Os lembretes via WhatsApp reduziram as faltas em mais de 75%. Simplesmente indispensável!',
  },
  {
    id: 'def-5',
    name: 'Acorde Music School',
    logoUrl: '/img/piano-trans.png',
    websiteUrl: 'https://instagram.com',
    category: 'Escola de Música',
    location: 'Campinas - SP',
    testimonial: 'Excelente suporte e recursos que realmente entendem a dinâmica de uma escola de música.',
  },
  {
    id: 'def-6',
    name: 'Camerata Som & Vida',
    logoUrl: '/img/guitar-trans.png',
    websiteUrl: 'https://instagram.com',
    category: 'Instituto Musical',
    location: 'Porto Alegre - RS',
    testimonial: 'O controle financeiro por PIX e boletos integrados facilitou 100% o nosso fluxo de caixa.',
  },
];

export default function ClientsMarquee() {
  const { data: dbClients = [] } = trpc.publicData.getLandingClients.useQuery();
  const [selectedPartner, setSelectedPartner] = useState<any>(null);

  // Mesclar dados do banco com defaults se necessário para manter o marquee fluido
  const formattedDbClients = dbClients.map((c: any) => ({
    id: `db-${c.id}`,
    name: c.name,
    logoUrl: c.logoUrl,
    websiteUrl: c.websiteUrl || null,
    category: 'Escola Parceira',
    location: 'Brasil',
    testimonial: c.testimonial || null,
  }));

  const allPartners = formattedDbClients.length >= 4 
    ? formattedDbClients 
    : [...formattedDbClients, ...DEFAULT_PARTNERS.slice(0, 6 - formattedDbClients.length)];

  // Duplicar array para rotação contínua perfeita no CSS/Framer
  const marqueeItems = [...allPartners, ...allPartners, ...allPartners];

  return (
    <section id="clients" className="relative py-24 bg-background border-b border-border/40 overflow-hidden select-none">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="container relative z-10 mb-14">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-black tracking-widest uppercase shadow-xs">
            <Sparkles size={13} className="text-primary animate-pulse" />
            <span>Escolas & Parceiros Oficiais</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-outfit font-extrabold text-foreground tracking-tight leading-[1.15]">
            Quem confia na <span className="text-primary font-black">MusicPro</span> para transformar sua escola
          </h2>

          <p className="text-sm md:text-base text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
            Grandes escolas, conservatórios e estúdios musicais utilizam nosso ecossistema todos os dias para gerenciar alunos, turmas e finanças com máxima excelência.
          </p>
        </div>
      </div>

      {/* ── CARROSSEL MARQUEE INFINITO COM FADE MASK ── */}
      <div 
        className="relative w-full overflow-hidden py-4"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        }}
      >
        {/* Track 1: Rolagem contínua para a esquerda */}
        <div className="flex w-max gap-5 animate-marquee hover:[animation-play-state:paused] transition-all">
          {marqueeItems.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              onClick={() => setSelectedPartner(item)}
              className="group relative w-[280px] sm:w-[320px] shrink-0 p-5 rounded-[1.75rem] bg-card/60 hover:bg-card border border-border/50 hover:border-primary/40 backdrop-blur-md transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
            >
              {/* Top Header Card */}
              <div className="flex items-center gap-3.5 mb-3">
                <div className="w-14 h-14 rounded-2xl bg-muted/30 dark:bg-muted/10 border border-border/50 p-2 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-primary/30 transition-all overflow-hidden">
                  {item.logoUrl ? (
                    <img
                      src={item.logoUrl}
                      alt={item.name}
                      className="max-w-full max-h-full object-contain filter grayscale group-hover:grayscale-0 transition-all duration-300"
                    />
                  ) : (
                    <Building2 size={24} className="text-primary/60" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-extrabold text-xs sm:text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {item.name}
                    </h4>
                    <ShieldCheck size={14} className="text-blue-500 shrink-0" />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block truncate mt-0.5">
                    {item.category || 'Escola Parceira'}
                  </span>
                </div>
              </div>

              {/* Testimonial / Snippet */}
              {item.testimonial ? (
                <p className="text-[11px] text-muted-foreground/80 line-clamp-2 italic font-medium leading-relaxed mb-3">
                  "{item.testimonial}"
                </p>
              ) : (
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Ambiente Ativo na Plataforma</span>
                </div>
              )}

              {/* Bottom Card Footer */}
              <div className="flex items-center justify-between pt-2.5 border-t border-border/30 text-[10px] font-bold">
                <span className="text-muted-foreground/60">{item.location || 'Brasil'}</span>
                {item.websiteUrl ? (
                  <span className="text-primary flex items-center gap-1 group-hover:underline">
                    Conhecer <ExternalLink size={10} />
                  </span>
                ) : (
                  <span className="text-primary/60 flex items-center gap-1">
                    Ver detalhes →
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MODAL DE DETALHES DA ESCOLA PARCEIRA ── */}
      <ResponsiveDialog
        open={!!selectedPartner}
        onOpenChange={(open) => !open && setSelectedPartner(null)}
        title={selectedPartner?.name || 'Escola Parceira'}
        description={selectedPartner?.category || 'Parceiro Oficial MusicPro'}
      >
        {selectedPartner && (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/20 border border-border/50">
              <div className="w-16 h-16 rounded-2xl bg-background border border-border/60 p-2.5 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                {selectedPartner.logoUrl ? (
                  <img
                    src={selectedPartner.logoUrl}
                    alt={selectedPartner.name}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <Building2 size={28} className="text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-foreground truncate">{selectedPartner.name}</h3>
                  <ShieldCheck size={16} className="text-blue-500 shrink-0" />
                </div>
                <p className="text-xs font-semibold text-muted-foreground">{selectedPartner.category} • {selectedPartner.location}</p>
                <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Escola Verificada MusicPro</span>
                </div>
              </div>
            </div>

            {selectedPartner.testimonial && (
              <div className="p-5 rounded-2xl bg-primary/5 border border-primary/15 relative">
                <Quote size={20} className="text-primary/30 mb-2" />
                <p className="text-sm font-medium text-foreground/90 italic leading-relaxed">
                  "{selectedPartner.testimonial}"
                </p>
                <div className="mt-3 flex items-center gap-1 text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className="fill-amber-500" />
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPartner(null)}
                className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-xs font-bold hover:bg-muted/80 transition-colors"
              >
                Fechar
              </button>
              {selectedPartner.websiteUrl && (
                <a
                  href={selectedPartner.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-primary/20 hover:scale-102 transition-all"
                >
                  Acessar Escola <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        )}
      </ResponsiveDialog>
    </section>
  );
}
