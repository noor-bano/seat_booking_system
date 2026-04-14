# Design System Specification: The Architectural Workspace

## 1. Overview & Creative North Star
**Creative North Star: "The Intelligent Monolith"**

To transcend the typical "utility app" feel of office management tools, this design system adopts a philosophy of **Intelligent Monolithism**. We treat the office floor plan and administrative data not as flat grids, but as a digital architectural model. The aesthetic is "High-End Editorial meets Executive Suite"—utilizing vast negative space, intentional asymmetry, and tonal depth to create a sense of calm in high-traffic environments. 

We break the "template" look by eschewing standard borders and rigid boxes in favor of **Layered Atmospheric Depth**. This system ensures that even a data-heavy dashboard feels breathable, premium, and authoritative.

---

## 2. Colors & Tonal Logic
The palette is rooted in a deep, commanding Navy (`primary`), supported by functional status colors that feel integrated rather than "clashing."

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section content. Boundaries must be defined solely through background color shifts or subtle tonal transitions. 
- *Example:* A `surface-container-low` sidebar sitting against a `surface` main content area.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers, like stacked sheets of frosted glass.
- **Base Level:** `surface` (#f7fafc)
- **Deep Inset:** `surface-container-low` (#f1f4f6) for background groupings.
- **Elevated Content:** `surface-container-lowest` (#ffffff) for primary interactive cards.
- **Active Overlays:** `surface-bright` (#f7fafc) with 80% opacity and 12px backdrop blur.

### The "Glass & Gradient" Rule
To avoid a "flat" enterprise look, use **Signature Textures**:
- **Primary CTAs:** Use a subtle linear gradient from `primary` (#00142f) to `primary_container` (#08284f) at a 135-degree angle.
- **Floating Seats:** Use the `tertiary_container` (#002a4c) with a high-saturation `on_tertiary_container` (#4793e1) text to denote agility and movement.

---

## 3. Typography: The Editorial Voice
We utilize a dual-font strategy to balance character with legibility.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern "executive" feel. Use for large floor numbers, dashboard titles, and high-level stats.
    *   *Headline-lg:* 2rem / Tight letter spacing (-0.02em).
*   **Interface & Body (Inter):** The workhorse for seat numbers, labels, and administrative tables. Inter’s tall x-height ensures readability at small scales on floor plan maps.
    *   *Body-md:* 0.875rem / 1.5 line-height for optimal legibility in data grids.
    *   *Label-sm:* 0.6875rem / Uppercase with 0.05em tracking for secondary metadata.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** rather than traditional structural lines.

### The Layering Principle
Hierarchy is established by "stacking" surface tiers. Place a `surface-container-lowest` card on a `surface-container-low` section to create a soft, natural lift.

### Ambient Shadows
For floating elements (modals, seat-selection popovers), use "Atmospheric Shadows":
- **Shadow Logic:** `0px 12px 32px rgba(24, 28, 30, 0.06)`. 
- The shadow must be tinted with the `on_surface` color to mimic natural light, avoiding harsh, synthetic greys.

### The "Ghost Border" Fallback
If a border is required for accessibility (e.g., in high-contrast mode), use a "Ghost Border":
- Token: `outline-variant` (#c5c6d2) at **15% opacity**. 100% opaque borders are strictly forbidden.

---

## 5. Component Logic

### Interactive Seat Grid (The Core)
- **Available Seat:** `secondary_container` (#9ff5c1) with a soft inner glow. No border.
- **Booked Seat:** `surface_container_highest` (#e0e3e5) with `on_surface_variant` icon.
- **Your Selection:** `primary` (#00142f) with a high-diffuse shadow.
- **Floating/Flex Seat:** `tertiary_container` (#002a4c).
- **Hover State:** Instead of a border, use a subtle scale-up (1.05x) and a shift to `surface_bright`.

### Buttons
- **Primary:** `primary` background, `on_primary` text. Radius: `md` (0.375rem).
- **Secondary (Tertiary Token):** `tertiary_fixed` background. Use for "Change Floor" or "View Filter" actions.
- **Ghost Action:** No background, `primary` text. Used for "Cancel" or secondary admin controls.

### Cards & Data Lists
- **Rule:** Forbid divider lines. 
- Use **Vertical White Space** (1.5rem minimum between groups) and `surface-container` shifts to separate rows in the "Managed Bookings" list.

### Input Fields
- **State:** "In-set" style. Use `surface-container-high` background.
- **Focus:** No heavy outline. Transition the background to `surface-container-lowest` and apply a 2px "Ghost Border" of `primary` at 20% opacity.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical layouts for dashboards (e.g., a wide floor plan on the left, a narrow, vertically-stacked stat column on the right).
*   **Do** use `backdrop-blur` (12px-20px) on any element that floats over the floor plan map.
*   **Do** lean on typography scale (Size and Weight) to differentiate information, not color.

### Don't:
*   **Don't** use 1px solid dividers between list items. Use 12px of padding and a background color toggle instead.
*   **Don't** use standard "Red" for errors. Use the specified `error` (#ba1a1a) which is tuned for the professional navy palette.
*   **Don't** use 100% black. All "dark" elements must be the `primary` navy or `on_surface` charcoal to maintain tonal warmth.