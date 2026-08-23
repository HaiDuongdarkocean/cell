# Spec: Language Profile

> Status: **Final — implementation-ready**.  
> Intent source: `docs/intent/profile-language.md` (confirmed).  
> Schema impact: v22 → v23.

## Objective

Thay thế cấu hình ngôn ngữ phẳng (target/native + style + auto-load + dictionary popup) bằng hệ thống **Language Profile** có thể tạo nhiều profile, kéo thả sắp xếp, chọn active, và gắn tài nguyên dictionary/frequency theo từng profile.

Mục tiêu:
- Người dùng học nhiều ngôn ngữ có thể chuyển nhanh giữa các cặp (native → target) mà không phải sửa đổi từng setting thủ công.
- Tài nguyên dictionary/frequency được gắn với profile target, tránh lookup nhầm hoặc chạm resource sai ngôn ngữ.
- Mỗi profile mang theo style, auto-load, auto-translate, ASR, và dictionary popup settings riêng.
- `selectedSubtitleLanguages` vẫn là global (auto-download subtitle), không nằm trong profile.
- `universalNativeLanguage` là global, làm native mặc định khi profile không override.

### User stories

1. **Tạo profile mới**: User chọn target language → chọn clean hoặc duplicate từ active → profile được thêm, name tự sinh `Native → Target`.
2. **Override native per profile**: User muốn profile tiếng Nhật dùng native là tiếng Anh, trong khi các profile khác dùng tiếng Việt.
3. **Chuyển profile nhanh**: User nhấn cờ target ở universal panel/sidebar → chọn profile khác → toàn bộ overlay + dictionary + resource filter đổi theo.
4. **Drag-drop sắp xếp**: User kéo profile trong danh sách Settings để đổi thứ tự.
5. **Gắn resource vào profile**: User import `BCC_CEDICT` cho tiếng Trung; chỉ resource được chọn trong profile mới được dùng khi lookup.
6. **Migration không mất dữ liệu**: User đang ở schema v22; cập nhật lên v23 tạo default profile từ cấu hình cũ, active vẫn giữ nguyên target/native/style.

### Non-goals / Out of scope

- Backend sync, multi-user.
- Full ISO 639-3 (chỉ ISO 639-1 + BCP-47 variants `zh-hans`, `zh-hant`).
- Global settings: `concurrentDownloads`, `defaultQuality`, `convertToMp4`, `parallelConversion`, `navCluster*`, `subtitleBlockSettings`, `keyboardShortcuts`.
- Per-profile `selectedSubtitleLanguages` — giữ global.
- Auto-detection video language → profile. (có thể ask sau)

---

## Tech Stack / Commands

- React 19 + TypeScript 6, Vite 8, @crxjs/vite-plugin.
- Zustand 5, FSD, named export, không `any`, SSOT components/tokens.
- Storage: `chrome.storage.local` (settings), IndexedDB (resources, per `langCode`).
- Language registry: `src/shared/config/languageRegistry.ts`.

```bash
# Regenerate tokens + build
npm run build

# Dev
npm run dev

# Type check
npm run typecheck

# Unit tests
npm run test:unit

# E2E
npm run test:e2e

# Lint
npm run lint
```

### New dependencies

Không thêm dependency. Dùng component sẵn (`@/shared/ui`) và registry có sẵn.

---

## Data Model

### New types — `src/entities/settings/types.ts`

```typescript
import type { OverlayStyleConfig } from '@/entities/subtitle/types';
import type { DictionaryPopupSettings } from '@/entities/settings/types';

/** A single language learning profile. */
export interface LanguageProfile {
  /** Stable unique id. Generated with `crypto.randomUUID()` in browser, fallback in tests. */
  readonly id: string;
  /** Target language code. ISO 639-1 or BCP-47 variant (`zh-hans`, `zh-hant`). */
  readonly target: string;
  /** Native language code. `''` means inherit from `settings.universalNativeLanguage`. */
  readonly native: string;
  /** Auto-generated display name, e.g. "Tiếng Việt → English". */
  readonly name: string;
  /** 1-based display order. Recomputed after drag-drop. */
  readonly order: number;
  readonly subtitleOverlayTargetStyle: OverlayStyleConfig;
  readonly subtitleOverlayNativeStyle: OverlayStyleConfig;
  readonly subtitleOverlayAutoLoad: boolean;
  readonly subtitleOverlayAutoLoadAsr: boolean;
  readonly subtitleOverlayAutoTranslate: boolean;
  readonly dictionaryPopup: DictionaryPopupSettings;
  /** Active dictionary/frequency resource ids for this profile's target language. */
  readonly resourceIds: number[];
}

/** Settings fields added/modified in schema v23. */
export interface SettingsV23 {
  /** Global native language. Used when a profile's `native === ''`. Default: vi. */
  readonly universalNativeLanguage: string;
  /** All language profiles, sorted by `order`. */
  readonly languageProfiles: LanguageProfile[];
  /** `id` of the currently active profile, or `null` if none selected. */
  readonly activeProfileId: string | null;
}

/** Resolved active profile with inheritance applied. */
export interface ResolvedProfile extends Omit<LanguageProfile, 'native'> {
  /** Resolved native (profile override or universal). */
  readonly native: string;
  /** ISO 639-1 base of `target`; used for dictionary/frequency resource lookup. */
  readonly resourceLangCode: string;
}
```

### Top-level `Settings` fields (resolved cache for backward compatibility)

The existing flat language fields **remain** in `Settings` as a read-only resolved cache populated from `activeProfileId`. `loadSettings()` resolves the active profile and writes these fields into the returned `Settings`; `saveSettings()` re-resolves them before persisting and ignores direct overrides. New code should prefer `getActiveProfileSettings()` or `settings.languageProfiles`.

- `subtitleOverlayTargetLanguage` (resolved from active profile `target`)
- `subtitleOverlayNativeLanguage` (resolved from active profile `native`)
- `subtitleOverlayAutoLoad`
- `subtitleOverlayAutoLoadAsr`
- `subtitleOverlayAutoTranslate`
- `subtitleOverlayTargetStyle`
- `subtitleOverlayNativeStyle`
- `dictionaryPopup`

`selectedSubtitleLanguages` remains top-level and global (not part of profile).

### Helper functions — `src/features/languageProfile/lib/profileResolution.ts`

```typescript
import { toIso6391, isoCodeToLabel } from '@/shared/config/languageRegistry';

/** Build a human-readable profile name. */
export function buildProfileName(
  profileNative: string,
  universalNative: string,
  target: string,
  existingNames: readonly string[],
): string {
  const native = profileNative || universalNative;
  const nativeLabel = isoCodeToLabel(native) ?? native || 'None';
  const targetLabel = isoCodeToLabel(target) ?? target;
  let candidate = `${nativeLabel} → ${targetLabel}`;
  let suffix = 2;
  while (existingNames.includes(candidate)) {
    candidate = `${nativeLabel} → ${targetLabel} (${suffix})`;
    suffix += 1;
  }
  return candidate;
}

/** Resolve a profile, applying universal native fallback and BCP-47 base. */
export function resolveProfile(
  profile: LanguageProfile,
  settings: { universalNativeLanguage: string },
): ResolvedProfile {
  const resolvedNative = profile.native || settings.universalNativeLanguage;
  return {
    ...profile,
    native: resolvedNative,
    resourceLangCode: toIso6391(profile.target),
  };
}

/** Find the active resolved profile, or `null` if none. */
export function getActiveProfileSettings(
  settings: { universalNativeLanguage: string; languageProfiles: LanguageProfile[]; activeProfileId: string | null },
): ResolvedProfile | null {
  if (!settings.activeProfileId || !settings.languageProfiles.length) return null;
  const profile = settings.languageProfiles.find((p) => p.id === settings.activeProfileId);
  if (!profile) return null;
  return resolveProfile(profile, settings);
}
```

### Validation rules

| Rule | Behavior |
|------|----------|
| `target` empty | Block save; target là bắt buộc. |
| `target === native` | Cảnh báo (warning) vì target = native vô nghĩa; vẫn cho phép lưu nhưng hiển thị badge warning. Nếu `native === ''` và resolved native = target, cũng warning. |
| Duplicate `(target, native)` pair | Block thêm/sửa thành pair đã tồn tại (so sánh raw `target` và resolved `native`; `''` resolved ra universal). Sửa native của profile hiện tại thì cho phép. |
| `target` not in `OVERLAY_LANGUAGE_OPTIONS` (except `''`) | Block. |
| `native` not in `OVERLAY_LANGUAGE_OPTIONS` | `''` được chấp nhận; các giá trị khác phải hợp lệ. |
| Order unique | Sau mỗi thao tác CRUD hoặc drag, recompute `order = index + 1` trên sorted list. |

---

## Storage & Migration

### Schema v22 → v23

`CURRENT_SCHEMA_VERSION` đổi từ `22` sang `23`.

```typescript
// src/shared/lib/storage/settingsStore.ts
// (đoạn migrations)
22: (s) => {
  const merged = { ...DEFAULT_SETTINGS, ...s, schemaVersion: 23 } as Record<string, unknown>;

  const oldTarget = (s.subtitleOverlayTargetLanguage as string | undefined) ?? DEFAULT_SETTINGS.subtitleOverlayTargetLanguage;
  const oldNative = (s.subtitleOverlayNativeLanguage as string | undefined) ?? DEFAULT_SETTINGS.subtitleOverlayNativeLanguage;
  const universalNative = oldNative;

  const defaultProfile: LanguageProfile = {
    id: generateProfileId(),
    target: oldTarget,
    native: '',
    name: buildProfileName('', universalNative, oldTarget, []),
    order: 1,
    subtitleOverlayTargetStyle: normalizeOverlayStyle(
      s.subtitleOverlayTargetStyle,
      DEFAULT_OVERLAY_STYLE_TARGET,
    ) as OverlayStyleConfig,
    subtitleOverlayNativeStyle: normalizeOverlayStyle(
      s.subtitleOverlayNativeStyle,
      DEFAULT_OVERLAY_STYLE_NATIVE,
    ) as OverlayStyleConfig,
    subtitleOverlayAutoLoad: s.subtitleOverlayAutoLoad ?? DEFAULT_SETTINGS.subtitleOverlayAutoLoad,
    subtitleOverlayAutoLoadAsr: s.subtitleOverlayAutoLoadAsr ?? DEFAULT_SETTINGS.subtitleOverlayAutoLoadAsr,
    subtitleOverlayAutoTranslate: s.subtitleOverlayAutoTranslate ?? DEFAULT_SETTINGS.subtitleOverlayAutoTranslate,
    dictionaryPopup: (s.dictionaryPopup as DictionaryPopupSettings | undefined) ?? DEFAULT_DICTIONARY_POPUP_SETTINGS,
    resourceIds: [],
  };

  merged.universalNativeLanguage = universalNative;
  merged.languageProfiles = [defaultProfile];
  merged.activeProfileId = defaultProfile.id;

  // Legacy flat fields are kept in storage for this migration; loadSettings()
  // resolves them from the active profile on every load. A later migration
  // can remove them once all consumers have been updated.

  return merged;
},
```

### New defaults in `src/shared/config/config.ts`

```typescript
export const DEFAULT_UNIVERSAL_NATIVE_LANGUAGE = 'vi';

export const DEFAULT_SETTINGS: Settings = {
  // ... (giữ nguyên các global field trước v22)
  universalNativeLanguage: DEFAULT_UNIVERSAL_NATIVE_LANGUAGE,
  languageProfiles: [],
  activeProfileId: null,
  // selectedSubtitleLanguages vẫn global
  selectedSubtitleLanguages: DEFAULT_SELECTED_SUBTITLE_LANGUAGES,
  // ...
};
```

### Quota / limits

- Không giới hạn số lượng profile. Tuy nhiên mỗi `LanguageProfile` chứa nested `dictionaryPopup` (~1KB) + styles + resource ids; nếu `chrome.storage.local` gần quota, `saveSettings` sẽ throw và UI hiển thị `Alert`.
- Không giới hạn `resourceIds`; IndexedDB tài nguyên vẫn được lưu theo `langCode` như cũ.

### Forward compat in `loadSettings`

Sau migration, `loadSettings` cần normalize mỗi profile:
- `subtitleOverlayTargetStyle` / `subtitleOverlayNativeStyle` có `fontWeight`.
- `order` là số nguyên dương liên tiếp.
- Xóa profile `id` trùng lặp (giữ cái đầu).
- Nếu `activeProfileId` không tồn tại trong `languageProfiles`, đặt `activeProfileId = languageProfiles[0]?.id ?? null`.
- Resolve active profile và ghi đè các flat fields (`subtitleOverlayTargetLanguage`, `subtitleOverlayNativeLanguage`, `subtitleOverlayAutoLoad`, v.v.) từ active profile để consumer cũ vẫn hoạt động.

---

## API / Messages

### New message types — `src/entities/message/types.ts`

```typescript
export interface GetActiveProfileRequest {
  readonly type: 'GET_ACTIVE_PROFILE';
}

export interface GetActiveProfileResponse {
  readonly profile: ResolvedProfile | null;
}

export interface SetActiveProfileRequest {
  readonly type: 'SET_ACTIVE_PROFILE';
  readonly profileId: string;
}

export interface SetActiveProfileResponse {
  readonly ok: boolean;
}
```

### Background handlers — `src/entrypoints/background/index.ts`

```typescript
// GET_ACTIVE_PROFILE
const settings = await loadSettings();
const profile = getActiveProfileSettings(settings);
return { profile } as GetActiveProfileResponse;

// SET_ACTIVE_PROFILE
const settings = await loadSettings();
const exists = settings.languageProfiles.some((p) => p.id === request.profileId);
if (!exists) return { ok: false };
await saveSettings({ activeProfileId: request.profileId });
return { ok: true };
```

### Cross-context sync

`chrome.storage.onChanged` listener trong content scripts/options page/universal panel:
- Khi key `settings` thay đổi, gọi `loadSettings()` và broadcast active profile mới qua Zustand store / React context.
- Ưu tiên storage sync; message types chỉ dùng khi cần active profile đồng bộ ngay (ví dụ: universal panel click không muốn chờ 1 tick storage).

---

## UI/UX

### 1. Settings → Language Profile card

Thay thế card hiện tại (`SettingsDialogContent.tsx`, section `languageProfile`) thành:

- **Universal native language** (top): `SearchableSelect`, options `OVERLAY_LANGUAGE_OPTIONS`, value `settings.universalNativeLanguage`. Thay đổi cập nhật `saveSettings({ universalNativeLanguage })`. Các profile có `native === ''` sẽ tự động resolve native mới.
- **Profile list** (bên dưới):
  - Mỗi profile là một `Card` nhỏ / `SettingsRow` kéo dài.
  - Hiển thị: `DragHandle`, tên profile, badge target (cờ/label), badge native, radio chọn active, `IconButton` edit, `IconButton` delete.
  - Drag-and-drop dùng native HTML5 DnD, pattern giống `TtsVoiceManagerPanel.tsx`: kéo đổi `order` trong `languageProfiles`.
- **Add profile button**: `Button` `+ Add profile`, mở `Dialog` hoặc inline form.

#### Add/Edit profile form

```
Target language *     [SearchableSelect target]
Native override       [Checkbox] Use universal native
                      [SearchableSelect native  (disabled nếu dùng universal)]
Duplicate from active [Checkbox]
[Save] [Cancel]
```

- **Clean**: tất cả per-profile settings dùng defaults.
- **Duplicate active**: copy `subtitleOverlay*Style`, `subtitleOverlayAuto*`, `dictionaryPopup`, `resourceIds` từ active profile. `target` vẫn là giá trị mới user chọn. Sau đó validate duplicate pair.
- Không cho phép sửa `target` trong edit mode (vì resourceIds + langCode binding). Muốn đổi target → xóa + tạo mới.
- Cho phép rename `name`? **Không** — name tự sinh, không editable trực tiếp. Nếu target/native thay đổi thì recompute name.

### 2. Universal panel quick switch

- Ở đầu universal panel/sidebar thêm `IconButton` (icon `languages`) hiển thị cờ/lable của `resolvedProfile.target`.
- Click mở `Drawer` (mobile) / `Popover` (desktop) hiển thị danh sách profile:
  - Radio active.
  - Tên + target/native label.
  - Chọn 1 profile → gửi `SET_ACTIVE_PROFILE` hoặc update `activeProfileId` trực tiếp qua settings store.
- Đóng drawer sau chọn. Không cần reload trang.

### 3. Resources card

`ResourcesPanel` chuyển từ:

```tsx
<ResourcesPanel langCode={settings.subtitleOverlayTargetLanguage || 'en'} />
```

sang:

```tsx
const active = getActiveProfileSettings(settings);
<ResourcesPanel
  profile={active}
  onResourceIdsChange={(resourceIds) =>
    updateActiveProfile({ resourceIds })
  }
/>
```

`ResourcesPanel` hiển thị tất cả resources của `resourceLangCode` (ISO 639-1 base) từ IndexedDB, cho phép chọn/deselect từng cái để cập nhật `profile.resourceIds`.

### 4. Shared UI & tokens

Dùng các atom có sẵn, không tự viết CSS class inline:
- `Card`, `SettingsRow`, `SearchableSelect`, `DragHandle`, `Button`, `IconButton`, `Sidebar`, `NavItem`, `Alert`, `Toggle`, `Dialog`, `Drawer`, `Popover`.
- Icon từ `ICON_CATALOG` (`src/shared/icons/index.ts`), ví dụ `languages`, `trash`, `pencil`, `check`, `grip` (cho drag).
- Token từ `tokens.css` (`var(--token)`), không sửa `tokens.css` trực tiếp (nếu cần thì sửa `tokens.json` và chạy build).

### 5. Responsive + a11y

- Desktop: Language Profile card dùng 2 cột cho universal native + add button; danh sách profile 1 cột dọc.
- Mobile (< 768px): danh sách profile full width; quick switch mở bottom `Sheet`/`Drawer`.
- Keyboard:
  - `Tab` qua các control.
  - Drag có thể thực hiện bằng `Space` / `Enter` chọn, `ArrowUp`/`ArrowDown` di chuyển (nếu HTML5 DnD không đủ thì bổ sung nút up/down).
  - `Delete` khi focus vào profile row → confirm xóa.
- ARIA:
  - Danh sách `role="list"`, mỗi item `role="listitem"`.
  - Drag handle có `aria-label="Drag to reorder"`.
  - Active radio dùng `aria-checked`.

---

## Dictionary Integration

### Resource IDs in profile

- `LanguageProfile.resourceIds` là mảng `number[]`.
- IndexedDB tài nguyên vẫn được lưu per `langCode` (ISO 639-1 base), không thay đổi `resourceRepository.ts`.
- `lookupOrchestrator` nhận thêm thông tin active profile để filter.

### Changes in `src/features/dictionaryPopup/logic/lookupOrchestrator.ts`

1. **Dictionary probe filter** (`createDictionaryProbeAsync`):

```typescript
const resources = await getAllResources(langCode);
const activeResourceIds = resolvedProfile?.resourceIds ?? [];
const filteredResources = activeResourceIds.length > 0
  ? resources.filter((r) => r.id !== undefined && activeResourceIds.includes(r.id))
  : resources;
const dictResources = filteredResources.filter((r) => r.type === 'DICTIONARY');
```

2. **Phrase index filter** (`tryEnglishPhraseMatchAll`):

```typescript
let indexes = await getAllPhraseIndexes(langCode);
if (activeResourceIds.length > 0) {
  indexes = indexes.filter((s) => activeResourceIds.includes(s.resourceId));
}
```

3. **Lookup request** (`LookupRequest`):

```typescript
export interface LookupRequest {
  // ... existing fields
  /** Active profile resource ids to limit dictionary/phrase lookup. */
  readonly resourceIds?: number[];
}
```

Callers (popup, content script) phải lấy `ResolvedProfile` và truyền `resourceIds`. Nếu `resourceIds` không truyền, fallback toàn bộ resources của `langCode`.

### Resource panel behavior

- `ResourcesPanel` load `getAllResources(resourceLangCode)`.
- Checkbox mỗi resource: on check → thêm `id` vào `resourceIds`; on uncheck → xóa `id`.
- Lưu ngay `saveSettings({ languageProfiles: updatedProfiles })`.

---

## Testing Strategy

### Unit tests

| Module | Test file | Cases |
|--------|-----------|-------|
| `buildProfileName` | `src/features/languageProfile/lib/buildProfileName.test.ts` | Sinh tên, duplicate suffix, `''` native, BCP-47 target. |
| `resolveProfile` | `src/features/languageProfile/lib/resolveProfile.test.ts` | Inherit universal, `toIso6391` base, `native` override. |
| `getActiveProfileSettings` | `src/features/languageProfile/lib/getActiveProfileSettings.test.ts` | Active found/not found, empty list. |
| `validateLanguageProfile` | `src/features/languageProfile/lib/validateLanguageProfile.test.ts` | target empty, target=native warning, duplicate pair, invalid lang. |
| v22→v23 migration | `src/shared/lib/storage/settingsStore.test.ts` | Tạo default profile, giữ style, xóa flat fields, active set. |
| `createDictionaryProbeAsync` | `src/features/dictionaryPopup/logic/lookupOrchestrator.test.ts` | Filter theo `resourceIds`, fallback toàn bộ khi rỗng. |

### Integration tests

- `profileStore.test.ts`: load/save qua `chrome.storage.local` mock, cross-tab sync qua `storage.onChanged`.
- `settingsStore.test.ts`: migration v22 → v23, forward compat, missing `activeProfileId`.

### UI tests (jest + Testing Library)

- `LanguageProfilePanel.test.tsx`: add profile, duplicate block, drag-drop reorder (simulate), select active, edit native override.
- `UniversalProfileSwitcher.test.tsx`: render button, mở list, chọn active, gửi message.

### E2E (Playwright)

- `profile-language.spec.ts`:
  1. Mở Options → Settings → Language Profile.
  2. Đổi universal native.
  3. Add profile `English → Japanese`.
  4. Drag profile mới lên đầu.
  5. Chọn active khác từ universal panel.
  6. Mở video, bật popup, verify lookup chỉ dùng resource đã chọn.

---

## Boundaries (Always / Ask / Never)

| Always | Ask | Never |
|--------|-----|-------|
| Dùng `getActiveProfileSettings()` để lấy target/native/style cho overlay, subtitle, và popup. | Tự ý thêm ISO 639-3 hoặc BCP-47 variant mới. | Đặt `selectedSubtitleLanguages` vào profile. |
| Validate duplicate `(target, native)` pair trước khi lưu. | Dùng `universalNativeLanguage` làm `native` mặc định mới hay không. | Đổi `resourceRepository.ts` thành lưu per profile thay vì per `langCode`. |
| Recompute `order` sau mỗi CRUD/drag. | Có hỗ trợ rename `name` thủ công không. | Lưu toàn bộ nội dung dictionary/frequency vào `chrome.storage.local`. |
| Dùng `languageRegistry.ts` cho label và `toIso6391` cho resource base. | Thêm dependency drag-drop thứ ba. | Dùng `any` hoặc default export trong code mới. |
| Chạy `npm run build` sau khi thay đổi types hoặc settings store. | Thêm quota limit cứng (e.g. max 50 profiles). | Để consumer cũ đọc flat fields mà không cập nhật. |

---

## Success Criteria

1. **AC-MIG-1**: Schema version tăng từ `22` lên `23`; `CURRENT_SCHEMA_VERSION = 23`.
2. **AC-MIG-2**: Mở settings từ schema v22 tự tạo 1 default profile chứa đầy đủ target, native, style, auto-load, dictionary popup, resource ids rỗng; active profile trỏ đến default; không mất dữ liệu cũ.
3. **AC-DATA-1**: `Settings` chứa `universalNativeLanguage`, `languageProfiles: LanguageProfile[]`, `activeProfileId: string | null`; `selectedSubtitleLanguages` vẫn top-level.
4. **AC-DATA-2**: Các flat field cũ (`subtitleOverlayTargetLanguage`, …) vẫn còn trong `Settings` top-level dưới dạng resolved cache từ active profile; `loadSettings()` tự động cập nhật chúng.
5. **AC-RESOLVE-1**: `getActiveProfileSettings(settings)` trả về `ResolvedProfile | null`, tự động merge `universalNativeLanguage` khi `profile.native === ''`.
6. **AC-RESOLVE-2**: `ResolvedProfile.resourceLangCode` là ISO 639-1 base của `target` (`zh-hans` → `zh`).
7. **AC-VAL-1**: Không thể tạo profile có `target` trùng với profile khác có cùng `(target, native)` đã resolved.
8. **AC-VAL-2**: `target === native` (resolved) hiển thị warning nhưng không block lưu.
9. **AC-UI-1**: Settings card Language Profile hiển thị universal native dropdown ở trên + danh sách profile card + nút Add profile.
10. **AC-UI-2**: Danh sách profile hỗ trợ drag-drop reorder, chọn active, edit native override, delete.
11. **AC-UI-3**: Universal panel/sidebar có nút cờ target active, click mở danh sách, chọn profile khác đổi active trong < 300ms.
12. **AC-DICT-1**: `lookupOrchestrator` chỉ load dictionary/frequency/phrase indexes từ `resourceIds` của active profile; nếu `resourceIds` rỗng thì fallback toàn bộ resources của `resourceLangCode`.
13. **AC-DICT-2**: `ResourcesPanel` nhận active profile, cho phép chọn/deselect resource để cập nhật `profile.resourceIds`.
14. **AC-PERF-1**: Mở Settings Language Profile, add profile, switch active đều < 3s trên máy RAM 1GB.
15. **AC-A11Y-1**: Danh sách profile focusable bằng Tab; drag có thể thực hiện bằng keyboard hoặc có nút up/down; có `aria-label` đầy đủ.
16. **AC-TEST-1**: Unit tests migration, resolution, validation, lookup filter đạt > 90% pass.
17. **AC-E2E-1**: E2E scenario add/switch profile active pass trên Playwright.

---

## Open Questions

1. **Cho phép user rename `name` thủ công không?** Hiện spec chọn auto-generated; nếu anh yêu muốn editable thì cần thêm field `isNameCustom: boolean`.
2. **Profile có nên bao gồm `tts.voices` per target?** Hiện `TtsSettings` nằm trong `dictionaryPopup`. Có thể mở rộng sau.
3. **Auto-switch active profile theo ngôn ngữ video/subtitle được detect?** Out of scope, nhưng nếu muốn sau này thì mở extension bằng `SET_ACTIVE_PROFILE` khi detect.

---

## ADR

### ADR-1: Why per-profile instead of global language settings?

- User persona 10–25 tuổi thường học >1 ngôn ngữ; mỗi cặp native→target có style, tài nguyên, và trigger khác nhau.
- Per-profile cô lập `dictionaryPopup`, style, auto-load, resource; tránh side-effect khi đổi target.
- Global `universalNativeLanguage` vẫn giữ native mặc định, giảm thao tác lặp lại.

### ADR-2: Why ISO 639-1 + BCP-47 variants for target?

- `languageRegistry.ts` đã có 182 ISO 639-1 entries + `zh-hans`, `zh-hant` variants, đủ cho UI subtitle và overlay.
- Tài nguyên dictionary/frequency chỉ cần ISO 639-1 base (`zh`); variant dùng `toIso6391()` để mapping.
- ISO 639-3 để sau vì tăng độ phức tạp validation và UI dropdown mà chưa cần thiết.

### ADR-3: Why store only `resourceIds` in the profile?

- IndexedDB tài nguyên per `langCode` là SSOT; resource data lớn (từ điển) không nên duplicate vào `chrome.storage.local`.
- `resourceIds` nhỏ gọn, dễ serialize, cho phép profile A dùng subset CEDICT, profile B dùng subset KANJIDIC cùng `zh`.
- Filter tại `lookupOrchestrator` giữ zero-copy: chỉ đọc resource phù hợp.
