# Learned Bug Fixes

Level 2 reference — load when debugging similar issues or working on auto-download/tab-scoping.

## Khái niệm hóa template (sau khi test pass + debug pass)

Khi fix bug → test pass → khái niệm hóa thành nguyên lý (abstract principle) để apply cho nhiều trường hợp:

### Format nguyên lý
```markdown
## <Tên nguyên lý> (ngắn, abstract)

### Nguyên lý
<1-2 câu mô tả nguyên lý, không cụ thể case>

### Cases đã gặp
- <Bug cụ thể dẫn đến nguyên lý này>
- <Bug khác liên quan>

### Apply cho
- <Tình huống khác nguyên lý này đúng>
- <Framework/library khác có pattern tương tự>
```

### Khi nào khái niệm hóa
- Sau khi test pass + debug pass (rule trong AGENTS.md)
- Bug có pattern tái sử dụng được (không phải 1-off)
- Bug liên quan đến framework/library/library behavior (không phải business logic)

### Khi nào KHÔNG khái niệm hóa
- Bug là 1-off (không tái sử dụng được)
- Bug là business logic (không phải pattern framework)
- Bug chưa đủ thông tin để abstract (chưa test pass)

---

## Broadcasts fan out → scope by identifier

### Nguyên lý
Broadcasts fan out to every listener — cannot target specific listener. Scope by identifier in payload, listener filters by identifier.

### Cases đã gặp
- Tab-Scoping bug: chrome.runtime.sendMessage cannot target specific tab → pass tabId in payload, popup filters by tabId

### Apply cho
- chrome.runtime.sendMessage (Chrome extension)
- WebSocket rooms (server broadcasts to all rooms, client filters by roomId)
- Event emitters (EventEmitter emits to all listeners, filter by event type)
- Database queries (query returns all rows, filter by WHERE clause)

---

## Separate dedup from catch-up

### Nguyên lý
Separate "don't redo" (dedup) from "allow new items" (catch-up). Use id-level dedup for items already processed, allow re-run for new items.

### Cases đã gặp
- Auto-download subtitle catch-up: URL guard (coarse) blocked subtitle catch-up → id-level dedup (fine) allows catch-up without re-downloading video

### Apply cho
- Incremental processing (polling with diff)
- Caching with invalidation (cache by id, invalidate by key)
- Data synchronization (sync by id, allow new items)

---

## Gather candidates + filter by explicit criteria

### Nguyên lý
Don't assume query results match intent. Gather candidates from several query shapes, then filter by explicit criteria.

### Cases đã gặp
- Edge app-window leak: `chrome.tabs.query({ active: true, currentWindow: false })` returned app-window tab → gather 3 query shapes + filter `chrome-extension://` URLs

### Apply cho
- chrome.tabs.query (Chrome extension)
- Database queries with complex WHERE (gather rows, filter by criteria)
- API responses with mixed data types (gather all, filter by type)
