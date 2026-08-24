#!/usr/bin/env bash
# M3 Design Standard — Auto-audit script
# Scans codebase for design system violations
# Usage: bash .agents/skills/m3-design-standard/audit/audit.sh

set -euo pipefail

ROOT="${1:-src}"
VIOLATIONS=0

report() {
  local file="$1"
  local line="$2"
  local type="$3"
  local detail="$4"
  echo "  $file:$line — $type: $detail"
  ((VIOLATIONS++)) || true
}

echo "=== M3 Design Standard Audit ==="
echo "Scanning: $ROOT"
echo ""

# 1. Hardcoded border-radius (should use var(--radius-*))
echo "--- [1] Hardcoded border-radius ---"
while IFS= read -r match; do
  file=$(echo "$match" | cut -d: -f1)
  line=$(echo "$match" | cut -d: -f2)
  report "$file" "$line" "border-radius" "should use var(--radius-*)"
done < <(grep -rn 'border-radius:\s*[0-9]' "$ROOT" --include='*.css' --include='*.module.css' 2>/dev/null || true)
echo ""

# 2. Hardcoded padding (should use var(--space-*)) — exclude:
#    - padding: 0 (token-less zero is OK)
#    - --card-padding: 0 (CSS custom property, not padding declaration)
#    Match only "padding:" not "--card-padding:" or "--input-padding:"
echo "--- [2] Hardcoded padding ---"
while IFS= read -r match; do
  file=$(echo "$match" | cut -d: -f1)
  line=$(echo "$match" | cut -d: -f2)
  report "$file" "$line" "padding" "should use var(--space-*)"
done < <(grep -rnP '(?<![-\w])padding:\s*[0-9]' "$ROOT" --include='*.css' --include='*.module.css' 2>/dev/null | grep -v 'var(' | grep -v 'padding:\s*0' || true)
echo ""

# 3. Hardcoded margin (should use var(--space-*)) — exclude margin: 0 (token-less zero is OK)
echo "--- [3] Hardcoded margin ---"
while IFS= read -r match; do
  file=$(echo "$match" | cut -d: -f1)
  line=$(echo "$match" | cut -d: -f2)
  report "$file" "$line" "margin" "should use var(--space-*)"
done < <(grep -rn 'margin:\s*[0-9]' "$ROOT" --include='*.css' --include='*.module.css' 2>/dev/null | grep -v 'var(' | grep -v 'margin:\s*0' || true)
echo ""

# 3b. Hardcoded gap (should use var(--space-*)) — exclude gap: 0 and normal (token-less zero is OK)
echo "--- [3b] Hardcoded gap ---"
while IFS= read -r match; do
  file=$(echo "$match" | cut -d: -f1)
  line=$(echo "$match" | cut -d: -f2)
  report "$file" "$line" "gap" "should use var(--space-*)"
done < <(grep -rnP '(?<![-\w])gap:\s*[0-9]' "$ROOT" --include='*.css' --include='*.module.css' 2>/dev/null | grep -v 'var(' | grep -v 'gap:\s*0' | grep -v 'gap:\s*normal' || true)
echo ""

# 4. Hardcoded font-size (should use var(--font-size-*))
echo "--- [4] Hardcoded font-size ---"
while IFS= read -r match; do
  file=$(echo "$match" | cut -d: -f1)
  line=$(echo "$match" | cut -d: -f2)
  report "$file" "$line" "font-size" "should use var(--font-size-*)"
done < <(grep -rn 'font-size:\s*[0-9]' "$ROOT" --include='*.css' --include='*.module.css' 2>/dev/null | grep -v 'var(' || true)
echo ""

# 5. Hardcoded box-shadow (should use elevation tokens)
echo "--- [5] Hardcoded box-shadow ---"
while IFS= read -r match; do
  file=$(echo "$match" | cut -d: -f1)
  line=$(echo "$match" | cut -d: -f2)
  report "$file" "$line" "box-shadow" "should use elevation token"
done < <(grep -rn 'box-shadow:\s*[0-9]' "$ROOT" --include='*.css' --include='*.module.css' 2>/dev/null || true)
echo ""

# 6. Hardcoded transition duration (should use var(--duration-*))
echo "--- [6] Hardcoded transition duration ---"
while IFS= read -r match; do
  file=$(echo "$match" | cut -d: -f1)
  line=$(echo "$match" | cut -d: -f2)
  report "$file" "$line" "transition duration" "should use var(--duration-*)"
done < <(grep -rn 'transition:.*[0-9]\+ms' "$ROOT" --include='*.css' --include='*.module.css' 2>/dev/null | grep -v 'var(' || true)
echo ""

# 7. Hardcoded cubic-bezier (should use var(--ease-*))
echo "--- [7] Hardcoded cubic-bezier ---"
while IFS= read -r match; do
  file=$(echo "$match" | cut -d: -f1)
  line=$(echo "$match" | cut -d: -f2)
  report "$file" "$line" "cubic-bezier" "should use var(--ease-*)"
done < <(grep -rn 'cubic-bezier(' "$ROOT" --include='*.css' --include='*.module.css' 2>/dev/null | grep -v 'var(' || true)
echo ""

# 8. Emoji in TSX (should use Icon component)
echo "--- [8] Emoji in TSX ---"
while IFS= read -r match; do
  file=$(echo "$match" | cut -d: -f1)
  line=$(echo "$match" | cut -d: -f2)
  report "$file" "$line" "emoji" "should use Icon from ICON_CATALOG"
done < <(grep -rnP '[\x{1F300}-\x{1F9FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]' "$ROOT" --include='*.tsx' 2>/dev/null || true)
echo ""

# 9. Native HTML inputs (should use SSOT shared components)
echo "--- [9] Native HTML inputs ---"
while IFS= read -r match; do
  file=$(echo "$match" | cut -d: -f1)
  line=$(echo "$match" | cut -d: -f2)
  report "$file" "$line" "native input" "should use SSOT component from @/shared/ui"
done < <(grep -rn '<input type="checkbox"\|<input type="radio"\|<select\|<textarea' "$ROOT" --include='*.tsx' 2>/dev/null || true)
echo ""

# 10. Box Model Spacing redundancy (dead spacing — container + child both have spacing)
# Static heuristic: CSS file with many spacing declarations (padding + margin + gap) → likely multi-layer stack.
# Catches Card(padding) > cardBody(padding) > Row(padding) and margin/gap variants.
# Note: This is a heuristic — verify with Phase 2 (runtime measure). False positives possible.
echo "--- [10] Box Model Spacing redundancy (heuristic) ---"
SPACING_VIOLATIONS=0
while IFS= read -r cssfile; do
  # Count total spacing declarations (padding + margin + gap, excluding 0 values)
  spacing_count=$(grep -cP '(?<![-\w])(padding|margin|gap):\s*(?!0[;}\s])' "$cssfile" 2>/dev/null || echo 0)
  if [ "$spacing_count" -gt 4 ]; then
    # Likely a multi-layer spacing stack — flag for Phase 2 review
    first_spacing_line=$(grep -nP '(?<![-\w])(padding|margin|gap):\s*(?!0[;}\s])' "$cssfile" 2>/dev/null | head -1 | cut -d: -f1)
    if [ -n "$first_spacing_line" ]; then
      report "$cssfile" "$first_spacing_line" "spacing stack" "file has $spacing_count spacing declarations — verify no dead spacing (Phase 2: leaf→root measure)"
      ((SPACING_VIOLATIONS++)) || true
    fi
  fi
done < <(find "$ROOT" -name '*.module.css' -type f 2>/dev/null || true)
if [ "$SPACING_VIOLATIONS" -eq 0 ]; then
  echo "  (heuristic — no obvious multi-spacing files flagged)"
fi
echo ""

# 11. Non-SSOT wrappers (feature CSS with .panel/.container/.root — should use atom from @/shared/ui)
# Detects feature-level CSS classes that act as layout wrappers instead of using SSOT components.
# These wrappers may not self-manage spacing → touch edge after container spacing=0.
echo "--- [11] Non-SSOT wrappers (migration candidates) ---"
NONSSOT_VIOLATIONS=0
while IFS= read -r cssfile; do
  # Look for .panel, .container, .root, .wrapper classes in feature CSS (not in shared/ui)
  if [[ "$cssfile" != *"shared/ui"* ]]; then
    while IFS= read -r match; do
      line=$(echo "$match" | cut -d: -f1)
      cls=$(echo "$match" | grep -oP '\.\K[a-zA-Z][\w-]*' | head -1)
      report "$cssfile" "$line" "non-SSOT wrapper" ".$cls in feature CSS — consider migration to @/shared/ui atom (reuse → variant → new)"
      ((NONSSOT_VIOLATIONS++)) || true
    done < <(grep -nP '^\.(panel|container|root|wrapper)\s*\{' "$cssfile" 2>/dev/null || true)
  fi
done < <(find "$ROOT" -name '*.module.css' -type f 2>/dev/null || true)
if [ "$NONSSOT_VIOLATIONS" -eq 0 ]; then
  echo "  (no non-SSOT wrappers detected)"
fi
echo ""

# 12. Box contract violations — container regions with padding that should be 0
# Per box-contract.md: Container, Body, Grid = padding 0. Header, Footer, Row = padding 12px 16px.
# Heuristic: flag .cardBody, .body, .grid, .pairRow with padding > 0 (should be 0 per contract).
echo "--- [12] Box contract: container/body/grid padding should be 0 ---"
CONTRACT_VIOLATIONS=0
while IFS= read -r cssfile; do
  # Check container-region classes that should have padding: 0 per contract
  while IFS= read -r match; do
    line=$(echo "$match" | cut -d: -f1)
    cls=$(echo "$match" | grep -oP '^\.\K[a-zA-Z][\w-]*' | head -1)
    # Only flag if padding is NOT 0 (has actual padding value)
    padding_val=$(echo "$match" | grep -oP 'padding:\s*\K[^;}]+' | head -1 | tr -d ' ')
    if [[ "$padding_val" != "0" && "$padding_val" != "0px" && -n "$padding_val" ]]; then
      report "$cssfile" "$line" "box contract" ".$cls has padding '$padding_val' — contract says container/body/grid padding = 0 (see box-contract.md)"
      ((CONTRACT_VIOLATIONS++)) || true
    fi
  done < <(grep -nP '^\.(cardBody|body|grid|pairRow|sectionCard)\s*\{[^}]*padding:' "$cssfile" 2>/dev/null || true)
done < <(find "$ROOT" -name '*.module.css' -type f 2>/dev/null || true)
if [ "$CONTRACT_VIOLATIONS" -eq 0 ]; then
  echo "  (container/body/grid padding compliant)"
fi
echo ""

# Summary
echo "=== Summary ==="
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "✅ No violations found — design system compliant"
else
  echo "❌ $VIOLATIONS violation(s) found"
  echo ""
  echo "Fix: replace hardcoded values with tokens from tokens.json"
  echo "     For spacing stack [10]: walk leaf→root (Phase 2), set container spacing=0 if children self-manage"
  echo "     For non-SSOT [11]: migration plan (Phase 4) — reuse → variant → new atom"
  echo "     For box contract [12]: container/body/grid padding → 0, rows own padding (see box-contract.md)"
  echo "Read: .agents/skills/m3-design-standard/references/*.md for M3 specs"
  echo "Process: audit-checklist.md → Audit Process (4 phase)"
fi

exit 0
