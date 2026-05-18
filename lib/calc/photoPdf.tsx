// Foto + maten PDF. Per A4-pagina 2 zijden (boven/onder split). Per zijde
// landscape-foto + B×H + openings-lijst. Geen prijzen, geen materiaal-BOM
// — dat zit in lib/calc/pdf.tsx. Bedoeld als visuele meet-fiche voor
// installateur of leverancier.

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

export type CalcPhotoPdfOpening = {
  type: "window" | "door" | "other";
  label: string;
  widthCm: number;
  heightCm: number;
  count: number;
};

export type CalcPhotoPdfSide = {
  name: string;
  widthCm: number;
  heightCm: number;
  photoDataUrl?: string;
  openings: CalcPhotoPdfOpening[];
};

export type CalcPhotoPdfDocumentProps = {
  generatedAt: Date;
  projectName?: string;
  sides: CalcPhotoPdfSide[];
};

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1a1a1a",
  },
  header: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 8, color: "#666", marginBottom: 10 },
  block: {
    height: 360, // ≈ helft van A4 minus paddings + header
    borderBottom: "0.5pt solid #888",
    paddingBottom: 8,
    marginBottom: 8,
  },
  blockLast: {
    height: 360,
    paddingBottom: 8,
  },
  blockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  blockTitle: { fontSize: 12, fontWeight: 700 },
  blockSize: { fontSize: 10, color: "#444" },
  inner: { flexDirection: "row", gap: 12 },
  photoBox: {
    width: 320,
    height: 220,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%", objectFit: "contain" },
  placeholder: {
    width: 320,
    height: 220,
    border: "0.5pt dashed #888",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: { fontSize: 9, color: "#888" },
  tableTitle: { fontSize: 9, fontWeight: 700, marginBottom: 4 },
  trow: { flexDirection: "row", paddingVertical: 2 },
  thead: {
    flexDirection: "row",
    fontSize: 8,
    fontWeight: 700,
    color: "#444",
    borderBottom: "0.5pt solid #888",
    paddingVertical: 2,
  },
  tcellType: { flex: 1 },
  tcellLabel: { flex: 2 },
  tcellSize: { flex: 1.4, textAlign: "right" },
  tcellCount: { flex: 0.6, textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 12,
    left: 24,
    right: 24,
    fontSize: 7,
    color: "#888",
    textAlign: "center",
  },
});

function openingLabel(t: "window" | "door" | "other"): string {
  if (t === "door") return "Deur";
  if (t === "window") return "Kozijn";
  return "Anders";
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function SideBlock({
  side,
  index,
  isLast,
}: {
  side: CalcPhotoPdfSide;
  index: number;
  isLast: boolean;
}) {
  return (
    <View style={isLast ? styles.blockLast : styles.block}>
      <View style={styles.blockHeader}>
        <Text style={styles.blockTitle}>
          {side.name || `Zijde ${index + 1}`}
        </Text>
        <Text style={styles.blockSize}>
          {side.widthCm} × {side.heightCm} cm
        </Text>
      </View>
      <View style={styles.inner}>
        {side.photoDataUrl ? (
          <View style={styles.photoBox}>
            <Image src={side.photoDataUrl} style={styles.photo} />
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Geen foto</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.tableTitle}>Openingen</Text>
          {side.openings.length === 0 ? (
            <Text style={{ fontSize: 9, color: "#888" }}>
              Geen openingen geregistreerd.
            </Text>
          ) : (
            <>
              <View style={styles.thead}>
                <Text style={styles.tcellType}>Type</Text>
                <Text style={styles.tcellLabel}>Label</Text>
                <Text style={styles.tcellSize}>B × H (cm)</Text>
                <Text style={styles.tcellCount}>#</Text>
              </View>
              {side.openings.map((o, i) => (
                <View style={styles.trow} key={i}>
                  <Text style={styles.tcellType}>{openingLabel(o.type)}</Text>
                  <Text style={styles.tcellLabel}>{o.label || "—"}</Text>
                  <Text style={styles.tcellSize}>
                    {o.widthCm} × {o.heightCm}
                  </Text>
                  <Text style={styles.tcellCount}>{o.count}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export function CalcPhotoPdfDocument(props: CalcPhotoPdfDocumentProps) {
  const dateStr = formatDate(props.generatedAt);
  // Chunk sides per pair voor 2-per-pagina layout.
  const pages: CalcPhotoPdfSide[][] = [];
  for (let i = 0; i < props.sides.length; i += 2) {
    pages.push(props.sides.slice(i, i + 2));
  }
  if (pages.length === 0) pages.push([]);

  return (
    <Document>
      {pages.map((pair, pageIdx) => (
        <Page key={pageIdx} size="A4" style={styles.page}>
          <Text style={styles.header}>Gevelmaten + foto&apos;s</Text>
          <Text style={styles.meta}>
            {props.projectName ? `${props.projectName} — ` : ""}
            {dateStr} — pagina {pageIdx + 1} van {pages.length}
          </Text>
          {pair.length === 0 && (
            <Text style={{ fontSize: 10, color: "#888" }}>
              Geen zijdes ingevuld.
            </Text>
          )}
          {pair.map((side, j) => (
            <SideBlock
              key={j}
              side={side}
              index={pageIdx * 2 + j}
              isLast={j === pair.length - 1}
            />
          ))}
          <Text style={styles.footer}>
            Renisual — foto+maten export ({dateStr})
          </Text>
        </Page>
      ))}
    </Document>
  );
}

export async function buildCalcPhotoPdf(
  props: CalcPhotoPdfDocumentProps,
): Promise<Buffer> {
  return await renderToBuffer(<CalcPhotoPdfDocument {...props} />);
}
