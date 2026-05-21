import { formatCurrency, formatDate } from "./utils";

export interface ReceiptData {
  orderId: string;
  timestamp: any;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  paymentMethod: string;
  customerName?: string;
  businessName: string;
  address?: string;
  phone?: string;
  pointsEarned?: number;
  totalPoints?: number;
}

export const printReceipt = (data: ReceiptData) => {
  const printWindow = window.open('', '_blank', 'width=320,height=650');
  if (!printWindow) {
    alert("Por favor, permite las ventanas emergentes para poder imprimir.");
    return;
  }

  const itemsHtml = data.items.map(item => `
    <tr class="item-row">
      <td class="item-cell">
        <div class="item-name">${item.name}</div>
        <div class="item-details">${item.quantity} UN x ${formatCurrency(item.price)}</div>
      </td>
      <td class="amount-cell">${formatCurrency(item.quantity * item.price)}</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        <title>Ticket - ${data.orderId}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');
          
          @page { 
            margin: 0; 
          }
          
          body { 
            font-family: 'Inter', sans-serif;
            font-size: 10px; 
            width: 58mm; 
            margin: 0; 
            padding: 10px 8px;
            color: #111827;
            line-height: 1.45;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .header { 
            text-align: center; 
            margin-bottom: 12px; 
          }
          
          .business-name { 
            font-weight: 800; 
            font-size: 13px; 
            text-transform: uppercase; 
            letter-spacing: 0.5px; 
            color: #111827;
            margin-bottom: 3px; 
          }
          
          .sub-header { 
            font-size: 8.5px; 
            color: #4b5563; 
            font-weight: 500; 
            line-height: 1.3;
          }

          .order-badge {
            margin-top: 8px;
            padding: 4px;
            background-color: #f3f4f6;
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            font-size: 9px;
            display: inline-block;
            letter-spacing: 0.5px;
          }
          
          .divider { 
            border-top: 1px dashed #d1d5db; 
            margin: 10px 0; 
          }
          
          .section-title { 
            font-weight: 800; 
            font-size: 8.5px; 
            text-transform: uppercase; 
            letter-spacing: 0.8px; 
            color: #6b7280; 
            margin-bottom: 6px; 
          }
          
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 6px 0; 
          }
          
          .item-row {
            border-bottom: 1px solid #f3f4f6;
          }
          
          .item-row:last-child {
            border-bottom: none;
          }
          
          .item-cell { 
            padding: 6px 0; 
            vertical-align: top; 
          }
          
          .amount-cell {
            padding: 6px 0;
            vertical-align: top;
            text-align: right;
            font-weight: 600;
            font-size: 10px;
            white-space: nowrap;
          }
          
          .item-name { 
            font-weight: 600; 
            font-size: 10px; 
            color: #111827;
          }
          
          .item-details { 
            font-size: 8.5px; 
            color: #6b7280; 
            font-weight: 500; 
            margin-top: 1px;
          }
          
          .totals-table td { 
            padding: 3px 0; 
            font-size: 9.5px;
          }
          
          .totals-table .label {
            color: #4b5563;
            font-weight: 500;
          }
          
          .totals-table .val {
            text-align: right;
            font-weight: 600;
            color: #111827;
          }
          
          .total-row { 
            font-weight: 800; 
            border-top: 1.5px solid #111827;
          }
          
          .total-row td {
            padding: 8px 0 2px 0 !important;
          }
          
          .total-row .grand-label {
            font-size: 11px;
            font-weight: 800;
            color: #111827;
          }
          
          .total-row .grand-val {
            font-size: 12px;
            font-weight: 800;
            text-align: right;
            color: #111827;
            font-family: 'JetBrains Mono', monospace;
          }
          
          .payment-info { 
            font-size: 9px; 
            background: #f9fafb; 
            border: 1px solid #f3f4f6;
            border-radius: 8px; 
            padding: 8px 10px; 
            margin-top: 12px; 
          }
          
          .info-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          
          .info-line:last-child {
            margin-bottom: 0;
          }
          
          .info-label {
            color: #6b7280;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 8px;
            letter-spacing: 0.3px;
          }
          
          .info-val {
            font-weight: 700;
            color: #111827;
          }

          .loyalty-section {
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px dashed #e5e7eb;
          }
          
          .loyalty-line {
            display: flex;
            justify-content: space-between;
            font-size: 8.5px;
            margin-bottom: 2px;
          }

          .loyalty-line:last-child {
            margin-bottom: 0;
          }

          .loyalty-label {
            color: #6b7280;
            font-weight: 500;
          }

          .loyalty-val {
            font-weight: 700;
            color: #111827;
          }

          .loyalty-total {
            color: #4f46e5;
            font-weight: 800;
          }
          
          .footer { 
            text-align: center; 
            margin-top: 20px; 
            font-size: 8.5px; 
            color: #6b7280; 
            font-weight: 500; 
            line-height: 1.4;
          }
          
          .footer-bold {
            font-weight: 700;
            color: #374151;
            margin-bottom: 2px;
          }
          
          @media print {
            body { 
              width: 58mm; 
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="business-name">${data.businessName}</div>
          <div class="sub-header">
            ${data.address ? `<div>${data.address}</div>` : ''}
            ${data.phone ? `<div>TEL: ${data.phone}</div>` : ''}
          </div>
          <div class="order-badge">ORDEN #${data.orderId.toUpperCase()}</div>
          <div class="sub-header" style="margin-top: 4px;">${formatDate(data.timestamp)}</div>
        </div>

        <div class="divider"></div>

        <div class="section-title">Detalle de Compra</div>
        <table>
          ${itemsHtml}
        </table>

        <div class="divider"></div>
        
        <table class="totals-table">
          <tr>
            <td class="label">Cantidad de items</td>
            <td class="val">${data.items.reduce((acc, i) => acc + i.quantity, 0)} UDS</td>
          </tr>
          <tr>
            <td class="label">Neto</td>
            <td class="val">${formatCurrency(data.total / 1.19)}</td>
          </tr>
          <tr>
            <td class="label">IVA (19%)</td>
            <td class="val">${formatCurrency(data.total - (data.total / 1.19))}</td>
          </tr>
          <tr class="total-row">
            <td class="grand-label">TOTAL-PAGADO</td>
            <td class="grand-val">${formatCurrency(data.total)}</td>
          </tr>
        </table>

        <div class="payment-info">
          <div class="info-line">
            <span class="info-label">Método de Pago</span>
            <span class="info-val">${data.paymentMethod.toUpperCase() || 'EFECTIVO'}</span>
          </div>
          ${data.customerName ? `
          <div class="info-line">
            <span class="info-label">Cliente</span>
            <span class="info-val">${data.customerName}</span>
          </div>
          ` : ''}
          
          ${data.pointsEarned ? `
            <div class="loyalty-section">
              <div class="loyalty-line">
                <span class="loyalty-label">Puntos ganados esta compra</span>
                <span class="loyalty-val">+${data.pointsEarned}</span>
              </div>
              ${data.totalPoints ? `
              <div class="loyalty-line">
                <span class="loyalty-label">Puntos acumulados totales</span>
                <span class="loyalty-total">${data.totalPoints} PTS</span>
              </div>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <div class="footer">
          <div class="footer-bold">¡Gracias por su compra!</div>
          <div>Documento no válido como factura</div>
        </div>

        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          }
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
