# Inventory Management System

## 1. Real-Time vs Batch Inventory Tracking

### Real-Time Inventory Pattern

```python
from datetime import datetime
from enum import Enum
import asyncio
from typing import Dict, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class InventoryMovementType(Enum):
    PURCHASE = "purchase"
    SALE = "sale"
    RETURN = "return"
    ADJUSTMENT = "adjustment"
    DAMAGE = "damage"
    TRANSFER = "transfer"
    RESTOCK = "restock"

class RealTimeInventoryManager:
    """Real-time inventory tracking with immediate updates"""

    def __init__(self, db_connection):
        self.db = db_connection
        self.cache = {}  # In-memory cache for frequently accessed SKUs

    async def record_movement(self,
                              sku: str,
                              quantity: int,
                              movement_type: InventoryMovementType,
                              warehouse_id: str,
                              reference_id: str = None,
                              metadata: Dict = None) -> Dict:
        """Record inventory movement immediately"""

        try:
            # Start transaction
            async with self.db.transaction():

                # Lock row for update (prevents race conditions)
                current_stock = await self.db.fetch_one(
                    "SELECT quantity FROM inventory WHERE sku = ? AND warehouse_id = ? FOR UPDATE",
                    (sku, warehouse_id)
                )

                if not current_stock:
                    raise ValueError(f"SKU {sku} not found in warehouse {warehouse_id}")

                new_quantity = current_stock['quantity'] + (quantity if movement_type == InventoryMovementType.PURCHASE else -quantity)

                # Prevent negative stock
                if new_quantity < 0:
                    raise ValueError(f"Insufficient stock. Current: {current_stock['quantity']}, Requested: {quantity}")

                # Update inventory
                await self.db.execute(
                    """UPDATE inventory
                       SET quantity = ?,
                           updated_at = ?,
                           last_movement_type = ?
                       WHERE sku = ? AND warehouse_id = ?""",
                    (new_quantity, datetime.now(), movement_type.value, sku, warehouse_id)
                )

                # Record movement history
                movement_id = await self.db.execute(
                    """INSERT INTO inventory_movements
                       (sku, warehouse_id, movement_type, quantity, reference_id, metadata, recorded_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (sku, warehouse_id, movement_type.value, quantity, reference_id,
                     metadata, datetime.now())
                )

                # Update cache
                self.cache[f"{sku}:{warehouse_id}"] = new_quantity

                # Check if low stock alert needed
                if new_quantity <= 10:
                    await self._trigger_low_stock_alert(sku, warehouse_id, new_quantity)

                logger.info(f"Recorded {movement_type.value} for {sku}: {quantity} units in {warehouse_id}")

                return {
                    'status': 'success',
                    'movement_id': movement_id,
                    'sku': sku,
                    'new_quantity': new_quantity,
                    'timestamp': datetime.now().isoformat(),
                }

        except Exception as e:
            logger.error(f"Error recording movement: {e}")
            return {
                'status': 'error',
                'error': str(e),
            }

    async def get_stock_level(self, sku: str, warehouse_id: str) -> Dict:
        """Get current stock level (from cache or DB)"""

        cache_key = f"{sku}:{warehouse_id}"

        # Check cache first
        if cache_key in self.cache:
            return {
                'sku': sku,
                'warehouse_id': warehouse_id,
                'quantity': self.cache[cache_key],
                'source': 'cache',
            }

        # Fallback to database
        result = await self.db.fetch_one(
            "SELECT quantity FROM inventory WHERE sku = ? AND warehouse_id = ?",
            (sku, warehouse_id)
        )

        if result:
            self.cache[cache_key] = result['quantity']
            return {
                'sku': sku,
                'warehouse_id': warehouse_id,
                'quantity': result['quantity'],
                'source': 'database',
            }

        return {
            'sku': sku,
            'warehouse_id': warehouse_id,
            'quantity': 0,
            'source': None,
        }

    async def _trigger_low_stock_alert(self, sku: str, warehouse_id: str, quantity: int):
        """Trigger alert when stock falls below threshold"""

        await self.db.execute(
            """INSERT INTO low_stock_alerts
               (sku, warehouse_id, alert_quantity, created_at)
               VALUES (?, ?, ?, ?)""",
            (sku, warehouse_id, quantity, datetime.now())
        )

        logger.warning(f"Low stock alert for {sku} in {warehouse_id}: {quantity} units")
```

### Batch Inventory Pattern

```python
class BatchInventoryProcessor:
    """Process inventory updates in batches for cost optimization"""

    def __init__(self, db_connection, batch_size: int = 100):
        self.db = db_connection
        self.batch_size = batch_size
        self.pending_movements = []

    def queue_movement(self,
                       sku: str,
                       quantity: int,
                       warehouse_id: str,
                       movement_type: InventoryMovementType):
        """Queue movement for batch processing"""

        self.pending_movements.append({
            'sku': sku,
            'quantity': quantity,
            'warehouse_id': warehouse_id,
            'movement_type': movement_type.value,
            'recorded_at': datetime.now(),
        })

        # Process when batch is full
        if len(self.pending_movements) >= self.batch_size:
            self.flush()

    def flush(self):
        """Process all queued movements at once"""

        if not self.pending_movements:
            return

        try:
            # Insert all movements in single batch
            self.db.execute_many(
                """INSERT INTO inventory_movements
                   (sku, warehouse_id, movement_type, quantity, recorded_at)
                   VALUES (?, ?, ?, ?, ?)""",
                [(m['sku'], m['warehouse_id'], m['movement_type'],
                  m['quantity'], m['recorded_at'])
                 for m in self.pending_movements]
            )

            # Update inventory in batch
            for sku, warehouse_id in set(
                (m['sku'], m['warehouse_id']) for m in self.pending_movements
            ):
                total_movement = sum(
                    m['quantity'] for m in self.pending_movements
                    if m['sku'] == sku and m['warehouse_id'] == warehouse_id
                )

                self.db.execute(
                    """UPDATE inventory
                       SET quantity = quantity + ?
                       WHERE sku = ? AND warehouse_id = ?""",
                    (total_movement, sku, warehouse_id)
                )

            logger.info(f"Processed batch of {len(self.pending_movements)} movements")
            self.pending_movements = []

        except Exception as e:
            logger.error(f"Batch processing error: {e}")
            raise
```

---

## 2. SKU Design & Hierarchy

### Hierarchical SKU Structure

```python
from dataclasses import dataclass
from typing import List

@dataclass
class SKU:
    """
    Hierarchical SKU format:
    AB-CD-EF-GH

    AB: Category (AP=Apparel, EL=Electronics, etc.)
    CD: Subcategory (01=Men's, 02=Women's, etc.)
    EF: Product type (SH=Shirt, PT=Pants, etc.)
    GH: Variant (01=Size S, 02=Size M, etc.)
    """

    category: str      # 2 chars
    subcategory: str   # 2 chars
    product_type: str  # 2 chars
    variant: str       # 2 chars

    def to_string(self) -> str:
        return f"{self.category}-{self.subcategory}-{self.product_type}-{self.variant}"

    @staticmethod
    def parse(sku_string: str) -> 'SKU':
        parts = sku_string.split('-')
        return SKU(*parts)

    def get_parent_sku(self, level: int = 1) -> str:
        """Get parent SKU at specified level"""
        if level == 1:
            return f"{self.category}-{self.subcategory}-{self.product_type}-**"
        elif level == 2:
            return f"{self.category}-{self.subcategory}-**-**"
        elif level == 3:
            return f"{self.category}-**-**-**"
        return self.to_string()


# SKU Catalog
SKU_CATEGORIES = {
    'AP': 'Apparel',
    'EL': 'Electronics',
    'HO': 'Home',
    'SP': 'Sports',
}

SKU_SUBCATEGORIES = {
    '01': 'Men\'s',
    '02': 'Women\'s',
    '03': 'Children\'s',
    '04': 'Unisex',
}

SKU_PRODUCT_TYPES = {
    'SH': 'Shirt',
    'PT': 'Pants',
    'SH': 'Shoes',
    'JK': 'Jacket',
}

SKU_VARIANTS = {
    '01': 'Size XS',
    '02': 'Size S',
    '03': 'Size M',
    '04': 'Size L',
    '05': 'Size XL',
    'BK': 'Black',
    'WH': 'White',
    'RD': 'Red',
}


class SKUManager:
    """Manage SKU generation and validation"""

    def generate_sku(self,
                     category: str,
                     subcategory: str,
                     product_type: str,
                     variant: str) -> str:
        """Generate valid SKU"""

        # Validate each component
        if category not in SKU_CATEGORIES:
            raise ValueError(f"Invalid category: {category}")

        sku = SKU(category, subcategory, product_type, variant)
        return sku.to_string()

    def get_sku_hierarchy(self, sku_string: str) -> Dict:
        """Get hierarchical information from SKU"""

        sku = SKU.parse(sku_string)

        return {
            'full_sku': sku.to_string(),
            'category': SKU_CATEGORIES.get(sku.category),
            'subcategory': SKU_SUBCATEGORIES.get(sku.subcategory),
            'product_type': SKU_PRODUCT_TYPES.get(sku.product_type),
            'variant': SKU_VARIANTS.get(sku.variant),
            'parent_skus': {
                'level_1': sku.get_parent_sku(1),
                'level_2': sku.get_parent_sku(2),
                'level_3': sku.get_parent_sku(3),
            }
        }
```

---

## 3. Barcode & QR Code Integration

### Barcode Management

```python
import barcode
from barcode.writer import ImageWriter
import qrcode
from PIL import Image
from io import BytesIO

class BarcodeManager:
    """Generate and manage barcodes/QR codes"""

    @staticmethod
    def generate_barcode(sku: str, output_format: str = 'png') -> bytes:
        """Generate EAN-13 barcode"""

        # Pad SKU to 12 digits
        ean = sku.replace('-', '').ljust(12, '0')[:12]

        # Generate barcode
        barcode_obj = barcode.get('ean13', ean, writer=ImageWriter())

        # Convert to bytes
        buffer = BytesIO()
        barcode_obj.write(buffer, options={'format': output_format})
        buffer.seek(0)

        return buffer.getvalue()

    @staticmethod
    def generate_qr_code(sku: str, product_url: str = None) -> bytes:
        """Generate QR code"""

        data = product_url or f"https://example.com/product/{sku}"

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )

        qr.add_data(data)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        # Convert to bytes
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)

        return buffer.getvalue()

    @staticmethod
    def decode_barcode(barcode_image: bytes) -> str:
        """Decode barcode from image"""

        from pyzbar import pyzbar
        from PIL import Image

        img = Image.open(BytesIO(barcode_image))
        decoded = pyzbar.decode(img)

        if decoded:
            return decoded[0].data.decode('utf-8')
        return None


class ReceivingProcess:
    """Warehouse receiving with barcode verification"""

    def __init__(self, db_connection):
        self.db = db_connection

    def receive_shipment(self, purchase_order_id: str, scanned_items: List[str]) -> Dict:
        """Process shipment receiving by scanning barcodes"""

        results = {
            'po_id': purchase_order_id,
            'received_items': [],
            'discrepancies': [],
            'total_items': len(scanned_items),
        }

        # Get expected items from PO
        expected = self.db.query(
            "SELECT sku, expected_quantity FROM po_items WHERE po_id = ?",
            (purchase_order_id,)
        )

        expected_dict = {item['sku']: item['expected_quantity'] for item in expected}
        received_dict = {}

        # Count scanned items
        for scanned_sku in scanned_items:
            received_dict[scanned_sku] = received_dict.get(scanned_sku, 0) + 1

        # Verify quantities
        for sku, received_qty in received_dict.items():
            expected_qty = expected_dict.get(sku, 0)

            if received_qty == expected_qty:
                results['received_items'].append({
                    'sku': sku,
                    'quantity': received_qty,
                    'status': 'match',
                })
                # Update inventory
                self.db.execute(
                    "UPDATE inventory SET quantity = quantity + ? WHERE sku = ?",
                    (received_qty, sku)
                )
            else:
                results['discrepancies'].append({
                    'sku': sku,
                    'expected': expected_qty,
                    'received': received_qty,
                    'variance': received_qty - expected_qty,
                })

        # Check for missing items
        for sku, expected_qty in expected_dict.items():
            if sku not in received_dict:
                results['discrepancies'].append({
                    'sku': sku,
                    'expected': expected_qty,
                    'received': 0,
                    'variance': -expected_qty,
                })

        return results
```

---

## 4. Multi-Location Inventory Sync

### Inventory Synchronization

```python
class MultiLocationInventorySync:
    """Sync inventory across multiple warehouses"""

    def __init__(self, db_connection):
        self.db = db_connection

    def get_total_stock(self, sku: str) -> Dict:
        """Get total stock across all warehouses"""

        locations = self.db.query(
            """SELECT warehouse_id, quantity, location_name
               FROM inventory
               WHERE sku = ?
               ORDER BY warehouse_id""",
            (sku,)
        )

        total = sum(loc['quantity'] for loc in locations)

        return {
            'sku': sku,
            'total_quantity': total,
            'locations': [
                {
                    'warehouse_id': loc['warehouse_id'],
                    'location_name': loc['location_name'],
                    'quantity': loc['quantity'],
                    'percentage': (loc['quantity'] / total * 100) if total > 0 else 0,
                }
                for loc in locations
            ]
        }

    def transfer_stock(self,
                      sku: str,
                      from_warehouse: str,
                      to_warehouse: str,
                      quantity: int) -> Dict:
        """Transfer stock between warehouses"""

        try:
            async with self.db.transaction():
                # Deduct from source
                source_stock = self.db.query(
                    "SELECT quantity FROM inventory WHERE sku = ? AND warehouse_id = ?",
                    (sku, from_warehouse)
                )[0]

                if source_stock['quantity'] < quantity:
                    raise ValueError("Insufficient stock at source warehouse")

                # Record outbound movement
                self.db.execute(
                    """INSERT INTO inventory_movements
                       (sku, warehouse_id, movement_type, quantity, reference_id)
                       VALUES (?, ?, ?, ?, ?)""",
                    (sku, from_warehouse, 'transfer', -quantity,
                     f"transfer_to_{to_warehouse}")
                )

                # Record inbound movement
                self.db.execute(
                    """INSERT INTO inventory_movements
                       (sku, warehouse_id, movement_type, quantity, reference_id)
                       VALUES (?, ?, ?, ?, ?)""",
                    (sku, to_warehouse, 'transfer', quantity,
                     f"transfer_from_{from_warehouse}")
                )

                # Update quantities
                self.db.execute(
                    "UPDATE inventory SET quantity = quantity - ? WHERE sku = ? AND warehouse_id = ?",
                    (quantity, sku, from_warehouse)
                )

                self.db.execute(
                    "UPDATE inventory SET quantity = quantity + ? WHERE sku = ? AND warehouse_id = ?",
                    (quantity, sku, to_warehouse)
                )

                return {
                    'status': 'success',
                    'sku': sku,
                    'from_warehouse': from_warehouse,
                    'to_warehouse': to_warehouse,
                    'quantity': quantity,
                    'timestamp': datetime.now().isoformat(),
                }

        except Exception as e:
            return {
                'status': 'error',
                'error': str(e),
            }

    def allocate_order(self, order_id: str, items: List[Dict]) -> Dict:
        """
        Allocate order from most efficient warehouse

        Items: [{'sku': 'AB-01-SH-02', 'quantity': 5}]
        """

        allocation = {
            'order_id': order_id,
            'from_warehouse': None,
            'items': [],
            'status': 'unallocated',
        }

        # Find best warehouse (prefer closest, then most stocked)
        for item in items:
            sku = item['sku']
            qty = item['quantity']

            # Get all warehouses with stock
            available = self.db.query(
                """SELECT warehouse_id, quantity, location_type
                   FROM inventory
                   WHERE sku = ? AND quantity >= ?
                   ORDER BY location_type DESC, quantity DESC""",
                (sku, qty)
            )

            if available:
                warehouse = available[0]
                allocation['items'].append({
                    'sku': sku,
                    'quantity': qty,
                    'warehouse': warehouse['warehouse_id'],
                })
                allocation['from_warehouse'] = warehouse['warehouse_id']
                allocation['status'] = 'allocated'

        return allocation
```

---

## 5. Demand Forecasting

### Basic Demand Forecast

```python
from statistics import mean, stdev
from datetime import datetime, timedelta

class DemandForecaster:
    """Simple demand forecasting"""

    def __init__(self, db_connection):
        self.db = db_connection

    def get_sales_history(self, sku: str, days: int = 90) -> List[Dict]:
        """Get historical sales data"""

        start_date = datetime.now() - timedelta(days=days)

        sales = self.db.query(
            """SELECT DATE(order_date) as date, SUM(quantity) as quantity
               FROM sales
               WHERE sku = ? AND order_date >= ?
               GROUP BY DATE(order_date)
               ORDER BY date""",
            (sku, start_date)
        )

        return sales

    def forecast_demand(self, sku: str, forecast_days: int = 30) -> Dict:
        """Simple moving average forecast"""

        # Get last 30 days
        history = self.get_sales_history(sku, days=30)

        if not history:
            return {
                'sku': sku,
                'forecast': None,
                'error': 'No sales history',
            }

        quantities = [h['quantity'] for h in history]

        # Calculate metrics
        avg_daily_sales = mean(quantities)
        std_dev = stdev(quantities) if len(quantities) > 1 else 0

        # Forecast
        forecasted_qty = int(avg_daily_sales * forecast_days)

        # Safety stock = (max daily sales - avg daily sales) * lead time (days)
        max_daily = max(quantities)
        safety_stock = int((max_daily - avg_daily_sales) * 7)  # 7 day lead time

        return {
            'sku': sku,
            'forecast_period_days': forecast_days,
            'forecasted_quantity': forecasted_qty,
            'average_daily_sales': avg_daily_sales,
            'std_deviation': std_dev,
            'safety_stock': safety_stock,
            'reorder_point': safety_stock + int(avg_daily_sales * 7),  # 7 day lead time
        }

    def calculate_abc_analysis(self) -> Dict:
        """
        ABC analysis: Classify inventory by value/importance
        A: Top 20% of sales (80% of revenue)
        B: Middle 30% (15% of revenue)
        C: Bottom 50% (5% of revenue)
        """

        # Get total sales by SKU (last 90 days)
        sales_by_sku = self.db.query(
            """SELECT sku, SUM(quantity * unit_price) as total_value
               FROM sales
               WHERE order_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)
               GROUP BY sku
               ORDER BY total_value DESC""",
        )

        total_value = sum(s['total_value'] for s in sales_by_sku)
        cumulative = 0
        analysis = {'A': [], 'B': [], 'C': []}

        for sku_sale in sales_by_sku:
            cumulative += sku_sale['total_value']
            percentage = cumulative / total_value * 100

            if percentage <= 80:
                analysis['A'].append(sku_sale['sku'])
            elif percentage <= 95:
                analysis['B'].append(sku_sale['sku'])
            else:
                analysis['C'].append(sku_sale['sku'])

        return {
            'a_items': analysis['A'],
            'b_items': analysis['B'],
            'c_items': analysis['C'],
            'recommendations': {
                'A': 'High frequency reviews, tight control',
                'B': 'Normal control, quarterly reviews',
                'C': 'Simple controls, periodic reviews',
            }
        }
```

---

## 6. Returns Processing

### Returns Management

```python
class ReturnsProcessor:
    """Manage product returns and refunds"""

    def initiate_return(self,
                       order_id: str,
                       sku: str,
                       quantity: int,
                       reason: str) -> Dict:
        """Initiate product return"""

        try:
            return_id = self.db.execute(
                """INSERT INTO returns
                   (order_id, sku, quantity, reason, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (order_id, sku, quantity, reason, 'initiated', datetime.now())
            )

            # Send return label to customer
            # send_return_label_email(order_id, return_id)

            return {
                'status': 'success',
                'return_id': return_id,
                'return_status': 'initiated',
            }

        except Exception as e:
            return {
                'status': 'error',
                'error': str(e),
            }

    def process_return_receipt(self,
                              return_id: str,
                              received_quantity: int,
                              condition: str) -> Dict:
        """Process returned item upon receipt"""

        try:
            return_info = self.db.query(
                "SELECT * FROM returns WHERE id = ?",
                (return_id,)
            )[0]

            # Check if returned quantity matches expected
            if received_quantity != return_info['quantity']:
                quality_issue = {
                    'return_id': return_id,
                    'expected_qty': return_info['quantity'],
                    'received_qty': received_quantity,
                    'variance': received_quantity - return_info['quantity'],
                }

            # Update return status
            self.db.execute(
                """UPDATE returns
                   SET status = ?, received_quantity = ?, condition = ?, received_at = ?
                   WHERE id = ?""",
                ('received', received_quantity, condition, datetime.now(), return_id)
            )

            # Add back to inventory (if condition is acceptable)
            if condition in ['new', 'like_new', 'good']:
                warehouse_id = 'RMA'  # Returns warehouse
                self.db.execute(
                    "UPDATE inventory SET quantity = quantity + ? WHERE sku = ? AND warehouse_id = ?",
                    (received_quantity, return_info['sku'], warehouse_id)
                )

                refund_status = 'approved'
            else:
                refund_status = 'pending_inspection'

            # Initiate refund
            self.db.execute(
                """UPDATE orders SET refund_status = ? WHERE id = ?""",
                (refund_status, return_info['order_id'])
            )

            return {
                'status': 'success',
                'return_id': return_id,
                'refund_status': refund_status,
                'quality_issue': quality_issue if received_quantity != return_info['quantity'] else None,
            }

        except Exception as e:
            return {
                'status': 'error',
                'error': str(e),
            }
```

---

## Key Inventory Patterns

```
Real-Time vs Batch:
- Real-time: High-velocity items, critical stock
- Batch: Bulk operations, cost optimization

SKU Design:
- Hierarchical for easy categorization
- Consistent format across organization
- Supports drill-down analytics

Multi-Location:
- Sync inventory after each transaction
- Track stock levels by location
- Enable efficient order allocation

Demand Forecasting:
- Use ABC analysis to focus on high-value SKUs
- Maintain safety stock based on variability
- Review forecast accuracy monthly

Returns:
- Clear condition assessment criteria
- Track return patterns
- Use data to improve product quality
```

