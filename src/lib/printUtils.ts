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
}

export const printReceipt = (data: ReceiptData) => {
  const printWindow = window.open('', '_blank', 'width=300,height=600');
  if (!printWindow) {
    alert("Por favor, permite las ventanas emergentes para poder imprimir.");
    return;
  }

  const itemsHtml = data.items.map(item => `
    <tr class="item-row">
      <td>
        <span class="item-name">${item.name}</span>
        <span class="item-details">${item.quantity} UN x ${formatCurrency(item.price)}</span>
      </td>
      <td class="amount">${formatCurrency(item.quantity * item.price)}</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        <title>Ticket - ${data.orderId}</title>
        <style>
          @page { margin: 0; }
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 11px; 
            width: 58mm; 
            margin: 0; 
            padding: 15px 10px;
            color: #1a1a1a;
            line-height: 1.4;
          }
          .header { text-align: center; margin-bottom: 15px; }
          .business-name { font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
          .sub-header { font-size: 9px; color: #666; font-weight: 500; }
          .divider { border-top: 1px dashed #ccc; margin: 12px 0; }
          .section-title { font-weight: 800; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          .item-row td { padding: 4px 0; vertical-align: top; }
          .item-name { font-weight: 700; font-size: 10px; display: block; }
          .item-details { font-size: 9px; color: #666; font-weight: 500; }
          .amount { font-weight: 700; text-align: right; }
          .totals-table td { padding: 2px 0; }
          .total-row { font-weight: 800; font-size: 13px; border-top: 1px solid #eee; }
          .payment-info { font-size: 9px; background: #f9f9f9; padding: 8px; rounded: 4px; margin-top: 10px; }
          .footer { text-align: center; margin-top: 25px; font-size: 9px; color: #888; font-weight: 500; }
          @media print {
            body { width: 58mm; }
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
          <div class="divider"></div>
          <div style="font-weight: 800; font-size: 10px;">ORDEN #${data.orderId.slice(0, 8).toUpperCase()}</div>
          <div class="sub-header">${formatDate(data.timestamp)}</div>
        </div>

        <div class="section-title">Detalle de Compra</div>
        <table>
          ${itemsHtml}
        </table>

        <div class="divider"></div>
        
        <table class="totals-table">
          <tr>
            <td class="item-details">Neto</td>
            <td class="amount">${formatCurrency(data.total / 1.19)}</td>
          </tr>
          <tr>
            <td class="item-details">IVA (19%)</td>
            <td class="amount">${formatCurrency(data.total - (data.total / 1.19))}</td>
          </tr>
          <tr class="total-row">
            <td style="padding-top: 8px;">TOTAL</td>
            <td class="amount" style="padding-top: 8px;">${formatCurrency(data.total)}</td>
          </tr>
        </table>

        <div class="payment-info">
          <div><strong>MÉTODO DE PAGO:</strong> ${data.paymentMethod.toUpperCase() || 'EFECTIVO'}</div>
          ${data.customerName ? `<div style="margin-top: 4px;"><strong>CLIENTE:</strong> ${data.customerName}</div>` : ''}
        </div>

        <div class="footer">
          ¡Gracias por su compra!<br/>
          Documento no válido como factura
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
