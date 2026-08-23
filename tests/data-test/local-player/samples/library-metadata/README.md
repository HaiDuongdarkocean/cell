# Library Metadata Test Samples

Real-world data samples for testing the Chrome extension video player's **library** and **resume position** features.

## Files

| File | Description | Count |
|------|-------------|-------|
| `video-entries.json` | Video library entries (Plex/Jellyfin/Kodi-style metadata) | 26 entries |
| `history-entries.json` | Per-session watch history (append-only, sorted by `watchedAt` desc) | 22 entries |
| `sort-scenarios.json` | Library sort algorithm test scenarios | 12 scenarios |
| `resume-scenarios.json` | Resume position prompt logic test scenarios | 12 scenarios |

## Data Sources & Patterns

Metadata field conventions modeled on real media servers:

- **Plex** — `addedAt` (epoch seconds), `lastViewedAt`, `viewOffset` (ms), `duration` (ms), `Media` container with `width`/`height`/`videoCodec`.
- **Jellyfin** — `UserData.PlaybackPositionTicks` (10000 ticks = 1ms), `Played`, `PlayCount`, `LastPlayedDate`. Playback history proposal (jellyfin-meta #136) uses append-only per-session rows with `DateStarted`/`DateStopped`/`StartPositionTicks`/`PositionTicks`.
- **Kodi** — NFO files with `title`, `originaltitle`, `filenameandpath`.

All positions/durations in this dataset use **milliseconds** (the extension's internal unit), not Plex epoch-seconds or Jellyfin ticks.

## Video Entries Coverage

26 entries covering all 24 requested cases:

1. Recently watched movie, finished (vid-001)
2. Movie watched halfway (vid-002)
3. Movie never watched (vid-003)
4. TV episode recently watched (vid-004)
5. TV episode watched long ago (vid-005)
6. Anime with Japanese title (vid-006)
7. Korean drama (vid-007)
8. Chinese movie (vid-008)
9. Documentary (vid-009)
10. Music video, short (vid-010)
11. 4K movie 3840×2160 (vid-008, vid-011)
12. 720p movie (vid-010, vid-012)
13. 1080p movie (vid-001, vid-013, …)
14. Old movie, added 2 years ago (vid-014)
15. Recently added movie, added today (vid-015)
16. Movie with very long name (vid-016)
17. Movie with special chars (vid-017 — Amélie)
18. Movie watched multiple times, resumePositionMs=0 (vid-018)
19. Movie paused near end (vid-019)
20. Movie paused at start (vid-020)
21. Short video 5 min (vid-021)
22. Very long video 3h (vid-022)
23. Same title different year (vid-023a Dune 1984 / vid-023b Dune 2021)
24. Same title different resolution (vid-024a 1080p / vid-024b 2160p Blade Runner)

## History Entries Coverage

22 entries (sorted by `watchedAt` descending) covering all 15 requested cases:

1. Full movie in one sitting (hist-001)
2. 10 min then stopped (hist-002)
3. Multiple sessions same videoId (hist-003a/b/c)
4. 5 min then skipped to end (hist-004)
5. Re-watched after full watch (hist-005a → hist-005b)
6. Watched yesterday (hist-006)
7. Watched a month ago (hist-007)
8. Watched a year ago (hist-008)
9. Very short session 30s (hist-009)
10. Long session 2h (hist-010)
11. Multiple videos same day (hist-011a/b/c)
12. Same video different days (hist-012a/b)
13. Watched to 90% then stopped (hist-013)
14. Watched to 1% then stopped (hist-014)
15. Resume after pause — position matches previous (hist-015a → hist-015b)

## Resume Prompt Logic (encoded in `resume-scenarios.json`)

- Prompt when `10s <= position < 95% of duration`.
- No prompt when `position < 10s` (too short to bother).
- No prompt when `position >= 95%` (treated as finished).
- No prompt when `position > duration` or `position == 0`.
- Time format: `M:SS` under 1h, `H:MM:SS` at/over 1h.
