import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bwipjs from 'bwip-js';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const catalogPath = path.join(root, 'apps/api/src/catalog/products.json');
const publicDir = path.join(root, 'apps/web/public');
const barcodeRoot = path.join(publicDir, 'barcodes');

const folderMap = {
  PANEL: 'panels',
  INVERTER: 'inverters',
  BATTERY: 'batteries',
  CHARGE_CONTROLLER: 'charge-controllers',
  STRUCTURE: 'structures',
  CABLE: 'cables',
  BOS: 'bos',
  SERVICE: 'services',
  TOOL: 'tools',
};

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

fs.rmSync(barcodeRoot, { recursive: true, force: true });
fs.mkdirSync(barcodeRoot, { recursive: true });

const manifest = [];

for (const item of catalog) {
  const folder = folderMap[item.category];
  if (!folder) continue;
  const directory = path.join(barcodeRoot, folder);
  fs.mkdirSync(directory, { recursive: true });

  const svg = bwipjs.toSVG({
    bcid: 'code128',
    text: item.sku,
    scale: 3,
    height: 14,
    includetext: true,
    textxalign: 'center',
    textsize: 11,
    paddingwidth: 10,
    paddingheight: 10,
    backgroundcolor: 'FFFFFF',
  });

  const filename = `${item.sku}.svg`;
  fs.writeFileSync(path.join(directory, filename), svg, 'utf8');

  manifest.push({
    sku: item.sku,
    name: item.name,
    category: item.category,
    folder,
    path: `/barcodes/${folder}/${filename}`,
    unit: item.unit,
    unitPrice: item.unitPrice,
    warrantyMonths: item.warrantyMonths,
  });

  console.log(`barcode  ${folder}/${filename}`);
}

fs.writeFileSync(
  path.join(barcodeRoot, 'manifest.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      symbology: 'Code 128',
      count: manifest.length,
      folders: folderMap,
      items: manifest,
    },
    null,
    2,
  ),
);

const folderSummary = Object.entries(folderMap)
  .map(([category, folder]) => {
    const count = manifest.filter((item) => item.category === category).length;
    return `- **${folder}/** — ${count} barcode${count === 1 ? '' : 's'} (${category})`;
  })
  .join('\n');

fs.writeFileSync(
  path.join(barcodeRoot, 'README.md'),
  `# SunPower static barcodes\n\nEvery catalogue item has a Code 128 barcode SVG in its category folder.\n\n${folderSummary}\n\nA machine-readable index is available at \`manifest.json\`. Rebuild with \`npm run assets\`.\n`,
);

const upiId = process.env.UPI_ID ?? 'sunpower@upi';
const upiName = process.env.UPI_NAME ?? 'SunPower Solutions';
const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
  upiName,
)}&cu=INR&tn=${encodeURIComponent('Solar installation payment')}`;

fs.mkdirSync(path.join(publicDir, 'payments'), { recursive: true });
const qrSvg = await QRCode.toString(upiUrl, {
  type: 'svg',
  width: 360,
  margin: 1,
  errorCorrectionLevel: 'M',
  color: { dark: '#0B1F33', light: '#FFFFFF' },
});
fs.writeFileSync(path.join(publicDir, 'payments/upi-qr.svg'), qrSvg, 'utf8');
fs.writeFileSync(
  path.join(publicDir, 'payments/upi.json'),
  JSON.stringify({ upiId, upiName, upiUrl }, null, 2),
);
console.log('payment  payments/upi-qr.svg');

const demoDir = path.join(publicDir, 'demo');
fs.mkdirSync(demoDir, { recursive: true });

fs.writeFileSync(
  path.join(demoDir, 'payment-proof.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="760" viewBox="0 0 420 760">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1f33"/><stop offset="1" stop-color="#123b57"/>
    </linearGradient>
  </defs>
  <rect width="420" height="760" rx="0" fill="url(#bg)"/>
  <text x="28" y="48" fill="#94a3b8" font-family="Arial, sans-serif" font-size="13" letter-spacing="2">UPI PAYMENT RECEIPT</text>
  <circle cx="210" cy="150" r="46" fill="#16a34a"/>
  <path d="M186 150l16 16 32-34" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="210" y="238" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="22" font-weight="700">Payment successful</text>
  <text x="210" y="290" text-anchor="middle" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="42" font-weight="700">₹77,489</text>
  <text x="210" y="318" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="13">Advance payment · Solar system</text>
  <rect x="28" y="360" width="364" height="250" rx="18" fill="#ffffff"/>
  <text x="52" y="400" fill="#64748b" font-family="Arial, sans-serif" font-size="12">PAID TO</text>
  <text x="52" y="428" fill="#0f172a" font-family="Arial, sans-serif" font-size="18" font-weight="700">SunPower Solutions</text>
  <text x="52" y="450" fill="#64748b" font-family="Arial, sans-serif" font-size="13">sunpower@upi</text>
  <line x1="52" y1="474" x2="368" y2="474" stroke="#e2e8f0"/>
  <text x="52" y="502" fill="#64748b" font-family="Arial, sans-serif" font-size="12">UTR</text>
  <text x="52" y="524" fill="#0f172a" font-family="Arial, sans-serif" font-size="14">4258 7712 0094</text>
  <text x="52" y="558" fill="#64748b" font-family="Arial, sans-serif" font-size="12">DATE</text>
  <text x="52" y="580" fill="#0f172a" font-family="Arial, sans-serif" font-size="14">31 Oct 2026, 10:42 AM</text>
  <text x="210" y="676" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="12">Demo screenshot for SunPower payment approval</text>
  <text x="210" y="700" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="11">PhonePe · Google Pay · BHIM UPI</text>
</svg>`,
);

fs.writeFileSync(
  path.join(demoDir, 'roof-photo.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3ff"/><stop offset="1" stop-color="#eef8ff"/></linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d4ed8"/><stop offset="1" stop-color="#0b1f33"/></linearGradient>
  </defs>
  <rect width="900" height="600" fill="url(#sky)"/>
  <circle cx="760" cy="110" r="54" fill="#fbbf24"/>
  <path d="M0 420L250 300l210 120 180-70 260 150v100H0z" fill="#d9c9b2"/>
  <path d="M80 470l260-140 260 140z" fill="#8b5e3c"/>
  <g transform="translate(155 300) skewX(-18)">
    <rect width="340" height="190" rx="6" fill="url(#panel)"/>
    <g stroke="#93c5fd" stroke-width="2" opacity="0.6">
      <path d="M0 48h340M0 96h340M0 144h340M68 0v190M136 0v190M204 0v190M272 0v190"/>
    </g>
  </g>
  <g transform="translate(540 350) skewX(-18)">
    <rect width="230" height="130" rx="6" fill="url(#panel)"/>
    <g stroke="#93c5fd" stroke-width="2" opacity="0.6">
      <path d="M0 44h230M0 88h230M58 0v130M116 0v130M174 0v130"/>
    </g>
  </g>
  <text x="40" y="560" fill="#475569" font-family="Arial, sans-serif" font-size="18">SunPower · finished rooftop array</text>
</svg>`,
);

fs.writeFileSync(
  path.join(demoDir, 'roof-photo-2.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <rect width="900" height="600" fill="#e7e5e4"/>
  <rect x="0" y="420" width="900" height="180" fill="#cbd5e1"/>
  <rect x="120" y="110" width="300" height="360" rx="14" fill="#f8fafc" stroke="#94a3b8" stroke-width="3"/>
  <rect x="160" y="160" width="220" height="130" rx="8" fill="#0b1f33"/>
  <text x="270" y="215" text-anchor="middle" fill="#38bdf8" font-family="Arial, sans-serif" font-size="20" font-weight="700">SUNPOWER</text>
  <text x="270" y="242" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="12">HYBRID INVERTER</text>
  <circle cx="230" cy="335" r="12" fill="#22c55e"/><text x="252" y="340" fill="#334155" font-family="Arial, sans-serif" font-size="12">GRID / SOLAR / BATTERY</text>
  <rect x="500" y="160" width="150" height="200" rx="8" fill="#f1f5f9" stroke="#64748b" stroke-width="3"/>
  <text x="575" y="195" text-anchor="middle" fill="#334155" font-family="Arial, sans-serif" font-size="13" font-weight="700">ACDB</text>
  <circle cx="575" cy="240" r="22" fill="#ef4444"/><text x="575" y="245" text-anchor="middle" fill="#fff" font-family="Arial" font-size="11">ON</text>
  <rect x="700" y="160" width="120" height="200" rx="8" fill="#f1f5f9" stroke="#64748b" stroke-width="3"/>
  <text x="760" y="195" text-anchor="middle" fill="#334155" font-family="Arial, sans-serif" font-size="13" font-weight="700">DCDB</text>
  <path d="M420 225h80M650 225h50M760 360v60" stroke="#475569" stroke-width="6" fill="none"/>
  <text x="40" y="560" fill="#475569" font-family="Arial, sans-serif" font-size="18">SunPower · inverter, ACDB and DCDB after commissioning</text>
</svg>`,
);

fs.writeFileSync(
  path.join(demoDir, 'signature.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240">
  <rect width="640" height="240" fill="#ffffff"/>
  <path d="M60 165c38-58 56-92 78-92 19 0 5 54-12 82-15 25 5 28 25 4 26-31 41-62 56-62 18 0 3 52-10 72-10 16 4 21 19 6 22-23 37-48 50-48 16 0 8 39-4 55-10 13 8 14 24 1 21-18 33-35 47-35 15 0 5 31-8 47-11 14 3 17 19 5 26-20 47-43 66-43 12 0 15 10 9 22" fill="none" stroke="#0b1f33" stroke-width="5" stroke-linecap="round"/>
  <line x1="60" y1="200" x2="580" y2="200" stroke="#cbd5e1" stroke-width="2"/>
  <text x="60" y="228" fill="#64748b" font-family="Arial, sans-serif" font-size="14">Customer signature · demo</text>
</svg>`,
);

console.log(`\nDone: ${manifest.length} barcodes, UPI QR and demo assets generated.`);
