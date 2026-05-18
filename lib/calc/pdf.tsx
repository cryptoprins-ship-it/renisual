// Lightweight client config PDF — toont sides, openings en materiaal-bom
// zonder klant-gegevens, prijzen of QR. Bedoeld als download voor de
// installateur om de gevelmeting + materiaal-stuklijst mee te nemen.
//
// Geen prijzen, geen BTW, geen lead-formulier vereist. Voor de volledige
// offerte met prijzen + branding zie lib/offerte/pdf.tsx.

import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ProfileCalculation } from "@/lib/calcEngine";

export type CalcPdfSide = {
  name: string;
  widthCm: number;
  heightCm: number;
  grossM2: number;
  netM2: number;
  openings: Array<{
    type: "window" | "door" | "other";
    label: string;
    widthCm: number;
    heightCm: number;
    count: number;
  }>;
};

export type CalcPdfVariant = {
  orientationLabel: string;
  netWithWaste: number;
  panelCount: number;
  profileItems: ProfileCalculation[];
};

export type CalcPdfDocumentProps = {
  generatedAt: Date;
  projectName?: string;
  productLabel?: string;
  // Primary (selected) orientation result — always present.
  orientationLabel: string;
  totals: { gross: number; openings: number; net: number };
  netWithWaste: number;
  wasteFactor: number;
  panelCount: number;
  insideCornerCount?: number;
  profileItems: ProfileCalculation[];
  sides: CalcPdfSide[];
  // Optional second orientation result — alleen aanwezig als product
  // beide orientaties ondersteunt. Wordt apart gerenderd in een
  // vergelijkings-blok onder de primaire materiaal-BOM.
  alternate?: CalcPdfVariant;
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
  },
  h1: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: "#666", marginBottom: 16 },
  h2: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
    borderBottom: "1pt solid #1a1a1a",
    paddingBottom: 2,
  },
  row: { flexDirection: "row" },
  cellLabel: { flex: 2, paddingVertical: 2 },
  cellVal: { flex: 1, paddingVertical: 2, textAlign: "right" },
  thead: { fontWeight: 700, fontSize: 9, borderBottom: "0.5pt solid #888" },
  sub: { fontSize: 8, color: "#888", marginLeft: 8 },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#888",
    textAlign: "center",
  },
});

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function openingLabel(type: "window" | "door" | "other"): string {
  if (type === "door") return "Deur";
  if (type === "window") return "Kozijn";
  return "Opening";
}

export function CalcPdfDocument(props: CalcPdfDocumentProps) {
  const dateStr = formatDate(props.generatedAt);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Gevelconfiguratie</Text>
        <Text style={styles.meta}>
          {props.projectName ? `${props.projectName} — ` : ""}
          {dateStr}
        </Text>

        <Text style={styles.h2}>Algemeen</Text>
        <View style={styles.row}>
          <Text style={styles.cellLabel}>Product</Text>
          <Text style={styles.cellVal}>{props.productLabel ?? "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellLabel}>Orientatie</Text>
          <Text style={styles.cellVal}>{props.orientationLabel}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellLabel}>Bruto m²</Text>
          <Text style={styles.cellVal}>{props.totals.gross.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellLabel}>Openingen m²</Text>
          <Text style={styles.cellVal}>{props.totals.openings.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellLabel}>Netto m²</Text>
          <Text style={styles.cellVal}>{props.totals.net.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cellLabel}>
            Netto incl. snijverlies ({props.wasteFactor}%)
          </Text>
          <Text style={styles.cellVal}>{props.netWithWaste.toFixed(2)}</Text>
        </View>
        {props.insideCornerCount !== undefined && props.insideCornerCount > 0 && (
          <View style={styles.row}>
            <Text style={styles.cellLabel}>Binnenhoeken</Text>
            <Text style={styles.cellVal}>{props.insideCornerCount}</Text>
          </View>
        )}

        <Text style={styles.h2}>Zijden</Text>
        <View style={[styles.row, styles.thead]}>
          <Text style={styles.cellLabel}>Naam</Text>
          <Text style={styles.cellVal}>B × H (cm)</Text>
          <Text style={styles.cellVal}>Bruto m²</Text>
          <Text style={styles.cellVal}>Netto m²</Text>
        </View>
        {props.sides.map((s, i) => (
          <View key={i}>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>{s.name || `Zijde ${i + 1}`}</Text>
              <Text style={styles.cellVal}>
                {s.widthCm} × {s.heightCm}
              </Text>
              <Text style={styles.cellVal}>{s.grossM2.toFixed(2)}</Text>
              <Text style={styles.cellVal}>{s.netM2.toFixed(2)}</Text>
            </View>
            {s.openings.map((o, j) => (
              <Text key={j} style={styles.sub}>
                • {openingLabel(o.type)} {o.label ? `(${o.label}) ` : ""}
                {o.count}× {o.widthCm} × {o.heightCm} cm
              </Text>
            ))}
          </View>
        ))}

        <Text style={styles.h2}>Materiaal — {props.orientationLabel}</Text>
        <View style={styles.row}>
          <Text style={styles.cellLabel}>Panelen</Text>
          <Text style={styles.cellVal}>{props.panelCount}</Text>
        </View>
        {props.profileItems.map((p, i) => (
          <View style={styles.row} key={i}>
            <Text style={styles.cellLabel}>
              {p.label} — {p.name}
              <Text style={{ color: "#888" }}>
                {" "}
                ({p.lengthMeters.toFixed(2)}m sticks)
              </Text>
            </Text>
            <Text style={styles.cellVal}>
              {p.count} st — {p.neededMeters.toFixed(2)}m nodig
            </Text>
          </View>
        ))}

        {props.alternate && (
          <>
            <Text style={styles.h2}>
              Materiaal — {props.alternate.orientationLabel} (alternatief)
            </Text>
            <View style={styles.row}>
              <Text style={styles.cellLabel}>Panelen</Text>
              <Text style={styles.cellVal}>{props.alternate.panelCount}</Text>
            </View>
            {props.alternate.profileItems.map((p, i) => (
              <View style={styles.row} key={i}>
                <Text style={styles.cellLabel}>
                  {p.label} — {p.name}
                  <Text style={{ color: "#888" }}>
                    {" "}
                    ({p.lengthMeters.toFixed(2)}m sticks)
                  </Text>
                </Text>
                <Text style={styles.cellVal}>
                  {p.count} st — {p.neededMeters.toFixed(2)}m nodig
                </Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer}>
          Renisual — gevelconfiguratie export ({dateStr})
        </Text>
      </Page>
    </Document>
  );
}

export async function buildCalcPdf(props: CalcPdfDocumentProps): Promise<Buffer> {
  // Helvetica is built-in zodat we geen extra font hoeven te bundelen.
  Font.registerHyphenationCallback((word) => [word]);
  return await renderToBuffer(<CalcPdfDocument {...props} />);
}
