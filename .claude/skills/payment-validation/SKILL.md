# Payment System Validation & Testing

## 1. Stripe Integration Patterns

### Stripe Payment Flow Implementation

```python
import stripe
from typing import Dict, Optional
from enum import Enum
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure Stripe API key
stripe.api_key = "sk_live_your_key_here"  # Use environment variable in production
stripe.api_version = "2024-01-01"

class PaymentStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"

class StripePaymentProcessor:
    """Handle payment processing with Stripe"""

    def __init__(self, idempotency_key_prefix: str = "payment"):
        self.idempotency_key_prefix = idempotency_key_prefix

    def create_payment_intent(self,
                              amount_cents: int,
                              currency: str = "usd",
                              description: str = None,
                              customer_id: str = None,
                              metadata: Dict = None) -> Dict:
        """Create Stripe PaymentIntent for charge"""

        idempotency_key = f"{self.idempotency_key_prefix}_{customer_id}_{amount_cents}_{datetime.now().isoformat()}"

        try:
            payment_intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency=currency,
                description=description,
                customer=customer_id,
                metadata=metadata or {},
                # Automatic confirmation after payment method provided
                confirm=False,
                # Automatic capture after authorization
                capture_method="automatic",
                # For idempotency - same request produces same result
                idempotency_key=idempotency_key,
            )

            logger.info(f"Created PaymentIntent {payment_intent.id}")

            return {
                'status': 'success',
                'payment_intent_id': payment_intent.id,
                'client_secret': payment_intent.client_secret,
                'amount': payment_intent.amount,
                'currency': payment_intent.currency,
                'status': payment_intent.status,
            }

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error: {e.user_message}")
            return {
                'status': 'error',
                'error': str(e),
            }

    def process_payment_with_card(self,
                                   amount_cents: int,
                                   payment_method_id: str,
                                   customer_id: str = None,
                                   statement_descriptor: str = None) -> Dict:
        """Process payment with saved or new payment method"""

        try:
            payment_intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency="usd",
                payment_method=payment_method_id,
                customer=customer_id,
                confirm=True,
                return_url="https://example.com/return",
                # Set statement descriptor for customer's bank statement
                statement_descriptor=statement_descriptor or "ACME Corp",
                # For off-session payments
                off_session=False,
                # Request three-D Secure if needed
                automatic_payment_methods={'enabled': True},
            )

            if payment_intent.status == "succeeded":
                return {
                    'status': 'succeeded',
                    'transaction_id': payment_intent.id,
                    'amount': payment_intent.amount,
                    'receipt_url': payment_intent.charges.data[0].receipt_url if payment_intent.charges.data else None,
                }

            elif payment_intent.status == "requires_action":
                return {
                    'status': 'requires_action',
                    'client_secret': payment_intent.client_secret,
                    'message': '3D Secure authentication required'
                }

            else:
                return {
                    'status': 'failed',
                    'error': payment_intent.last_payment_error.message if payment_intent.last_payment_error else "Unknown error"
                }

        except stripe.error.CardError as e:
            # Card declined
            return {
                'status': 'failed',
                'error': e.user_message,
                'error_code': e.code,  # "card_declined", "insufficient_funds", etc.
            }

        except stripe.error.RateLimitError as e:
            # Too many requests
            return {
                'status': 'error',
                'error': 'Rate limited. Please try again later.',
            }

    def create_customer(self, email: str, name: str = None, metadata: Dict = None) -> Dict:
        """Create Stripe customer for recurring charges"""

        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata=metadata or {},
                # Set preferred language for emails
                preferred_locales=['en'],
            )

            return {
                'status': 'success',
                'customer_id': customer.id,
                'email': customer.email,
            }

        except stripe.error.StripeError as e:
            return {
                'status': 'error',
                'error': str(e),
            }

    def save_payment_method(self,
                           customer_id: str,
                           payment_method_id: str,
                           set_as_default: bool = True) -> Dict:
        """Save payment method to customer"""

        try:
            # Attach payment method to customer
            payment_method = stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer_id,
            )

            # Set as default if requested
            if set_as_default:
                stripe.Customer.modify(
                    customer_id,
                    invoice_settings={'default_payment_method': payment_method_id}
                )

            return {
                'status': 'success',
                'payment_method_id': payment_method_id,
                'card_last_four': payment_method.card.last4,
                'card_brand': payment_method.card.brand,
            }

        except stripe.error.StripeError as e:
            return {
                'status': 'error',
                'error': str(e),
            }
```

---

## 2. Payment Flow Testing

### Stripe Test Card Numbers

```python
# Test card numbers for different scenarios

TEST_CARDS = {
    'success': {
        'visa': '4242424242424242',
        'mastercard': '5555555555554444',
        'amex': '378282246310005',
    },
    'decline': {
        'insufficient_funds': '4000000000009995',
        'lost_card': '4000000000009987',
        'stolen_card': '4000000000009979',
        'processing_error': '4000000000000119',
    },
    '3d_secure': {
        'require_auth': '4000002500003155',
        'auth_fail': '4000002500003163',
    }
}

class PaymentFlowTest:
    """Test payment flows end-to-end"""

    def test_successful_payment(self):
        """Test successful charge flow"""
        processor = StripePaymentProcessor()

        # Create payment intent
        pi_result = processor.create_payment_intent(
            amount_cents=10000,  # $100.00
            currency="usd",
            description="Test charge",
            metadata={'order_id': 'TEST-001'}
        )

        assert pi_result['status'] == 'success'
        payment_intent_id = pi_result['payment_intent_id']

        # Confirm with test card
        payment_result = processor.process_payment_with_card(
            amount_cents=10000,
            payment_method_id='pm_card_visa',  # Stripe test PM
            customer_id='cus_test123'
        )

        assert payment_result['status'] == 'succeeded'
        assert 'transaction_id' in payment_result

    def test_declined_payment(self):
        """Test declined card handling"""
        processor = StripePaymentProcessor()

        result = processor.process_payment_with_card(
            amount_cents=10000,
            payment_method_id='pm_card_declined',  # Test card
        )

        assert result['status'] == 'failed'
        assert result['error_code'] == 'card_declined'

    def test_3d_secure_flow(self):
        """Test 3D Secure authentication"""
        processor = StripePaymentProcessor()

        result = processor.process_payment_with_card(
            amount_cents=10000,
            payment_method_id='pm_card_threeDSecure2Required',
        )

        # Should return requires_action
        assert result['status'] == 'requires_action'
        assert 'client_secret' in result

    def test_idempotency(self):
        """Test idempotent payment creation"""
        processor = StripePaymentProcessor()

        # Make same request twice
        result1 = processor.create_payment_intent(
            amount_cents=5000,
            customer_id='cus_test123',
        )

        result2 = processor.create_payment_intent(
            amount_cents=5000,
            customer_id='cus_test123',
        )

        # Should return same payment intent
        # (In real implementation, uses idempotency key)
```

---

## 3. Refunds & Dispute Handling

### Refund Processing

```python
class RefundProcessor:
    """Handle refunds and partial refunds"""

    def refund_charge(self, charge_id: str, amount_cents: int = None,
                      reason: str = "requested_by_customer") -> Dict:
        """
        Issue full or partial refund

        Args:
            charge_id: Original charge ID
            amount_cents: Amount to refund (None = full refund)
            reason: One of 'duplicate', 'fraudulent', 'requested_by_customer'
        """

        try:
            refund = stripe.Refund.create(
                charge=charge_id,
                amount=amount_cents,  # None refunds full amount
                reason=reason,
                metadata={'refund_initiated_at': datetime.now().isoformat()},
            )

            return {
                'status': 'success',
                'refund_id': refund.id,
                'amount': refund.amount,
                'status': refund.status,  # succeeded or failed
                'created': refund.created,
            }

        except stripe.error.StripeError as e:
            return {
                'status': 'error',
                'error': str(e),
            }

    def handle_dispute(self, dispute_id: str, evidence: str) -> Dict:
        """
        Respond to payment dispute with evidence

        Common disputes: fraudulent, duplicate, product_unacceptable
        """

        try:
            dispute = stripe.Dispute.modify(
                dispute_id,
                evidence={
                    'access_activity_log': evidence,
                    'customer_communication': None,
                    'customer_email_address': 'customer@example.com',
                    'customer_name': 'Customer Name',
                    'customer_purchase_ip': '192.168.1.1',
                    'product_description': 'Product description',
                    'receipt': None,
                    'refund_policy': None,
                    'refund_policy_disclosure': None,
                    'service_date': None,
                    'service_documentation': None,
                }
            )

            logger.info(f"Dispute {dispute_id} updated with evidence")

            return {
                'status': 'success',
                'dispute_id': dispute.id,
                'evidence_status': dispute.evidence_details.due_by,
            }

        except stripe.error.StripeError as e:
            return {
                'status': 'error',
                'error': str(e),
            }

    def list_disputes(self, status: str = None) -> Dict:
        """List disputes for your account"""

        kwargs = {}
        if status:
            kwargs['status'] = status  # won, lost, warning_closed, warning_under_review

        disputes = stripe.Dispute.list(**kwargs)

        return {
            'total': disputes.total_count,
            'disputes': [
                {
                    'dispute_id': d.id,
                    'amount': d.amount,
                    'reason': d.reason,
                    'status': d.status,
                    'created': d.created,
                }
                for d in disputes.data
            ]
        }
```

---

## 4. Webhook Validation & Handling

### Secure Webhook Processing

```python
import hmac
import hashlib
import json
from flask import Flask, request

app = Flask(__name__)
STRIPE_WEBHOOK_SECRET = "whsec_your_webhook_secret"

class WebhookValidator:
    """Validate and process Stripe webhooks"""

    @staticmethod
    def validate_webhook_signature(payload_raw: bytes, signature: str) -> bool:
        """
        Verify webhook came from Stripe

        Signature header format: t=timestamp,v1=signature
        """

        try:
            # Parse signature header
            time_str, sig_val = None, None
            for item in signature.split(','):
                key, val = item.split('=')
                if key == 't':
                    time_str = val
                elif key == 'v1':
                    sig_val = val

            # Verify timestamp is recent (within 5 minutes)
            import time
            current_time = int(time.time())
            if abs(current_time - int(time_str)) > 300:
                logger.warning("Webhook timestamp outside acceptable range")
                return False

            # Verify signature
            signed_content = f"{time_str}.{payload_raw.decode('utf-8')}"
            expected_sig = hmac.new(
                STRIPE_WEBHOOK_SECRET.encode(),
                signed_content.encode(),
                hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(sig_val, expected_sig)

        except Exception as e:
            logger.error(f"Webhook validation error: {e}")
            return False

    @staticmethod
    def process_event(event: Dict) -> bool:
        """Process webhook event"""

        event_type = event['type']
        event_data = event['data']['object']

        try:
            if event_type == 'payment_intent.succeeded':
                return handle_payment_succeeded(event_data)

            elif event_type == 'payment_intent.payment_failed':
                return handle_payment_failed(event_data)

            elif event_type == 'charge.refunded':
                return handle_charge_refunded(event_data)

            elif event_type == 'customer.subscription.created':
                return handle_subscription_created(event_data)

            elif event_type == 'customer.subscription.deleted':
                return handle_subscription_cancelled(event_data)

            elif event_type == 'charge.dispute.created':
                return handle_dispute_created(event_data)

            else:
                logger.info(f"Unhandled event type: {event_type}")
                return True

        except Exception as e:
            logger.error(f"Error processing webhook: {e}")
            return False


@app.route('/webhook/stripe', methods=['POST'])
def webhook_endpoint():
    """Stripe webhook endpoint"""

    payload_raw = request.get_data()
    signature = request.headers.get('Stripe-Signature')

    # Validate signature
    if not WebhookValidator.validate_webhook_signature(payload_raw, signature):
        return {'error': 'Invalid signature'}, 403

    # Parse event
    event = json.loads(payload_raw)

    # Process event (idempotently)
    success = WebhookValidator.process_event(event)

    return {'status': 'success' if success else 'error'}, 200 if success else 500


def handle_payment_succeeded(payment_intent: Dict) -> bool:
    """Handle successful payment"""

    logger.info(f"Payment succeeded: {payment_intent['id']}")

    # Update order status in database
    order_id = payment_intent['metadata'].get('order_id')
    amount = payment_intent['amount']

    # Update database (idempotent: check if already processed)
    # db.orders.update({'_id': order_id}, {'$set': {'status': 'paid', 'payment_id': payment_intent['id']}})

    # Send confirmation email
    # send_email(payment_intent['receipt_email'], 'Payment Confirmation', ...)

    return True


def handle_payment_failed(payment_intent: Dict) -> bool:
    """Handle failed payment"""

    logger.warning(f"Payment failed: {payment_intent['id']}")
    logger.warning(f"Error: {payment_intent.get('last_payment_error')}")

    # Update order status
    order_id = payment_intent['metadata'].get('order_id')

    # Send failure notification
    # send_email(customer_email, 'Payment Failed', ...)

    return True


def handle_charge_refunded(charge: Dict) -> bool:
    """Handle refund"""

    logger.info(f"Charge refunded: {charge['id']}")

    # Update order status
    # db.orders.update({'payment_id': charge['id']}, {'$set': {'status': 'refunded'}})

    # Send refund confirmation
    # send_email(charge['receipt_email'], 'Refund Processed', ...)

    return True
```

### Webhook Retry Logic

```python
from tenacity import retry, stop_after_attempt, wait_exponential

class WebhookRetryHandler:
    """Handle webhook delivery with retries"""

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=2, max=60),
    )
    async def deliver_webhook(self, event: Dict, retry_count: int = 0) -> bool:
        """
        Deliver webhook with exponential backoff

        Stripe retries: immediately, 1hr, 2hr, 5hr, 5hr
        """

        try:
            # Call event handler
            success = WebhookValidator.process_event(event)

            if not success:
                raise Exception("Event processing failed")

            return True

        except Exception as e:
            logger.warning(f"Webhook delivery attempt {retry_count + 1} failed: {e}")

            # Store failed webhook for manual review
            failed_webhooks.insert({
                'event_id': event['id'],
                'event_type': event['type'],
                'attempt': retry_count + 1,
                'error': str(e),
                'created_at': datetime.now(),
            })

            raise  # Re-raise to trigger retry
```

---

## 5. Subscription Billing

### Subscription Management

```python
class SubscriptionManager:
    """Manage recurring subscriptions"""

    def create_subscription(self,
                           customer_id: str,
                           price_id: str,
                           billing_cycle_anchor: int = None) -> Dict:
        """Create subscription for customer"""

        try:
            subscription = stripe.Subscription.create(
                customer=customer_id,
                items=[{'price': price_id}],
                # Start billing on specific date
                billing_cycle_anchor=billing_cycle_anchor,
                # Auto-advance cycle if payment fails
                collection_method='charge_automatically',
                payment_behavior='default_incomplete',
                # Save default payment method
                default_payment_method='pm_card_visa',
                # Send invoice immediately
                off_session=True,
            )

            return {
                'status': 'success',
                'subscription_id': subscription.id,
                'status': subscription.status,
                'current_period_end': subscription.current_period_end,
            }

        except stripe.error.StripeError as e:
            return {
                'status': 'error',
                'error': str(e),
            }

    def update_subscription(self,
                           subscription_id: str,
                           price_id: str = None,
                           billing_cycle_anchor: int = None) -> Dict:
        """Update subscription (e.g., upgrade/downgrade)"""

        try:
            # For immediate upgrade
            subscription = stripe.Subscription.retrieve(subscription_id)

            items_to_update = []
            if price_id:
                # Add new item for upgrade
                items_to_update.append({
                    'id': subscription.items.data[0].id,
                    'price': price_id,
                })

            updated = stripe.Subscription.modify(
                subscription_id,
                items=items_to_update,
                billing_cycle_anchor=billing_cycle_anchor,
                # Options for prorating:
                # "create_invoices" - immediately invoice for difference
                # "none" - no prorating
                proration_behavior="create_invoices",
            )

            return {
                'status': 'success',
                'subscription_id': updated.id,
                'status': updated.status,
            }

        except stripe.error.StripeError as e:
            return {
                'status': 'error',
                'error': str(e),
            }

    def cancel_subscription(self, subscription_id: str,
                           at_period_end: bool = False) -> Dict:
        """Cancel subscription"""

        try:
            if at_period_end:
                # Cancel at end of billing period (don't charge next cycle)
                subscription = stripe.Subscription.modify(
                    subscription_id,
                    cancel_at_period_end=True
                )
            else:
                # Cancel immediately
                subscription = stripe.Subscription.delete(subscription_id)

            return {
                'status': 'success',
                'subscription_id': subscription_id,
                'cancelled_at': datetime.now().isoformat(),
            }

        except stripe.error.StripeError as e:
            return {
                'status': 'error',
                'error': str(e),
            }

    def get_upcoming_invoice(self, subscription_id: str) -> Dict:
        """Preview upcoming invoice"""

        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            invoice = stripe.Invoice.upcoming(customer=subscription.customer)

            return {
                'status': 'success',
                'amount_due': invoice.amount_due,
                'currency': invoice.currency,
                'due_date': invoice.due_date,
                'lines': [
                    {
                        'description': line.description,
                        'amount': line.amount,
                    }
                    for line in invoice.lines.data
                ]
            }

        except stripe.error.StripeError as e:
            return {
                'status': 'error',
                'error': str(e),
            }
```

---

## 6. PCI DSS Compliance Basics

### Secure Payment Handling

```python
# PCI DSS Compliance Checklist

PCI_COMPLIANCE_CHECKLIST = """
☑ NEVER store full card numbers
   - Use Stripe tokenization (payment tokens)
   - Store only last 4 digits if needed

☑ Use HTTPS for all payment data transmission
   - TLS 1.2 minimum
   - Valid SSL certificate

☑ Validate all input
   - Prevent SQL injection in payment data handling
   - Validate card number format (Luhn algorithm)

☑ Implement strong access control
   - Limit who can access payment data
   - Strong passwords (min 8 chars, complexity)

☑ Use Payment Method Tokenization
   - Convert card to token immediately
   - Never touch raw card data on your server

☑ Log all payment events
   - Failed attempts
   - Refunds
   - Disputes
   - Keep for at least 3 months

☑ Regular security testing
   - Penetration testing annually
   - Vulnerability scans quarterly

☑ Use PCI-DSS Compliant Payment Processor
   - Stripe is PCI-DSS Level 1 certified
   - Reduces your PCI scope
"""

class PaymentSecurityValidator:
    """Validate payment security practices"""

    @staticmethod
    def validate_payment_data(payment_dict: Dict) -> Dict:
        """Ensure payment data is tokenized, not raw"""

        issues = []

        # Check for raw card numbers
        if 'card_number' in payment_dict:
            issues.append('ERROR: Raw card number in data (PCI violation)')

        # Check for raw CVV
        if 'cvv' in payment_dict or 'cvc' in payment_dict:
            issues.append('ERROR: Raw CVV in data (PCI violation)')

        # Validate payment method is token
        if 'payment_method' not in payment_dict:
            issues.append('WARNING: No payment method token found')

        return {
            'compliant': len(issues) == 0,
            'issues': issues,
        }

    @staticmethod
    def validate_luhn_number(card_number: str) -> bool:
        """Validate card number format (doesn't mean card is valid)"""

        # Remove spaces/dashes
        card = card_number.replace(' ', '').replace('-', '')

        # Check length
        if len(card) < 13 or len(card) > 19:
            return False

        # Luhn algorithm
        def luhn_checksum(num):
            digits = [int(d) for d in num]
            # Double every second digit
            for i in range(len(digits) - 2, -1, -2):
                digits[i] *= 2
                if digits[i] > 9:
                    digits[i] -= 9
            return sum(digits) % 10

        return luhn_checksum(card) == 0
```

---

## 7. Error Handling & User Communication

### Payment Error Mapping

```python
PAYMENT_ERROR_MESSAGES = {
    'card_declined': {
        'user_message': 'Your card was declined. Please try another payment method.',
        'retry': True,
    },
    'insufficient_funds': {
        'user_message': 'Your card has insufficient funds.',
        'retry': True,
    },
    'lost_card': {
        'user_message': 'This card has been reported as lost.',
        'retry': False,
    },
    'stolen_card': {
        'user_message': 'This card has been reported as stolen.',
        'retry': False,
    },
    'processing_error': {
        'user_message': 'A processing error occurred. Please try again.',
        'retry': True,
    },
    'expired_card': {
        'user_message': 'Your card has expired.',
        'retry': False,
    },
    'incorrect_cvc': {
        'user_message': 'The card\'s security code is incorrect.',
        'retry': True,
    },
    'rate_limit': {
        'user_message': 'Too many attempts. Please wait a few minutes and try again.',
        'retry': False,
    },
}

class PaymentErrorHandler:
    """Handle payment errors gracefully"""

    @staticmethod
    def format_error_response(error: Exception) -> Dict:
        """Convert Stripe error to user-friendly response"""

        if isinstance(error, stripe.error.CardError):
            error_code = error.code
            message = PAYMENT_ERROR_MESSAGES.get(
                error_code,
                {'user_message': 'Payment failed. Please try again.', 'retry': True}
            )

            return {
                'success': False,
                'error_code': error_code,
                'user_message': message['user_message'],
                'can_retry': message['retry'],
                'decline_code': error.decline_code if hasattr(error, 'decline_code') else None,
            }

        elif isinstance(error, stripe.error.RateLimitError):
            return {
                'success': False,
                'error_code': 'rate_limit',
                'user_message': 'Too many requests. Please wait a moment and try again.',
                'can_retry': False,
            }

        else:
            return {
                'success': False,
                'error_code': 'unknown',
                'user_message': 'An unexpected error occurred. Please contact support.',
                'can_retry': False,
            }

    @staticmethod
    def send_payment_failure_notification(customer_email: str,
                                         error_message: str,
                                         can_retry: bool) -> bool:
        """Send email about payment failure"""

        subject = "Payment Failed - Action Required"
        body = f"""
        Your recent payment could not be processed.

        Error: {error_message}

        {'You can retry your payment here: https://example.com/retry' if can_retry else ''}

        If you need help, contact support@example.com
        """

        # Send via email service
        return True
```

---

## Key Payment Validation Principles

```
1. Always use tokenization
   - Never handle raw card data
   - Use Stripe payment tokens

2. Implement idempotency
   - Handle duplicate requests gracefully
   - Use idempotency keys for all charges

3. Validate webhooks
   - Always verify signature
   - Check timestamp is recent
   - Process idempotently

4. Test with Stripe test cards
   - Don't use production cards in testing
   - Use specific test card numbers for scenarios

5. Handle all error cases
   - Card declined: Show user-friendly message
   - 3D Secure required: Redirect to auth
   - Rate limited: Retry with backoff

6. Log everything
   - Payment attempts
   - Failures
   - Refunds
   - Keep for compliance

7. Communicate clearly
   - Let users know payment status
   - Send confirmation emails
   - Notify of issues promptly
```

