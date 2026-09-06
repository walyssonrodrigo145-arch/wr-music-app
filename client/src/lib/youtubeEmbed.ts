// ─── YouTube Embed (client) ──────────────────────────────────────────────────
// Fonte única para montar o src do player nos modais.
// Caça-Bug (Erro 153): o host youtube-nocookie passou a disparar
// "Erro de configuração do player" em vários vídeos — o host PADRÃO
// (www.youtube.com/embed) é o compatível. O alternativo fica disponível
// via toggle na UI para os casos raros em que o padrão falhar.

export interface YouTubeEmbedRef {
  videoId: string | null;
  playlistId: string | null;
}

export function youtubeEmbedSrc(
  videoId: string | null,
  playlistId: string | null,
  altHost = false
): string | null {
  if (!videoId && !playlistId) return null;
  const host = altHost ? "https://www.youtube-nocookie.com/embed" : "https://www.youtube.com/embed";
  if (videoId) {
    return `${host}/${videoId}?rel=0&playsinline=1${playlistId ? `&list=${playlistId}` : ""}`;
  }
  return `${host}/videoseries?list=${playlistId}&rel=0&playsinline=1`;
}
