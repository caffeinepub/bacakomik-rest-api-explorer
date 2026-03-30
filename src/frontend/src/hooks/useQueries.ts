import { useQuery } from "@tanstack/react-query";
import { useActor } from "./useActor";

export function useLatestChapters(
  page: number,
  perPage: number,
  enabled = true,
) {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["latestChapters", page, perPage],
    queryFn: async () => {
      if (!actor) return "{}";
      return actor.getLatestChapters(BigInt(page), BigInt(perPage));
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

export function useSearchComics(query: string, page: number, enabled = true) {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["searchComics", query, page],
    queryFn: async () => {
      if (!actor) return "{}";
      return actor.searchComics(query, BigInt(page));
    },
    enabled: !!actor && !isFetching && enabled && query.length > 0,
  });
}

export function useComicBySlug(slug: string, enabled = true) {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["comicBySlug", slug],
    queryFn: async () => {
      if (!actor) return "{}";
      return actor.getComicBySlug(slug);
    },
    enabled: !!actor && !isFetching && enabled && slug.length > 0,
  });
}

export function useChaptersByComic(
  categoryId: number,
  page: number,
  enabled = true,
) {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["chaptersByComic", categoryId, page],
    queryFn: async () => {
      if (!actor) return "{}";
      return actor.getChaptersByComic(BigInt(categoryId), BigInt(page));
    },
    enabled: !!actor && !isFetching && enabled && categoryId > 0,
  });
}
