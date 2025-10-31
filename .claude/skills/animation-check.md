# Animation Check Skill

Validate Framer Motion animations in WebApp for smooth performance.

## What this skill does:

1. Checks Framer Motion usage
2. Validates animation patterns
3. Identifies performance anti-patterns
4. Suggests optimizations
5. Checks transition durations

## Usage:

Say: **"check animations"** or **"validate motion"** or **"animation review"** or **"performance check"**

## Commands:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0/webapp/src"

echo "=== Animation Check ==="
echo ""

# 1. Framer Motion components
echo "1. Framer Motion Usage:"
motion_count=$(grep -r "motion\." "$PROJECT_DIR" | wc -l | tr -d ' ')
echo "   Found $motion_count motion components"

if [ "$motion_count" -gt 0 ]; then
  echo "   ✅ Framer Motion in use"
  echo "   Top 5 files with most animations:"
  grep -r "motion\." "$PROJECT_DIR" | cut -d: -f1 | sort | uniq -c | sort -rn | head -5 | sed 's/^/     /'
else
  echo "   ⚠️ No animations found"
fi

# 2. Animation props
echo ""
echo "2. Animation Props:"
initial_count=$(grep -r "initial=" "$PROJECT_DIR" | wc -l | tr -d ' ')
animate_count=$(grep -r "animate=" "$PROJECT_DIR" | wc -l | tr -d ' ')
exit_count=$(grep -r "exit=" "$PROJECT_DIR" | wc -l | tr -d ' ')
whileHover_count=$(grep -r "whileHover=" "$PROJECT_DIR" | wc -l | tr -d ' ')
whileTap_count=$(grep -r "whileTap=" "$PROJECT_DIR" | wc -l | tr -d ' ')
echo "   initial: $initial_count"
echo "   animate: $animate_count"
echo "   exit: $exit_count"
echo "   whileHover: $whileHover_count"
echo "   whileTap: $whileTap_count"

# 3. Layout animations (performance check)
echo ""
echo "3. Layout Animations:"
layout_count=$(grep -r "layout\s*=" "$PROJECT_DIR" | wc -l | tr -d ' ')
layoutId_count=$(grep -r "layoutId=" "$PROJECT_DIR" | wc -l | tr -d ' ')
echo "   layout prop: $layout_count uses"
echo "   layoutId prop: $layoutId_count uses"

if [ "$layout_count" -gt 10 ]; then
  echo "   ⚠️ Warning: Many layout animations (can impact performance)"
else
  echo "   ✅ Layout animations look good"
fi

# 4. Spring animations
echo ""
echo "4. Spring Animations:"
spring_count=$(grep -r "type: 'spring'" "$PROJECT_DIR" | wc -l | tr -d ' ')
echo "   Spring transitions: $spring_count uses"
if [ "$spring_count" -gt 0 ]; then
  echo "   ✅ Using spring physics for natural motion"
fi

# 5. Check for performance anti-patterns
echo ""
echo "5. Performance Check:"
# Check for animating width/height
width_anim=$(grep -r "animate.*width\|animate.*height" "$PROJECT_DIR" | wc -l | tr -d ' ')
if [ "$width_anim" -gt 0 ]; then
  echo "   ⚠️ Warning: Found $width_anim animations on width/height (not GPU-accelerated)"
  echo "   Recommendation: Use scale instead"
else
  echo "   ✅ No width/height animations"
fi

echo ""
echo "=== Animation Check Complete ==="
```

## Animation best practices:

### Optimal durations:
- **Micro-interactions:** `0.15-0.2s`
- **Page transitions:** `0.3-0.5s`
- **Complex animations:** `0.5-0.8s`

### Performance:
✅ **Use (GPU-accelerated):**
- `transform` (scale, rotate, translate)
- `opacity`
- `filter` (blur, brightness)

❌ **Avoid (CPU-bound):**
- `width`, `height`
- `margin`, `padding`
- `top`, `left`, `right`, `bottom`

### Spring preset:
```jsx
const controlSpring = {
  type: 'spring',
  stiffness: 400,
  damping: 32
};
```

### Good patterns:

```jsx
// ✅ Good - GPU accelerated
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
/>

// ✅ Good - Spring physics
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={controlSpring}
/>

// ❌ Avoid - Not GPU-accelerated
<motion.div
  animate={{ width: "100%" }}
/>
```

## Automatic suggestions:

Claude will suggest:
- 🔧 Replacing non-performant animations
- 🔧 Adjusting durations
- 🔧 Adding exit animations
- 🔧 Optimizing layout animations
- 🔧 Using spring presets

## When to use:

- ⚡ After adding new animations
- ⚡ Performance review
- ⚡ Before production build
- ⚡ UX quality check
- ⚡ When animations feel sluggish
