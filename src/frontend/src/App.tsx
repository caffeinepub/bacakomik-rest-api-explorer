import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { useActor } from "@/hooks/useActor";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  Flame,
  Grid3X3,
  List,
  Loader2,
  Palette,
  Sparkles,
  Tag,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

const queryClient = new QueryClient();

const BASE_URL = "https://bacakomik.my/";

type EndpointId =
  | "popularComics"
  | "latestComics"
  | "coloredComics"
  | "comicList"
  | "genreList";

interface Endpoint {
  id: EndpointId;
  label: string;
  path: string;
  description: string;
  icon: React.ReactNode;
  hasPage: boolean;
}

const ENDPOINTS: Endpoint[] = [
  {
    id: "popularComics",
    label: "Komik Populer",
    path: "komik-populer/",
    description: "Daftar komik terpopuler",
    icon: <Flame className="w-4 h-4" />,
    hasPage: false,
  },
  {
    id: "latestComics",
    label: "Komik Terbaru",
    path: "komik-terbaru/",
    description: "Update chapter terbaru",
    icon: <Sparkles className="w-4 h-4" />,
    hasPage: true,
  },
  {
    id: "coloredComics",
    label: "Komik Berwarna",
    path: "komik-berwarna/",
    description: "Komik versi full color",
    icon: <Palette className="w-4 h-4" />,
    hasPage: true,
  },
  {
    id: "comicList",
    label: "Daftar Komik",
    path: "daftar-komik/",
    description: "Semua judul komik",
    icon: <Grid3X3 className="w-4 h-4" />,
    hasPage: true,
  },
  {
    id: "genreList",
    label: "Daftar Genre",
    path: "daftar-genre/",
    description: "Kategori & genre komik",
    icon: <Tag className="w-4 h-4" />,
    hasPage: false,
  },
];

interface ComicCard {
  title: string;
  href: string;
  thumb: string;
  type?: string;
  chapter?: string;
}

interface GenreItem {
  name: string;
  href: string;
  count?: string;
}

function parseComicsFromHtml(html: string): ComicCard[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const comics: ComicCard[] = [];

    // Try bsx pattern (most common on BacaKomik)
    const bsxItems = doc.querySelectorAll(".bsx");
    if (bsxItems.length > 0) {
      for (const item of bsxItems) {
        const a = item.querySelector("a");
        const img = item.querySelector("img");
        const title =
          item
            .querySelector(".tt, .bigor, h4, h3, .title")
            ?.textContent?.trim() ||
          a?.getAttribute("title") ||
          "";
        const href = a?.getAttribute("href") || "";
        const thumb =
          img?.getAttribute("src") ||
          img?.getAttribute("data-src") ||
          img?.getAttribute("data-lazy-src") ||
          "";
        const type = item
          .querySelector(".type, .typeflag")
          ?.textContent?.trim();
        const chapter = item
          .querySelector(".epxs, .epxss, .chx")
          ?.textContent?.trim();
        if (title || href) {
          comics.push({ title, href, thumb, type, chapter });
        }
      }
      return comics;
    }

    // Try animpoker pattern
    const animItems = doc.querySelectorAll(".animpoker, .listupd .bs");
    for (const item of animItems) {
      const a = item.querySelector("a");
      const img = item.querySelector("img");
      const title =
        item.querySelector(".tt, h4, h3")?.textContent?.trim() ||
        a?.getAttribute("title") ||
        "";
      const href = a?.getAttribute("href") || "";
      const thumb =
        img?.getAttribute("src") || img?.getAttribute("data-src") || "";
      if (title || href) {
        comics.push({ title, href, thumb });
      }
    }
    if (comics.length > 0) return comics;

    // Generic fallback: article links with images
    const articles = doc.querySelectorAll("article, .item, .post");
    for (const item of articles) {
      const a = item.querySelector("a");
      const img = item.querySelector("img");
      const title =
        item.querySelector("h1, h2, h3, h4, .title")?.textContent?.trim() ||
        a?.textContent?.trim() ||
        "";
      const href = a?.getAttribute("href") || "";
      const thumb =
        img?.getAttribute("src") || img?.getAttribute("data-src") || "";
      if (title && href) {
        comics.push({ title, href, thumb });
      }
    }
    return comics;
  } catch {
    return [];
  }
}

function parseGenresFromHtml(html: string): GenreItem[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const genres: GenreItem[] = [];

    // genre-list links
    const genreLinks = doc.querySelectorAll(
      ".genre-list a, .tagcloud a, .genrelist a, .genres a",
    );
    for (const a of genreLinks) {
      const name = a.textContent?.trim() || "";
      const href = a.getAttribute("href") || "";
      const count = (a as HTMLElement).dataset.count || "";
      if (name) genres.push({ name, href, count });
    }
    if (genres.length > 0) return genres;

    // fallback: all links in main content
    const main = doc.querySelector("main, .site-content, #content, .genrediv");
    if (main) {
      const links = main.querySelectorAll("a");
      for (const a of links) {
        const name = a.textContent?.trim() || "";
        const href = a.getAttribute("href") || "";
        if (name && href && href.includes("/genre/")) {
          genres.push({ name, href });
        }
      }
    }
    return genres;
  } catch {
    return [];
  }
}

interface ComicGridProps {
  comics: ComicCard[];
}

function ComicGrid({ comics }: ComicGridProps) {
  if (comics.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {comics.map((comic, idx) => (
        <motion.div
          key={`${comic.href}-${idx}`}
          data-ocid={`comics.item.${idx + 1}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.03, duration: 0.25 }}
          className="group rounded-xl overflow-hidden flex flex-col"
          style={{
            background: "oklch(16% 0.025 240)",
            border: "1px solid oklch(22% 0.04 240)",
          }}
        >
          {/* Thumbnail */}
          <div
            className="relative overflow-hidden"
            style={{ aspectRatio: "3/4", background: "oklch(14% 0.02 240)" }}
          >
            {comic.thumb ? (
              <img
                src={comic.thumb}
                alt={comic.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ color: "oklch(30% 0.04 240)" }}
              >
                <BookOpen className="w-8 h-8" />
              </div>
            )}
            {comic.type && (
              <span
                className="absolute top-1.5 left-1.5 text-xs font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: "oklch(72% 0.18 195)",
                  color: "oklch(12% 0.02 240)",
                  fontSize: "9px",
                }}
              >
                {comic.type}
              </span>
            )}
            {comic.chapter && (
              <span
                className="absolute bottom-1.5 left-1.5 right-1.5 text-xs font-mono px-1.5 py-0.5 rounded truncate"
                style={{
                  background: "oklch(8% 0.01 240 / 0.85)",
                  color: "oklch(72% 0.18 195)",
                  fontSize: "9px",
                }}
              >
                {comic.chapter}
              </span>
            )}
          </div>
          {/* Info */}
          <div className="p-2 flex flex-col gap-1.5 flex-1">
            <p
              className="text-xs font-semibold leading-tight line-clamp-2"
              style={{ color: "oklch(85% 0.02 240)" }}
            >
              {comic.title}
            </p>
            {comic.href && (
              <a
                href={comic.href}
                target="_blank"
                rel="noopener noreferrer"
                data-ocid={`comics.link.${idx + 1}`}
                className="mt-auto flex items-center gap-1 text-xs hover:underline"
                style={{ color: "oklch(55% 0.12 195)" }}
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Baca
              </a>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

interface GenreGridProps {
  genres: GenreItem[];
}

function GenreGrid({ genres }: GenreGridProps) {
  if (genres.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {genres.map((g, idx) => (
        <motion.a
          key={`${g.href}-${idx}`}
          data-ocid={`genres.item.${idx + 1}`}
          href={g.href}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: idx * 0.02 }}
          className="px-3 py-1.5 rounded-full text-sm font-medium hover:opacity-80 transition-opacity"
          style={{
            background: "oklch(20% 0.06 195)",
            color: "oklch(72% 0.18 195)",
            border: "1px solid oklch(30% 0.1 195)",
          }}
        >
          {g.name}
          {g.count && (
            <span
              className="ml-1.5 text-xs"
              style={{ color: "oklch(45% 0.08 195)" }}
            >
              ({g.count})
            </span>
          )}
        </motion.a>
      ))}
    </div>
  );
}

function ApiExplorer() {
  const { actor, isFetching: actorLoading } = useActor();
  const [selectedEndpoint, setSelectedEndpoint] =
    useState<EndpointId>("popularComics");
  const [page, setPage] = useState("1");
  const [result, setResult] = useState<string | null>(null);
  const [comics, setComics] = useState<ComicCard[] | null>(null);
  const [genres, setGenres] = useState<GenreItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const currentEndpoint = ENDPOINTS.find((e) => e.id === selectedEndpoint)!;
  const currentUrl = `${BASE_URL}${currentEndpoint.path}${
    currentEndpoint.hasPage && page !== "1" ? `?page=${page}` : ""
  }`;

  const runQuery = useCallback(async () => {
    if (!actor) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setComics(null);
    setGenres(null);
    try {
      let html: string;
      const p = BigInt(page || 1);
      switch (selectedEndpoint) {
        case "popularComics":
          html = await (actor as any).getPopularComics();
          break;
        case "latestComics":
          html = await (actor as any).getLatestComics(p);
          break;
        case "coloredComics":
          html = await (actor as any).getColoredComics(p);
          break;
        case "comicList":
          html = await (actor as any).getComicList(p);
          break;
        case "genreList":
          html = await (actor as any).getGenreList();
          break;
      }

      setResult(html);

      if (selectedEndpoint === "genreList") {
        const parsed = parseGenresFromHtml(html);
        setGenres(parsed);
      } else {
        const parsed = parseComicsFromHtml(html);
        setComics(parsed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      toast.error("Gagal mengambil data");
    } finally {
      setLoading(false);
    }
  }, [actor, selectedEndpoint, page]);

  // Auto-fetch on initial actor load
  if (actor && !actorLoading && !hasInitialized) {
    setHasInitialized(true);
    runQuery();
  }

  const copyHtml = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("HTML disalin ke clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const hasCards =
    (comics && comics.length > 0) || (genres && genres.length > 0);
  const showRawFallback = result && !loading && !hasCards;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "oklch(12% 0.02 240)" }}
    >
      {/* Header */}
      <header
        className="border-b px-6 py-4"
        style={{
          borderColor: "oklch(22% 0.04 240)",
          background: "oklch(14% 0.025 240)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ background: "oklch(20% 0.06 195)" }}
          >
            <BookOpen
              className="w-5 h-5"
              style={{ color: "oklch(72% 0.18 195)" }}
            />
          </div>
          <div>
            <h1
              className="text-lg font-bold tracking-tight"
              style={{ color: "oklch(88% 0.02 240)" }}
            >
              BacaKomik{" "}
              <span style={{ color: "oklch(72% 0.18 195)" }}>REST API</span>{" "}
              Explorer
            </h1>
            <p
              className="text-xs font-mono"
              style={{ color: "oklch(55% 0.04 240)" }}
            >
              {BASE_URL}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-xs font-mono"
              style={{
                borderColor: "oklch(30% 0.08 195)",
                color: "oklch(65% 0.15 195)",
                background: "oklch(16% 0.04 195)",
              }}
            >
              HTML Scraper
            </Badge>
            {actorLoading && (
              <div
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "oklch(55% 0.04 240)" }}
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                connecting...
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="w-60 border-r flex-shrink-0 flex flex-col"
          style={{
            borderColor: "oklch(22% 0.04 240)",
            background: "oklch(13% 0.02 240)",
          }}
        >
          <div
            className="p-3 border-b"
            style={{ borderColor: "oklch(22% 0.04 240)" }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "oklch(45% 0.04 240)" }}
            >
              Endpoints
            </p>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            {ENDPOINTS.map((ep) => (
              <button
                type="button"
                key={ep.id}
                data-ocid={`nav.${ep.id}.button`}
                onClick={() => {
                  setSelectedEndpoint(ep.id);
                  setResult(null);
                  setError(null);
                  setComics(null);
                  setGenres(null);
                  setPage("1");
                }}
                className="w-full text-left px-3 py-2.5 rounded-md transition-all duration-150"
                style={{
                  background:
                    selectedEndpoint === ep.id
                      ? "oklch(20% 0.08 195)"
                      : "transparent",
                  borderLeft:
                    selectedEndpoint === ep.id
                      ? "2px solid oklch(72% 0.18 195)"
                      : "2px solid transparent",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      color:
                        selectedEndpoint === ep.id
                          ? "oklch(72% 0.18 195)"
                          : "oklch(45% 0.04 240)",
                    }}
                  >
                    {ep.icon}
                  </span>
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{
                        color:
                          selectedEndpoint === ep.id
                            ? "oklch(88% 0.02 240)"
                            : "oklch(65% 0.04 240)",
                      }}
                    >
                      {ep.label}
                    </p>
                    <p
                      className="text-xs font-mono mt-0.5"
                      style={{ color: "oklch(40% 0.04 240)", fontSize: "10px" }}
                    >
                      GET /{ep.path}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Request panel */}
          <div
            className="border-b p-5"
            style={{
              borderColor: "oklch(22% 0.04 240)",
              background: "oklch(14% 0.025 240)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Badge
                className="text-xs font-bold"
                style={{
                  background: "oklch(30% 0.1 145)",
                  color: "oklch(72% 0.15 145)",
                }}
              >
                GET
              </Badge>
              <code
                className="text-sm font-mono flex-1 px-3 py-1.5 rounded"
                style={{
                  background: "oklch(10% 0.02 240)",
                  color: "oklch(72% 0.18 195)",
                  fontSize: "12px",
                  wordBreak: "break-all",
                }}
              >
                {currentUrl}
              </code>
            </div>

            <div className="flex items-end gap-4">
              {currentEndpoint.hasPage && (
                <div className="flex flex-col gap-1">
                  <Label
                    className="text-xs"
                    style={{ color: "oklch(55% 0.04 240)" }}
                  >
                    page
                  </Label>
                  <Input
                    data-ocid="params.page.input"
                    type="number"
                    min="1"
                    value={page}
                    onChange={(e) => setPage(e.target.value)}
                    className="w-24 h-8 text-sm font-mono"
                    style={{
                      background: "oklch(10% 0.02 240)",
                      borderColor: "oklch(25% 0.04 240)",
                      color: "oklch(88% 0.02 240)",
                    }}
                    placeholder="1"
                  />
                </div>
              )}

              <Button
                data-ocid="request.submit_button"
                onClick={runQuery}
                disabled={loading || actorLoading || !actor}
                className="font-semibold h-8"
                style={{
                  background: "oklch(72% 0.18 195)",
                  color: "oklch(12% 0.02 240)",
                  minWidth: "130px",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>Send Request</>
                )}
              </Button>
            </div>
          </div>

          {/* Response panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className="flex items-center justify-between px-5 py-2.5 border-b"
              style={{
                borderColor: "oklch(22% 0.04 240)",
                background: "oklch(13% 0.02 240)",
              }}
            >
              <div className="flex items-center gap-2">
                <p
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "oklch(45% 0.04 240)" }}
                >
                  Response
                </p>
                {hasCards && (
                  <Badge
                    className="text-xs"
                    style={{
                      background: "oklch(20% 0.06 195)",
                      color: "oklch(72% 0.18 195)",
                      border: "1px solid oklch(30% 0.1 195)",
                    }}
                  >
                    {comics?.length ?? genres?.length} items
                  </Badge>
                )}
              </div>
              {result && (
                <Button
                  data-ocid="response.copy.button"
                  variant="ghost"
                  size="sm"
                  onClick={copyHtml}
                  className="h-7 px-2 text-xs"
                  style={{
                    color: copied
                      ? "oklch(72% 0.15 145)"
                      : "oklch(55% 0.04 240)",
                  }}
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-1" />
                  )}
                  {copied ? "Disalin!" : "Copy HTML"}
                </Button>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-5">
                <AnimatePresence mode="wait">
                  {loading && (
                    <motion.div
                      key="loading"
                      data-ocid="response.loading_state"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        <div
                          key="sk-a"
                          className="rounded-xl overflow-hidden"
                          style={{
                            background: "oklch(16% 0.025 240)",
                            border: "1px solid oklch(22% 0.04 240)",
                          }}
                        >
                          <Skeleton
                            className="w-full"
                            style={{ aspectRatio: "3/4" }}
                          />
                          <div className="p-2 space-y-1.5">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                          </div>
                        </div>
                        <div
                          key="sk-b"
                          className="rounded-xl overflow-hidden"
                          style={{
                            background: "oklch(16% 0.025 240)",
                            border: "1px solid oklch(22% 0.04 240)",
                          }}
                        >
                          <Skeleton
                            className="w-full"
                            style={{ aspectRatio: "3/4" }}
                          />
                          <div className="p-2 space-y-1.5">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                          </div>
                        </div>
                        <div
                          key="sk-c"
                          className="rounded-xl overflow-hidden"
                          style={{
                            background: "oklch(16% 0.025 240)",
                            border: "1px solid oklch(22% 0.04 240)",
                          }}
                        >
                          <Skeleton
                            className="w-full"
                            style={{ aspectRatio: "3/4" }}
                          />
                          <div className="p-2 space-y-1.5">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                          </div>
                        </div>
                        <div
                          key="sk-d"
                          className="rounded-xl overflow-hidden"
                          style={{
                            background: "oklch(16% 0.025 240)",
                            border: "1px solid oklch(22% 0.04 240)",
                          }}
                        >
                          <Skeleton
                            className="w-full"
                            style={{ aspectRatio: "3/4" }}
                          />
                          <div className="p-2 space-y-1.5">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                          </div>
                        </div>
                        <div
                          key="sk-e"
                          className="rounded-xl overflow-hidden"
                          style={{
                            background: "oklch(16% 0.025 240)",
                            border: "1px solid oklch(22% 0.04 240)",
                          }}
                        >
                          <Skeleton
                            className="w-full"
                            style={{ aspectRatio: "3/4" }}
                          />
                          <div className="p-2 space-y-1.5">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                          </div>
                        </div>
                        <div
                          key="sk-f"
                          className="rounded-xl overflow-hidden"
                          style={{
                            background: "oklch(16% 0.025 240)",
                            border: "1px solid oklch(22% 0.04 240)",
                          }}
                        >
                          <Skeleton
                            className="w-full"
                            style={{ aspectRatio: "3/4" }}
                          />
                          <div className="p-2 space-y-1.5">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                          </div>
                        </div>
                        <div
                          key="sk-g"
                          className="rounded-xl overflow-hidden"
                          style={{
                            background: "oklch(16% 0.025 240)",
                            border: "1px solid oklch(22% 0.04 240)",
                          }}
                        >
                          <Skeleton
                            className="w-full"
                            style={{ aspectRatio: "3/4" }}
                          />
                          <div className="p-2 space-y-1.5">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                          </div>
                        </div>
                        <div
                          key="sk-h"
                          className="rounded-xl overflow-hidden"
                          style={{
                            background: "oklch(16% 0.025 240)",
                            border: "1px solid oklch(22% 0.04 240)",
                          }}
                        >
                          <Skeleton
                            className="w-full"
                            style={{ aspectRatio: "3/4" }}
                          />
                          <div className="p-2 space-y-1.5">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                          </div>
                        </div>
                        <div
                          key="sk-i"
                          className="rounded-xl overflow-hidden"
                          style={{
                            background: "oklch(16% 0.025 240)",
                            border: "1px solid oklch(22% 0.04 240)",
                          }}
                        >
                          <Skeleton
                            className="w-full"
                            style={{ aspectRatio: "3/4" }}
                          />
                          <div className="p-2 space-y-1.5">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                          </div>
                        </div>
                        <div
                          key="sk-j"
                          className="rounded-xl overflow-hidden"
                          style={{
                            background: "oklch(16% 0.025 240)",
                            border: "1px solid oklch(22% 0.04 240)",
                          }}
                        >
                          <Skeleton
                            className="w-full"
                            style={{ aspectRatio: "3/4" }}
                          />
                          <div className="p-2 space-y-1.5">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {error && !loading && (
                    <motion.div
                      key="error"
                      data-ocid="response.error_state"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-lg p-4 border"
                      style={{
                        background: "oklch(14% 0.05 25)",
                        borderColor: "oklch(30% 0.12 25)",
                      }}
                    >
                      <p
                        className="text-sm font-semibold mb-1"
                        style={{ color: "oklch(60% 0.22 25)" }}
                      >
                        Error
                      </p>
                      <p
                        className="text-sm font-mono"
                        style={{ color: "oklch(70% 0.1 25)" }}
                      >
                        {error}
                      </p>
                    </motion.div>
                  )}

                  {/* Comic cards */}
                  {comics && comics.length > 0 && !loading && (
                    <motion.div
                      key="comics"
                      data-ocid="response.success_state"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <ComicGrid comics={comics} />
                    </motion.div>
                  )}

                  {/* Genre tags */}
                  {genres && genres.length > 0 && !loading && (
                    <motion.div
                      key="genres"
                      data-ocid="response.success_state"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <GenreGrid genres={genres} />
                    </motion.div>
                  )}

                  {/* Raw HTML fallback */}
                  {showRawFallback && (
                    <motion.div
                      key="raw"
                      data-ocid="response.success_state"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <div
                        className="rounded-lg p-3 mb-3 border text-xs"
                        style={{
                          background: "oklch(16% 0.04 55)",
                          borderColor: "oklch(30% 0.1 55)",
                          color: "oklch(70% 0.15 55)",
                        }}
                      >
                        <List className="w-3.5 h-3.5 inline mr-1.5" />
                        Tidak ada card yang berhasil diparsing. Menampilkan raw
                        HTML (dipersingkat).
                      </div>
                      <pre
                        className="text-xs font-mono leading-relaxed p-4 rounded-lg overflow-x-auto"
                        style={{
                          background: "oklch(10% 0.02 240)",
                          color: "oklch(65% 0.04 240)",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          maxHeight: "600px",
                          overflow: "auto",
                        }}
                      >
                        {result.slice(0, 8000)}
                        {result.length > 8000 ? "\n... [truncated]" : ""}
                      </pre>
                    </motion.div>
                  )}

                  {!result && !loading && !error && (
                    <motion.div
                      key="empty"
                      data-ocid="response.empty_state"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-20 gap-3"
                    >
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ background: "oklch(18% 0.04 240)" }}
                      >
                        <BookOpen
                          className="w-6 h-6"
                          style={{ color: "oklch(35% 0.04 240)" }}
                        />
                      </div>
                      <p
                        className="text-sm"
                        style={{ color: "oklch(40% 0.04 240)" }}
                      >
                        Tekan Send Request untuk mengambil data
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer
        className="border-t px-6 py-3 flex items-center justify-center"
        style={{
          borderColor: "oklch(22% 0.04 240)",
          background: "oklch(13% 0.02 240)",
        }}
      >
        <p className="text-xs" style={{ color: "oklch(35% 0.04 240)" }}>
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: "oklch(45% 0.04 240)" }}
          >
            Built with ❤️ using caffeine.ai
          </a>
        </p>
      </footer>

      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiExplorer />
    </QueryClientProvider>
  );
}
