import { Router } from "express";
import PDFDocument from "pdfkit";
import { requireAuthBearer, ShrinkagePdfSchema, AuthenticatedRequest } from "../services/security";

export const shrinkageRouter = Router();

// Secure PDF generation for physical stock audits and shrinkage reporting (completely bilingual & validated)
shrinkageRouter.post("/shrinkage/pdf", requireAuthBearer as any, (req: AuthenticatedRequest, res) => {
  try {
    // Validate schema with Zod
    const parsed = ShrinkagePdfSchema.parse(req.body);
    const { 
      items = [], 
      responsible = "Administrador", 
      comments = "",
      isHistorical = false,
      lang = "es"
    } = parsed;

    const isEn = lang === "en";
    
    // Choose document title depending on language
    const defaultTitle = isEn 
      ? "Shrinkage and Inventory Adjustment Report" 
      : "Reporte de Mermas y Ajuste de Inventario";
    
    const title = parsed.title || defaultTitle;
    
    // Set response headers for direct secure PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=reporte_auditoria_${Date.now()}.pdf`);
    
    if (isHistorical) {
      // Direct cache-control header optimization for finalized historic audits that never mutate
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    }
    
    // Initialize PDF Document
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    
    // Pipe straight into the Express response stream
    doc.pipe(res);
    
    // Branding Header
    doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(22).text("STOCKFLOW", { align: "left" });
    doc.fillColor("#64748b").font("Helvetica").fontSize(10).text(
      isEn ? "Inventory Control & Logistics Platform" : "Plataforma de Control de Inventario & Logística", 
      { align: "left" }
    );
    doc.moveDown(1);
    
    // Title of Report
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(16).text(title);
    doc.moveDown(0.2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).strokeColor("#cbd5e1").stroke();
    doc.moveDown(1);
    
    // Metadata Block
    doc.fillColor("#334155").font("Helvetica-Bold").fontSize(11).text(
      isEn ? "CONTROL METADATA" : "METADATOS DE CONTROL", 
      { underline: true }
    );
    doc.font("Helvetica").fontSize(10);
    
    doc.text(isEn ? "Audit Supervisor: " : "Responsable de Auditoría: ", { continued: true })
       .font("Helvetica-Bold").text(responsible);
       
    doc.font("Helvetica").text(isEn ? "Date & Time of Issue: " : "Fecha y Hora de Emisión: ", { continued: true })
       .font("Helvetica-Bold").text(new Date().toLocaleString(isEn ? "en-US" : "es-CL"));
       
    doc.font("Helvetica").text(isEn ? "Total Audited Items: " : "Total de Artículos Auditados: ", { continued: true })
       .font("Helvetica-Bold").text(`${items.length}`);
    doc.moveDown(1.5);
    
    // Main Audit table Header
    const yHeader = doc.y;
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10);
    
    doc.text(isEn ? "Product / Description" : "Producto / Detalle", 50, yHeader, { width: 170 });
    doc.text(isEn ? "System Stock" : "Stock Teórico", 230, yHeader, { width: 80, align: "right" });
    doc.text(isEn ? "Physical Stock" : "Stock Físico", 320, yHeader, { width: 80, align: "right" });
    doc.text(isEn ? "Difference" : "Diferencia", 410, yHeader, { width: 60, align: "right" });
    doc.text(isEn ? "Adjustment Motive" : "Motivo de Ajuste", 480, yHeader, { width: 70, align: "left" });
    
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
        doc.fillColor("#94a3b8").fontSize(8).text(
          isEn ? "STOCKFLOW - REPORT CONTINUATION" : "STOCKFLOW - CONTINUACIÓN DE REPORTE", 
          50, 40
        );
        doc.moveTo(50, 52).lineTo(545, 52).strokeColor("#e2e8f0").stroke();
        doc.moveDown(2);
      }
      
      const currentY = doc.y;
      const theo = Number(item.stockActual ?? 0);
      const real = Number(item.stockFisico ?? 0);
      const diff = real - theo;
      
      if (diff > 0) positiveDiffs += diff;
      else if (diff < 0) negativeDiffs += Math.abs(diff);
      
      const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
      const diffColor = diff === 0 ? "#334155" : diff > 0 ? "#16a34a" : "#dc2626";
      
      doc.font("Helvetica-Bold").fillColor("#0f172a");
      doc.text(item.name || (isEn ? `Item #${i+1}` : `Artículo #${i+1}`), 50, currentY, { width: 170 });
      
      doc.font("Helvetica").fillColor("#334155");
      doc.text(String(theo), 230, currentY, { width: 80, align: "right" });
      doc.text(String(real), 320, currentY, { width: 80, align: "right" });
      
      doc.font("Helvetica-Bold").fillColor(diffColor);
      doc.text(diffStr, 410, currentY, { width: 60, align: "right" });
      
      doc.font("Helvetica").fillColor("#475569");
      doc.text(item.motive || (isEn ? "Not specified" : "Sin especificar"), 480, currentY, { width: 70, align: "left" });
      
      doc.moveDown(1.2);
    });
    
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).strokeColor("#cbd5e1").stroke();
    doc.moveDown(0.8);
    
    // Wrap up statistics
    doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(10).text(
      isEn ? "ADJUSTMENT SUMMARY:" : "RESUMEN DE AJUSTES:"
    );
    doc.font("Helvetica").fontSize(9);
    
    doc.text(isEn ? "Positive Adjustments (Surplus): " : "Ajustes Positivos (Sobrantes): ", { continued: true })
       .fillColor("#16a34a").font("Helvetica-Bold").text(`+${positiveDiffs} ${isEn ? "units" : "unidades"}`);
       
    doc.fillColor("#334155").font("Helvetica")
       .text(isEn ? "Negative Adjustments (Shrinkage/Missing): " : "Ajustes Negativos (Mermas/Faltantes): ", { continued: true })
       .fillColor("#dc2626").font("Helvetica-Bold").text(`-${negativeDiffs} ${isEn ? "units" : "unidades"}`);
    doc.moveDown(1);
    
    // Comments block if any
    if (comments && comments.trim().length > 0) {
      doc.fillColor("#334155").font("Helvetica-Bold").fontSize(10).text(
        isEn ? "COMMENTS AND OBSERVATIONS:" : "COMENTARIOS Y OBSERVACIONES:"
      );
      doc.font("Helvetica").fontSize(9).text(comments);
      doc.moveDown(1.5);
    }
    
    // Signatures block
    doc.moveDown(3);
    const sigY = doc.y;
    doc.moveTo(50, sigY).lineTo(200, sigY).strokeColor("#94a3b8").stroke();
    doc.moveTo(350, sigY).lineTo(500, sigY).strokeColor("#94a3b8").stroke();
    
    doc.font("Helvetica").fontSize(8).fillColor("#64748b");
    doc.text(
      isEn ? "Audit Supervisor Signature" : "Firma Responsable Auditoría", 
      50, sigY + 5, { width: 150, align: "center" }
    );
    doc.text(
      isEn ? "Corporate Approval Signature" : "Firma de Aprobación Corporativa", 
      350, sigY + 5, { width: 150, align: "center" }
    );
    
    // Done with stream write
    doc.end();
  } catch (err: any) {
    console.error("Secure PDF generation error:", err);
    if (err.name === "ZodError") {
      res.status(400).json({ error: "Estructura de reporte de auditoría no válida", details: err.errors });
    } else {
      res.status(500).json({ error: "No se pudo generar el documento PDF.", details: err.message });
    }
  }
});

// Module health diagnostics
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
