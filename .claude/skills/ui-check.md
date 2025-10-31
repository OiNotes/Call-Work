# UI Check Skill

Validate WebApp UI compliance with Status Stock 4.0 design system.

## What this skill does:

1. Checks color usage (Primary: #FF6B00, BG: #181818, Cards: glassmorphism)
2. Validates glassmorphism effects (backdrop-blur)
3. Checks button touch-friendly sizes (min 44px)
4. Validates typography (Inter font)
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
glass_count=$(grep -r "backdrop-blur\|glass-card\|glass-elevated" "$PROJECT_DIR" | wc -l | tr -d ' ')
echo "   Found $glass_count components using glassmorphism"

if [ "$glass_count" -gt 0 ]; then
  echo "   ✅ Glassmorphism in use"
  grep -r "glass-card\|glass-elevated" "$PROJECT_DIR" | cut -d: -f1 | sort -u | sed 's/^/     - /'
else
  echo "   ⚠️ No glassmorphism effects found"
fi

# 2. Color palette
echo ""
echo "2. Color Palette Usage:"
orange_count=$(grep -r "#FF6B00\|orange-primary" "$PROJECT_DIR" | wc -l | tr -d ' ')
dark_count=$(grep -r "bg-dark-bg\|#181818" "$PROJECT_DIR" | wc -l | tr -d ' ')
echo "   Primary Orange (#FF6B00): $orange_count uses"
echo "   Dark BG (#181818): $dark_count uses"

# Check for old colors that should be replaced
old_colors=$(grep -r "#0A0A0A\|#1A1A1A" "$PROJECT_DIR" --exclude-dir=node_modules | wc -l | tr -d ' ')
if [ "$old_colors" -gt 0 ]; then
  echo "   ⚠️ Warning: Found $old_colors uses of old colors (#0A0A0A, #1A1A1A)"
  echo "   Should be replaced with design system colors"
fi

# 3. Touch-friendly buttons
echo ""
echo "3. Touch-Friendly Buttons (min 44px):"
button_count=$(grep -r "min-h-\[44px\]\|h-11\|h-12\|py-3" "$PROJECT_DIR" | wc -l | tr -d ' ')
echo "   Found $button_count touch-friendly buttons"

if [ "$button_count" -lt 5 ]; then
  echo "   ⚠️ Warning: Too few touch-friendly buttons"
  echo "   Recommendation: Use min-h-[44px], h-11, or py-3 for all buttons"
else
  echo "   ✅ Good button sizing"
fi

# 4. Typography
echo ""
echo "4. Typography:"
tracking_tight=$(grep -r "tracking-tight" "$PROJECT_DIR" | wc -l | tr -d ' ')
font_semibold=$(grep -r "font-semibold\|font-bold" "$PROJECT_DIR" | wc -l | tr -d ' ')
echo "   tracking-tight: $tracking_tight uses"
echo "   font-semibold/bold: $font_semibold uses"

echo ""
echo "=== Design Check Complete ==="
```

## Design system rules:

### Colors:
- **Primary:** `#FF6B00` (orange-primary)
- **Background:** `#181818` (bg-dark-bg)
- **Cards:** `#212121` (bg-dark-card)
- **Glass:** `glass-card`, `glass-elevated` classes

### Effects:
- **Glassmorphism:** `backdrop-blur-md` + `bg-white/5`
- **Rounded corners:** `rounded-xl` or `rounded-2xl`
- **Borders:** `border border-white/10`

### Spacing:
- **Touch targets:** min `44px` (h-11 or py-3)
- **Card padding:** `p-4`, `p-5`, or `p-6`
- **Section gaps:** `gap-3`, `gap-4`, or `gap-6`

### Typography:
- **Headings:** `font-bold tracking-tight`
- **Body:** `font-medium tracking-tight` or regular
- **Small text:** `text-sm text-gray-400`

## Automatic suggestions:

Claude will suggest fixes for:
- ❌ Missing glassmorphism effects
- ❌ Wrong color usage (old #0A0A0A, #1A1A1A)
- ❌ Too small buttons (<44px)
- ❌ Inconsistent typography

## When to use:

- 🎨 Before merging UI changes
- 🎨 Design review
- 🎨 Quality control
- 🎨 Before screenshots/demos
- 🎨 After redesign
