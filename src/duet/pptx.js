import PptxGenJS from "pptxgenjs";

// Builds a real PowerPoint file from a deck artifact. Runs on-device; no server involved.
const BG = "0D0D0E";
const TEXT = "F4F2EF";
const DIM = "A09E9A";
const ACCENT = "E5532C";
const FONT = "Arial";

export function deckFileName(artifact) {
  const slug = artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deck";
  return `${slug}.pptx`;
}

export const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function addTitleSlide(pptx, slide) {
  const s = pptx.addSlide();
  s.background = { color: BG };
  s.addShape(pptx.ShapeType.roundRect, { x: 4.55, y: 1.15, w: 0.9, h: 0.1, fill: { color: ACCENT }, line: { color: ACCENT }, rectRadius: 0.05 });
  s.addText(slide.title, { x: 0.8, y: 1.5, w: 8.4, h: 1.5, fontFace: FONT, fontSize: 38, bold: true, color: TEXT, align: "center", valign: "middle" });
  if (slide.subtitle) {
    s.addText(slide.subtitle, { x: 1.2, y: 3.1, w: 7.6, h: 0.9, fontFace: FONT, fontSize: 18, color: DIM, align: "center", valign: "top" });
  }
  return s;
}

function addStatementSlide(pptx, slide) {
  const s = pptx.addSlide();
  s.background = { color: BG };
  s.addText(slide.title, { x: 0.8, y: 1.2, w: 8.4, h: 2.1, fontFace: FONT, fontSize: 40, bold: true, color: TEXT, align: "center", valign: "middle" });
  if (slide.subtitle) {
    s.addText(slide.subtitle, { x: 1.2, y: 3.4, w: 7.6, h: 1.1, fontFace: FONT, fontSize: 20, color: DIM, align: "center", valign: "top" });
  }
  return s;
}

function addBulletSlide(pptx, slide) {
  const s = pptx.addSlide();
  s.background = { color: BG };
  s.addText(slide.title, { x: 0.7, y: 0.45, w: 8.6, h: 0.9, fontFace: FONT, fontSize: 30, bold: true, color: TEXT, valign: "middle" });
  let top = 1.4;
  if (slide.subtitle) {
    s.addText(slide.subtitle, { x: 0.7, y: 1.3, w: 8.6, h: 0.5, fontFace: FONT, fontSize: 16, color: DIM, valign: "top" });
    top = 1.95;
  }
  const bullets = slide.bullets || [];
  if (bullets.length) {
    s.addText(
      bullets.map((text) => ({
        text,
        options: { bullet: { code: "25CF" }, paraSpaceAfter: 12, fontFace: FONT, fontSize: 22, color: TEXT },
      })),
      { x: 0.8, y: top, w: 8.4, h: 5.625 - top - 0.5, valign: "top" },
    );
  }
  return s;
}

export async function buildDeckPptx(artifact) {
  if (artifact.kind !== "deck" || !artifact.content?.slides?.length) {
    throw new Error("Only presentations with at least one slide can be exported to PowerPoint.");
  }
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = artifact.title;
  pptx.company = "Claude Duet";

  for (const slide of artifact.content.slides) {
    const s =
      slide.layout === "title" ? addTitleSlide(pptx, slide) : slide.layout === "statement" ? addStatementSlide(pptx, slide) : addBulletSlide(pptx, slide);
    if (slide.notes) s.addNotes(slide.notes);
  }
  return pptx.write({ outputType: "base64" });
}
