const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "images");
const COLORS = {
  merah: [220, 38, 38], hijau: [22, 163, 74], biru: [37, 99, 235],
  kuning: [234, 179, 8], ungu: [147, 51, 234], oranye: [234, 88, 12]
};
const SIZE = 200;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png([r, g, b]) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.alloc(1 + SIZE * 3);
  for (let x = 0; x < SIZE; x += 1) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: SIZE }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, rgb] of Object.entries(COLORS)) {
  const file = path.join(OUT, `${name}.png`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, png(rgb));
}
console.log(`Fixture gambar ada di ${OUT}`);
