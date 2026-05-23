# XLSX Skill - Professional Excel Spreadsheet Management

## Overview

This skill provides comprehensive Excel spreadsheet creation and manipulation using `openpyxl`. Enterprise-grade solutions for financial reports, data analysis, dashboards, and template-based document generation.

## Core Capabilities

### 1. Basic Spreadsheet Creation

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Create new workbook
wb = Workbook()
ws = wb.active
ws.title = "Sheet1"

# Add data
ws['A1'] = "Header 1"
ws['B1'] = "Header 2"
ws['A2'] = "Value 1"
ws['B2'] = "Value 2"

# Save workbook
wb.save('output.xlsx')
```

### 2. Styling and Formatting

#### Cell Styling
```python
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

# Select cell
cell = ws['A1']

# Font styling
cell.font = Font(
    name='Calibri',
    size=14,
    bold=True,
    italic=False,
    vertAlign='superscript',
    underline='single',
    strike=False,
    color='0052FF'  # Blue
)

# Fill/Background color
cell.fill = PatternFill(
    start_color='FFD966',  # Yellow
    end_color='FFD966',
    fill_type='solid'
)

# Alignment
cell.alignment = Alignment(
    horizontal='center',
    vertical='center',
    text_rotation=0,
    wrap_text=True,
    shrink_to_fit=False,
    indent=0
)

# Borders
thin_border = Border(
    left=Side(style='thin'),
    right=Side(style='thin'),
    top=Side(style='thin'),
    bottom=Side(style='thin')
)
cell.border = thin_border

# Number formatting
cell.number_format = '###,##0.00'  # Decimal with thousand separator
cell.number_format = '$#,##0.00'   # Currency
cell.number_format = '0%'           # Percentage
cell.number_format = 'mm/dd/yyyy'   # Date
```

#### Range Styling
```python
# Apply styling to range
thin_border = Border(
    left=Side(style='thin', color='000000'),
    right=Side(style='thin', color='000000'),
    top=Side(style='thin', color='000000'),
    bottom=Side(style='thin', color='000000')
)

for row in ws['A1:C10']:
    for cell in row:
        cell.border = thin_border
        cell.alignment = Alignment(horizontal='center', vertical='center')
```

### 3. Column and Row Management

```python
# Set column widths
ws.column_dimensions['A'].width = 20
ws.column_dimensions['B'].width = 30
ws.column_dimensions['C'].width = 15

# Set row heights
ws.row_dimensions[1].height = 25
ws.row_dimensions[2].height = 40

# Freeze panes (freeze first row and column)
ws.freeze_panes = 'B2'

# Hide columns/rows
ws.column_dimensions['A'].hidden = True
ws.row_dimensions[3].hidden = True

# Insert columns/rows
ws.insert_rows(2)  # Insert row at position 2
ws.insert_cols(3)  # Insert column at position 3

# Delete columns/rows
ws.delete_rows(2, 3)  # Delete 3 rows starting at position 2
ws.delete_cols(3, 2)  # Delete 2 columns starting at position 3
```

### 4. Formulas and Calculations

```python
# Basic formulas
ws['D1'] = '=A1+B1+C1'  # Sum
ws['D2'] = '=AVERAGE(A2:C2)'  # Average
ws['D3'] = '=MAX(A3:C3)'  # Maximum
ws['D4'] = '=MIN(A4:C4)'  # Minimum
ws['D5'] = '=PRODUCT(A5:C5)'  # Multiply
ws['D6'] = '=COUNT(A6:C6)'  # Count numbers

# String functions
ws['E1'] = '=CONCATENATE(A1," ",B1)'  # Concatenate
ws['E2'] = '=UPPER(A2)'  # Uppercase
ws['E3'] = '=LOWER(A3)'  # Lowercase
ws['E4'] = '=LEN(A4)'  # Length
ws['E5'] = '=TRIM(A5)'  # Remove spaces

# Conditional formulas
ws['F1'] = '=IF(A1>100,"High","Low")'
ws['F2'] = '=IFS(A2>100,"High",A2>50,"Medium","Low")'

# Lookup formulas
ws['G1'] = '=VLOOKUP(A1,Sheet2!$A$1:$B$100,2,FALSE)'
ws['G2'] = '=INDEX(B:B,MATCH(A2,A:A,0))'

# Date functions
ws['H1'] = '=TODAY()'
ws['H2'] = '=NOW()'
ws['H3'] = '=DATE(2026,4,7)'
ws['H4'] = '=DATEADD(A4,30,"day")'  # Add 30 days

# Financial functions
ws['I1'] = '=PV(0.05,10,100)'  # Present Value
ws['I2'] = '=PMT(0.05/12,360,300000)'  # Monthly payment
ws['I3'] = '=RATE(10,500,10000)'  # Interest rate

# Conditional aggregation
ws['J1'] = '=SUMIF(A:A,">100")'  # Sum if greater than 100
ws['J2'] = '=COUNTIF(B:B,"Yes")'  # Count if equals "Yes"
ws['J3'] = '=AVERAGEIF(C:C,">0")'  # Average if greater than 0
```

### 5. Conditional Formatting

```python
from openpyxl.formatting.rule import FormulaRule, CellIsRule, ColorScaleRule
from openpyxl.styles import Font, PatternFill

# Color scale formatting (gradient)
color_scale = ColorScaleRule(
    start_type='min', start_color='FF0000',  # Red for low
    mid_type='percentile', mid_value=50, mid_color='FFFF00',  # Yellow for middle
    end_type='max', end_color='00FF00'  # Green for high
)
ws.conditional_formatting.add('A1:A100', color_scale)

# Cell value formatting
cell_rule = CellIsRule(
    operator='greaterThan',
    formula=['100'],
    fill=PatternFill(start_color='00FF00', end_color='00FF00', fill_type='solid'),
    font=Font(bold=True)
)
ws.conditional_formatting.add('B1:B100', cell_rule)

# Formula-based formatting
formula_rule = FormulaRule(
    formula=['$A1>100'],
    fill=PatternFill(start_color='FFFF00', end_color='FFFF00', fill_type='solid')
)
ws.conditional_formatting.add('A1:A100', formula_rule)

# Data bar
from openpyxl.formatting.rule import DataBarRule
data_bar = DataBarRule(
    start_type='min',
    end_type='max',
    color='0052FF'  # Blue bars
)
ws.conditional_formatting.add('C1:C100', data_bar)
```

### 6. Charts

```python
from openpyxl.chart import BarChart, LineChart, PieChart, ScatterChart, AreaChart
from openpyxl.chart.reference import Reference

# Add sample data
ws['A1'] = 'Month'
ws['B1'] = 'Sales'
for i, (month, sales) in enumerate([('Jan', 1000), ('Feb', 1500), ('Mar', 2000)], start=2):
    ws[f'A{i}'] = month
    ws[f'B{i}'] = sales

# Create bar chart
bar_chart = BarChart()
bar_chart.title = 'Monthly Sales'
bar_chart.x_axis.title = 'Month'
bar_chart.y_axis.title = 'Sales'
bar_chart.style = 10

# Add data to chart
data = Reference(ws, min_col=2, min_row=1, max_row=4)
cats = Reference(ws, min_col=1, min_row=2, max_row=4)
bar_chart.add_data(data, titles_from_data=True)
bar_chart.set_categories(cats)

ws.add_chart(bar_chart, 'D2')

# Line chart
line_chart = LineChart()
line_chart.title = 'Sales Trend'
line_chart.add_data(data, titles_from_data=True)
line_chart.set_categories(cats)
ws.add_chart(line_chart, 'D12')

# Pie chart
pie_chart = PieChart()
pie_chart.title = 'Sales Distribution'
pie_chart.add_data(data, titles_from_data=True)
ws.add_chart(pie_chart, 'J2')

# Scatter chart
scatter = ScatterChart()
scatter.title = 'Correlation'
scatter.add_data(Reference(ws, min_col=2, min_row=1, max_row=4))
scatter.set_categories(Reference(ws, min_col=1, min_row=2, max_row=4))
ws.add_chart(scatter, 'J12')
```

### 7. Pivot Tables

```python
from openpyxl.pivot.table import PivotTable, PivotTableStyleInfo

# Create pivot table from data range
pivot_wb = Workbook()
pivot_ws = pivot_wb.active

# Source data (rows: 1-100, cols: A-D)
pivot_table = PivotTable(
    ref='Sheet1!$A$1:$D$100',
    title='SalesPivot'
)

# Configure pivot table structure
from openpyxl.pivot.fields import Numeric
pivot_table.add_field('Region', 'row')
pivot_table.add_field('Product', 'col')
pivot_table.add_field('Sales', 'data', 'sum')

# Apply style
style = PivotTableStyleInfo(
    name='PivotStyleMedium2',
    showRowHeaders=True,
    showColHeaders=True,
    rowStripeSize=1,
    colStripeSize=1
)
pivot_table.pivotTableStyleInfo = style

# Note: openpyxl has limited pivot table support
# For advanced pivot tables, consider:
# 1. Creating in Excel manually
# 2. Using pandas with ExcelWriter
# 3. Using xlwings to automate Excel
```

### 8. Data Import/Export

```python
from openpyxl import load_workbook
import csv
import pandas as pd

# Load existing workbook
wb = load_workbook('existing.xlsx')
ws = wb.active

# Read from CSV and write to Excel
with open('data.csv', 'r') as csvfile:
    reader = csv.reader(csvfile)
    for row_idx, row in enumerate(reader, start=1):
        for col_idx, value in enumerate(row, start=1):
            ws.cell(row=row_idx, column=col_idx, value=value)

wb.save('from_csv.xlsx')

# Using pandas for easier import/export
df = pd.read_csv('data.csv')
df.to_excel('output.xlsx', index=False, sheet_name='Data')

# Read Excel into pandas DataFrame
df = pd.read_excel('data.xlsx', sheet_name='Sheet1')
print(df)

# Multiple sheets with pandas
with pd.ExcelWriter('multi_sheet.xlsx') as writer:
    df1.to_excel(writer, sheet_name='Sales')
    df2.to_excel(writer, sheet_name='Costs')
    df3.to_excel(writer, sheet_name='Profit')
```

### 9. Data Validation

```python
from openpyxl.worksheet.datavalidation import DataValidation

# Create dropdown list
dv = DataValidation(
    type='list',
    formula1='"Option1,Option2,Option3"',
    allow_blank=False,
    showInputMessage=True,
    showErrorMessage=True,
    promptTitle='Select Value',
    prompt='Please select a value from the list',
    errorTitle='Invalid Entry',
    error='Please select from the dropdown list'
)

ws.add_data_validation(dv)
dv.add('A1:A100')

# Numeric validation
numeric_dv = DataValidation(
    type='decimal',
    operator='greaterThan',
    formula1='0'
)
ws.add_data_validation(numeric_dv)
numeric_dv.add('B1:B100')

# Date validation
date_dv = DataValidation(
    type='date',
    operator='greaterThanOrEqual',
    formula1='2026-01-01'
)
ws.add_data_validation(date_dv)
date_dv.add('C1:C100')

# Custom validation with formula
custom_dv = DataValidation(
    type='custom',
    formula1='=AND(A1>0, A1<100)'
)
ws.add_data_validation(custom_dv)
custom_dv.add('D1:D100')
```

### 10. Named Ranges

```python
# Define named range
ws['A1'] = 100
wb.defined_names.add('SalesTotal', '=Sheet1!$A$1')

# Use named range in formula
ws['B1'] = '=SalesTotal*0.1'  # 10% of SalesTotal

# Named range for data range
wb.defined_names.add('SalesData', '=Sheet1!$A$1:$A$100')
ws['C1'] = '=SUM(SalesData)'

# Access defined names
for name in wb.defined_names.definedName:
    print(f'{name.name}: {name.value}')
```

### 11. Large Dataset Optimization

```python
from openpyxl import load_workbook
from openpyxl.worksheet.table import Table, TableStyleInfo

def create_large_spreadsheet(output_file, num_rows=10000):
    """Create and optimize large spreadsheet"""
    wb = Workbook(write_only=True)  # Write-only mode for large files
    ws = wb.create_sheet()

    # Write header
    ws.append(['ID', 'Name', 'Email', 'Sales', 'Date'])

    # Write data rows
    from datetime import datetime, timedelta
    base_date = datetime(2026, 1, 1)

    for i in range(1, num_rows + 1):
        ws.append([
            i,
            f'Customer {i}',
            f'customer{i}@example.com',
            1000 + (i * 10),
            base_date + timedelta(days=i % 365)
        ])

    wb.save(output_file)
    print(f'Created {num_rows} rows in {output_file}')

# For reading large files efficiently
def read_large_spreadsheet(xlsx_file):
    """Read large spreadsheet with optimized memory usage"""
    from openpyxl import load_workbook

    wb = load_workbook(xlsx_file, read_only=True, data_only=True)
    ws = wb.active

    for row in ws.iter_rows(min_row=2, values_only=True):
        # Process row
        id_val, name, email, sales, date_val = row
        print(f'{name}: ${sales}')

# Create table reference for large data
ws['A1'] = 'ID'
ws['B1'] = 'Name'

# Add as table (for filtering/sorting)
tab = Table(displayName='DataTable', ref='A1:B10000')
style = TableStyleInfo(
    name='TableStyleMedium2',
    showFirstColumn=False,
    showLastColumn=False,
    showRowStripes=True,
    showColumnStripes=False
)
tab.tableStyleInfo = style
ws.add_table(tab)
```

### 12. Template-Based Report Generation

```python
def create_financial_report(company_name, period, financial_data, output_file):
    """Generate financial report from template"""
    wb = Workbook()
    ws = wb.active
    ws.title = 'Financial Report'

    # Title
    ws['A1'] = f'{company_name} - Financial Report'
    ws['A1'].font = Font(size=16, bold=True)
    ws['A2'] = f'Period: {period}'
    ws['A2'].font = Font(size=12, italic=True)

    # Revenue section
    ws['A4'] = 'Revenue'
    ws['A4'].font = Font(size=12, bold=True, color='0052FF')
    ws['A5'] = 'Product Sales'
    ws['B5'] = financial_data['product_sales']
    ws['B5'].number_format = '$#,##0.00'
    ws['A6'] = 'Service Revenue'
    ws['B6'] = financial_data['service_revenue']
    ws['B6'].number_format = '$#,##0.00'
    ws['A7'] = 'Total Revenue'
    ws['A7'].font = Font(bold=True)
    ws['B7'] = f"=SUM(B5:B6)"
    ws['B7'].number_format = '$#,##0.00'
    ws['B7'].fill = PatternFill(start_color='FFFF00', fill_type='solid')

    # Expenses section
    ws['A9'] = 'Expenses'
    ws['A9'].font = Font(size=12, bold=True, color='0052FF')
    ws['A10'] = 'Salaries'
    ws['B10'] = financial_data['salaries']
    ws['B10'].number_format = '$#,##0.00'
    ws['A11'] = 'Operating Costs'
    ws['B11'] = financial_data['operating_costs']
    ws['B11'].number_format = '$#,##0.00'
    ws['A12'] = 'Total Expenses'
    ws['A12'].font = Font(bold=True)
    ws['B12'] = '=SUM(B10:B11)'
    ws['B12'].number_format = '$#,##0.00'

    # Profit
    ws['A14'] = 'Net Profit'
    ws['A14'].font = Font(size=12, bold=True, color='00AA00')
    ws['B14'] = '=B7-B12'
    ws['B14'].number_format = '$#,##0.00'
    ws['B14'].fill = PatternFill(start_color='C6EFCE', fill_type='solid')

    wb.save(output_file)
    print(f'Report created: {output_file}')

# Usage
financial_data = {
    'product_sales': 500000,
    'service_revenue': 200000,
    'salaries': 300000,
    'operating_costs': 150000,
}

create_financial_report('Acme Corp', 'Q1 2026', financial_data, 'financial_report.xlsx')
```

## Best Practices

1. **Memory Efficiency**: Use `write_only=True` for large spreadsheets
2. **Formula Optimization**: Avoid volatile functions (NOW, RAND) in shared files
3. **Naming Conventions**: Use meaningful sheet and range names
4. **Validation**: Always validate data before import
5. **Formatting Consistency**: Use styles and themes across reports
6. **Documentation**: Include data dictionary sheet for complex files
7. **Version Control**: Track changes in separate columns or sheets

## Dependencies

```bash
pip install openpyxl pandas
# Optional: For advanced features
pip install xlwings  # Automate Excel
pip install xlrd xlwt  # Legacy format support
```

## Limitations

- Charts created with openpyxl may need adjustment in Excel
- Pivot tables have limited support; consider using pandas or Excel directly
- VBA macros cannot be created; use VBA templates loaded via openpyxl
- Conditional formatting limited to basic rules

## Resources

- [openpyxl Documentation](https://openpyxl.readthedocs.io/)
- [Excel Function Reference](https://support.microsoft.com/en-us/office/excel-functions-by-category-c7f693f5-95d7-49c3-be87-94f996495fbf)
- [Pandas Excel Integration](https://pandas.pydata.org/docs/user_guide/io.html#excel-files)
- [ECMA-376 Office Open XML Specification](https://www.ecma-international.org/publications/standards/Ecma-376.html)
