# DOCX Skill - Professional Document Generation

## Overview

This skill provides enterprise-grade Word document creation and manipulation using `python-docx`. It enables developers to programmatically generate professional documents with complex formatting, templates, and batch processing capabilities.

## Core Capabilities

### 1. Basic Document Creation

```python
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

# Create new document
doc = Document()

# Add heading
heading = doc.add_heading('Document Title', level=0)
heading.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Add paragraph with formatting
p = doc.add_paragraph('Body text with ')
p.add_run('bold').bold = True
p.add_run(' and ')
p.add_run('italic').italic = True
p.add_run(' text.')

# Save document
doc.save('output.docx')
```

### 2. Document Styling and Formatting

#### Heading Hierarchy
```python
doc.add_heading('Main Heading', level=1)
doc.add_heading('Sub-Heading', level=2)
doc.add_heading('Sub-Sub-Heading', level=3)
```

#### Text Formatting
```python
paragraph = doc.add_paragraph('Sample text')
run = paragraph.runs[0]

# Character formatting
run.bold = True
run.italic = True
run.underline = True
run.font.size = Pt(12)
run.font.color.rgb = RGBColor(0, 0, 139)  # Dark blue
run.font.name = 'Calibri'

# Paragraph formatting
from docx.enum.text import WD_ALIGN_PARAGRAPH
paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
paragraph.paragraph_format.left_indent = Inches(0.5)
paragraph.paragraph_format.line_spacing = 1.5
paragraph.paragraph_format.space_before = Pt(12)
paragraph.paragraph_format.space_after = Pt(12)
```

#### Style Application
```python
# Apply built-in styles
doc.add_paragraph('Heading Style Text', style='Heading 1')
doc.add_paragraph('Quote Style Text', style='Quote')
doc.add_paragraph('List item', style='List Bullet')
doc.add_paragraph('Numbered item', style='List Number')
```

### 3. Table Creation and Manipulation

```python
# Create table (3 rows x 3 columns)
table = doc.add_table(rows=3, cols=3)
table.style = 'Light Grid Accent 1'

# Populate header row
hdr_cells = table.rows[0].cells
hdr_cells[0].text = 'Column 1'
hdr_cells[1].text = 'Column 2'
hdr_cells[2].text = 'Column 3'

# Populate data rows
data = [
    ['Data 1A', 'Data 1B', 'Data 1C'],
    ['Data 2A', 'Data 2B', 'Data 2C'],
]

for i, row_data in enumerate(data, start=1):
    row_cells = table.rows[i].cells
    for j, cell_text in enumerate(row_data):
        row_cells[j].text = cell_text

# Table formatting
for row in table.rows:
    for cell in row.cells:
        # Set cell text color
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.size = Pt(11)

# Merge cells (merge 2x2 block in top-left)
table.rows[0].cells[0].merge(table.rows[1].cells[1])
```

### 4. Headers and Footers

```python
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

section = doc.sections[0]

# Add header
header = section.header
header_para = header.paragraphs[0]
header_para.text = 'Document Header'
header_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Add footer with page numbers
footer = section.footer
footer_para = footer.paragraphs[0]
footer_para.text = 'Page '

# Add page number field
run = footer_para.add_run()
fldChar1 = OxmlElement('w:fldChar')
fldChar1.set(qn('w:fldCharType'), 'begin')
run._r.append(fldChar1)

instrText = OxmlElement('w:instrText')
instrText.set(qn('xml:space'), 'preserve')
instrText.text = 'PAGE'
run._r.append(instrText)

fldChar2 = OxmlElement('w:fldChar')
fldChar2.set(qn('w:fldCharType'), 'end')
run._r.append(fldChar2)

footer_para.add_run(' of ')

# Add total pages
run = footer_para.add_run()
fldChar3 = OxmlElement('w:fldChar')
fldChar3.set(qn('w:fldCharType'), 'begin')
run._r.append(fldChar3)

instrText = OxmlElement('w:instrText')
instrText.set(qn('xml:space'), 'preserve')
instrText.text = 'NUMPAGES'
run._r.append(instrText)

fldChar4 = OxmlElement('w:fldChar')
fldChar4.set(qn('w:fldCharType'), 'end')
run._r.append(fldChar4)
```

### 5. Image and Media Insertion

```python
# Add image with specific width
doc.add_paragraph('Figure 1: Company Logo')
doc.add_picture('logo.png', width=Inches(2))

# Add image with caption
last_paragraph = doc.paragraphs[-1]
last_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Add image inline
paragraph = doc.add_paragraph('Inline image: ')
run = paragraph.add_run()
run.add_picture('icon.png', width=Inches(0.3))
```

### 6. Page Breaks and Sections

```python
# Add page break
doc.add_page_break()

# Add section break (new section with different formatting)
section = doc.add_section()
section.header.paragraphs[0].text = 'Section 2 Header'

# Set page orientation for section
section.orientation_changed = True
section.page_height = Inches(11)
section.page_width = Inches(8.5)
```

### 7. Table of Contents Generation

```python
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def add_table_of_contents(doc):
    """Add table of contents field to document"""
    paragraph = doc.add_paragraph()
    run = paragraph.add_run()
    fldChar1 = OxmlElement('w:fldChar')
    fldChar1.set(qn('w:fldCharType'), 'begin')
    run._r.append(fldChar1)

    instrText = OxmlElement('w:instrText')
    instrText.set(qn('xml:space'), 'preserve')
    instrText.text = 'TOC \\o "1-2" \\h \\z \\u'
    run._r.append(instrText)

    fldChar2 = OxmlElement('w:fldChar')
    fldChar2.set(qn('w:fldCharType'), 'separate')
    run._r.append(fldChar2)

    fldChar3 = OxmlElement('w:fldChar')
    fldChar3.set(qn('w:fldCharType'), 'end')
    run._r.append(fldChar3)

# Usage
doc = Document()
add_table_of_contents(doc)
doc.add_heading('Chapter 1', level=1)
doc.add_paragraph('Chapter 1 content...')
```

### 8. Document Templates

```python
def create_report_template(title, author, date, sections):
    """Create standardized report template"""
    doc = Document()

    # Title page
    title_para = doc.add_heading(title, level=0)
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph()
    doc.add_paragraph()

    # Metadata
    doc.add_paragraph(f'Author: {author}')
    doc.add_paragraph(f'Date: {date}')

    # Page break
    doc.add_page_break()

    # Table of contents placeholder
    doc.add_heading('Table of Contents', level=1)
    doc.add_paragraph('[Table of Contents - Update in Word]')
    doc.add_page_break()

    # Add sections
    for section in sections:
        doc.add_heading(section['title'], level=1)
        for subsection in section.get('subsections', []):
            doc.add_heading(subsection, level=2)
            doc.add_paragraph('[Content to be filled in]')

    return doc

# Usage
sections = [
    {
        'title': 'Executive Summary',
        'subsections': ['Overview', 'Key Findings']
    },
    {
        'title': 'Analysis',
        'subsections': ['Methodology', 'Results', 'Interpretation']
    }
]

doc = create_report_template('Q1 Financial Report', 'John Doe', '2026-04-07', sections)
doc.save('report.docx')
```

### 9. Mail Merge Preparation

```python
def prepare_mail_merge_template(filename, merge_fields):
    """Create template with mail merge fields"""
    doc = Document()

    # Add greeting line with merge field
    greeting = doc.add_paragraph()
    greeting.add_run('Dear ').font.size = Pt(12)

    # Add merge field reference
    from docx.oxml import parse_xml
    merge_field = parse_xml(r'<w:fldSimple {} w:instr=" MERGE FIELD  FirstName  \* MERGEFORMAT "/>'
                            .format('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'))
    greeting._p.append(merge_field)

    doc.add_paragraph('This is a personalized letter...')

    doc.save(filename)

# Usage
merge_fields = ['FirstName', 'LastName', 'Company']
prepare_mail_merge_template('mail_merge_template.docx', merge_fields)
```

### 10. Find and Replace

```python
from docx.oxml.text.paragraph import CT_P
from docx.text.paragraph import Paragraph

def find_replace_all(doc, old_text, new_text):
    """Find and replace text throughout document"""
    for paragraph in doc.paragraphs:
        if old_text in paragraph.text:
            # Clear paragraph
            for run in paragraph.runs:
                if old_text in run.text:
                    run.text = run.text.replace(old_text, new_text)

    # Also check tables
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    if old_text in paragraph.text:
                        for run in paragraph.runs:
                            if old_text in run.text:
                                run.text = run.text.replace(old_text, new_text)

# Usage
doc = Document('template.docx')
find_replace_all(doc, '{{COMPANY}}', 'Acme Corp')
doc.save('output.docx')
```

### 11. Track Changes and Comments

```python
from docx.oxml import parse_xml

def add_comment_to_paragraph(paragraph, comment_text, author):
    """Add review comment to paragraph"""
    # Note: python-docx has limited comment support
    # This demonstrates the concept; full implementation requires
    # working directly with the package's internal XML structure

    # For production, use python-docx with direct XML manipulation
    # or consider using python-pptx for presentations with comments
    pass

def mark_revision(paragraph, revision_type='insert'):
    """Mark paragraph as inserted/deleted"""
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    p = paragraph._p
    if revision_type == 'insert':
        ins = OxmlElement('w:ins')
        ins.set(qn('w:author'), 'Document Author')
        ins.set(qn('w:date'), '2026-04-07T10:00:00Z')
        p.insert(0, ins)
```

### 12. Batch Document Processing

```python
import os
from pathlib import Path

def batch_generate_letters(data_file, template_doc, output_dir):
    """Generate multiple documents from template and data"""
    import csv

    os.makedirs(output_dir, exist_ok=True)

    with open(data_file, 'r') as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, 1):
            doc = Document(template_doc)

            # Replace placeholders
            for key, value in row.items():
                find_replace_all(doc, f'{{{{{key}}}}}', str(value))

            # Save with unique filename
            output_path = Path(output_dir) / f'letter_{idx}_{row.get("id", "")}.docx'
            doc.save(output_path)
            print(f'Generated: {output_path}')

# Usage
batch_generate_letters('contacts.csv', 'template.docx', 'output_letters/')
```

### 13. Export to PDF

```python
from subprocess import run

def docx_to_pdf(docx_file, pdf_file):
    """Convert DOCX to PDF using LibreOffice"""
    try:
        run([
            'libreoffice',
            '--headless',
            '--convert-to', 'pdf',
            '--outdir', os.path.dirname(pdf_file) or '.',
            docx_file
        ], check=True)
        print(f'Converted to: {pdf_file}')
    except Exception as e:
        print(f'Error converting to PDF: {e}')

# Alternative using python-docx2pdf
def docx_to_pdf_alternative(docx_file, pdf_file):
    """Convert using python-docx2pdf package"""
    try:
        from docx2pdf import convert
        convert(docx_file, pdf_file)
        print(f'Converted to: {pdf_file}')
    except ImportError:
        print('Install with: pip install docx2pdf')
```

## Common Document Types

### 1. Business Report
```python
def create_business_report(title, client_name, report_date):
    doc = Document()

    # Header
    header = doc.sections[0].header
    header.paragraphs[0].text = 'CONFIDENTIAL'

    # Title
    doc.add_heading(title, level=0).alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph(f'Client: {client_name}')
    doc.add_paragraph(f'Date: {report_date}')
    doc.add_page_break()

    # Executive Summary
    doc.add_heading('Executive Summary', level=1)
    doc.add_paragraph('Summary content...')

    # Findings
    doc.add_heading('Findings', level=1)
    doc.add_paragraph('Finding 1', style='List Number')
    doc.add_paragraph('Finding 2', style='List Number')

    # Recommendations
    doc.add_heading('Recommendations', level=1)
    doc.add_paragraph('Recommendation 1', style='List Bullet')
    doc.add_paragraph('Recommendation 2', style='List Bullet')

    return doc
```

### 2. Proposal Template
```python
def create_proposal(client, project_title, scope, deliverables, timeline, cost):
    doc = Document()

    doc.add_heading(f'Proposal: {project_title}', level=0)
    doc.add_paragraph(f'Prepared for: {client}')
    doc.add_paragraph(f'Date: {datetime.now().strftime("%Y-%m-%d")}')

    doc.add_heading('Project Scope', level=1)
    doc.add_paragraph(scope)

    doc.add_heading('Deliverables', level=1)
    for item in deliverables:
        doc.add_paragraph(item, style='List Bullet')

    doc.add_heading('Timeline', level=1)
    doc.add_paragraph(timeline)

    doc.add_heading('Investment', level=1)
    doc.add_paragraph(f'Total Cost: ${cost:,.2f}')

    return doc
```

### 3. Contract Template
```python
def create_contract(party_a, party_b, terms):
    doc = Document()

    doc.add_heading('AGREEMENT', level=0)
    doc.add_paragraph().alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph(f'This Agreement is entered into as of {datetime.now().strftime("%B %d, %Y")} ')
    doc.add_paragraph(f'BETWEEN {party_a} ("Party A")')
    doc.add_paragraph(f'AND {party_b} ("Party B")')

    doc.add_heading('Terms and Conditions', level=1)
    for i, term in enumerate(terms, 1):
        doc.add_heading(f'{i}. {term["title"]}', level=2)
        doc.add_paragraph(term['content'])

    doc.add_heading('Signatures', level=1)
    doc.add_paragraph()
    table = doc.add_table(rows=3, cols=2)
    table.rows[0].cells[0].text = 'Party A'
    table.rows[0].cells[1].text = 'Party B'
    table.rows[1].cells[0].text = '_' * 30
    table.rows[1].cells[1].text = '_' * 30
    table.rows[2].cells[0].text = 'Date'
    table.rows[2].cells[1].text = 'Date'

    return doc
```

## Best Practices

1. **Template Reuse**: Store common formatting as base documents
2. **Styling Consistency**: Use named styles to maintain consistency across document types
3. **Error Handling**: Always wrap `doc.save()` in try-except blocks
4. **Memory Management**: For large batch operations, process documents one at a time
5. **Validation**: Verify merge field names match source data before batch processing
6. **Accessibility**: Include alt text for images using the `.alt_text` attribute
7. **Encoding**: Always specify UTF-8 encoding for international characters

## Limitations and Workarounds

- **Track Changes**: Limited support in python-docx; use direct XML manipulation or external tools
- **Advanced Formatting**: Some complex formatting requires access to XML properties
- **Comments**: Use remarks in document text or metadata; full comment support requires XML access
- **Form Fields**: Limited support; consider using LibreOffice for complex forms

## Dependencies

```bash
pip install python-docx
# Optional: For PDF conversion
pip install docx2pdf libreoffice
```

## Resources

- [python-docx Documentation](https://python-docx.readthedocs.io/)
- [OpenXML Specification](https://www.ecma-international.org/publications/standards/Ecma-376.html)
- [Document Styles Gallery](https://www.microsoft.com/en-us/microsoft-365/blog/2017/07/27/what-you-can-do-with-word-styles/)
