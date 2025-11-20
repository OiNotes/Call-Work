---
name: ui-check
description: Validate glassmorphism effects, color palette, touch-friendly buttons, typography in WebApp. Use before design reviews or commits.
---

# UI Check Skill

Validate WebApp UI compliance with Status Stock 4.0 design system.

## What this skill does:

1. Checks glassmorphism usage (backdrop-blur, glass-card classes)
2. Validates color palette (#FF6B00 orange, #181818 dark)
3. Checks button touch-friendly sizes (min 44px)
4. Validates typography (Inter font, tracking-tight)
5. Checks spacing consistency

## Usage:

Say: **"check ui"** or **"validate design"** or **"design review"** or **"ui quality"**

## Commands:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0/webapp/src"

echo "=== UI Design Check ==="
echo ""

# 1. Glassmorphism effects
echo "1. Glassmorphism Effects:"
glass_count=$(grep -r "backdrop-blur\|glass-card\|glass-elevated" "$PROJECT_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
echo "   Found $glass_count glassmorphism usages"

if [ "$glass_count" -gt 0 ]; then
  echo "   ✅ Glassmorphism in use"
  echo "   Files with glassmorphism:"
  grep -r "glass-card\|glass-elevated" "$PROJECT_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | cut -d: -f1 | sort -u | sed 's/^/     - /' | head -10
else
  echo "   ⚠️  No glassmorphism effects found (check design system)"
fi

# 2. Color palette
echo ""
echo "2. Color Palette Usage:"
orange_count=$(grep -r "#FF6B00\|orange-primary" "$PROJECT_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
dark_count=$(grep -r "bg-dark-bg\|#181818" "$PROJECT_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
echo "   Primary Orange (#FF6B00): $orange_count uses"
echo "   Dark BG (#181818): $dark_count uses"

if [ "$orange_count" -gt 0 ]; then
  echo "   ✅ Brand color in use"
fi

# Check for old/wrong colors
old_colors=$(grep -r "#0A0A0A\|#1A1A1A\|#000000" "$PROJECT_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | grep -v "node_modules" | wc -l | tr -d ' ')
if [ "$old_colors" -gt 0 ]; then
  echo "   ⚠️  Warning: Found $old_colors uses of non-design-system colors"
  echo "   Check these files:"
  grep -r "#0A0A0A\|#1A1A1A\|#000000" "$PROJECT_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | grep -v "node_modules" | cut -d: -f1 | sort -u | sed 's/^/     - /' | head -5
fi

# 3. Touch-friendly buttons
echo ""
echo "3. Touch-Friendly Buttons (min 44px):"
button_count=$(grep -r "min-h-\[44px\]\|h-11\|h-12\|py-3\|py-4" "$PROJECT_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
echo "   Found $button_count touch-friendly sized elements"

if [ "$button_count" -gt 5 ]; then
  echo "   ✅ Good button sizing"
else
  echo "   ⚠️  Few touch-friendly buttons found"
  echo "   Recommendation: Use min-h-[44px], h-11, or py-3 for all interactive elements"
fi

# 4. Typography
echo ""
echo "4. Typography:"
tracking_tight=$(grep -r "tracking-tight" "$PROJECT_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
font_bold=$(grep -r "font-semibold\|font-bold" "$PROJECT_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
echo "   tracking-tight: $tracking_tight uses"
echo "   font-semibold/bold: $font_bold uses"

if [ "$tracking_tight" -gt 10 ]; then
  echo "   ✅ Consistent typography"
fi

# 5. Framer Motion (should be present for animations)
echo ""
echo "5. Animation Framework:"
motion_count=$(grep -r "framer-motion\|motion\." "$PROJECT_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
echo "   Framer Motion usage: $motion_count occurrences"

if [ "$motion_count" -gt 0 ]; then
  echo "   ✅ Animations present"
else
  echo "   ℹ️  No animations detected (optional)"
fi

echo ""
echo "=== Design Check Complete ==="
```

## Design system rules:

### Colors:

- **Primary:** `#FF6B00` (orange-primary) - brand color
- **Background:** `#181818` (bg-dark-bg)
- **Cards:** `#212121` (bg-dark-card)
- **Text:** white/gray-400/gray-500
- **Glass:** `glass-card`, `glass-elevated` classes

### Effects:

- **Glassmorphism:** `backdrop-blur-md` + `bg-white/5` or `bg-white/10`
- **Rounded corners:** `rounded-xl` or `rounded-2xl`
- **Borders:** `border border-white/10`
- **Shadows:** Minimal (glassmorphism style)

### Spacing:

- **Touch targets:** min `44px` (h-11 = 44px, py-3 = 48px total)
- **Card padding:** `p-4`, `p-5`, or `p-6`
- **Section gaps:** `gap-3`, `gap-4`, or `gap-6`
- **Screen padding:** `p-4` or `px-4`

### Typography:

- **Headings:** `font-bold tracking-tight` + `text-xl` or `text-2xl`
- **Body:** `font-medium tracking-tight` or regular
- **Small text:** `text-sm text-gray-400`
- **Font family:** Inter (set in index.css)

## Automatic suggestions:

Claude will suggest fixes for:

- ❌ Missing glassmorphism effects
- ❌ Wrong color usage (not from design system)
- ❌ Buttons too small (<44px)
- ❌ Inconsistent typography
- ❌ Missing rounded corners
- ❌ Hard backgrounds (should use glassmorphism)

## When to use:

- 🎨 Before merging UI changes
- 🎨 Design review
- 🎨 Quality control
- 🎨 Before screenshots/demos
- 🎨 After redesign or new components
- 🎨 Before production release

## Pro tips:

- Use Tailwind classes from design system (check `webapp/tailwind.config.js`)
- All interactive elements should be touch-friendly (44px min)
- Glassmorphism is the signature style - use it for all cards/modals
- Orange (#FF6B00) is for primary actions and brand elements only
