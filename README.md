# Makhraj 3D — Visualisasi Anatomi X-Ray Makharijul Huruf

**Demo Langsung (Publik):** https://build-zaidana.github.io/makhraj-3d/

Aplikasi web 3D interaktif gratis berbasis **Three.js + WebGL2** untuk membantu masyarakat umum, murid, dan pengajar memahami pelafalan **29 huruf Hijaiyah (Makharijul Huruf)** secara tepat dengan visualisasi anatomi 3D open-source (*BodyParts3D / OrganUI*), **X-Ray Fresnel Vision**, studio PBR lighting, mode latihan kuis, serta dukungan desktop & perangkat mobile.

## Fitur Utama
- **Belajar Tahsin Lengkap (29 Huruf + Harakat + Al-Qur'an):** Setiap huruf dilengkapi indikator **Titik Temu Organ**, panduan pelafalan bahasa Indonesia sehari-hari, latihan **4 Harakat (Fathah, Kasrah, Dhammah, Sukun)**, serta **contoh kata nyata dari Al-Qur'an** lengkap dengan Surah & Ayat.
- **Latihan Suara Privat (`Rekam & Bandingkan Suaramu`):** Rekam suaramu langsung di perangkat via `MediaRecorder` + meteran level mikrofon (100% lokal/privat tanpa server), lalu putar berurutan **Contoh Asli → Suaramu** untuk evaluasi mandiri.
- **Animasi Perbandingan 3D (`A ↔ B`) & Pin Organ 3D Interaktif:** Bandingkan huruf yang sering tertukar (`ت vs ط vs د`, `ق vs ك`, `د vs ض`, `ح vs ه vs خ`, dll.) dengan animasi transisi lidah bolak-balik otomatis, atau klik langsung pin organ di model 3D (`Organ Explorer`) untuk menjelajahi huruf berdasarkan organnya.
- **Kurikulum 5 Makhraj, Penguasaan & Kuis Adaptif 10 Soal:** Tandai huruf yang sudah dikuasai (`Sudah Paham`), pantau progres per 5 Makhraj, lalu latih diri lewat kuis **Tebak Huruf 3D** atau **Tebak Tempat Keluar** dengan filter `Semua 29`, `Huruf Mirip`, atau `Belum Paham` + ringkasan akhir sesi.
- **Tema Studio Terang & Gelap (Monokrom) + Ramah Pemula:** Tampilan default **Mode Terang** galeri lembut dengan tombol 1-klik ke **Mode Gelap**, **Peta 29 Huruf** dengan pencarian instan (`G`), modal **Bantuan**, mode latihan **Ulang** & **0.5x**, serta tombol 1-klik **Fokus Titik** (kamera & irisan tidak pernah di-reset otomatis saat ganti huruf).
- **Siap Offline & Dapat Diinstal (PWA):** Dilengkapi `manifest.webmanifest` dan Service Worker (`sw.js`) yang men-cache model 3D GLB, decoder Basis WASM, dan 29 audio MP3 secara lokal untuk akses offline di ponsel maupun laptop.
- **Anatomi 1:1 MRI Khusus Organ Makharijul Huruf (`BodyParts3D` / `OrganUI`):**
  - `public/models/anatomy_head_1to1.glb` (3,6 MB, 54 struktur anatomi terkalibrasi 1:1 khusus organ bicara — tanpa distraksi tengkorak atau tulang leher): **28 gigi individual** + gusi + tulang palatum + mandibula berengsel TMJ, rongga hidung (*Al-Khaisyum*) + konka + nasofaring, otot konstriktor faring + *musculus uvulae*, serta hyoid, kartilago laring, epiglotis, pita suara, dan trakea — lengkap dengan kontrol **Diseksi 4 Lapisan Organ Makhraj**.
- **Kalibrasi Matematis Seluruh 29 Huruf:** Seluruh pose lidah (`56×64` deformable spline + SSS), rahang, bibir (52 ARKit blendshapes), epiglotis, dan titik fokus diverifikasi 1:1 terhadap koordinat permukaan MRI asli tanpa penetrasi gigi/langit-langit.
- **Real-Time Subsurface Scattering (SSS) & Fine-Mist Airflow:** Material `MeshPhysicalMaterial` dengan *Fast Subsurface Scattering* (`onBeforeCompile`) pada lidah `56×64`, gusi, mukosa faring, dan enamel gigi, dipadukan partikel *silky fine-mist* sepanjang saluran napas MRI 1:1.
- **X-Ray Fresnel Vision + Interactive Sagittal Cutaway:** Custom GLSL shader pada cangkang kepala `facecap.glb` (52 ARKit blendshapes untuk gerakan bibir `ب م و ف`) dengan slider irisan sagital real-time dan tepi potongan bercahaya.
- **Interactive 3D Anatomical Callout Labels:** Penunjuk anatomi 3D yang otomatis menyorot organ aktif sesuai huruf Hijaiyah yang dipilih.
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
