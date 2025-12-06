const express = require("express");
const multer = require("multer");
// require sharp lazily inside handler to avoid startup crash if not installed

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 12 * 1024 * 1024 } });

// Helper: process buffer to webp <= maxBytes
async function processToWebP(buffer, maxKB = 100) {
  const maxBytes = maxKB * 1024;
  let quality = 80; // start quality
  let widthCap = 1600;

  // require sharp here so missing module doesn't crash the whole app
  let sharp;
  try {
    sharp = require("sharp");
  } catch (e) {
    throw new Error(
      "Server-side image processing unavailable: 'sharp' module not installed"
    );
  }

  // initial metadata
  let img = sharp(buffer).rotate();
  let metadata = await img.metadata();
  let width = metadata.width || null;
  let height = metadata.height || null;

  // If image is huge, scale down first
  if (width && height && (width > widthCap || height > widthCap)) {
    const ratio = Math.min(widthCap / width, widthCap / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  let resultBuffer = null;

  // Try decreasing quality until under maxBytes
  for (; quality >= 20; quality -= 10) {
    try {
      let pipeline = sharp(buffer).rotate();
      if (width && height) pipeline = pipeline.resize(width, height);
      const out = await pipeline.webp({ quality }).toBuffer();
      if (out.length <= maxBytes) {
        resultBuffer = out;
        break;
      }
      resultBuffer = out; // keep last attempt
    } catch (e) {
      // continue
    }
  }

  // If still too big, progressively scale down
  if (resultBuffer && resultBuffer.length > maxBytes) {
    let scale = 0.9;
    let currentWidth = width || metadata.width;
    let currentHeight = height || metadata.height;
    while (
      resultBuffer.length > maxBytes &&
      (currentWidth > 200 || currentHeight > 200)
    ) {
      currentWidth = Math.round(currentWidth * scale);
      currentHeight = Math.round(currentHeight * scale);
      try {
        const out = await sharp(buffer)
          .rotate()
          .resize(currentWidth, currentHeight)
          .webp({ quality: Math.max(30, quality) })
          .toBuffer();
        resultBuffer = out;
      } catch (e) {
        break;
      }
      scale -= 0.05;
      if (scale < 0.5) break;
    }
  }

  return resultBuffer || buffer; // fallback to original if processing failed
}

// POST /process-image
router.post("/process-image", upload.single("file"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Process buffer to webp <= 100KB
    const processed = await processToWebP(req.file.buffer, 100);

    // Build data URI
    const dataUri = `data:image/webp;base64,${processed.toString("base64")}`;

    res.json({ dataUri, size: processed.length });
  } catch (err) {
    console.error("process-image error:", err);
    res.status(500).json({ message: err.message || "Processing failed" });
  }
});

module.exports = router;
