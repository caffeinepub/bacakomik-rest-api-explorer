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
  Eye,
  Hash,
  Image,
  List,
  Loader2,
  Search,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

const queryClient = new QueryClient();

const BASE_URL = "https://bacakomik.my/wp-json/wp/v2/";

type EndpointId =
  | "latestChapters"
  | "searchComics"
  | "comicBySlug"
  | "chaptersByComic"
  | "chapterImages";

interface Endpoint {
  id: EndpointId;
  label: string;
  method: string;
  path: string;
  description: string;
  icon: React.ReactNode;
}

const ENDPOINTS: Endpoint[] = [
  {
    id: "latestChapters",
    label: "Latest Chapters",
    method: "GET",
    path: "/posts",
    description: "Fetch latest comic chapters",
    icon: <Zap className="w-4 h-4" />,
  },
  {
    id: "searchComics",
    label: "Search Comics",
    method: "GET",
    path: "/categories?search=...",
    description: "Search comics by keyword",
    icon: <Search className="w-4 h-4" />,
  },
  {
    id: "comicBySlug",
    label: "Comic by Slug",
    method: "GET",
    path: "/categories?slug=...",
    description: "Get comic details by slug",
    icon: <Hash className="w-4 h-4" />,
  },
  {
    id: "chaptersByComic",
    label: "Chapters by Comic",
    method: "GET",
    path: "/posts?categories=...",
    description: "Get chapters for a comic",
    icon: <List className="w-4 h-4" />,
  },
  {
    id: "chapterImages",
    label: "Chapter Images",
    method: "GET",
    path: "/posts?slug=...",
    description: "Preview chapter pages as images",
    icon: <Image className="w-4 h-4" />,
  },
];

interface ComicImage {
  url: string;
  page: number;
}

function syntaxHighlight(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = "json-number";
        if (/^"/u.test(match)) {
          cls = /:$/.test(match) ? "json-key" : "json-string";
        } else if (/true|false/.test(match)) {
          cls = "json-boolean";
        } else if (/null/.test(match)) {
          cls = "json-null";
        }
        return `<span class="${cls}">${match}</span>`;
      },
    );
}

function extractImagesFromJson(jsonStr: string): ComicImage[] {
  const images: ComicImage[] = [];
  try {
    const data = JSON.parse(jsonStr);
    const posts = Array.isArray(data) ? data : [data];
    for (const post of posts) {
      // Featured media
      const embedded = post._embedded;
      if (embedded) {
        const featuredMedia = embedded["wp:featuredmedia"];
        if (Array.isArray(featuredMedia)) {
          for (const media of featuredMedia) {
            if (media?.source_url) {
              images.push({ url: media.source_url, page: images.length + 1 });
            }
          }
        }
      }
      // Parse content HTML for img tags
      const content = post?.content?.rendered || post?.content || "";
      if (content) {
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        let match: RegExpExecArray | null;
        // biome-ignore lint/suspicious/noAssignInExpressions: regex loop pattern
        while ((match = imgRegex.exec(content)) !== null) {
          const url = match[1];
          if (url && /\.(jpg|jpeg|png|webp|gif)/i.test(url)) {
            images.push({ url, page: images.length + 1 });
          }
        }
      }
      // Direct source_url at root
      if (
        post?.source_url &&
        /\.(jpg|jpeg|png|webp|gif)/i.test(post.source_url)
      ) {
        images.push({ url: post.source_url, page: images.length + 1 });
      }
      // guid.rendered
      if (
        post?.guid?.rendered &&
        /\.(jpg|jpeg|png|webp|gif)/i.test(post.guid.rendered)
      ) {
        images.push({ url: post.guid.rendered, page: images.length + 1 });
      }
    }
  } catch {
    // not json
  }
  return images;
}

function buildUrl(id: EndpointId, params: Record<string, string>): string {
  switch (id) {
    case "latestChapters":
      return `${BASE_URL}posts?page=${params.page || 1}&per_page=${params.perPage || 10}`;
    case "searchComics":
      return `${BASE_URL}categories?search=${encodeURIComponent(params.query || "")}&page=${params.page || 1}`;
    case "comicBySlug":
      return `${BASE_URL}categories?slug=${encodeURIComponent(params.slug || "")}`;
    case "chaptersByComic":
      return `${BASE_URL}posts?categories=${params.categoryId || ""}&page=${params.page || 1}`;
    case "chapterImages":
      return `${BASE_URL}posts?_embed=true&slug=${encodeURIComponent(params.chapterSlug || "")}`;
  }
}

interface ImageReaderProps {
  images: ComicImage[];
  chapterSlug: string;
}

function ImageReader({ images, chapterSlug }: ImageReaderProps) {
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingStates, setLoadingStates] = useState<Record<number, boolean>>(
    () => Object.fromEntries(images.map((_, i) => [i, true])),
  );

  const handleImageLoad = (idx: number) => {
    setLoadingStates((prev) => ({ ...prev, [idx]: false }));
    setLoadedCount((c) => c + 1);
  };

  if (images.length === 0) {
    return (
      <motion.div
        data-ocid="images.empty_state"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-20 gap-4"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "oklch(18% 0.04 240)" }}
        >
          <Image className="w-8 h-8" style={{ color: "oklch(35% 0.04 240)" }} />
        </div>
        <div className="text-center">
          <p
            className="text-sm font-semibold"
            style={{ color: "oklch(60% 0.04 240)" }}
          >
            No images found
          </p>
          <p className="text-xs mt-1" style={{ color: "oklch(40% 0.04 240)" }}>
            Slug "{chapterSlug}" returned no image content
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      data-ocid="images.panel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Reader header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <p
          className="text-xs font-mono"
          style={{ color: "oklch(45% 0.04 240)" }}
        >
          <span style={{ color: "oklch(72% 0.18 195)" }}>{loadedCount}</span>/
          {images.length} pages loaded
        </p>
        <Badge
          className="text-xs font-mono"
          style={{
            background: "oklch(20% 0.06 195)",
            color: "oklch(72% 0.18 195)",
            border: "1px solid oklch(30% 0.1 195)",
          }}
        >
          {images.length} pages
        </Badge>
      </div>

      {/* Comic reader strip */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "oklch(6% 0.01 240)",
          border: "1px solid oklch(20% 0.03 240)",
        }}
      >
        {images.map((img, idx) => (
          <div
            key={img.url}
            data-ocid={`images.item.${idx + 1}`}
            className="relative flex flex-col items-center"
            style={{
              borderBottom:
                idx < images.length - 1
                  ? "1px solid oklch(15% 0.02 240)"
                  : "none",
            }}
          >
            {/* Loading skeleton */}
            {loadingStates[idx] && (
              <div
                data-ocid="images.loading_state"
                className="w-full flex items-center justify-center"
                style={{
                  minHeight: "400px",
                  background: "oklch(10% 0.02 240)",
                }}
              >
                <div className="flex flex-col items-center gap-3">
                  <Skeleton className="w-full max-w-[600px] h-[400px] rounded-none" />
                  <p
                    className="text-xs font-mono"
                    style={{ color: "oklch(35% 0.04 240)" }}
                  >
                    Loading page {idx + 1}...
                  </p>
                </div>
              </div>
            )}
            <img
              src={img.url}
              alt={`Page ${idx + 1}`}
              onLoad={() => handleImageLoad(idx)}
              onError={() => handleImageLoad(idx)}
              style={{
                display: loadingStates[idx] ? "none" : "block",
                width: "100%",
                maxWidth: "800px",
                objectFit: "contain",
                margin: "0 auto",
              }}
            />
            {/* Page number indicator */}
            {!loadingStates[idx] && (
              <div
                className="py-2 px-4 text-xs font-mono"
                style={{ color: "oklch(30% 0.03 240)" }}
              >
                — {idx + 1} —
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

interface ChapterListItemsProps {
  result: string;
  onViewImages: (slug: string) => void;
}

function ChapterListItems({ result, onViewImages }: ChapterListItemsProps) {
  let chapters: Array<{
    slug: string;
    title: { rendered: string };
    id: number;
  }> = [];
  try {
    const parsed = JSON.parse(result);
    chapters = Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }

  if (chapters.length === 0) return null;

  return (
    <div
      className="mb-4 rounded-lg border overflow-hidden"
      style={{
        borderColor: "oklch(25% 0.05 195)",
        background: "oklch(14% 0.03 195)",
      }}
    >
      <div
        className="px-4 py-2 border-b flex items-center gap-2"
        style={{ borderColor: "oklch(22% 0.05 195)" }}
      >
        <Eye className="w-3.5 h-3.5" style={{ color: "oklch(72% 0.18 195)" }} />
        <p
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "oklch(55% 0.08 195)" }}
        >
          Quick Preview
        </p>
      </div>
      <div className="divide-y" style={{ borderColor: "oklch(20% 0.04 195)" }}>
        {chapters.slice(0, 8).map((ch, idx) => (
          <div
            key={ch.id}
            data-ocid={`chapters.item.${idx + 1}`}
            className="flex items-center justify-between px-4 py-2.5 gap-3"
          >
            <p
              className="text-xs font-mono truncate flex-1"
              style={{ color: "oklch(70% 0.04 240)" }}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized WP title
              dangerouslySetInnerHTML={{
                __html: ch.title?.rendered || ch.slug,
              }}
            />
            <Button
              data-ocid={`chapters.view_images.button.${idx + 1}`}
              size="sm"
              variant="ghost"
              onClick={() => onViewImages(ch.slug)}
              className="h-6 px-2 text-xs flex-shrink-0 gap-1"
              style={{
                color: "oklch(72% 0.18 195)",
                border: "1px solid oklch(28% 0.08 195)",
                background: "oklch(16% 0.04 195)",
              }}
            >
              <Image className="w-3 h-3" />
              View
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApiExplorer() {
  const { actor, isFetching: actorLoading } = useActor();
  const [selectedEndpoint, setSelectedEndpoint] =
    useState<EndpointId>("latestChapters");
  const [params, setParams] = useState<Record<string, string>>({
    page: "1",
    perPage: "10",
    query: "",
    slug: "",
    categoryId: "",
    chapterSlug: "",
  });
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [imageResults, setImageResults] = useState<ComicImage[] | null>(null);

  const currentUrl = buildUrl(selectedEndpoint, params);

  const runQuery = useCallback(async () => {
    if (!actor) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setImageResults(null);
    try {
      if (selectedEndpoint === "chapterImages") {
        // Client-side fetch for image preview
        const url = buildUrl("chapterImages", params);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const jsonStr = JSON.stringify(raw, null, 2);
        const images = extractImagesFromJson(jsonStr);
        setImageResults(images);
        setResult(jsonStr);
      } else {
        let raw: string;
        switch (selectedEndpoint) {
          case "latestChapters":
            raw = await actor.getLatestChapters(
              BigInt(params.page || 1),
              BigInt(params.perPage || 10),
            );
            break;
          case "searchComics":
            raw = await actor.searchComics(
              params.query || "",
              BigInt(params.page || 1),
            );
            break;
          case "comicBySlug":
            raw = await actor.getComicBySlug(params.slug || "");
            break;
          case "chaptersByComic":
            raw = await actor.getChaptersByComic(
              BigInt(params.categoryId || 0),
              BigInt(params.page || 1),
            );
            break;
        }
        try {
          const parsed = JSON.parse(raw);
          setResult(JSON.stringify(parsed, null, 2));
        } catch {
          setResult(raw);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [actor, selectedEndpoint, params]);

  // Auto-fetch on initial actor load
  if (actor && !actorLoading && !hasInitialized) {
    setHasInitialized(true);
    runQuery();
  }

  const copyJson = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    toast.success("JSON copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const updateParam = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleViewImages = (slug: string) => {
    setParams((prev) => ({ ...prev, chapterSlug: slug }));
    setSelectedEndpoint("chapterImages");
    setResult(null);
    setError(null);
    setImageResults(null);
  };

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
              style={{
                color: "oklch(88% 0.02 240)",
                fontFamily: "var(--font-sans)",
              }}
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
                borderColor: "oklch(30% 0.08 145)",
                color: "oklch(65% 0.15 145)",
                background: "oklch(16% 0.04 145)",
              }}
            >
              WP REST API v2
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
          className="w-64 border-r flex-shrink-0 flex flex-col"
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
                  setImageResults(null);
                }}
                className="w-full text-left px-3 py-2.5 rounded-md transition-all duration-150 group"
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
                      style={{ color: "oklch(45% 0.04 240)", fontSize: "10px" }}
                    >
                      {ep.method} {ep.path.split("?")[0]}
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

            {/* Parameters */}
            <div className="flex flex-wrap gap-4 mb-4">
              <AnimatePresence mode="wait">
                {selectedEndpoint === "latestChapters" && (
                  <motion.div
                    key="latestChapters"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-4"
                  >
                    <div className="flex flex-col gap-1">
                      <Label
                        className="text-xs"
                        style={{ color: "oklch(55% 0.04 240)" }}
                      >
                        page
                      </Label>
                      <Input
                        data-ocid="params.page.input"
                        value={params.page}
                        onChange={(e) => updateParam("page", e.target.value)}
                        className="w-20 h-8 text-sm font-mono"
                        style={{
                          background: "oklch(10% 0.02 240)",
                          borderColor: "oklch(25% 0.04 240)",
                          color: "oklch(88% 0.02 240)",
                        }}
                        placeholder="1"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label
                        className="text-xs"
                        style={{ color: "oklch(55% 0.04 240)" }}
                      >
                        per_page
                      </Label>
                      <Input
                        data-ocid="params.perPage.input"
                        value={params.perPage}
                        onChange={(e) => updateParam("perPage", e.target.value)}
                        className="w-20 h-8 text-sm font-mono"
                        style={{
                          background: "oklch(10% 0.02 240)",
                          borderColor: "oklch(25% 0.04 240)",
                          color: "oklch(88% 0.02 240)",
                        }}
                        placeholder="10"
                      />
                    </div>
                  </motion.div>
                )}
                {selectedEndpoint === "searchComics" && (
                  <motion.div
                    key="searchComics"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-4"
                  >
                    <div className="flex flex-col gap-1">
                      <Label
                        className="text-xs"
                        style={{ color: "oklch(55% 0.04 240)" }}
                      >
                        search
                      </Label>
                      <Input
                        data-ocid="params.query.input"
                        value={params.query}
                        onChange={(e) => updateParam("query", e.target.value)}
                        className="w-48 h-8 text-sm font-mono"
                        style={{
                          background: "oklch(10% 0.02 240)",
                          borderColor: "oklch(25% 0.04 240)",
                          color: "oklch(88% 0.02 240)",
                        }}
                        placeholder="one piece..."
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label
                        className="text-xs"
                        style={{ color: "oklch(55% 0.04 240)" }}
                      >
                        page
                      </Label>
                      <Input
                        data-ocid="params.searchPage.input"
                        value={params.page}
                        onChange={(e) => updateParam("page", e.target.value)}
                        className="w-20 h-8 text-sm font-mono"
                        style={{
                          background: "oklch(10% 0.02 240)",
                          borderColor: "oklch(25% 0.04 240)",
                          color: "oklch(88% 0.02 240)",
                        }}
                        placeholder="1"
                      />
                    </div>
                  </motion.div>
                )}
                {selectedEndpoint === "comicBySlug" && (
                  <motion.div
                    key="comicBySlug"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-4"
                  >
                    <div className="flex flex-col gap-1">
                      <Label
                        className="text-xs"
                        style={{ color: "oklch(55% 0.04 240)" }}
                      >
                        slug
                      </Label>
                      <Input
                        data-ocid="params.slug.input"
                        value={params.slug}
                        onChange={(e) => updateParam("slug", e.target.value)}
                        className="w-64 h-8 text-sm font-mono"
                        style={{
                          background: "oklch(10% 0.02 240)",
                          borderColor: "oklch(25% 0.04 240)",
                          color: "oklch(88% 0.02 240)",
                        }}
                        placeholder="one-piece"
                      />
                    </div>
                  </motion.div>
                )}
                {selectedEndpoint === "chaptersByComic" && (
                  <motion.div
                    key="chaptersByComic"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-4"
                  >
                    <div className="flex flex-col gap-1">
                      <Label
                        className="text-xs"
                        style={{ color: "oklch(55% 0.04 240)" }}
                      >
                        category_id
                      </Label>
                      <Input
                        data-ocid="params.categoryId.input"
                        value={params.categoryId}
                        onChange={(e) =>
                          updateParam("categoryId", e.target.value)
                        }
                        className="w-32 h-8 text-sm font-mono"
                        style={{
                          background: "oklch(10% 0.02 240)",
                          borderColor: "oklch(25% 0.04 240)",
                          color: "oklch(88% 0.02 240)",
                        }}
                        placeholder="12345"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label
                        className="text-xs"
                        style={{ color: "oklch(55% 0.04 240)" }}
                      >
                        page
                      </Label>
                      <Input
                        data-ocid="params.chapPage.input"
                        value={params.page}
                        onChange={(e) => updateParam("page", e.target.value)}
                        className="w-20 h-8 text-sm font-mono"
                        style={{
                          background: "oklch(10% 0.02 240)",
                          borderColor: "oklch(25% 0.04 240)",
                          color: "oklch(88% 0.02 240)",
                        }}
                        placeholder="1"
                      />
                    </div>
                  </motion.div>
                )}
                {selectedEndpoint === "chapterImages" && (
                  <motion.div
                    key="chapterImages"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-4"
                  >
                    <div className="flex flex-col gap-1">
                      <Label
                        className="text-xs"
                        style={{ color: "oklch(55% 0.04 240)" }}
                      >
                        chapter_slug
                      </Label>
                      <Input
                        data-ocid="params.chapterSlug.input"
                        value={params.chapterSlug}
                        onChange={(e) =>
                          updateParam("chapterSlug", e.target.value)
                        }
                        className="w-72 h-8 text-sm font-mono"
                        style={{
                          background: "oklch(10% 0.02 240)",
                          borderColor: "oklch(25% 0.04 240)",
                          color: "oklch(88% 0.02 240)",
                        }}
                        placeholder="one-piece-chapter-1100"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              data-ocid="request.submit_button"
              onClick={runQuery}
              disabled={loading || actorLoading || !actor}
              className="font-semibold"
              style={{
                background: "oklch(72% 0.18 195)",
                color: "oklch(12% 0.02 240)",
                minWidth: "140px",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : selectedEndpoint === "chapterImages" ? (
                <>
                  <Image className="w-4 h-4 mr-2" />
                  Preview Images
                </>
              ) : (
                <>Send Request</>
              )}
            </Button>
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
              <p
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "oklch(45% 0.04 240)" }}
              >
                {selectedEndpoint === "chapterImages"
                  ? "Image Preview"
                  : "Response"}
              </p>
              {result && selectedEndpoint !== "chapterImages" && (
                <Button
                  data-ocid="response.copy.button"
                  variant="ghost"
                  size="sm"
                  onClick={copyJson}
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
                  {copied ? "Copied!" : "Copy JSON"}
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
                      className="flex flex-col items-center justify-center py-20 gap-4"
                    >
                      <Loader2
                        className="w-8 h-8 animate-spin"
                        style={{ color: "oklch(72% 0.18 195)" }}
                      />
                      <p
                        className="text-sm font-mono"
                        style={{ color: "oklch(45% 0.04 240)" }}
                      >
                        {selectedEndpoint === "chapterImages"
                          ? "Loading chapter images..."
                          : "Awaiting response..."}
                      </p>
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
                  {/* Chapter Images view */}
                  {selectedEndpoint === "chapterImages" &&
                    imageResults !== null &&
                    !loading && (
                      <motion.div
                        key="imageReader"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        <ImageReader
                          images={imageResults}
                          chapterSlug={params.chapterSlug}
                        />
                      </motion.div>
                    )}
                  {/* JSON result for non-image endpoints */}
                  {result &&
                    !loading &&
                    selectedEndpoint !== "chapterImages" && (
                      <motion.div
                        key="result"
                        data-ocid="response.success_state"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        {/* Quick preview for chaptersByComic */}
                        {selectedEndpoint === "chaptersByComic" && (
                          <ChapterListItems
                            result={result}
                            onViewImages={handleViewImages}
                          />
                        )}
                        <pre
                          className="text-sm font-mono leading-relaxed"
                          style={{
                            color: "oklch(80% 0.02 240)",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                          // biome-ignore lint/security/noDangerouslySetInnerHtml: controlled JSON syntax highlighting
                          dangerouslySetInnerHTML={{
                            __html: syntaxHighlight(result),
                          }}
                        />
                      </motion.div>
                    )}
                  {!result && !loading && !error && !imageResults && (
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
                        {selectedEndpoint === "chapterImages" ? (
                          <Image
                            className="w-6 h-6"
                            style={{ color: "oklch(35% 0.04 240)" }}
                          />
                        ) : (
                          <BookOpen
                            className="w-6 h-6"
                            style={{ color: "oklch(35% 0.04 240)" }}
                          />
                        )}
                      </div>
                      <p
                        className="text-sm"
                        style={{ color: "oklch(40% 0.04 240)" }}
                      >
                        {selectedEndpoint === "chapterImages"
                          ? "Enter a chapter slug and click Preview Images"
                          : "Send a request to see the response"}
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
