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
  matenSection: {
    marginBottom: 18,
  },
  sideBlock: {
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 8,
    marginBottom: 10,
  },
  sideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  sideTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: INK,
  },
  sideSize: {
    fontFamily: "Courier",
    fontSize: 9,
    color: INK,
  },
  openingsHeader: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  openingsRow: {
    flexDirection: "row",
    paddingVertical: 3,
  },
  cellOpType: { flex: 1.2 },
  cellOpLabel: { flex: 2 },
  cellOpSize: { flex: 1.5, textAlign: "right", fontFamily: "Courier" },
  cellOpCount: { flex: 0.5, textAlign: "right" },
  noOpenings: {
    fontSize: 9,
    color: MUTED,
    fontStyle: "italic",
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
  // Pricing inputs. Prices passed in are EX-BTW; the PDF multiplies by
  // 1.21 to display incl-BTW figures (per user request — prices shown
  // are consumer-facing). Pricing is opt-in via includePrices; when off
  // the PDF renders BOM only (description + quantity columns) with no
  // unit prices, no totals, and no VAT disclaimer.
  includePrices?: boolean;
  panelCount: number;
  pricePerPanel: number;
  // Beginprofiel (start rail) — was missing from the PDF schema even
  // though calc engine and UI display it. Optional for backward compat
  // with older payloads in flight.
  profileStartCount?: number;
  profileEndCount: number;
  profileMiddleCount: number;
  profileCornerCount: number;
  // YJDZ binnenhoek — only meaningful for L-shape / U-shape facades.
  // Defaults to 0 / undefined for typical rectangular installs.
  profileInsideCornerCount?: number;
  pricePerStartProfile?: number;
  pricePerEndProfile: number;
  pricePerMiddleProfile: number;
  pricePerCornerProfile: number;
  pricePerInsideCornerProfile?: number;
  // Stick lengths in metres — render as e.g. "(3,8m)" suffix on each
  // line in the offerte. Spanl ships some profiles in two lengths with
  // different prices; the offerte must explicitly state which variant
  // was calculated. Optional with sensible defaults so older payloads
  // without lengths still render (no suffix).
  lengthPanelM?: number;
  lengthStartProfileM?: number;
  lengthEndProfileM?: number;
  lengthMiddleProfileM?: number;
  lengthCornerProfileM?: number;
  lengthInsideCornerProfileM?: number;
  fastenerEstimateExBtw: number;
  // Derived totals already computed by the calc engine — we re-display
  // them rather than recomputing to keep one source of truth.
  subtotalExBtw: number;
  totalInclBtw: number;
  // Human-readable product label, e.g. "Spanl PB9003A — white (RAL 9010)".
  // Rendered as a PRODUCT column next to KLANT + PROJECT so the recipient
  // can see at a glance which panel was quoted.
  productLabel?: string;
  // Optional facade images (data URLs or signed URLs).
  photoSrc?: string;
  renderSrc?: string;
  // One-line note describing how the calc was made (Snel vs Per zijde),
  // shown directly under the document label so a recipient can see at a
  // glance whether this is a rough estimate or a per-side calculation.
  modeLine?: string;
  // Pre-rendered QR code (data URL) pointing at the public offerte page.
  qrSrc: string;
  // Orientation of the primary (chosen) BOM. Drives the section header
  // when an alternate is also rendered. Optional — when absent, the
  // primary block has no orientation header.
  primaryOrientation?: "horizontal" | "vertical";
  // Optional second BOM section (the "Al gedacht aan de X optie?"
  // toggle on /gevelcalc). Rendered after the primary table with its
  // own header. Prices are derived using the same per-unit rates as
  // the primary — only the counts and totals differ.
  alternate?: {
    orientation: "horizontal" | "vertical";
    panelCount: number;
    profileStartCount?: number;
    profileEndCount: number;
    profileMiddleCount: number;
    profileCornerCount: number;
    profileInsideCornerCount?: number;
    subtotalExBtw: number;
    totalInclBtw: number;
  };
  // Per-zijde maten + openingen, één-op-één gelift uit de "foto's+maten"
  // PDF zodat de ontvanger ziet welke gevelmaten zijn aangenomen. Wordt
  // gerenderd tussen render-foto en BOM-tabel. Optioneel — oude
  // payloads zonder sides slaan deze sectie gewoon over.
  sides?: OfferteSideInfo[];
};

export type OfferteSideInfo = {
  name: string;
  widthCm: number;
  heightCm: number;
  openings: Array<{
    type: "window" | "door" | "other";
    label: string;
    widthCm: number;
    heightCm: number;
    count: number;
  }>;
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

type LineRow = { desc: string; qty: number; unit: number; total: number };

// Build the BOM line-rows for one orientation. Prices are per-unit and
// stay identical between primary and alternate — only the counts (and
// derived totals) differ.
function buildLineRows(
  counts: {
    panelCount: number;
    profileStartCount?: number;
    profileEndCount: number;
    profileMiddleCount: number;
    profileCornerCount: number;
    profileInsideCornerCount?: number;
    fastenerEstimateExBtw: number;
  },
  prices: {
    pricePerPanel: number;
    pricePerStartProfile?: number;
    pricePerEndProfile: number;
    pricePerMiddleProfile: number;
    pricePerCornerProfile: number;
    pricePerInsideCornerProfile?: number;
  },
  // Stick lengths in metres so the PDF labels each profile with its
  // length variant (e.g. "Eindprofiel (3.8m)" vs "Beginprofiel (3m)").
  // Spanl voert sommige profielen in twee lengtes met verschillende
  // prijzen — de offerte moet dus expliciet maken welke variant er
  // gerekend is. All optional with sensible defaults so downstream
  // call sites that don't yet pass them keep working.
  lengths: {
    lengthPanelM?: number;
    lengthStartProfileM?: number;
    lengthEndProfileM?: number;
    lengthMiddleProfileM?: number;
    lengthCornerProfileM?: number;
    lengthInsideCornerProfileM?: number;
  } = {},
  VAT: number,
): LineRow[] {
  const startCount = counts.profileStartCount ?? 0;
  const startPrice = prices.pricePerStartProfile ?? 0;
  const insideCornerCount = counts.profileInsideCornerCount ?? 0;
  const insideCornerPrice = prices.pricePerInsideCornerProfile ?? 0;
  const fmtLen = (m?: number) => (m ? ` (${String(m).replace(".", ",")}m)` : "");
  return [
    {
      desc: `Gevelpaneel${fmtLen(lengths.lengthPanelM)}`,
      qty: counts.panelCount,
      unit: prices.pricePerPanel * VAT,
      total: counts.panelCount * prices.pricePerPanel * VAT,
    },
    {
      desc: `Beginprofiel${fmtLen(lengths.lengthStartProfileM)}`,
      qty: startCount,
      unit: startPrice * VAT,
      total: startCount * startPrice * VAT,
    },
    {
      desc: `Eindprofiel${fmtLen(lengths.lengthEndProfileM)}`,
      qty: counts.profileEndCount,
      unit: prices.pricePerEndProfile * VAT,
      total: counts.profileEndCount * prices.pricePerEndProfile * VAT,
    },
    {
      desc: `Tussenprofiel${fmtLen(lengths.lengthMiddleProfileM)}`,
      qty: counts.profileMiddleCount,
      unit: prices.pricePerMiddleProfile * VAT,
      total: counts.profileMiddleCount * prices.pricePerMiddleProfile * VAT,
    },
    {
      desc: `Hoekprofiel buiten${fmtLen(lengths.lengthCornerProfileM)}`,
      qty: counts.profileCornerCount,
      unit: prices.pricePerCornerProfile * VAT,
      total: counts.profileCornerCount * prices.pricePerCornerProfile * VAT,
    },
    {
      desc: `Hoekprofiel binnen${fmtLen(lengths.lengthInsideCornerProfileM)}`,
      qty: insideCornerCount,
      unit: insideCornerPrice * VAT,
      total: insideCornerCount * insideCornerPrice * VAT,
    },
    // Bevestigingsmateriaal regel verwijderd — qty=1 met onbekende
    // prijs gaf een hardcoded 1 zonder context die nergens op sloeg.
    // Schroeven / klips / butyl rekent de leverancier los af.
  ].filter((row) => row.qty > 0);
}

const orientationLabelNl = (o: "horizontal" | "vertical") =>
  o === "vertical" ? "VERTICALE OPTIE" : "HORIZONTALE OPTIE";

export function OfferteDocument(props: OfferteDocumentProps) {
  const offerteUrl = `https://renisual.com/offerte/${props.ref}`;
  const includePrices = !!props.includePrices;
  const VAT = 1.21;

  const prices = {
    pricePerPanel: props.pricePerPanel,
    pricePerStartProfile: props.pricePerStartProfile,
    pricePerEndProfile: props.pricePerEndProfile,
    pricePerMiddleProfile: props.pricePerMiddleProfile,
    pricePerCornerProfile: props.pricePerCornerProfile,
    pricePerInsideCornerProfile: props.pricePerInsideCornerProfile,
  };

  // When prices are shown, all unit/total values are presented INCLUSIEF
  // BTW (input is ex-BTW from the calc engine, multiplied by 1.21 here).
  // Single TOTAAL row, no separate BTW row.
  const lengths = {
    lengthPanelM: props.lengthPanelM,
    lengthStartProfileM: props.lengthStartProfileM,
    lengthEndProfileM: props.lengthEndProfileM,
    lengthMiddleProfileM: props.lengthMiddleProfileM,
    lengthCornerProfileM: props.lengthCornerProfileM,
    lengthInsideCornerProfileM: props.lengthInsideCornerProfileM,
  };
  const lineRows = buildLineRows(
    {
      panelCount: props.panelCount,
      profileStartCount: props.profileStartCount,
      profileEndCount: props.profileEndCount,
      profileMiddleCount: props.profileMiddleCount,
      profileCornerCount: props.profileCornerCount,
      profileInsideCornerCount: props.profileInsideCornerCount,
      fastenerEstimateExBtw: props.fastenerEstimateExBtw,
    },
    prices,
    lengths,
    VAT,
  );
  const totalInclBtw = lineRows.reduce((sum, row) => sum + row.total, 0);

  // Alternate-orientation rows. Same prices, different counts. Same
  // fastener estimate (single line, count = 1) survives because that
  // line isn't orientation-dependent.
  const altRows = props.alternate
    ? buildLineRows(
        {
          panelCount: props.alternate.panelCount,
          profileStartCount: props.alternate.profileStartCount,
          profileEndCount: props.alternate.profileEndCount,
          profileMiddleCount: props.alternate.profileMiddleCount,
          profileCornerCount: props.alternate.profileCornerCount,
          profileInsideCornerCount: props.alternate.profileInsideCornerCount,
          fastenerEstimateExBtw: props.fastenerEstimateExBtw,
        },
        prices,
        lengths,
        VAT,
      )
    : [];
  const altTotalInclBtw = altRows.reduce((sum, row) => sum + row.total, 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.watermarkLayer} fixed>
          <Text style={styles.watermarkText}>RENISUAL</Text>
          <Text style={styles.watermarkTagline}>GEGENEREERD VIA RENISUAL.COM</Text>
        </View>

        <View style={styles.header}>
          <View>
            <Text style={styles.brandWordmark}>Renisual</Text>
            <Text style={{ marginTop: 4, fontSize: 8, color: MUTED, fontStyle: "italic" }}>
              Zien is weten.
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.documentLabel}>OFFERTE</Text>
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
          {props.productLabel ? (
            <View style={styles.col}>
              <Text style={styles.blockLabel}>PRODUCT</Text>
              <Text style={styles.bodyText}>{props.productLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Only the proposed render is shown — original photo was
            removed from the PDF on user request. The bestaande-situatie
            shot lives on the public /offerte/[ref] page if a viewer
            wants the side-by-side comparison. The render gets a single
            full-width cell instead of the previous half-width split. */}
        {props.renderSrc ? (
          <View style={styles.imageRow}>
            <View style={styles.imageCell}>
              <Image src={props.renderSrc} style={styles.facadeImage} />
              <Text style={styles.imageCaption}>VOORGESTELD EINDRESULTAAT</Text>
            </View>
          </View>
        ) : null}

        {props.sides && props.sides.length > 0 ? (
          <View style={styles.matenSection}>
            <Text style={styles.blockLabel}>MATEN PER ZIJDE</Text>
            {props.sides.map((side, i) => (
              <View key={i} style={styles.sideBlock}>
                <View style={styles.sideHeader}>
                  <Text style={styles.sideTitle}>
                    {side.name || `Zijde ${i + 1}`}
                  </Text>
                  <Text style={styles.sideSize}>
                    {side.widthCm} × {side.heightCm} cm
                  </Text>
                </View>
                {side.openings.length === 0 ? (
                  <Text style={styles.noOpenings}>Geen openingen.</Text>
                ) : (
                  <>
                    <View style={styles.openingsHeader}>
                      <Text style={[styles.tableHeaderCell, styles.cellOpType]}>
                        TYPE
                      </Text>
                      <Text style={[styles.tableHeaderCell, styles.cellOpLabel]}>
                        LABEL
                      </Text>
                      <Text style={[styles.tableHeaderCell, styles.cellOpSize]}>
                        B × H (CM)
                      </Text>
                      <Text style={[styles.tableHeaderCell, styles.cellOpCount]}>
                        #
                      </Text>
                    </View>
                    {side.openings.map((o, j) => (
                      <View key={j} style={styles.openingsRow}>
                        <Text style={[styles.bodyText, styles.cellOpType]}>
                          {o.type === "window"
                            ? "Raam"
                            : o.type === "door"
                              ? "Deur"
                              : "Anders"}
                        </Text>
                        <Text style={[styles.bodyText, styles.cellOpLabel]}>
                          {o.label || "—"}
                        </Text>
                        <Text style={[styles.bodyText, styles.cellOpSize]}>
                          {o.widthCm} × {o.heightCm}
                        </Text>
                        <Text style={[styles.bodyText, styles.cellOpCount]}>
                          {o.count}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            ))}
          </View>
        ) : null}

        {props.alternate && props.primaryOrientation ? (
          <View style={{ marginBottom: 6 }}>
            <Text style={styles.blockLabel}>
              GEKOZEN — {orientationLabelNl(props.primaryOrientation)}
            </Text>
          </View>
        ) : null}

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.cellDescription]}>OMSCHRIJVING</Text>
            <Text style={[styles.tableHeaderCell, styles.cellQty]}>AANTAL</Text>
            {includePrices ? (
              <>
                <Text style={[styles.tableHeaderCell, styles.cellUnit]}>STUKPRIJS</Text>
                <Text style={[styles.tableHeaderCell, styles.cellTotal]}>SUBTOTAAL</Text>
              </>
            ) : null}
          </View>
          {lineRows.map((row) => (
            <View style={styles.tableRow} key={row.desc}>
              <Text style={[styles.bodyText, styles.cellDescription]}>{row.desc}</Text>
              <Text style={[styles.bodyText, styles.cellQty]}>{row.qty}</Text>
              {includePrices ? (
                <>
                  <Text style={[styles.bodyText, styles.cellUnit]}>{fmtMoney(row.unit)}</Text>
                  <Text style={[styles.bodyText, styles.cellTotal]}>{fmtMoney(row.total)}</Text>
                </>
              ) : null}
            </View>
          ))}
        </View>

        {includePrices ? (
          <View style={styles.totalsBlock}>
            <View style={styles.totalsTable}>
              <View style={styles.totalsRowFinal}>
                <Text style={styles.totalsLabelFinal}>TOTAAL (incl. BTW)</Text>
                <Text style={styles.totalsValueFinal}>{fmtMoney(totalInclBtw)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {props.alternate ? (
          <>
            <View style={{ marginTop: 18, marginBottom: 6 }}>
              <Text style={styles.blockLabel}>
                ALTERNATIEF — {orientationLabelNl(props.alternate.orientation)}
              </Text>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.cellDescription]}>OMSCHRIJVING</Text>
                <Text style={[styles.tableHeaderCell, styles.cellQty]}>AANTAL</Text>
                {includePrices ? (
                  <>
                    <Text style={[styles.tableHeaderCell, styles.cellUnit]}>STUKPRIJS</Text>
                    <Text style={[styles.tableHeaderCell, styles.cellTotal]}>SUBTOTAAL</Text>
                  </>
                ) : null}
              </View>
              {altRows.map((row) => (
                <View style={styles.tableRow} key={`alt-${row.desc}`}>
                  <Text style={[styles.bodyText, styles.cellDescription]}>{row.desc}</Text>
                  <Text style={[styles.bodyText, styles.cellQty]}>{row.qty}</Text>
                  {includePrices ? (
                    <>
                      <Text style={[styles.bodyText, styles.cellUnit]}>{fmtMoney(row.unit)}</Text>
                      <Text style={[styles.bodyText, styles.cellTotal]}>{fmtMoney(row.total)}</Text>
                    </>
                  ) : null}
                </View>
              ))}
            </View>
            {includePrices ? (
              <View style={styles.totalsBlock}>
                <View style={styles.totalsTable}>
                  <View style={styles.totalsRowFinal}>
                    <Text style={styles.totalsLabelFinal}>TOTAAL ALT (incl. BTW)</Text>
                    <Text style={styles.totalsValueFinal}>{fmtMoney(altTotalInclBtw)}</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            Deze offerte is alleen gebaseerd op materiaal, exclusief arbeidskosten.
          </Text>
          {includePrices ? (
            <Text style={[styles.disclaimerText, { marginTop: 4 }]}>
              Prijs gebaseerd op laatste adviesprijs. Prijzen zijn indicatief.
            </Text>
          ) : (
            <Text style={[styles.disclaimerText, { marginTop: 4 }]}>
              Materiaaladvies op basis van jouw gevelmaten. Vraag je leverancier voor de definitieve prijs en levertijd.
            </Text>
          )}
        </View>

        <View style={styles.qrBlock}>
          <Image src={props.qrSrc} style={styles.qrImage} />
          <View style={styles.qrCopy}>
            <Text style={styles.qrTitle}>SCAN VOOR LIVE OFFERTE</Text>
            <Text style={styles.qrSubtitle}>
              Open de digitale versie met foto en gevelrender.
              {includePrices ? " Prijzen zijn indicatief." : ""}
            </Text>
            <Text style={styles.qrUrl}>{offerteUrl}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerWordmark}>Renisual</Text>
          <Text style={styles.footerText}>
            Render, reken, renoveer. — opgesteld via Renisual.com
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
