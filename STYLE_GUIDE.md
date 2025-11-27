# DB Explorer - BRUTALIST UI Style Guide

## Design Philosophy

RAW. FUNCTIONAL. NO BULLSHIT.

Heavy borders, sharp corners, monospace everything, high contrast black/white with minimal color accents.

Form follows function. Every element screams its purpose.

## Color Palette

### Core Colors (Black & White System)

- **Background**: `bg-white` - Pure white, no grays

- **Surface**: `bg-black` - Pure black for emphasis

- **Border**: `border-black border-2` - THICK black borders everywhere

- **Text Primary**: `text-black` - Maximum contrast

- **Text Inverse**: `text-white` - On black backgrounds

### Accent Colors (Use Sparingly - Only for Status)

- **Success**: `bg-green-400` - Bright green, connected state

- **Error**: `bg-red-500` - Red alert, errors only

- **Warning**: `bg-yellow-300` - Yellow caution

- **Active**: `bg-blue-400` - Bright blue for selected states

### NO Gradients. NO Shadows. NO Opacity. NO Gray Scales.

## Typography

### Font Family

- **Everything**: `font-mono` - Monospace only (system mono stack)

- Fallback: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

### Sizes (Bigger & Bolder)

- **H1**: `text-4xl font-bold uppercase tracking-tight` - PAGE TITLES

- **H2**: `text-2xl font-bold uppercase` - SECTION HEADERS

- **H3**: `text-xl font-bold uppercase` - SUBSECTIONS

- **Body**: `text-base` - Everything else, same size

- **Small**: `text-sm` - Metadata only

### Text Treatment

- All headings: UPPERCASE

- Body text: Normal case

- Labels: UPPERCASE

- Buttons: UPPERCASE

- Weight: Either normal (400) or bold (700), nothing in between

## Spacing

### Grid-Based Spacing (8px base unit)

- **1**: `4px` - Micro spacing

- **2**: `8px` - Base unit

- **4**: `16px` - Standard gap

- **8**: `32px` - Section spacing

- **16**: `64px` - Large breaks

### Padding

- Buttons: `px-8 py-4` - Chunky

- Inputs: `px-4 py-3` - Tight

- Cards: `p-0` - No padding, content touches borders

- Content areas: `p-8` - Generous breathing room

## Borders

### Border System

- **Default**: `border-2 border-black` - Everything has thick borders

- **Active**: `border-4 border-black` - Extra thick for emphasis

- **Nested**: Borders on borders on borders

- **Radius**: `rounded-none` - ZERO border radius, sharp corners only

### Border Usage

- Every component gets a border

- Tables: Border every cell

- Inputs: Heavy borders, thicker on focus

- Buttons: Border + outline for depth

- Cards: Border + internal dividing borders

## Shadows & Effects

### NO SHADOWS

- **All**: `shadow-none`

- Use borders and offsets for depth instead

- Layering through border stacking

### Depth Through Offset

```css
/* Example: Button pressed effect */
transform: translate(2px, 2px)

/* Fake "shadow" with double border */
box-shadow: 4px 4px 0 0 black
```

## Component Patterns

### Layout Structure

```
┌━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ╔═══════════════════════════════════════╗ ┃
┃ ║ HEADER - BLACK BG                     ║ ┃
┃ ╚═══════════════════════════════════════╝ ┃
┣━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃░░░░░░░░░┃                                 ┃
┃░SIDEBAR░┃ MAIN CONTENT                    ┃
┃░░░░░░░░░┃                                 ┃
┃░░░░░░░░░┃                                 ┃
┗━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Button States

- **Default**: `border-2 border-black bg-white text-black uppercase`

- **Hover**: `bg-black text-white` - Invert colors

- **Active**: `translate-x-0.5 translate-y-0.5` - Shift on click

- **Disabled**: `border-black border-2 text-black opacity-25` - Faded out

### Input States

- **Default**: `border-2 border-black`

- **Focus**: `border-4 border-black outline-none` - Thicker border

- **Error**: `border-4 border-red-500`

- **Disabled**: `border-2 border-black bg-gray-100`

### Table Design

```
┌────────┬────────┬────────┐
│ HEADER │ HEADER │ HEADER │ ← Black background, white text
├────────┼────────┼────────┤
│ Cell   │ Cell   │ Cell   │ ← All cells bordered
├────────┼────────┼────────┤
│ Cell   │ Cell   │ Cell   │ ← No row hover, just borders
└────────┴────────┴────────┘
```

### Status Indicators

- **Pills**: Rectangle, not rounded. `px-3 py-1 border-2 border-black`

- **Colors**: Full saturation, no pastels

- **Text**: UPPERCASE, bold

## Interactive Patterns

### Click/Tap Feedback

- Instant color inversion (black ↔ white)

- Small position shift (2px offset)

- No transitions, instant changes

### Focus States

- Thick border increase (2px → 4px)

- No blue rings, use border only

- High contrast maintained

### Loading States

- Animated ASCII spinner or

- Blinking text "LOADING..."

- No smooth animations, stepped/blocky

## Layout Rules

### Grid Everything

- Use CSS Grid with visible gaps

- Gaps show background (creates border effect)

- No floating elements

- Everything aligned to grid

### Spacing

- Generous whitespace

- But contained within borders

- Elements don't touch borders (internal padding)

### Hierarchy Through Size & Weight

- No subtle differences

- Big jumps in size (4xl → 2xl → base)

- Bold vs normal, nothing in between

## Anti-Patterns (NEVER USE)

❌ Border radius

❌ Box shadows

❌ Gradients

❌ Transparency/opacity (except disabled states)

❌ Soft colors (pastels, grays)

❌ Smooth transitions

❌ Rounded corners

❌ Subtle spacing differences

❌ Icon fonts (use ASCII or SVG outlines)

❌ Cursive/script fonts

## Code Example

```tsx
// GOOD - Brutalist Button
<button className="border-2 border-black bg-white px-8 py-4 text-black font-mono uppercase font-bold hover:bg-black hover:text-white active:translate-x-0.5 active:translate-y-0.5">
  CONNECT
</button>

// BAD - Soft Button
<button className="bg-blue-500 rounded-lg shadow-md px-4 py-2 text-white">
  Connect
</button>
```

## Accessibility

- Maximum contrast (black on white)

- Large click targets (minimum 44x44px)

- Clear focus indicators (thick borders)

- No reliance on color alone (use text/symbols)
