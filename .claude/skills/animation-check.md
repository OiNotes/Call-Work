---
name: animation-check
description: Check Framer Motion animations for performance anti-patterns and GPU acceleration. Use when adding animations or before deployment.
---

# Animation Check Skill

Validate Framer Motion animations in WebApp for smooth performance.

## What this skill does:

1. Checks Framer Motion usage and patterns
2. Validates animation properties (GPU-accelerated only)
3. Identifies performance anti-patterns
4. Checks transition durations
5. Suggests optimizations

## Usage:

Say: **"check animations"** or **"validate motion"** or **"animation review"** or **"performance check"**

## Commands:

```bash
PROJECT_DIR="/Users/sile/Documents/Status Stock 4.0/webapp/src"

echo "=== Animation Check ==="
echo ""

# 1. Framer Motion components
echo "1. Framer Motion Usage:"
motion_count=$(grep -r "motion\." "$PROJECT_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
echo "   Found $motion_count motion components"

if [ "$motion_count" -gt 0 ]; then
  echo "   ✅ Framer Motion in use"
  echo ""
  echo "   Top 5 files with most animations:"
  grep -r "motion\." "$PROJECT_DIR" --include="*.jsx" --include="*.js" 2>/dev/null | cut -d: -f1 | sort | uniq -c | sort -rn | head -5 | sed 's/^/     /'
else
  echo "   ℹ️  No animations found (animations are optional)"
fi

# 2. Animation props
echo ""
echo "2. Animation Props:"
initial_count=$(grep -r "initial=" "$PROJECT_DIR" --include="*.jsx" 2>/dev/null | wc -l | tr -d ' ')
animate_count=$(grep -r "animate=" "$PROJECT_DIR" --include="*.jsx" 2>/dev/null | wc -l | tr -d ' ')
exit_count=$(grep -r "exit=" "$PROJECT_DIR" --include="*.jsx" 2>/dev/null | wc -l | tr -d ' ')
whileHover_count=$(grep -r "whileHover=" "$PROJECT_DIR" --include="*.jsx" 2>/dev/null | wc -l | tr -d ' ')
whileTap_count=$(grep -r "whileTap=" "$PROJECT_DIR" --include="*.jsx" 2>/dev/null | wc -l | tr -d ' ')

echo "   initial: $initial_count uses"
echo "   animate: $animate_count uses"
echo "   exit: $exit_count uses"
echo "   whileHover: $whileHover_count uses (micro-interactions)"
echo "   whileTap: $whileTap_count uses (button feedback)"

if [ "$whileTap_count" -gt 0 ]; then
  echo "   ✅ Interactive feedback present"
fi

# 3. Layout animations
echo ""
echo "3. Layout Animations:"
layout_count=$(grep -r "layout\s*=" "$PROJECT_DIR" --include="*.jsx" 2>/dev/null | wc -l | tr -d ' ')
layoutId_count=$(grep -r "layoutId=" "$PROJECT_DIR" --include="*.jsx" 2>/dev/null | wc -l | tr -d ' ')

echo "   layout prop: $layout_count uses"
echo "   layoutId prop: $layoutId_count uses (shared layout transitions)"

if [ "$layout_count" -gt 20 ]; then
  echo "   ⚠️  Many layout animations (can impact performance)"
  echo "   Tip: Use layout sparingly, prefer transform-based animations"
elif [ "$layout_count" -gt 0 ]; then
  echo "   ✅ Layout animations look reasonable"
fi

# 4. Spring animations (best for natural motion)
echo ""
echo "4. Spring Animations:"
spring_count=$(grep -r "type: ['\"]spring['\"]" "$PROJECT_DIR" --include="*.jsx" 2>/dev/null | wc -l | tr -d ' ')
echo "   Spring transitions: $spring_count uses"

if [ "$spring_count" -gt 0 ]; then
  echo "   ✅ Using spring physics for natural motion"
else
  echo "   ℹ️  No spring animations (consider for better feel)"
fi

# 5. Performance anti-patterns
echo ""
echo "5. Performance Check:"

# Check for animating width/height (NOT GPU-accelerated)
width_anim=$(grep -r "animate.*width\|animate.*height" "$PROJECT_DIR" --include="*.jsx" 2>/dev/null | grep -v "// OK\|transform" | wc -l | tr -d ' ')

if [ "$width_anim" -gt 0 ]; then
  echo "   ⚠️  Warning: Found $width_anim animations on width/height"
  echo "   These are NOT GPU-accelerated!"
  echo "   Recommendation: Use scale instead"
  echo ""
  echo "   Files to check:"
  grep -r "animate.*width\|animate.*height" "$PROJECT_DIR" --include="*.jsx" 2>/dev/null | grep -v "// OK\|transform" | cut -d: -f1 | sort -u | sed 's/^/     - /' | head -5
else
  echo "   ✅ No width/height animations (good!)"
fi

# Check for top/left animations (should use x/y instead)
position_anim=$(grep -r "animate.*top\|animate.*left\|animate.*right\|animate.*bottom" "$PROJECT_DIR" --include="*.jsx" 2>/dev/null | grep -v "// OK" | wc -l | tr -d ' ')

if [ "$position_anim" -gt 0 ]; then
  echo "   ⚠️  Warning: Found $position_anim animations on top/left/right/bottom"
  echo "   Recommendation: Use x/y instead (GPU-accelerated)"
else
  echo "   ✅ No position animations (good!)"
fi

# 6. AnimatePresence usage
echo ""
echo "6. AnimatePresence (for exit animations):"
animate_presence=$(grep -r "AnimatePresence" "$PROJECT_DIR" --include="*.jsx" 2>/dev/null | wc -l | tr -d ' ')

if [ "$animate_presence" -gt 0 ]; then
  echo "   ✅ Found $animate_presence uses (enables exit animations)"
else
  echo "   ℹ️  Not used (exit animations won't work without it)"
fi

echo ""
echo "=== Animation Check Complete ==="
```

## Animation best practices:

### ✅ GPU-Accelerated (GOOD):
```jsx
// Transform properties
animate={{ x: 100, y: 50, scale: 1.1, rotate: 45 }}

// Opacity
animate={{ opacity: 1 }}

// Filters
animate={{ blur: "10px" }}
```

### ❌ CPU-Bound (AVOID):
```jsx
// Size properties
animate={{ width: "100%", height: "200px" }}  // Slow!

// Position properties
animate={{ top: 0, left: 0 }}  // Slow!

// Margins/Padding
animate={{ marginTop: 20 }}  // Slow!
```

### Optimal durations:
- **Micro-interactions:** 0.15-0.2s (button hover, tap)
- **Page transitions:** 0.3-0.5s
- **Complex animations:** 0.5-0.8s

### Spring preset (recommended):
```jsx
const springConfig = {
  type: 'spring',
  stiffness: 400,
  damping: 32
};

<motion.div
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={springConfig}
/>
```

## Common patterns:

### Page transition:
```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3 }}
/>
```

### Button feedback:
```jsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
/>
```

### Stagger children:
```jsx
<motion.div
  variants={containerVariants}
  initial="hidden"
  animate="visible"
>
  {items.map(item => (
    <motion.div key={item} variants={itemVariants} />
  ))}
</motion.div>
```

## When to use:

- ⚡ After adding new animations
- ⚡ Performance review before release
- ⚡ When animations feel sluggish
- ⚡ Before production build
- ⚡ UX quality check

## Pro tips:

- Always use GPU-accelerated properties (transform, opacity)
- Spring animations feel more natural than easing curves
- Use will-change: transform CSS hint for heavy animations
- Test on low-end devices (throttle CPU in DevTools)
- Keep animations under 0.5s for snappy feel
