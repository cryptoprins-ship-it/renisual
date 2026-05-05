import { SamModel, AutoProcessor, RawImage } from "@huggingface/transformers";
import sharp from "sharp";

const imgPath = process.argv[2] || "/tmp/test.jpg";

console.log("loading model…");
const model = await SamModel.from_pretrained("Xenova/slimsam-77-uniform");
const processor = await AutoProcessor.from_pretrained("Xenova/slimsam-77-uniform");

console.log("reading image:", imgPath);
const image = await RawImage.read(`file://${imgPath}`);
console.log("image size:", image.width, "x", image.height);

const cx = Math.floor(image.width / 2);
const cy = Math.floor(image.height / 2);
console.log("point prompt:", cx, cy);

const inputs = await processor(image, {
  input_points: [[[[cx, cy]]]],
  input_labels: [[[1]]],
});

console.log("running model…");
const outputs = await model({ ...inputs });

const masks = await processor.post_process_masks(
  outputs.pred_masks,
  inputs.original_sizes,
  inputs.reshaped_input_sizes,
);

const mask = masks[0][0];
console.log("mask shape:", mask.dims, "scores:", outputs.iou_scores.data);

const scores = Array.from(outputs.iou_scores.data);
const bestIdx = scores.indexOf(Math.max(...scores));
console.log("best mask idx:", bestIdx, "score:", scores[bestIdx].toFixed(3));

const [, , h, w] = mask.dims;
const planeSize = h * w;
const planeStart = bestIdx * planeSize;
const buf = Buffer.alloc(planeSize);
for (let i = 0; i < planeSize; i++) {
  buf[i] = mask.data[planeStart + i] ? 255 : 0;
}

await sharp(buf, { raw: { width: w, height: h, channels: 1 } })
  .png()
  .toFile("/tmp/sam-mask.png");
console.log("saved /tmp/sam-mask.png");
