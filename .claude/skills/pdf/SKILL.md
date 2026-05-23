# PDF Skill - Professional PDF Generation and Processing

## Overview

This skill provides comprehensive PDF creation and processing capabilities using `reportlab` for generation, `pdfplumber` for extraction, and related libraries for manipulation and compliance. Enterprise-grade solutions for reports, invoices, certificates, and digital signatures.

## Core Capabilities

### 1. PDF Generation with ReportLab

#### Basic Document Creation
```python
from reportlab.lib.pagesizes import letter, A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor

# Create PDF canvas
pdf_file = "simple_document.pdf"
c = canvas.Canvas(pdf_file, pagesize=letter)
width, height = letter

# Add text
c.setFont("Helvetica-Bold", 24)
c.drawString(1*inch, height - 1*inch, "Document Title")

# Add body text with word wrapping
c.setFont("Helvetica", 12)
y_position = height - 1.5*inch
text_lines = [
    "This is the first line of body text.",
    "This is the second line of body text.",
]
for line in text_lines:
    c.drawString(1*inch, y_position, line)
    y_position -= 0.3*inch

# Save PDF
c.save()
print(f"PDF created: {pdf_file}")
```

#### Advanced Styling
```python
from reportlab.lib.colors import Color, black, blue, red
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# Text with color
c.setFillColor(HexColor("#0052FF"))  # Blue
c.drawString(1*inch, 8*inch, "Colored Text")

# Rectangles and shapes
c.setStrokeColor(blue)
c.setLineWidth(2)
c.rect(0.5*inch, 6*inch, 3*inch, 1*inch)

# Circles and ellipses
c.setFillColor(red)
c.circle(2*inch, 7*inch, 0.25*inch, stroke=1)

# Lines
c.setStrokeColor(black)
c.setLineWidth(1)
c.line(0.5*inch, 5.5*inch, 7.5*inch, 5.5*inch)
```

### 2. Flowable Documents with Platypus

```python
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Create styled document
pdf_file = "structured_document.pdf"
doc = SimpleDocTemplate(
    pdf_file,
    pagesize=letter,
    rightMargin=0.5*inch,
    leftMargin=0.5*inch,
    topMargin=0.75*inch,
    bottomMargin=0.75*inch,
)

# Container for PDF elements
elements = []

# Get base styles
styles = getSampleStyleSheet()

# Create custom style
title_style = ParagraphStyle(
    'CustomTitle',
    parent=styles['Heading1'],
    fontSize=24,
    textColor=HexColor("#0052FF"),
    spaceAfter=30,
    alignment=TA_CENTER,
)

# Add elements to document
elements.append(Paragraph("Professional Report", title_style))
elements.append(Spacer(1, 0.3*inch))

body_text = "This is body text with automatic line wrapping and proper spacing."
elements.append(Paragraph(body_text, styles['BodyText']))
elements.append(Spacer(1, 0.2*inch))

# Build PDF with all elements
doc.build(elements)
```

### 3. Tables in PDF

```python
from reportlab.platypus import Table, TableStyle
from reportlab.lib import colors

# Create table data
data = [
    ['Column 1', 'Column 2', 'Column 3'],
    ['Data 1A', 'Data 1B', 'Data 1C'],
    ['Data 2A', 'Data 2B', 'Data 2C'],
    ['Data 3A', 'Data 3B', 'Data 3C'],
]

# Create table object
table = Table(data, colWidths=[2*inch, 2*inch, 2*inch])

# Apply table styling
table.setStyle(TableStyle([
    # Header row styling
    ('BACKGROUND', (0, 0), (-1, 0), HexColor("#0052FF")),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 14),

    # Data rows styling
    ('BACKGROUND', (0, 1), (-1, -1), HexColor("#F5F5F5")),
    ('TEXTCOLOR', (0, 1), (-1, -1), black),
    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
    ('FONTSIZE', (0, 1), (-1, -1), 11),

    # Grid
    ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HexColor("#F5F5F5")]),

    # Padding
    ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),

    # Borders
    ('LINEABOVE', (0, 0), (-1, 0), 2, HexColor("#0052FF")),
    ('LINEBELOW', (0, 0), (-1, 0), 2, HexColor("#0052FF")),
]))

# Add to document
elements.append(table)
```

### 4. Text Extraction with pdfplumber

```python
import pdfplumber

# Extract text from entire PDF
with pdfplumber.open("document.pdf") as pdf:
    # Extract text from all pages
    full_text = ""
    for page in pdf.pages:
        full_text += page.extract_text()

    print(full_text)

# Extract text from specific page
with pdfplumber.open("document.pdf") as pdf:
    first_page = pdf.pages[0]
    text = first_page.extract_text()
    print(text)

# Extract text with layout preservation
with pdfplumber.open("document.pdf") as pdf:
    page = pdf.pages[0]
    text = page.extract_text(layout=True)
    print(text)
```

### 5. Table Extraction from PDFs

```python
import pdfplumber
import pandas as pd

def extract_tables_from_pdf(pdf_file):
    """Extract all tables from PDF and return as DataFrames"""
    tables_data = []

    with pdfplumber.open(pdf_file) as pdf:
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables()

            if tables:
                for table_idx, table in enumerate(tables):
                    # Convert table to DataFrame
                    df = pd.DataFrame(table[1:], columns=table[0])
                    tables_data.append({
                        'page': page_num + 1,
                        'table_index': table_idx,
                        'data': df
                    })

    return tables_data

# Usage
tables = extract_tables_from_pdf("report.pdf")
for item in tables:
    print(f"Page {item['page']}, Table {item['table_index']}:")
    print(item['data'])
    print()
```

### 6. PDF Merging and Splitting

```python
from PyPDF2 import PdfReader, PdfWriter

def merge_pdfs(pdf_list, output_file):
    """Merge multiple PDFs into one"""
    writer = PdfWriter()

    for pdf_file in pdf_list:
        reader = PdfReader(pdf_file)
        for page in reader.pages:
            writer.add_page(page)

    with open(output_file, 'wb') as output:
        writer.write(output)

    print(f"Merged PDF created: {output_file}")

def split_pdf(pdf_file, output_dir):
    """Split PDF into individual pages"""
    import os

    os.makedirs(output_dir, exist_ok=True)
    reader = PdfReader(pdf_file)

    for idx, page in enumerate(reader.pages):
        writer = PdfWriter()
        writer.add_page(page)

        output_file = os.path.join(output_dir, f"page_{idx+1:03d}.pdf")
        with open(output_file, 'wb') as output:
            writer.write(output)

    print(f"Split {len(reader.pages)} pages to {output_dir}")

def extract_page_range(pdf_file, output_file, start_page, end_page):
    """Extract pages from start_page to end_page (1-indexed)"""
    reader = PdfReader(pdf_file)
    writer = PdfWriter()

    for page_num in range(start_page - 1, end_page):
        writer.add_page(reader.pages[page_num])

    with open(output_file, 'wb') as output:
        writer.write(output)

# Usage
merge_pdfs(['doc1.pdf', 'doc2.pdf', 'doc3.pdf'], 'merged.pdf')
split_pdf('merged.pdf', 'split_pages/')
extract_page_range('document.pdf', 'pages_5-10.pdf', 5, 10)
```

### 7. PDF Form Filling

```python
from PyPDF2 import PdfReader, PdfWriter

def fill_pdf_form(template_pdf, output_pdf, field_values):
    """Fill form fields in PDF template"""
    reader = PdfReader(template_pdf)
    writer = PdfWriter()

    # Update form field values
    writer.append_pages_from_reader(reader)

    if "/AcroForm" in reader.trailer["/Root"]:
        writer.update_page_label(0)

        # Access form fields
        if writer._get_object_from_stream(reader.trailer["/Root"], "/AcroForm"):
            # Fill field values
            for page in writer.pages:
                writer.update_page_label(page)

    # For newer PyPDF2 versions (3.0+):
    reader = PdfReader(template_pdf)
    writer = PdfWriter()
    writer.append_pages_from_reader(reader)

    # Update form fields
    for key, value in field_values.items():
        writer.update_page_label(0)  # Update first page

    with open(output_pdf, 'wb') as output:
        writer.write(output)

# Alternative approach using pdfrw (more reliable for form filling)
def fill_pdf_form_pdfrw(template_pdf, output_pdf, field_values):
    """Fill form fields using pdfrw library"""
    from pdfrw import PdfReader, PdfWriter

    template = PdfReader(template_pdf)

    # Flatten form fields (make them read-only)
    for page in template.pages:
        annotations = page.get("/Annots")
        if annotations is None:
            continue
        for annotation in annotations:
            if annotation["/Subtype"] == "/Widget":
                if annotation["/T"]:
                    field_name = annotation["/T"][1:-1]  # Remove parentheses
                    if field_name in field_values:
                        annotation.update(
                            AP="",
                            AS=f"/{field_values[field_name]}"
                        )
                        annotation["/V"] = f"({field_values[field_name]})"
                        annotation["/DV"] = f"({field_values[field_name]})"

    PdfWriter().write(output_pdf, template)

# Usage
fields = {
    'name': 'John Doe',
    'email': 'john@example.com',
    'date': '2026-04-07'
}
fill_pdf_form_pdfrw('form_template.pdf', 'filled_form.pdf', fields)
```

### 8. Watermarking PDFs

```python
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from io import BytesIO

def add_watermark(input_pdf, output_pdf, watermark_text):
    """Add text watermark to PDF"""

    # Create watermark
    watermark_buffer = BytesIO()
    c = canvas.Canvas(watermark_buffer, pagesize=letter)
    c.setFont("Helvetica", 60)
    c.setFillAlpha(0.3)  # 30% transparency
    c.rotate(45)
    c.drawString(400, 100, watermark_text)
    c.save()

    watermark_buffer.seek(0)
    watermark_pdf = PdfReader(watermark_buffer)
    watermark_page = watermark_pdf.pages[0]

    # Apply watermark to all pages
    reader = PdfReader(input_pdf)
    writer = PdfWriter()

    for page in reader.pages:
        page.merge_page(watermark_page)
        writer.add_page(page)

    with open(output_pdf, 'wb') as output:
        writer.write(output)

    print(f"Watermarked PDF: {output_pdf}")

def add_background_image(input_pdf, output_pdf, background_image):
    """Add image as background to PDF"""
    from reportlab.pdfgen import canvas
    from PIL import Image

    reader = PdfReader(input_pdf)
    writer = PdfWriter()

    for page in reader.pages:
        # Create background with image
        bg_buffer = BytesIO()
        c = canvas.Canvas(bg_buffer, pagesize=letter)
        c.drawImage(background_image, 0, 0, width=8.5*inch, height=11*inch)
        c.save()

        bg_buffer.seek(0)
        bg_pdf = PdfReader(bg_buffer)
        bg_page = bg_pdf.pages[0]

        # Merge
        bg_page.merge_page(page)
        writer.add_page(bg_page)

    with open(output_pdf, 'wb') as output:
        writer.write(output)

# Usage
add_watermark('original.pdf', 'watermarked.pdf', 'CONFIDENTIAL')
add_background_image('document.pdf', 'with_background.pdf', 'company_letterhead.png')
```

### 9. PDF/A Compliance (Archival Format)

```python
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import registerFont
from reportlab.pdfbase.ttfonts import TTFont

def create_pdfa_compliant_document(filename, title, content):
    """Create PDF/A-1b compliant document for long-term archival"""

    # Register fonts (required for PDF/A)
    try:
        registerFont(TTFont('Arial', 'arial.ttf'))
        font_name = 'Arial'
    except:
        font_name = 'Helvetica'  # Fallback

    c = canvas.Canvas(filename, pagesize=letter)
    width, height = letter

    # PDF/A metadata
    c.setTitle(title)
    c.setAuthor("Document Generator")
    c.setSubject("Archival Document")
    c.setKeywords("pdf/a, archival")
    c.setCreator("PDF Generator v1.0")
    c.setProducer("reportlab")

    # Content
    c.setFont(font_name, 24)
    c.drawString(1*inch, height - 1*inch, title)

    c.setFont(font_name, 12)
    y_position = height - 1.5*inch
    for line in content.split('\n'):
        c.drawString(1*inch, y_position, line)
        y_position -= 0.3*inch

    c.save()
    print(f"PDF/A document created: {filename}")

# For full PDF/A-1b compliance, consider using specialized tools:
# - GhostScript: gs -sDEVICE=pdfwrite -dPDFA=1 -o output.pdf input.pdf
# - LibreOffice: libreoffice --headless --convert-to pdf:writer_pdf_Export="{UseTaggedPDF:true}" file.pdf
```

### 10. Digital Signatures

```python
from pyHanko.pdf_cms import simple_cms_sign
from pyHanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyHanko.pdf_utils.reader import PdfFileReader
import datetime

def digitally_sign_pdf(input_pdf, output_pdf, signing_certificate, signing_key):
    """Add digital signature to PDF"""

    # Read the PDF
    with open(input_pdf, 'rb') as pdf_file:
        r = PdfFileReader(pdf_file)
        w = IncrementalPdfFileWriter(pdf_file)

        # Create signature field
        signature_metadata = simple_cms_sign(
            outfile=w,
            appearance_text_params={
                'url': 'https://example.com',
                'date': datetime.datetime.now().isoformat(),
            },
            signing_cert=signing_certificate,
            signing_key=signing_key,
            timestamper=None,  # Add timestamping if needed
        )

    with open(output_pdf, 'wb') as output:
        w.write(output)

    print(f"PDF signed: {output_pdf}")

# For production signing, use digital certificate:
# from pyHanko.pdf_cms.api import select_signing_credential
# credentials = select_signing_credential()
# digitally_sign_pdf('document.pdf', 'signed.pdf', credentials.cert, credentials.key)
```

### 11. Invoice Template

```python
def create_invoice_pdf(invoice_data, output_file):
    """Generate professional invoice PDF"""
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib import colors
    from reportlab.lib.units import inch

    doc = SimpleDocTemplate(output_file, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()

    # Header
    header_data = [
        ['INVOICE', '', f"Invoice #: {invoice_data['invoice_number']}"],
        ['', '', f"Date: {invoice_data['date']}"],
        ['', '', f"Due: {invoice_data['due_date']}"],
    ]
    header_table = Table(header_data, colWidths=[2*inch, 2*inch, 2*inch])
    elements.append(header_table)
    elements.append(Spacer(1, 0.3*inch))

    # From/To
    from_to_data = [
        ['FROM:', 'BILL TO:'],
        [
            f"{invoice_data['from']['name']}\n{invoice_data['from']['address']}\n{invoice_data['from']['phone']}",
            f"{invoice_data['to']['name']}\n{invoice_data['to']['address']}\n{invoice_data['to']['email']}"
        ],
    ]
    from_to_table = Table(from_to_data, colWidths=[3.25*inch, 3.25*inch])
    elements.append(from_to_table)
    elements.append(Spacer(1, 0.3*inch))

    # Line items
    line_items = [['Description', 'Quantity', 'Unit Price', 'Amount']]
    total = 0
    for item in invoice_data['items']:
        amount = item['quantity'] * item['unit_price']
        total += amount
        line_items.append([
            item['description'],
            str(item['quantity']),
            f"${item['unit_price']:.2f}",
            f"${amount:.2f}",
        ])

    # Totals
    line_items.append(['', '', 'Total:', f"${total:.2f}"])

    items_table = Table(line_items, colWidths=[3*inch, 1*inch, 1.5*inch, 1.5*inch])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor("#0052FF")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('BACKGROUND', (0, -1), (-1, -1), HexColor("#E0E0E0")),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ]))

    elements.append(items_table)
    elements.append(Spacer(1, 0.3*inch))

    # Notes
    if invoice_data.get('notes'):
        elements.append(Paragraph(f"<b>Notes:</b> {invoice_data['notes']}", styles['BodyText']))

    doc.build(elements)
    print(f"Invoice created: {output_file}")

# Usage
invoice = {
    'invoice_number': 'INV-001',
    'date': '2026-04-07',
    'due_date': '2026-05-07',
    'from': {
        'name': 'Your Company',
        'address': '123 Main St, City, ST 12345',
        'phone': '(555) 123-4567',
    },
    'to': {
        'name': 'Client Name',
        'address': '456 Oak Ave, City, ST 67890',
        'email': 'client@example.com',
    },
    'items': [
        {'description': 'Consulting Services', 'quantity': 40, 'unit_price': 150},
        {'description': 'Software License', 'quantity': 1, 'unit_price': 5000},
    ],
    'notes': 'Payment due within 30 days. Thank you for your business!',
}

create_invoice_pdf(invoice, 'invoice.pdf')
```

### 12. Accessibility in PDFs

```python
from reportlab.platypus import SimpleDocTemplate, Paragraph, Image
from reportlab.lib.styles import getSampleStyleSheet

def create_accessible_pdf(filename):
    """Create PDF with accessibility features"""
    doc = SimpleDocTemplate(filename)
    elements = []
    styles = getSampleStyleSheet()

    # Add title with semantic meaning
    title = Paragraph("Document Title", styles['Title'])
    elements.append(title)

    # Add image with alt text
    img = Image('diagram.png', width=4*inch, height=3*inch)
    # Note: Direct alt text not fully supported in reportlab
    # Use document structure and headings instead
    elements.append(Paragraph("Figure 1: Process Diagram", styles['Italic']))
    elements.append(img)

    # Use consistent heading hierarchy
    for heading_level in [1, 2, 3]:
        style_name = f'Heading{heading_level}'
        if style_name in [s.name for s in styles.values()]:
            elements.append(Paragraph(f"Section Level {heading_level}", styles[style_name]))
            elements.append(Paragraph("Content for this section...", styles['BodyText']))

    # Use descriptive link text
    doc.build(elements)

    # For full accessibility (PDF/UA), post-process with:
    # - PAC (PDF Accessibility Checker)
    # - Adobe Acrobat Pro
    # - Accessible PDF creation tools

# Accessibility checklist:
# 1. Use semantic PDF structure (Tags)
# 2. Provide alt text for images
# 3. Use proper heading hierarchy
# 4. Include table headers and descriptions
# 5. Use sufficient color contrast
# 6. Ensure readable font sizes (12pt minimum)
# 7. Use descriptive link text
```

## Common Document Templates

### 1. Certificate Template
```python
def create_certificate(name, course, date, output_file):
    """Generate certificate of completion"""
    c = canvas.Canvas(output_file, pagesize=letter)
    width, height = letter

    # Background
    c.setFillColor(HexColor("#F5F5F5"))
    c.rect(0, 0, width, height, fill=1)

    # Border
    c.setStrokeColor(HexColor("#0052FF"))
    c.setLineWidth(3)
    c.rect(0.5*inch, 0.5*inch, width-1*inch, height-1*inch)

    # Title
    c.setFont("Helvetica-Bold", 32)
    c.drawString(2*inch, height - 2*inch, "Certificate of Completion")

    # Body
    c.setFont("Helvetica", 14)
    c.drawString(2*inch, height - 3*inch, "This certifies that")

    c.setFont("Helvetica-Bold", 18)
    c.drawString(2*inch, height - 3.5*inch, name)

    c.setFont("Helvetica", 14)
    c.drawString(2*inch, height - 4.5*inch, f"has successfully completed the {course} course")

    c.drawString(2*inch, height - 5.5*inch, f"Date: {date}")

    c.save()
```

### 2. Report Cover Page
```python
def create_report_cover(title, subtitle, author, date, output_file):
    """Generate professional report cover page"""
    c = canvas.Canvas(output_file, pagesize=letter)
    width, height = letter

    # Gradient-like background with color blocks
    c.setFillColor(HexColor("#0052FF"))
    c.rect(0, height/2, width, height/2, fill=1)

    c.setFillColor(white)
    c.rect(0, 0, width, height/2, fill=1)

    # Title
    c.setFont("Helvetica-Bold", 36)
    c.setFillColor(HexColor("#0052FF"))
    c.drawString(1*inch, height - 2*inch, title)

    # Subtitle
    c.setFont("Helvetica", 18)
    c.drawString(1*inch, height - 3*inch, subtitle)

    # Author and date
    c.setFont("Helvetica", 12)
    c.drawString(1*inch, 2*inch, f"Author: {author}")
    c.drawString(1*inch, 1.5*inch, f"Date: {date}")

    c.save()
```

## Best Practices

1. **Font Selection**: Use only standard fonts (Helvetica, Times, Courier) for universal compatibility
2. **Color Safety**: Always provide sufficient contrast for accessibility
3. **Page Breaks**: Test multi-page documents thoroughly
4. **File Size**: Use image compression for large PDFs
5. **Unicode**: Ensure UTF-8 encoding for international text
6. **Performance**: For large batch operations, process PDFs sequentially
7. **Security**: Use encryption for sensitive documents

## Dependencies

```bash
pip install reportlab pdfplumber PyPDF2 pdfrw
# Optional: For digital signatures
pip install pyHanko
# Optional: For advanced PDF/A creation
pip install pikepdf
```

## Resources

- [ReportLab Documentation](https://www.reportlab.com/docs/reportlab-userguide.pdf)
- [pdfplumber GitHub](https://github.com/jsvine/pdfplumber)
- [PyPDF2 Documentation](https://pypdf2.readthedocs.io/)
- [PDF/A Specification](https://www.pdfa.org/pdf-a-standard/)
- [WCAG Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
