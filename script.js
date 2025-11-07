// ---------------------------
// Emoji Mosaic Generator (WASM powered)
// ---------------------------

// === DOM elements ===
const fileInput = document.getElementById("imageUpload"); // <input type="file" id="imageUpload">
const inputCanvas = document.getElementById("inputCanvas"); // <canvas id="inputCanvas"></canvas>
const inputCtx = inputCanvas.getContext("2d");
const outputContainer = document.getElementById("mosaicContainer"); // <div id="mosaicContainer"></div>

// === Settings ===
const tileSize = 12; // adjust tile size if needed
let imageLoaded = false;

// STEP 2 — Convert emoji file names → actual emoji characters
function filenameToEmoji(name) {
  const hexes = name
    .toLowerCase()
    .split('/').pop()          // "emoji_u1f602.svg"
    .replace(/^emoji_u/, '')   // "1f602.svg"
    .replace(/\.svg$/, '')     // "1f602"
    .split('_');               // handles multi-part emojis too (like family emojis)

  return String.fromCodePoint(...hexes.map(h => parseInt(h, 16)));
}

// === Step 1: initialize WASM and KD-tree ===
(async function initWasmAndTree() {
  try {
    console.log("⏳ Initializing WebAssembly + KD-tree...");
    await loadWasmModule("build/full_mosaic.wasm");
    await loadKDTreeIntoWasm("kd_tree.json");
    console.log("✅ WASM and KD-tree ready.");
  } catch (e) {
    console.error("❌ WASM init failed:", e);
  }
})();

// === Step 2: image upload handler ===
fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = async () => {
    // Draw uploaded image to input canvas
    inputCanvas.width = img.width;
    inputCanvas.height = img.height;
    inputCtx.drawImage(img, 0, 0);
    imageLoaded = true;

    // Ensure WASM is ready
    if (!window.wasmReady) {
      console.log("WASM not ready yet, reloading...");
      await loadWasmModule("build/full_mosaic.wasm");
      await loadKDTreeIntoWasm("kd_tree.json");
    }

    console.log("🖼️ Image loaded, generating mosaic...");

    // === Step 3: compute tile colors ===
    const { colors, cols, rows } = calculateTileColorsFromCanvas(inputCanvas, tileSize);

// === Step 4: run WASM matching ===
console.time("🧩 Mosaic matching time");
let results = runMatchingAndGetResults(colors);
console.timeEnd("🧩 Mosaic matching time");

// ✅ Convert each file name → emoji character
results = results.map(filenameToEmoji);

console.log("✅ Converted Emoji Example:", results.slice(0, 10)); // should show actual emojis

// === Step 5: render (we will replace SVG later)
renderFromResults(results, cols, rows, tileSize, 0.80);

    console.log("✅ Mosaic generated successfully!");
  };
});

async function renderFromResults(results, cols, rows, tileSize, scale = 1.00) {
  outputContainer.innerHTML = "";

  let canvas = document.getElementById("mosaicCanvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "mosaicCanvas";
    outputContainer.appendChild(canvas);
  }

  const dpr = window.devicePixelRatio || 1;
  const scaleOutput = 2; // 2K output resolution

  canvas.width = cols * tileSize * dpr * scaleOutput;
  canvas.height = rows * tileSize * dpr * scaleOutput;
  canvas.style.width = (cols * tileSize) + "px";
  canvas.style.height = (rows * tileSize) + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr * scaleOutput, dpr * scaleOutput);

  await document.fonts.load(`${tileSize * scale}px NotoEmoji`);

  // Black background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Scale emoji size
  ctx.font = `${tileSize * scale}px NotoEmoji`;
  ctx.textBaseline = "top";

  // Center emoji nicely inside tile
  const offset = (tileSize - (tileSize * scale)) / 2;

  let index = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++, index++) {
      const emoji = results[index] || "⬜";
      ctx.fillText(emoji, x * tileSize + offset, y * tileSize + offset);
    }
  }

  console.log("✅ Mosaic rendered (2K + scale control)");
}

// === Optional: reset button ===
function resetMosaic() {
  outputContainer.innerHTML = "";
  inputCtx.clearRect(0, 0, inputCanvas.width, inputCanvas.height);
  fileInput.value = "";
  imageLoaded = false;
  console.log("🔁 Mosaic reset.");
}



// === Optional: export functions ===
function downloadMosaicPNG() {
  const canvas = document.getElementById("mosaicCanvas");
  if (!canvas) return alert("Please generate the mosaic first!");

  const link = document.createElement("a");
  link.download = "mosaic-2k.png"; // File name when downloaded
  link.href = canvas.toDataURL("image/png"); // Convert canvas → PNG
  link.click();

  console.log("✅ PNG Downloaded");
}

document.getElementById("downloadBtn").addEventListener("click", downloadMosaicPNG);