// Renisual offerte PDF.
//
// Phase 1 layout: Renisual-only branding (no supplier logo). Matches
// the visual style of the design sample referenced in the build spec
// — Times-Bold wordmark, diagonal RENISUAL watermark at 6% opacity,
// specification table with right-aligned numbers, disclaimer box, and
// a QR pointing at the public /offerte/[ref] page.

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import QRCode from "qrcode";

const INK = "#0a0a0a";
const PAPER = "#f5f4f0";
const MUTED = "#6b6b6b";
const LINE = "#d4d2cc";
const ACCENT_BG = "#efede7";

const styles = StyleSheet.create({
  page: {
    backgroundColor: PAPER,
    color: INK,
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
  },
  watermarkLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  watermarkText: {
    fontFamily: "Times-Bold",
    fontSize: 110,
    color: INK,
    opacity: 0.06,
    transform: "rotate(-35deg)",
    letterSpacing: 6,
  },
  watermarkTagline: {
    marginTop: 16,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: INK,
    opacity: 0.18,
    transform: "rotate(-35deg)",
    letterSpacing: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    marginBottom: 22,
  },
  brandWordmark: {
    fontFamily: "Times-Bold",
    fontSize: 22,
    color: INK,
    letterSpacing: 1,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  documentLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: INK,
    letterSpacing: 2,
  },
  refText: {
    marginTop: 4,
    fontSize: 9,
    color: MUTED,
  },
  twoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  col: {
    flex: 1,
    paddingRight: 12,
  },
  blockLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: MUTED,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 10,
    color: INK,
    lineHeight: 1.4,
  },
  imageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 22,
  },
  imageCell: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
  },
  imageCaption: {
    fontSize: 8,
    color: MUTED,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: LINE,
    backgroundColor: PAPER,
    letterSpacing: 1,
  },
  facadeImage: {
    width: "100%",
    height: 130,
    objectFit: "cover",
  },
  table: {
    borderTopWidth: 1,
    borderTopColor: LINE,
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    backgroundColor: PAPER,
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: MUTED,
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  cellDescription: { flex: 4, paddingRight: 8 },
  cellQty: { flex: 1, textAlign: "right", paddingRight: 8 },
  cellUnit: { flex: 1.5, textAlign: "right", paddingRight: 8 },
  cellTotal: { flex: 1.5, textAlign: "right" },
  totalsBlock: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  totalsTable: {
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalsLabel: {
    fontSize: 9,
    color: MUTED,
  },
  totalsValue: {
    fontSize: 10,
    color: INK,
  },
  totalsRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: INK,
    marginTop: 4,
  },
  totalsLabelFinal: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: INK,
    letterSpacing: 1,
  },
  totalsValueFinal: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: INK,
  },
  disclaimerBox: {
    marginTop: 18,
    padding: 12,
    backgroundColor: ACCENT_BG,
    borderRadius: 2,
  },
  disclaimerText: {
    fontSize: 9,
    color: INK,
    lineHeight: 1.5,
  },
  qrBlock: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  qrImage: {
    width: 84,
    height: 84,
  },
  qrCopy: {
    flex: 1,
  },
  qrTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: INK,
    letterSpacing: 1,
    marginBottom: 4,
  },
  qrSubtitle: {
    fontSize: 9,
    color: MUTED,
    lineHeight: 1.4,
  },
  qrUrl: {
    marginTop: 6,
    fontFamily: "Courier",
    fontSize: 8,
    color: INK,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 10,
  },
  footerWordmark: {
    fontFamily: "Times-Bold",
    fontSize: 11,
    color: INK,
    letterSpacing: 1,
  },
  footerText: {
    flex: 1,
    paddingHorizontal: 14,
    fontSize: 8,
    color: MUTED,
    lineHeight: 1.4,
  },
  pageNumber: {
    fontSize: 8,
    color: MUTED,
  },
});

export type OfferteDocumentProps = {
  ref: string;
  generatedAt: Date;
  customer?: {
    name?: string;
    email?: string;
    company?: string;
    projectAddress?: string;
  };
  // Pricing inputs in EUR (ex-BTW). The PDF derives BTW + total.
  panelCount: number;
  pricePerPanel: number;
  profileEndCount: number;
  profileMiddleCount: number;
  profileCornerCount: number;
  pricePerEndProfile: number;
  pricePerMiddleProfile: number;
  pricePerCornerProfile: number;
  fastenerEstimateExBtw: number;
  // Derived totals already computed by the calc engine — we re-display
  // them rather than recomputing to keep one source of truth.
  subtotalExBtw: number;
  totalInclBtw: number;
  // Optional facade images (data URLs or signed URLs).
  photoSrc?: string;
  renderSrc?: string;
  // One-line note describing how the calc was made (Snel vs Per zijde),
  // shown directly under the document label so a recipient can see at a
  // glance whether this is a rough estimate or a per-side calculation.
  modeLine?: string;
  // Pre-rendered QR code (data URL) pointing at the public offerte page.
  qrSrc: string;
};

const fmtMoney = (n: number) =>
  `EUR ${n
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

const fmtDate = (d: Date) => {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${d.getFullYear()}`;
};

export function OfferteDocument(props: OfferteDocumentProps) {
  const offerteUrl = `https://renisual.com/offerte/${props.ref}`;
  const btw = Math.round((props.totalInclBtw - props.subtotalExBtw) * 100) / 100;

  const lineRows: Array<{ desc: string; qty: number; unit: number; total: number }> = [
    {
      desc: "Gevelpaneel",
      qty: props.panelCount,
      unit: props.pricePerPanel,
      total: props.panelCount * props.pricePerPanel,
    },
    {
      desc: "Eindprofiel",
      qty: props.profileEndCount,
      unit: props.pricePerEndProfile,
      total: props.profileEndCount * props.pricePerEndProfile,
    },
    {
      desc: "Tussenprofiel",
      qty: props.profileMiddleCount,
      unit: props.pricePerMiddleProfile,
      total: props.profileMiddleCount * props.pricePerMiddleProfile,
    },
    {
      desc: "Hoekprofiel",
      qty: props.profileCornerCount,
      unit: props.pricePerCornerProfile,
      total: props.profileCornerCount * props.pricePerCornerProfile,
    },
    {
      desc: "Bevestigingsmateriaal (schroeven, klips, butyl)",
      qty: 1,
      unit: props.fastenerEstimateExBtw,
      total: props.fastenerEstimateExBtw,
    },
  ].filter((row) => row.qty > 0 || row.total > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.watermarkLayer} fixed>
          <Text style={styles.watermarkText}>RENISUAL</Text>
          <Text style={styles.watermarkTagline}>GEGENEREERD VIA RENISUAL.COM</Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.brandWordmark}>Renisual</Text>
          <View style={styles.headerRight}>
            <Text style={styles.documentLabel}>ADVIESOFFERTE</Text>
            <Text style={styles.refText}>
              {props.ref} {"·"} {fmtDate(props.generatedAt)}
            </Text>
          </View>
        </View>

        {props.modeLine ? (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 9, color: MUTED, fontStyle: "italic" }}>{props.modeLine}</Text>
          </View>
        ) : null}

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.blockLabel}>KLANT</Text>
            <Text style={styles.bodyText}>{props.customer?.name ?? "Anonieme aanvraag"}</Text>
            {props.customer?.company ? <Text style={styles.bodyText}>{props.customer.company}</Text> : null}
            {props.customer?.email ? <Text style={styles.bodyText}>{props.customer.email}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.blockLabel}>PROJECT</Text>
            <Text style={styles.bodyText}>
              {props.customer?.projectAddress ?? "Adres niet opgegeven"}
            </Text>
            <Text style={styles.bodyText}>Opgesteld {fmtDate(props.generatedAt)}</Text>
          </View>
        </View>

        {(props.photoSrc || props.renderSrc) && (
          <View style={styles.imageRow}>
            <View style={styles.imageCell}>
              {props.photoSrc ? <Image src={props.photoSrc} style={styles.facadeImage} /> : <View style={styles.facadeImage} />}
              <Text style={styles.imageCaption}>BESTAANDE SITUATIE</Text>
            </View>
            <View style={styles.imageCell}>
              {props.renderSrc ? <Image src={props.renderSrc} style={styles.facadeImage} /> : <View style={styles.facadeImage} />}
              <Text style={styles.imageCaption}>VOORGESTELD EINDRESULTAAT</Text>
            </View>
          </View>
        )}

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.cellDescription]}>OMSCHRIJVING</Text>
            <Text style={[styles.tableHeaderCell, styles.cellQty]}>AANTAL</Text>
            <Text style={[styles.tableHeaderCell, styles.cellUnit]}>STUKPRIJS</Text>
            <Text style={[styles.tableHeaderCell, styles.cellTotal]}>SUBTOTAAL</Text>
          </View>
          {lineRows.map((row) => (
            <View style={styles.tableRow} key={row.desc}>
              <Text style={[styles.bodyText, styles.cellDescription]}>{row.desc}</Text>
              <Text style={[styles.bodyText, styles.cellQty]}>{row.qty}</Text>
              <Text style={[styles.bodyText, styles.cellUnit]}>{fmtMoney(row.unit)}</Text>
              <Text style={[styles.bodyText, styles.cellTotal]}>{fmtMoney(row.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotaal (excl. BTW)</Text>
              <Text style={styles.totalsValue}>{fmtMoney(props.subtotalExBtw)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>BTW (21%)</Text>
              <Text style={styles.totalsValue}>{fmtMoney(btw)}</Text>
            </View>
            <View style={styles.totalsRowFinal}>
              <Text style={styles.totalsLabelFinal}>TOTAAL</Text>
              <Text style={styles.totalsValueFinal}>{fmtMoney(props.totalInclBtw)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            Adviesprijzen — exclusief BTW. Vraag je leverancier voor de definitieve prijs.
          </Text>
          <Text style={[styles.disclaimerText, { marginTop: 4 }]}>
            Leveranciers werken met staffelkortingen op basis van afnamevolume; vraag dus altijd
            een leverancierofferte aan voordat je een definitieve keuze maakt.
          </Text>
        </View>

        <View style={styles.qrBlock}>
          <Image src={props.qrSrc} style={styles.qrImage} />
          <View style={styles.qrCopy}>
            <Text style={styles.qrTitle}>SCAN VOOR LIVE OFFERTE</Text>
            <Text style={styles.qrSubtitle}>
              Open de digitale versie met foto, AI-render en altijd-actuele prijzen.
            </Text>
            <Text style={styles.qrUrl}>{offerteUrl}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerWordmark}>Renisual</Text>
          <Text style={styles.footerText}>
            Deze offerte is opgesteld via Renisual.com — het platform voor
            gevelvisualisatie en m{"²"}-berekening.
          </Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

// Server-side helper used by the API route. Generates the QR + buffer
// in one call so route code stays readable.
export async function buildOffertePdf(props: Omit<OfferteDocumentProps, "qrSrc">): Promise<Buffer> {
  const offerteUrl = `https://renisual.com/offerte/${props.ref}`;
  const qrSrc = await QRCode.toDataURL(offerteUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 300,
  });
  return await renderToBuffer(<OfferteDocument {...props} qrSrc={qrSrc} />);
}
