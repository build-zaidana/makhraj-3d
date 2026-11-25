# Makhraj 3D — Visualisasi Anatomi X-Ray Makharijul Huruf (FP Grafika Komputer)

Aplikasi web 3D interaktif berbasis **Three.js + WebGL2** untuk membantu murid memahami dan melafalkan **29 huruf Hijaiyah (Makharijul Huruf)** secara tepat dengan visualisasi anatomi 3D open-source (*BodyParts3D / OrganUI*), **X-Ray Fresnel Vision**, studio PBR lighting, dan selective Bloom post-processing.

## Fitur Utama
- **Real Open-Source 3D Human Anatomy (`BodyParts3D` / `OrganUI`):**
  - `public/models/teeth.glb` — 28 gigi individual anatomis, gusi atas/bawah, maksila, dan mandibula berengsel pada sendi TMJ.
  - `public/models/nose.glb` — rongga hidung (*Al-Khaisyum*), konka hidung (*turbinates*), nasofaring, dan tulang palatina.
  - `public/models/larynx.glb` — tulang hyoid, kartilago tiroid/krikoid/aritenoid, epiglotis beranimasi (*Wasathul Halq* ع ح), pita suara bergetar (*Aqshal Halq* ء ه), dan trakea.
- **X-Ray Fresnel Vision + Interactive Sagittal Cutaway:** Custom GLSL shader pada model kepala `facecap.glb` (52 ARKit blendshapes) dengan slider irisan sagital real-time dan tepi potongan bercahaya.
- **High-Res Procedural Deformable Tongue:** Lidah 44×52 high-res yang terdeformasi per-vertex secara real-time sepanjang kurva *Catmull-Rom Spline* dengan material `MeshPhysicalMaterial` (wet clearcoat, velvety sheen, dan tekstur 512px prosedural).
- **Interactive 3D Anatomical Callout Labels:** Penunjuk anatomi 3D yang otomatis menyorot organ aktif sesuai huruf Hijaiyah yang dipilih.
- **Volumetric Airflow Particle System:** Visualisasi partikel aliran udara & suara (*Hams*, *Jahr*, *Qalqalah*, *Safir*, dan aliran dengung *Ghunnah* ke rongga hidung *Al-Khaisyum*).
- **Audio Pelafalan Kredibel Offline + Slow-Motion 0.5x:** 29 rekaman audio lokal melalui Web Audio API (`AnalyserNode`) untuk menyinkronkan pita suara, beacon Makhraj, dan partikel secara real-time.

## Aspek Grafika Komputer yang Diimplementasikan
1. **Studio PBR & IBL:** `PMREMGenerator` + `RoomEnvironment`, `MeshPhysicalMaterial` (*clearcoat, sheen, ior*) pada enamel gigi, mukosa basah, dan kartilago.
2. **Lighting & Shadows:** 3-Point Studio Lighting (`HemisphereLight`, Key `DirectionalLight` dengan `PCFSoftShadowMap` 2048×2048, Rim & Fill Light) + Dynamic `PointLight` di rongga mulut.
3. **Post-Processing:** MSAA `EffectComposer` + `RenderPass` + `UnrealBloomPass` selektif + `OutputPass`.
4. **Custom GLSL Shaders (3 Shader):**
   - `src/shaders/xrayFresnel.glsl.js` — Fresnel X-Ray + animated scanline + real-time sagittal clipping rim (kompatibel ARKit morph targets).
   - `src/shaders/makhrajGlow.glsl.js` — Pulsing energy beacon pada titik makhraj aktif.
   - `src/shaders/airflowParticle.glsl.js` — Volumetric glowing point-sprite particles.
5. **Procedural Geometry & Textures:** `TongueMesh.js` (deformasi spline real-time) + `TextureGenerator.js` (diffuse, normal, & roughness maps 512px–1024px termasuk podium motif geometris Islam 8-sudut).

## Cara Menjalankan
```bash
npm install
npm run dev
```
Untuk build produksi:
```bash
npm run build
```

## Kredit Aset Open-Source
- **Anatomi 3D Gigi, Rongga Hidung & Laring:** OrganUI (`organui/teeth-3d`, `organui/nose-3d`, `organui/larynx-3d`) turunan dari **BodyParts3D**, © The Database Center for Life Science, dilisensikan di bawah **CC BY-SA 2.1 Japan**.
- **Model 3D Kepala:** `facecap.glb` dari repositori contoh resmi Three.js (Face Cap / CC0).
- **Audio Pelafalan Hijaiyah:** Rekaman pelafalan huruf Arab dari repositori open-source `adnan/Arabic-Alphabet`.
