import { useQuery } from "@tanstack/react-query";
import { useActor } from "./useActor";

export function usePopularComics(enabled = true) {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["popularComics"],
    queryFn: async () => {
      if (!actor) return "";
      return actor.getPopularComics();
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

export function useLatestComics(page: number, enabled = true) {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["latestComics", page],
    queryFn: async () => {
      if (!actor) return "";
      return actor.getLatestComics(BigInt(page));
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

export function useColoredComics(page: number, enabled = true) {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["coloredComics", page],
    queryFn: async () => {
      if (!actor) return "";
      return actor.getColoredComics(BigInt(page));
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

export function useComicList(page: number, enabled = true) {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["comicList", page],
    queryFn: async () => {
      if (!actor) return "";
      return actor.getComicList(BigInt(page));
    },
    enabled: !!actor && !isFetching && enabled,
  });
}

export function useGenreList(enabled = true) {
  const { actor, isFetching } = useActor();
  return useQuery<string>({
    queryKey: ["genreList"],
    queryFn: async () => {
      if (!actor) return "";
      return actor.getGenreList();
    },
    enabled: !!actor && !isFetching && enabled,
  });
}
