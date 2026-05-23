# UX Copy and Microcopy Guide

## I. Principles of Effective Microcopy

### 1.1 Core Principles

**1. Be Specific, Not Generic**
```
✗ Bad: "Error occurred"
✓ Good: "Password must contain at least 8 characters"

✗ Bad: "Invalid input"
✓ Good: "Email address must include an @ symbol (e.g., you@example.com)"
```

**2. Be Actionable**
```
✗ Bad: "Something went wrong"
✓ Good: "Unable to connect. Check your internet connection and try again."

✗ Bad: "Failed"
✓ Good: "Upload failed: File size exceeds 10MB. Please try a smaller file."
```

**3. Use Active Voice & Second Person**
```
✗ Bad: "Password was not accepted"
✓ Good: "Your password doesn't meet security requirements"

✗ Bad: "Invalid credentials provided"
✓ Good: "Email or password is incorrect. Please try again."
```

**4. Be Concise**
```
✗ Bad: "Due to unforeseen circumstances, the system is temporarily unable to process your request at this time"
✓ Good: "Server is busy. Please try again in a few moments."
```

**5. Use Positive Language When Possible**
```
✗ Bad: "Don't forget to save your work"
✓ Good: "Save your work regularly to avoid losing changes"

✗ Bad: "You cannot proceed without uploading a file"
✓ Good: "Upload a file to continue"
```

### 1.2 Tone Guidelines

**Professional, Friendly, Human:**
```
For: Financial, Healthcare, Enterprise apps
"We couldn't process your payment. Your card hasn't been charged.
Please update your payment method or contact support if this persists."

For: Consumer, Creative, Social apps
"Oops! That payment didn't go through. Your money is safe.
Let's fix this together—update your card and we'll try again."
```

**Clear Over Clever:**
```
✗ Bad (too clever): "Your password has entered the danger zone"
✓ Good: "Password is too simple. Use 12+ characters with uppercase, numbers, and symbols."
```

**Empathetic:**
```
✗ Bad: "You've exceeded the upload limit"
✓ Good: "You've reached your upload limit. Upgrade to Pro for unlimited uploads, or delete older files to make space."
```

---

## II. Error Messages

### 2.1 Error Message Structure

Every error message should answer:
1. **What happened?** (specific, not technical jargon)
2. **Why did it happen?** (context)
3. **What should I do?** (clear next step)

```
What: "Your email is already registered"
Why: "This email is already in use"
Action: "Sign in instead or use a different email address"

Full message: "This email is already registered. Sign in with this account or try a different email."
```

### 2.2 Common Error Patterns

**Authentication Errors:**
```typescript
const authErrors = {
  // ✗ Bad
  'invalid_credentials': 'Authentication failed',

  // ✓ Good
  'invalid_credentials': 'Email or password is incorrect. Try again or reset your password.',
  'email_not_verified': 'Please verify your email before signing in. Check your inbox for a verification link.',
  'account_locked': 'Too many failed attempts. Your account is locked for 30 minutes for security.',
  'password_expired': 'Your password has expired. Create a new one to continue.',
  'mfa_required': 'Enter the 6-digit code from your authenticator app.',
};
```

**Form Validation Errors:**
```typescript
const validationErrors = {
  // ✗ Bad
  'required': 'This field is required',

  // ✓ Good (field-specific)
  'name.required': 'What should we call you?',
  'email.required': 'We need your email to contact you',
  'email.invalid': 'Enter a valid email (e.g., you@example.com)',
  'password.too_short': 'Password must be at least 12 characters',
  'password.no_uppercase': 'Include at least one uppercase letter',
  'password.no_number': 'Include at least one number',
  'phone.invalid': 'Phone number must be 10 digits',
  'date.invalid': 'Date must be valid (e.g., 01/15/2024)',
};
```

**Payment Errors:**
```typescript
const paymentErrors = {
  'card_declined': 'Card declined. Try another payment method or contact your bank.',
  'insufficient_funds': 'Insufficient funds. Check your balance or use another card.',
  'expired_card': 'Your card has expired. Update the expiration date.',
  'processing_error': 'Payment processing failed. Your card hasn\'t been charged. Please try again.',
  'address_mismatch': 'Billing address doesn\'t match card records. Update your address and try again.',
};
```

**Network/Server Errors:**
```typescript
const serverErrors = {
  // ✗ Bad (technical, unhelpful)
  '500': 'Internal Server Error',
  '502': 'Bad Gateway',
  '503': 'Service Unavailable',

  // ✓ Good (user-friendly)
  '500': 'Something went wrong on our end. We\'re fixing it. Please try again in a few moments.',
  '502': 'We\'re having trouble connecting. Check your internet and try again.',
  '503': 'We\'re temporarily offline for maintenance. We\'ll be back in about 30 minutes.',
  'timeout': 'The request took too long. Check your connection and try again.',
  'network_error': 'No internet connection. Check your WiFi or data and try again.',
};
```

### 2.3 Error Message Component Pattern

```typescript
interface ErrorMessageProps {
  error?: {
    code: string;
    message: string;
    action?: string;
  };
  onRetry?: () => void;
}

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  if (!error) return null;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      {/* Error icon + title */}
      <div className="flex gap-3">
        <div className="text-red-600">⚠️</div>
        <div className="flex-1">
          {/* Main message */}
          <p className="font-semibold text-red-900">{error.message}</p>

          {/* Helpful context */}
          {error.action && (
            <p className="mt-1 text-sm text-red-700">{error.action}</p>
          )}

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Try Again
              </button>
            )}
            <a
              href="/help"
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              Get Help
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## III. Empty States

### 3.1 Empty State Hierarchy

**1. Icon/Illustration** (visual indication)
**2. Headline** (what's missing, not "No data")
**3. Subheadline** (why it's empty, what to do)
**4. Primary Action** (how to fill it)
**5. Secondary Action** (alternative)

```typescript
export function EmptyOrdersState() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      {/* Icon */}
      <div className="mb-4 text-5xl">📦</div>

      {/* Headline */}
      <h2 className="text-xl font-semibold text-gray-900">
        No orders yet
      </h2>

      {/* Subheadline */}
      <p className="mt-2 text-center text-gray-600">
        Start exploring and place your first order
      </p>

      {/* Primary Action */}
      <button className="mt-6 bg-blue-600 px-6 py-2 text-white">
        Browse Products
      </button>

      {/* Secondary Action */}
      <a href="/help" className="mt-3 text-sm text-blue-600 hover:underline">
        Learn more about our products
      </a>
    </div>
  );
}
```

### 3.2 Empty State Variations

**First-Run Empty State (onboarding):**
```
Icon: 👋
Headline: "Welcome to Dashboard"
Subheadline: "Create your first dashboard to get started"
Action: "Create Dashboard"
```

**Search Empty State (no results):**
```
Icon: 🔍
Headline: "No results for 'xyz'"
Subheadline: "Try different keywords or filters"
Action: "Clear Search"
Secondary: "Browse Popular"
```

**Error Empty State (failed to load):**
```
Icon: ⚠️
Headline: "Unable to load data"
Subheadline: "Check your connection and try again"
Action: "Retry"
Secondary: "Contact Support"
```

**Permission Empty State (blocked):**
```
Icon: 🔒
Headline: "Access Restricted"
Subheadline: "You don't have permission to view this"
Action: "Request Access"
Secondary: "Learn About Permissions"
```

---

## IV. Onboarding Flows

### 4.1 Welcome Sequence

```typescript
// Step 1: Welcome
export function WelcomeStep() {
  return (
    <div className="text-center">
      <h1 className="text-3xl font-bold">Welcome to Acme!</h1>
      <p className="mt-4 text-lg text-gray-600">
        Let's set up your account in 5 minutes
      </p>
      <button className="mt-8 bg-blue-600 px-8 py-3 text-white">
        Get Started
      </button>
    </div>
  );
}

// Step 2: Profile Setup
export function ProfileStep() {
  return (
    <form>
      <h2 className="text-2xl font-semibold">Tell us about yourself</h2>
      <p className="mt-2 text-gray-600">
        We'll customize your experience based on this info
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label>What's your name?</label>
          <input placeholder="First and last name" />
        </div>

        <div>
          <label>What's your role?</label>
          <select>
            <option>Choose your role...</option>
            <option>Designer</option>
            <option>Developer</option>
          </select>
        </div>
      </div>
    </form>
  );
}

// Step 3: Confirmation
export function ConfirmationStep() {
  return (
    <div className="text-center">
      <div className="mb-4 text-5xl">✨</div>
      <h2 className="text-2xl font-semibold">You're all set!</h2>
      <p className="mt-2 text-gray-600">
        Your account is ready. Let's explore the dashboard
      </p>
      <button className="mt-6 bg-blue-600 px-8 py-3 text-white">
        Go to Dashboard
      </button>
    </div>
  );
}
```

### 4.2 Progressive Disclosure Onboarding

Show features incrementally, not all at once:

```typescript
export function Feature({ title, description, completed, onClick }) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg border-2 border-gray-200 p-4 transition-all hover:border-blue-500"
    >
      {/* Checkmark when completed */}
      {completed && <span className="text-xl">✓</span>}

      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{description}</p>

      {/* Helpful tip for incomplete feature */}
      {!completed && (
        <p className="mt-2 text-xs text-blue-600">
          💡 Try this next →
        </p>
      )}
    </div>
  );
}
```

---

## V. Button Labels and CTAs

### 5.1 Primary Action Labels

**Be Specific About What Happens:**
```
✗ Bad: "Submit", "OK", "Continue"
✓ Good: "Create Account", "Save Changes", "Next: Payment"

✗ Bad: "Click Here"
✓ Good: "Download Invoice", "Schedule Demo"
```

**Verb-Noun Pattern:**
```
Create + Order
Save + Draft
Upload + File
Schedule + Meeting
Delete + Account
Invite + Collaborators
Apply + Filters
Share + Document
```

### 5.2 Destructive Actions

Always warn before destructive actions:

```typescript
export function DeleteButton() {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return confirmDelete ? (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="font-semibold text-red-900">
        Delete this account? This cannot be undone.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleDelete}
          className="bg-red-600 px-4 py-2 text-white"
        >
          Yes, Delete
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          className="bg-gray-200 px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => setConfirmDelete(true)}
      className="text-red-600 hover:text-red-700"
    >
      Delete Account
    </button>
  );
}
```

### 5.3 Secondary Action Labels

```typescript
// Save Pattern
<button className="bg-blue-600">Save Changes</button>
<button className="bg-gray-200">Discard</button>

// Delete Pattern
<button className="bg-red-600">Delete</button>
<button className="bg-gray-200">Keep</button>

// Form Pattern
<button className="bg-blue-600">Submit Application</button>
<button className="bg-gray-200">Save as Draft</button>
```

---

## VI. Tooltips and Help Text

### 6.1 Tooltip Patterns

```typescript
interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </div>

      {visible && (
        <div className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white">
          {content}
          {/* Arrow pointer */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

// Usage
<Tooltip content="Max 5 teammates. Upgrade for more.">
  <button>Invite Teammate</button>
</Tooltip>
```

### 6.2 Help Text (Form Labels)

Help text explains what the field is for and why:

```typescript
export function FormField() {
  return (
    <div>
      <label htmlFor="domain">Custom Domain</label>

      {/* Help text: why it's needed, what format */}
      <p className="mt-1 text-sm text-gray-600">
        Your unique subdomain for this workspace (e.g., acme.myapp.com)
      </p>

      <input
        id="domain"
        placeholder="your-workspace"
        aria-describedby="domain-help"
      />

      {/* Inline validation/feedback */}
      <p id="domain-help" className="mt-1 text-xs text-gray-500">
        3-20 characters, lowercase letters and hyphens only
      </p>
    </div>
  );
}
```

### 6.3 Progressive Help

```typescript
export function FieldWithHint() {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div>
      <label>API Rate Limit</label>

      {/* Basic hint */}
      <p className="text-sm text-gray-600">
        Max requests per minute
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="ml-1 text-blue-600 hover:underline"
        >
          {showDetails ? 'Hide' : 'Show'} details
        </button>
      </p>

      {/* Progressive disclosure */}
      {showDetails && (
        <div className="mt-2 rounded bg-blue-50 p-3 text-sm text-blue-900">
          Free plan: 100 req/min. Pro plan: 1000 req/min.
          Burst traffic up to 2x limit is allowed.
        </div>
      )}

      <input type="number" defaultValue={100} />
    </div>
  );
}
```

---

## VII. Form Labels and Validation Messages

### 7.1 Label Guidelines

**Use Clear, Descriptive Labels:**
```
✗ Bad: "Date"
✓ Good: "Birth Date"

✗ Bad: "Billing"
✓ Good: "Billing Address"

✗ Bad: "Promo"
✓ Good: "Discount Code (optional)"
```

**Indicate Optional vs Required:**
```typescript
export function FormWithLabels() {
  return (
    <>
      {/* Required (most are required, mark the optional ones) */}
      <label>Email Address</label>
      <input required aria-required="true" />

      {/* Optional (explicitly mark) */}
      <label>Company Name <span className="text-gray-500">(optional)</span></label>
      <input />

      {/* Or: Required (mark all required) */}
      <label>
        Email Address
        <span className="text-red-600" aria-label="required"> *</span>
      </label>
    </>
  );
}
```

### 7.2 Real-Time Validation Messages

```typescript
export function PasswordField() {
  const [password, setPassword] = useState('');

  const requirements = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*]/.test(password),
  };

  return (
    <div>
      <label>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-describedby="password-requirements"
      />

      {/* Real-time feedback */}
      <div id="password-requirements" className="mt-3 space-y-2 text-sm">
        <div className={requirements.length ? 'text-green-600' : 'text-gray-500'}>
          ✓ At least 12 characters
        </div>
        <div className={requirements.uppercase ? 'text-green-600' : 'text-gray-500'}>
          ✓ One uppercase letter
        </div>
        <div className={requirements.number ? 'text-green-600' : 'text-gray-500'}>
          ✓ One number
        </div>
        <div className={requirements.special ? 'text-green-600' : 'text-gray-500'}>
          ✓ One special character (!@#$%^&*)
        </div>
      </div>
    </div>
  );
}
```

### 7.3 Error Message Placement

```typescript
export function FormWithInlineErrors({ onSubmit }) {
  const [errors, setErrors] = useState({});

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      // Validate and set errors
    }}>
      <div className="space-y-4">
        {/* Input + error together */}
        <div>
          <label>Email</label>
          <input
            type="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {/* Error appears directly below */}
          {errors.email && (
            <p id="email-error" className="mt-1 text-sm text-red-600">
              {errors.email}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
```

---

## VIII. Notification Copy

### 8.1 In-App Notifications

```typescript
interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

export function Notification({
  type,
  title,
  message,
  action,
}: NotificationProps) {
  const icons = {
    success: '✓',
    error: '⚠️',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const colors = {
    success: 'bg-green-50 text-green-900 border-green-200',
    error: 'bg-red-50 text-red-900 border-red-200',
    warning: 'bg-yellow-50 text-yellow-900 border-yellow-200',
    info: 'bg-blue-50 text-blue-900 border-blue-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[type]}`}>
      <div className="flex gap-3">
        <span className="text-lg">{icons[type]}</span>
        <div className="flex-1">
          <p className="font-semibold">{title}</p>
          {message && <p className="mt-1 text-sm">{message}</p>}
          {action && (
            <button
              onClick={action.onClick}
              className="mt-2 text-sm font-medium underline"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 8.2 Toast Notifications (Transient)

```typescript
// Success notifications (auto-dismiss after 3-5 seconds)
<Notification
  type="success"
  title="Changes saved"
  message="Your settings have been updated"
  // No action button needed - user doesn't need to do anything
/>

// Error notifications (persist - user should take action)
<Notification
  type="error"
  title="Unable to save"
  message="Check your connection and try again"
  action={{ label: 'Retry', onClick: handleSave }}
/>

// Info notifications (educational)
<Notification
  type="info"
  title="New feature"
  message="You can now bulk edit items"
  action={{ label: 'Learn more', onClick: () => openTutorial() }}
/>
```

---

## IX. Loading States

### 9.1 Loading Messages

```typescript
// Generic loading (user is waiting, reassure them)
export function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin text-2xl">⏳</div>
      <p>Loading your data...</p>
      <p className="text-xs text-gray-500">This usually takes 5-10 seconds</p>
    </div>
  );
}

// Specific loading messages (build confidence)
export function DetailedLoading() {
  const [step, setStep] = useState('connecting');

  const messages = {
    connecting: 'Connecting to server...',
    fetching: 'Fetching your data...',
    processing: 'Processing...',
    finalizing: 'Almost done...',
  };

  return (
    <div className="space-y-2">
      <div className="animate-spin">⏳</div>
      <p>{messages[step]}</p>
    </div>
  );
}

// Progress indication (when duration is long)
export function ProgressLoading({ progress, eta }) {
  return (
    <div>
      <p>Uploading: {progress}%</p>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      {eta && <p className="text-xs text-gray-500">~{eta} remaining</p>}
    </div>
  );
}
```

---

## X. 404 and Error Pages

### 10.1 404 Page

```typescript
export function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center text-center">
      <h1 className="text-6xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-xl text-gray-600">Page not found</p>

      {/* Context-aware message */}
      <p className="mt-4 text-gray-600">
        The page you're looking for might have been removed or doesn't exist
      </p>

      {/* Suggested next steps */}
      <div className="mt-8 space-y-2">
        <a href="/" className="block text-blue-600 hover:underline">
          Go to homepage
        </a>
        <a href="/sitemap" className="block text-blue-600 hover:underline">
          Browse sitemap
        </a>
        <a href="/contact" className="block text-blue-600 hover:underline">
          Contact support
        </a>
      </div>
    </div>
  );
}
```

### 10.2 Maintenance Page

```typescript
export function MaintenancePage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center text-center">
      <div className="mb-4 text-5xl">🔧</div>
      <h1 className="text-2xl font-bold">We're under maintenance</h1>

      {/* Clear timeline */}
      <p className="mt-4 text-gray-600">
        We're currently updating our systems. We expect to be back by 2 PM EST.
      </p>

      {/* What to do */}
      <div className="mt-6 space-y-2">
        <p className="text-sm text-gray-500">
          💌 We'll email you when we're back online
        </p>
        <p className="text-sm text-gray-500">
          💬 Questions? <a href="mailto:support@acme.com" className="text-blue-600">Contact support</a>
        </p>
      </div>
    </div>
  );
}
```

---

## XI. Voice and Tone Guidelines

### 11.1 Tone Spectrum

**Formal (Enterprise/Finance)**
```
"We are unable to process your request at this time.
Please contact our support team for assistance."
```

**Friendly (Consumer/Social)**
```
"Oops! Something went a bit sideways.
Give it another shot or reach out to us!"
```

**Knowledgeable (Technical/Developer)**
```
"API rate limit exceeded (429 Too Many Requests).
Retry after 60 seconds. See docs for backoff strategy."
```

### 11.2 Tone Characteristics

**Voice (consistent identity):**
- Helpful, not condescending
- Honest, not misleading
- Direct, not vague
- Human, not corporate

**Common Tone Misses:**
```
✗ Condescending: "Unfortunately, you've made an error"
✓ Helpful: "That password is too short. Try at least 12 characters"

✗ Vague: "Invalid format"
✓ Direct: "Phone numbers must be in format 123-456-7890"

✗ Corporate: "The system regrets to inform you..."
✓ Human: "We couldn't process that. Here's what to do..."
```

### 11.3 Tone Guide Template

```
Company: [Your Company]
Voice Attributes: [Helpful, direct, honest, friendly]

FORMAL SITUATION
Content: [Error in payment processing]
Tone: Professional, empathetic
Example: "Your payment wasn't processed. Your card hasn't been charged.
Please update your payment method or contact support."

FRIENDLY SITUATION
Content: [Empty state - no data]
Tone: Encouraging, light
Example: "Nothing here yet! Create your first [item] to get started."

TECHNICAL SITUATION
Content: [API error]
Tone: Clear, precise
Example: "Rate limit exceeded (429). Retry after 30 seconds."
```

---

## XII. Copy Writing Checklist

- [ ] Error messages include: what happened, why, what to do next
- [ ] All CTA buttons use verb-noun pattern (specific, not "Click Here")
- [ ] Empty states have: icon, headline, subheading, primary action
- [ ] Form labels are descriptive and indicate required vs optional
- [ ] Validation messages match field requirements (real-time feedback)
- [ ] Help text explains why the field is needed
- [ ] Destructive actions require confirmation
- [ ] Loading messages reassure user (not generic "Loading...")
- [ ] Notifications have clear titles and actions
- [ ] Tooltips provide context without overwhelming
- [ ] 404/error pages suggest next steps
- [ ] Voice and tone consistent across product
- [ ] No jargon or technical terms visible to users
- [ ] Active voice, second person perspective
- [ ] Concise (no "at this point in time")
- [ ] Positive framing when possible

---

## XIII. Quick Reference: Common Phrases

**Errors:**
```
"[X] is required"
"[X] must be at least [N] characters"
"[X] already exists"
"Unable to [action]. [Solution]."
```

**Empty States:**
```
"No [item] yet"
"Get started by [action]"
"Try [suggestion] to populate this"
```

**Loading:**
```
"Loading..."
"Almost done..."
"Setting up your account..."
```

**Success:**
```
"[X] created successfully"
"Changes saved"
"All set!"
"You're good to go"
```

**Destructive:**
```
"Delete [X]? This cannot be undone."
"Are you sure? This will [consequence]."
```

This guide provides production-ready patterns for writing effective, human-centered microcopy across web and mobile applications.
