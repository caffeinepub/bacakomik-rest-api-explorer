# BacaKomik REST API Explorer

## Current State
Backend uses WordPress REST API (`https://bacakomik.my/wp-json/wp/v2/`) with endpoints for latest chapters, search, comic by slug, chapters by comic. Frontend displays 5 tabs.

## Requested Changes (Diff)

### Add
- 5 new backend functions fetching from specific BacaKomik HTML page URLs
- Frontend tabs updated to match new endpoints

### Modify
- Backend: replace all WP REST API URLs with direct page scraping
  - `getPopularComics()` -> GET https://bacakomik.my/komik-populer/
  - `getLatestComics(page)` -> GET https://bacakomik.my/komik-terbaru/?page=N
  - `getColoredComics(page)` -> GET https://bacakomik.my/komik-berwarna/?page=N
  - `getComicList(page)` -> GET https://bacakomik.my/daftar-komik/?page=N
  - `getGenreList()` -> GET https://bacakomik.my/daftar-genre/
- Frontend: update 5 endpoint tabs to match new functions, parse returned HTML to extract comic data (title, cover image, link), display as cards

### Remove
- Old WP REST API functions: getLatestChapters, searchComics, getComicBySlug, getChaptersByComic
- Chapter images tab (or adapt to work with scraped data)

## Implementation Plan
1. Update backend main.mo with 5 new HTTP outcall functions
2. Regenerate backend.d.ts
3. Update App.tsx: 5 endpoint tabs, HTML parsing logic, comic card display
