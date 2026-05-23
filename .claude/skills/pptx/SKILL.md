# PPTX Skill - Professional PowerPoint Presentation Creation

## Overview

This skill provides comprehensive PowerPoint presentation creation and customization using `python-pptx`. Enterprise-grade solutions for business presentations, reports, pitches, and template-based slide generation.

## Core Capabilities

### 1. Basic Presentation Creation

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN

# Create presentation
prs = Presentation()
prs.slide_width = Inches(10)
prs.slide_height = Inches(7.5)

# Add blank slide
blank_slide_layout = prs.slide_layouts[6]  # Blank layout
slide = prs.slides.add_slide(blank_slide_layout)

# Add text box
left = Inches(1)
top = Inches(1)
width = Inches(8)
height = Inches(1)
textbox = slide.shapes.add_textbox(left, top, width, height)
text_frame = textbox.text_frame
text_frame.text = "Slide Title"

# Save presentation
prs.save('presentation.pptx')
```

### 2. Slide Layouts

```python
# Available layouts (vary by template)
# 0: Title Slide
# 1: Title and Content
# 2: Section Header
# 3: Two Content
# 4: Comparison
# 5: Title Only
# 6: Blank
# 7: Centered Title
# 8: Custom layouts

# Add title slide
title_slide_layout = prs.slide_layouts[0]
slide = prs.slides.add_slide(title_slide_layout)
title = slide.shapes.title
subtitle = slide.placeholders[1]

title.text = "Presentation Title"
subtitle.text = "Subtitle or Presenter Name"

# Add title and content slide
content_layout = prs.slide_layouts[1]
slide = prs.slides.add_slide(content_layout)
title = slide.shapes.title
title.text = "Slide Title"

content = slide.placeholders[1].text_frame
content.text = "Bullet point 1"
p = content.add_paragraph()
p.text = "Bullet point 2"
p.level = 0

p = content.add_paragraph()
p.text = "Sub-bullet"
p.level = 1

# Add two-column layout
two_col_layout = prs.slide_layouts[3]
slide = prs.slides.add_slide(two_col_layout)
title = slide.shapes.title
title.text = "Two Column Layout"

left_col = slide.placeholders[1].text_frame
left_col.text = "Left column content"

right_col = slide.placeholders[2].text_frame
right_col.text = "Right column content"
```

### 3. Text Formatting

```python
from pptx.util import Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

# Access text frame
text_frame = textbox.text_frame
text_frame.word_wrap = True
text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE

# Format paragraph
paragraph = text_frame.paragraphs[0]
paragraph.alignment = PP_ALIGN.CENTER
paragraph.level = 0
paragraph.space_before = Pt(12)
paragraph.space_after = Pt(12)
paragraph.line_spacing = 1.15

# Format text run
run = paragraph.runs[0]
run.font.size = Pt(28)
run.font.bold = True
run.font.italic = False
run.font.underline = True
run.font.color.rgb = RGBColor(0, 82, 255)  # Blue
run.font.name = 'Calibri'

# Add formatted text
run = paragraph.add_run()
run.text = ' continues here'
run.font.size = Pt(24)
run.font.color.rgb = RGBColor(0, 0, 0)
```

### 4. Master Slide Customization

```python
# Access master slides
prs = Presentation()
blank_slide_layout = prs.slide_layouts[6]
slide = prs.slides.add_slide(blank_slide_layout)

# Add header
header = slide.shapes.add_textbox(
    Inches(0.5),
    Inches(0.3),
    Inches(9),
    Inches(0.4)
)
header_frame = header.text_frame
header_frame.text = "Company Name"
header_frame.paragraphs[0].font.size = Pt(10)
header_frame.paragraphs[0].font.bold = True
header_frame.paragraphs[0].alignment = PP_ALIGN.LEFT

# Add footer
footer = slide.shapes.add_textbox(
    Inches(0.5),
    Inches(7),
    Inches(9),
    Inches(0.4)
)
footer_frame = footer.text_frame
footer_frame.text = "Page 1 | Confidential"
footer_frame.paragraphs[0].font.size = Pt(8)
footer_frame.paragraphs[0].alignment = PP_ALIGN.RIGHT

# Add background shape (serves as design element)
from pptx.util import Inches
background = slide.shapes.add_shape(
    1,  # MSO_SHAPE.RECTANGLE
    Inches(0),
    Inches(0),
    Inches(10),
    Inches(0.8)
)
background.fill.solid()
background.fill.fore_color.rgb = RGBColor(0, 82, 255)  # Blue header bar
background.line.color.rgb = RGBColor(0, 82, 255)
```

### 5. Images and Media

```python
from pptx.util import Inches

# Add image
left = Inches(1)
top = Inches(1)
height = Inches(4)
pic = slide.shapes.add_picture('image.png', left, top, height=height)

# Add image with caption
picture_box = slide.shapes.add_textbox(
    left,
    top + height + Inches(0.2),
    Inches(4),
    Inches(0.5)
)
tf = picture_box.text_frame
tf.text = "Figure 1: Product Screenshot"
tf.paragraphs[0].font.size = Pt(10)
tf.paragraphs[0].alignment = PP_ALIGN.CENTER

# Resize and position image
pic.left = Inches(2)
pic.top = Inches(1.5)
pic.width = Inches(3)
pic.height = Inches(3)

# Add multiple images in grid
images = ['img1.png', 'img2.png', 'img3.png', 'img4.png']
for idx, img_path in enumerate(images):
    row = idx // 2
    col = idx % 2
    left = Inches(1 + col * 4)
    top = Inches(1 + row * 3)
    slide.shapes.add_picture(img_path, left, top, width=Inches(3))
```

### 6. Charts and Graphs

```python
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
from pptx.util import Inches, Pt

# Prepare chart data
chart_data = CategoryChartData()
chart_data.categories = ['Q1', 'Q2', 'Q3', 'Q4']

chart_data.add_series('Sales', (1000, 1500, 2000, 2500))
chart_data.add_series('Costs', (500, 600, 700, 800))

# Add column chart
x, y, cx, cy = Inches(2), Inches(2), Inches(6), Inches(4)
chart = slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED,
    x, y, cx, cy,
    chart_data
).chart

# Customize chart
chart.has_legend = True
chart.legend.position = XL_LEGEND_POSITION.BOTTOM
chart.legend.include_in_layout = False

# Format chart title
chart.chart_title.text_frame.clear()
chart.chart_title.text_frame.text = "Quarterly Performance"

# Add line chart
line_chart_data = CategoryChartData()
line_chart_data.categories = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
line_chart_data.add_series('Revenue', (5000, 5500, 6000, 6500, 7000, 7500))

x, y, cx, cy = Inches(2), Inches(2), Inches(6), Inches(4)
slide.shapes.add_chart(
    XL_CHART_TYPE.LINE,
    x, y, cx, cy,
    line_chart_data
)

# Pie chart
pie_chart_data = CategoryChartData()
pie_chart_data.categories = ['Product A', 'Product B', 'Product C']
pie_chart_data.add_series('Sales', (30, 40, 30))

slide.shapes.add_chart(
    XL_CHART_TYPE.PIE,
    Inches(1), Inches(1), Inches(4), Inches(4),
    pie_chart_data
)
```

### 7. Tables

```python
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor

# Define table data
rows, cols = 4, 3
left = Inches(1)
top = Inches(1)
width = Inches(8)
height = Inches(3)

table_shape = slide.shapes.add_table(rows, cols, left, top, width, height).table

# Set column widths
table.columns[0].width = Inches(2)
table.columns[1].width = Inches(3)
table.columns[2].width = Inches(3)

# Add header row
table.cell(0, 0).text = "Column 1"
table.cell(0, 1).text = "Column 2"
table.cell(0, 2).text = "Column 3"

# Add data
table.cell(1, 0).text = "Data 1A"
table.cell(1, 1).text = "Data 1B"
table.cell(1, 2).text = "Data 1C"

# Format header cells
for col in range(cols):
    cell = table.cell(0, col)
    cell.fill.solid()
    cell.fill.fore_color.rgb = RGBColor(0, 82, 255)

    paragraph = cell.text_frame.paragraphs[0]
    paragraph.font.bold = True
    paragraph.font.color.rgb = RGBColor(255, 255, 255)
    paragraph.alignment = PP_ALIGN.CENTER

# Format data cells
for row in range(1, rows):
    for col in range(cols):
        cell = table.cell(row, col)
        cell.text_frame.vertical_anchor = MSO_ANCHOR.MIDDLE
```

### 8. Speaker Notes

```python
from pptx import Presentation

# Access slide
slide = prs.slides[0]

# Add speaker notes
notes_slide = slide.notes_slide
text_frame = notes_slide.notes_text_frame
text_frame.text = """
Key talking points for this slide:
- Point 1: Explain the main concept
- Point 2: Provide supporting evidence
- Point 3: Connect to next slide

Timing: 3-5 minutes
"""

# Add formatted notes
p = text_frame.add_paragraph()
p.text = "Additional notes here"
p.level = 0
p.font.size = Pt(11)
```

### 9. Slide Transitions and Animations

```python
from pptx.oxml.xmlchemy import OxmlElement

# Add slide transition (XML-based)
slide = prs.slides[0]

# Add fade transition
transition = OxmlElement('p:transition')
transition.set('spd', 'med')
transition.set('advTm', '3000')  # Auto advance after 3 seconds

fade = OxmlElement('p:fade')
fade.set('thruBlk', 'false')
transition.append(fade)

slide._element.insert(0, transition)

# Note: Full animation support requires XML manipulation
# For complex animations, consider:
# 1. Creating template with animations in PowerPoint
# 2. Using VBA macros
# 3. Working with XML directly
```

### 10. Batch Presentation Generation

```python
def generate_presentations_from_data(data_list, template_path, output_dir):
    """Generate multiple presentations from data"""
    import os

    os.makedirs(output_dir, exist_ok=True)

    for idx, data in enumerate(data_list):
        # Load template or create new
        prs = Presentation()

        # Add title slide
        title_slide_layout = prs.slide_layouts[0]
        slide = prs.slides.add_slide(title_slide_layout)
        title = slide.shapes.title
        subtitle = slide.placeholders[1]

        title.text = data['title']
        subtitle.text = data['company']

        # Add content slide
        content_layout = prs.slide_layouts[1]
        slide = prs.slides.add_slide(content_layout)
        title = slide.shapes.title
        title.text = "Overview"

        content = slide.placeholders[1].text_frame
        content.text = data['description']

        # Save with unique filename
        output_path = os.path.join(output_dir, f"presentation_{idx+1}_{data['id']}.pptx")
        prs.save(output_path)
        print(f"Generated: {output_path}")

# Usage
data = [
    {'id': '001', 'title': 'Sales Pitch', 'company': 'Acme Corp', 'description': 'Q1 Results'},
    {'id': '002', 'title': 'Product Demo', 'company': 'TechCorp', 'description': 'New Features'},
]

generate_presentations_from_data(data, 'template.pptx', 'presentations/')
```

### 11. Export to PDF

```python
import subprocess
import os

def pptx_to_pdf(pptx_file, pdf_file):
    """Convert PPTX to PDF using LibreOffice"""
    try:
        subprocess.run([
            'libreoffice',
            '--headless',
            '--convert-to', 'pdf',
            '--outdir', os.path.dirname(pdf_file) or '.',
            pptx_file
        ], check=True)
        print(f"Converted to: {pdf_file}")
    except subprocess.CalledProcessError as e:
        print(f"Error: {e}")

# Alternative: Use xlwings (requires PowerPoint/Excel installed)
def pptx_to_pdf_xlwings(pptx_file, pdf_file):
    """Convert using xlwings and PowerPoint COM object"""
    try:
        from pptx import Presentation

        prs = Presentation(pptx_file)
        prs.save(pdf_file, export_format=2)  # 2 = PDF format
        print(f"Converted to: {pdf_file}")
    except ImportError:
        print("Install xlwings: pip install xlwings")
```

### 12. Professional Report Template

```python
def create_business_report_presentation(title, sections_data, output_file):
    """Generate professional business report presentation"""
    prs = Presentation()
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(7.5)

    # Title slide
    title_slide_layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(title_slide_layout)
    slide.shapes.title.text = title
    slide.placeholders[1].text = "Business Report"

    # Executive Summary slide
    summary_layout = prs.slide_layouts[1]
    slide = prs.slides.add_slide(summary_layout)
    slide.shapes.title.text = "Executive Summary"

    content = slide.placeholders[1].text_frame
    content.text = sections_data['summary']

    # Content slides
    for section in sections_data['sections']:
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        slide.shapes.title.text = section['title']

        content = slide.placeholders[1].text_frame
        content.text = section['content']

        # Add bullets if provided
        if 'bullets' in section:
            for bullet in section['bullets']:
                p = content.add_paragraph()
                p.text = bullet
                p.level = 0

    # Conclusion slide
    conclusion_layout = prs.slide_layouts[1]
    slide = prs.slides.add_slide(conclusion_layout)
    slide.shapes.title.text = "Conclusion"

    content = slide.placeholders[1].text_frame
    content.text = sections_data['conclusion']

    prs.save(output_file)
    print(f"Report created: {output_file}")

# Usage
report_data = {
    'summary': 'This report provides comprehensive analysis of Q1 performance.',
    'sections': [
        {
            'title': 'Market Analysis',
            'content': 'Market conditions summary',
            'bullets': ['Point 1', 'Point 2', 'Point 3']
        },
        {
            'title': 'Financial Results',
            'content': 'Revenue and cost analysis',
            'bullets': ['Revenue up 15%', 'Costs controlled']
        },
    ],
    'conclusion': 'Overall performance exceeded expectations.',
}

create_business_report_presentation('Q1 2026 Report', report_data, 'report.pptx')
```

## Common Presentation Patterns

### Sales Presentation
```python
# Title
# Problem
# Solution
# Product/Service Features
# Case Studies
# Pricing
# Call to Action
# Q&A
```

### Training Presentation
```python
# Title/Objectives
# Module 1
# Module 2
# Module 3
# Summary
# Resources
# Assessment
# Contact
```

### Product Launch
```python
# Title
# Company Overview
# Problem Statement
# Product Introduction
# Features & Benefits
# Pricing
# Timeline
# Contact/Purchase
```

## Best Practices

1. **Design Consistency**: Use master slides for uniform formatting
2. **Content Hierarchy**: Follow one concept per slide rule
3. **Visual Balance**: Avoid text-heavy slides; use visuals
4. **Color Scheme**: Limit to 3-4 colors for professional appearance
5. **Font Selection**: Use maximum 2 font families
6. **Whitespace**: Leave adequate margins and spacing
7. **Accessibility**: Include alt text descriptions
8. **Slide Numbers**: Add slide numbers for reference
9. **Speaker Notes**: Include detailed notes for presenter
10. **Version Control**: Save iterations with dates in filename

## Limitations

- Limited animation support (requires XML manipulation)
- Transitions can be basic (XML-based)
- Media embedding has limitations (may require links vs. embeds)
- Themes and master slides have limited customization
- No VBA macro creation capability

## Dependencies

```bash
pip install python-pptx pillow
# Optional: For PDF export
pip install libreoffice  # System package
```

## Resources

- [python-pptx Documentation](https://python-pptx.readthedocs.io/)
- [OOXML Specification](https://www.ecma-international.org/publications/standards/Ecma-376.html)
- [Presentation Design Guidelines](https://www.microsoft.com/en-us/microsoft-365/blog/)
- [Accessible Presentations](https://www.w3.org/WAI/teach-advocate/accessible-presentations/)
