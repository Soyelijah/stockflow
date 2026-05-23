import { Router } from "express";
import PDFDocument from "pdfkit";
import { z } from "zod";

export const shrinkageRouter = Router();

// Zod schema for input validation and CPU amplification mitigation
const ShrinkagePDFSchema = z.object({
  title: z.string().max(150).optional(),
  responsible: z.string().max(100).optional(),
  comments: z.string().max(1000).optional(),
  items: z.array(
    z.object({
      name: z.string().min(1).max(200),
      stockActual: z.union([z.number(), z.string()]).transform((val) => Number(val)).optional(),
      theoStock: z.union([z.number(), z.string()]).transform((val) => Number(val)).optional(),
      stockFisico: z.union([z.number(), z.string()]).transform((val) => Number(val)).optional(),
      realStock: z.union([z.number(), z.string()]).transform((val) => Number(val)).optional(),
      motive: z.string().max(200).optional(),
      comments: z.string().max(200).optional()
    })
  ).max(200) // Mitigation for Finding-004 CPU amplification: limit items to 200
});

// Secure PDF generation for physical stock audits and shrinkage reporting
shrinkageRouter.post("/shrinkage/pdf", (req, res) => {
  try {
    const parsed = ShrinkagePDFSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.format() });
    }

    const { 
      title = "Reporte de Mermas y Ajuste de Inventario", 
      items = [], 
      responsible = "Administrador", 
      comments = "" 
    } = parsed.data;
    
    // Set response headers for direct secure PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=reporte_auditoria_${Date.now()}.pdf`);
    
    // Initialize PDF Document
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    
    // Pipe straight into the Express response stream
    doc.pipe(res);
    
    // Branding Header
    doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(22).text("STOCKFLOW", { align: "left" });
    doc.fillColor("#64748b").font("Helvetica").fontSize(10).text("Plataforma de Control de Inventario & Logística", { align: "left" });
    doc.moveDown(1);
    
    // Title of Report
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(16).text(title);
    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).strokeColor("#cbd5e1").stroke();
    doc.moveDown(1);
    
    // Metadata Block
    doc.fillColor("#334155").font("Helvetica-Bold").fontSize(11).text("METADATOS DE CONTROL", { underline: true });
    doc.font("Helvetica").fontSize(10);
    doc.text(`Responsable de Auditoría: `, { continued: true }).font("Helvetica-Bold").text(responsible);
    doc.font("Helvetica").text(`Fecha y Hora de Emisión: `, { continued: true }).font("Helvetica-Bold").text(new Date().toLocaleString("es-CL"));
    doc.font("Helvetica").text(`Total de Artículos Auditados: `, { continued: true }).font("Helvetica-Bold").text(`${items.length}`);
    doc.moveDown(1.5);
    
    // Main Audit table Header
    const yHeader = doc.y;
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10);
    doc.text("Producto / Detalle", 50, yHeader, { width: 170 });
    doc.text("Stock Teórico", 230, yHeader, { width: 80, align: "right" });
    doc.text("Stock Físico", 320, yHeader, { width: 80, align: "right" });
    doc.text("Diferencia", 410, yHeader, { width: 60, align: "right" });
    doc.text("Motivo de Ajuste", 480, yHeader, { width: 70, align: "left" });
    
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1.5).strokeColor("#475569").stroke();
    doc.moveDown(0.8);
    
    // Loop through individual line entries
    doc.font("Helvetica").fontSize(9).fillColor("#334155");
    let positiveDiffs = 0;
    let negativeDiffs = 0;
    
    items.forEach((item: any, i: number) => {
      // Manage page breaks safely
      if (doc.y > 700) {
        doc.addPage({ margin: 50, size: "A4" });
        // Draw recurring header on new pages
        doc.fillColor("#94a3b8").fontSize(8).text("STOCKFLOW - CONTINUACIÓN DE REPORTE", 50, 40);
        doc.moveTo(50, 52).lineTo(545, 52).strokeColor("#e2e8f0").stroke();
        doc.moveDown(2);
      }
      
      const currentY = doc.y;
      const theo = Number(item.stockActual ?? item.theoStock ?? 0);
      const real = Number(item.stockFisico ?? item.realStock ?? 0);
      const diff = real - theo;
      
      if (diff > 0) positiveDiffs += diff;
      else if (diff < 0) negativeDiffs += Math.abs(diff);
      
      const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
      const diffColor = diff === 0 ? "#334155" : diff > 0 ? "#16a34a" : "#dc2626";
      
      doc.font("Helvetica-Bold").fillColor("#0f172a");
      doc.text(item.name || `Artículo #${i+1}`, 50, currentY, { width: 170 });
      
      doc.font("Helvetica").fillColor("#334155");
      doc.text(String(theo), 230, currentY, { width: 80, align: "right" });
      doc.text(String(real), 320, currentY, { width: 80, align: "right" });
      
      doc.font("Helvetica-Bold").fillColor(diffColor);
      doc.text(diffStr, 410, currentY, { width: 60, align: "right" });
      
      doc.font("Helvetica").fillColor("#475569");
      doc.text(item.motive || item.comments || "Sin especificar", 480, currentY, { width: 70, align: "left" });
      
      doc.moveDown(1.2);
    });
    
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).strokeColor("#cbd5e1").stroke();
    doc.moveDown(0.8);
    
    // Wrap up statistics
    doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(10).text("RESUMEN DE AJUSTES:");
    doc.font("Helvetica").fontSize(9);
    doc.text(`Ajustes Positivos (Sobrantes): `, { continued: true }).fillColor("#16a34a").font("Helvetica-Bold").text(`+${positiveDiffs} unidades`);
    doc.fillColor("#334155").font("Helvetica").text(`Ajustes Negativos (Mermas/Faltantes): `, { continued: true }).fillColor("#dc2626").font("Helvetica-Bold").text(`-${negativeDiffs} unidades`);
    doc.moveDown(1);
    
    // Comments block if any
    if (comments && comments.trim().length > 0) {
      doc.fillColor("#334155").font("Helvetica-Bold").fontSize(10).text("COMENTARIOS Y OBSERVACIONES:");
      doc.font("Helvetica").fontSize(9).text(comments);
      doc.moveDown(1.5);
    }
    
    // Signatures block
    doc.moveDown(3);
    const sigY = doc.y;
    doc.moveTo(50, sigY).lineTo(200, sigY).strokeColor("#94a3b8").stroke();
    doc.moveTo(350, sigY).lineTo(500, sigY).strokeColor("#94a3b8").stroke();
    
    doc.font("Helvetica").fontSize(8).fillColor("#64748b");
    doc.text("Firma Responsable Auditoría", 50, sigY + 5, { width: 150, align: "center" });
    doc.text("Firma de Aprobación Corporativa", 350, sigY + 5, { width: 150, align: "center" });
    
    // Done with stream write
    doc.end();
  } catch (err: any) {
    console.error("Secure PDF generation error:", err);
    res.status(500).json({ error: "No se pudo generar el documento PDF.", details: err.message });
  }
});

// Mock health check for shrinkage module
export function healthCheck() {
  return {
    status: "online",
    details: {
      engine: "pdfkit",
      supportedFormats: ["pdf"],
      licensed: true
    }
  };
}
