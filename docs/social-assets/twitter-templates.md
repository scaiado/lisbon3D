# Lisbon 3D Explorer — Build in Public Templates

These templates and guidelines are for sharing progress on Twitter/X, LinkedIn, or other platforms.

## 📸 Visual Assets Guidelines
- **Aspect Ratio**: 16:9 (1200x675px) for Twitter cards and standard posts.
- **Backgrounds**: Use the map itself as the background whenever possible. For text-heavy slides, use `--stone-900` or `--stone-50` with the azulejo pattern at 5% opacity.
- **Brand Elements**: Always include the Lisbon 3D logo watermark in the bottom right corner (opacity 70%).

## 📝 Post Templates

### 🚀 Template 1: Milestone / Feature Launch
**Use when:** Reaching a major technical or visual milestone.

**Text:**
Just hit a major milestone with the Lisbon 3D map! 🇵🇹✨

Today we shipped [Feature: e.g., accurate building extrusions / dynamic golden hour lighting / historical layers]. 

Built completely with open data (@OpenStreetMap) and open-source tools. 

What part of the city should we model next? 👇

#BuildInPublic #Mapbox #Lisbon #3DMapping #OpenSource

**Media:**
- 10-second high-quality screen recording flying over the new feature.
- OR: A 2-image split showing "Before (Flat)" vs "After (3D)".

---

### 🛠️ Template 2: Behind the Scenes / Tech Deep Dive
**Use when:** Solving a hard technical problem or optimizing performance.

**Text:**
Rendering [Number, e.g., 50,000] buildings in a browser isn't easy. Here's how we're doing it for Lisbon 3D Explorer 🧵

1️⃣ [Technical point 1, e.g., Vector tile optimization]
2️⃣ [Technical point 2, e.g., Instanced meshes for trees]
3️⃣ [Technical point 3, e.g., WebGL magic]

It brought our load time down from [X]s to [Y]s. ⚡

Full tech breakdown in the repo: [Link to GitHub]

#WebDev #ThreeJS #GIS #MapLibre

**Media:**
- Screenshot of the code alongside a performance graph.
- OR: A wireframe/debug view of the map rendering.

---

### 🎨 Template 3: Design & Aesthetics
**Use when:** Updating the UI, changing colors, or nailing a specific vibe.

**Text:**
Trying to capture the soul of Lisbon in a web app. 🚋💙

We built a custom map theme based on traditional Azulejo tiles, terracotta rooftops, and that famous golden hour light over the Tagus. 

Left: Default map
Right: Our custom Lisbon theme

Which do you prefer? 

#UIUX #MapDesign #DataViz #Lisboa

**Media:**
- Side-by-side comparison image showcasing the custom color palette.

---

### 🐛 Template 4: The "Oops" / Vulnerable Post
**Use when:** A funny bug occurs or something breaks spectacularly.

**Text:**
Well, I accidentally flooded Lisbon today. 🌊😅

A tiny typo in the elevation data processing turned the entire Baixa district into a lake. 

Sometimes #BuildInPublic means sharing the bloopers too. Fixed it now, but here's the "Atlantis Edition" of the map:

[Screenshot/GIF of the bug]

#Bugs #DevLife #WebMapping

---

## 🎨 Open Graph & Social Card Spec (Figma/Canvas)
When generating standard social cards for links:

1. **Background**: `--lisbon-azul` (#1E4D6B) to `--lisbon-azul-dark` (#0F2D3D) gradient.
2. **Graphic**: A beautiful, high-angle isometric shot of the Praça do Comércio model.
3. **Typography**:
   - Title: "Lisbon 3D Explorer" (Space Grotesk, Bold, White)
   - Subtitle: "An open-source 3D map of the city of seven hills." (Inter, Regular, `--stone-200`)
4. **Badges**: "100% Open Data", "Built with MapLibre"

*CSS/Tailwind translation for OG image generation:*
```html
<div class="w-[1200px] h-[630px] bg-gradient-to-br from-[#1E4D6B] to-[#0F2D3D] relative overflow-hidden flex flex-col justify-center px-20">
  <div class="absolute inset-0 opacity-20 bg-[url('/azulejo-pattern.svg')]"></div>
  <h1 class="text-white font-space-grotesk font-bold text-7xl mb-6 relative z-10">Lisbon 3D Explorer</h1>
  <p class="text-[#E7E5E4] font-inter text-3xl max-w-2xl leading-relaxed relative z-10">An open-source, interactive 3D map of the city of seven hills.</p>
</div>
```