# Content Quality & Validation

## 1. Markdown Linting with Markdownlint

### Configuration & Rules

```yaml
# .markdownlint.yaml
default: true
MD003:
  style: consistent

MD004:
  style: consistent

MD007:
  indent: 2

MD013:
  line_length: 100
  heading_line_length: 100
  code_line_length: 100
  code_blocks: false
  tables: false

MD024:
  siblings_only: true

MD033:
  allowed_html:
    - iframe
    - br

MD034: false  # Allow bare URLs

MD035:
  style: consistent

MD051: false  # HTML in markdown
```

### Markdownlint Implementation

```python
import subprocess
import json
import re
from typing import List, Dict

class MarkdownValidator:
    """Validate markdown files against linting rules"""

    def __init__(self, config_path: str = '.markdownlint.yaml'):
        self.config = config_path

    def lint_file(self, file_path: str) -> Dict:
        """Lint single markdown file"""

        result = subprocess.run(
            ['markdownlint', '--config', self.config, file_path],
            capture_output=True,
            text=True
        )

        issues = []
        for line in result.stdout.split('\n'):
            if line.strip():
                # Parse: file.md: 5: MD001 Heading levels should only increase by one level
                match = re.match(r'(.+?): (\d+): (MD\d+) (.+)', line)
                if match:
                    issues.append({
                        'line': int(match.group(2)),
                        'rule': match.group(3),
                        'message': match.group(4),
                        'severity': 'error' if 'error' in result.stderr.lower() else 'warning'
                    })

        return {
            'file': file_path,
            'valid': result.returncode == 0,
            'issues': issues,
            'count': len(issues)
        }

    def lint_directory(self, directory: str) -> List[Dict]:
        """Lint all markdown files in directory"""

        result = subprocess.run(
            ['markdownlint', '--config', self.config, f'{directory}/**/*.md'],
            capture_output=True,
            text=True,
            shell=True
        )

        return [self.lint_file(f) for f in subprocess.check_output(
            f'find {directory} -name "*.md" -type f', shell=True
        ).decode().split('\n') if f]

    def auto_fix(self, file_path: str) -> bool:
        """Auto-fix markdown issues"""

        result = subprocess.run(
            ['markdownlint-fix', '--config', self.config, file_path],
            capture_output=True
        )

        return result.returncode == 0


# Usage in CI/CD
validator = MarkdownValidator()
issues = validator.lint_file('docs/getting-started.md')

if not issues['valid']:
    print(f"Found {issues['count']} issues")
    for issue in issues['issues']:
        print(f"  Line {issue['line']}: {issue['rule']} - {issue['message']}")
```

### Markdown Quality Rules

```markdown
# ✓ Good Markdown

## Proper Heading Hierarchy
Content here...

### Section 1
Details...

## Another Section
More content...

---

## ✓ Code Blocks Properly Fenced
\`\`\`python
def hello():
    print("world")
\`\`\`

---

## ✓ Consistent Link Format
[Link Text](https://example.com)
[Reference Link][1]

[1]: https://example.com

---

## ✗ Bad Patterns to Avoid

# Heading
## Skipped to H3 (should be H2)
### This violates hierarchy

Missing blank line before code block:
\`\`\`python
code here
\`\`\`

Line too long: Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua (>100 chars)

Multiple spaces  for  indentation
```

---

## 2. HTML Validation & Accessibility

### HTML Structure Validation

```python
from html.parser import HTMLParser
from typing import List, Dict
import re

class HTMLAccessibilityValidator:
    """Validate HTML for accessibility and structure"""

    def __init__(self):
        self.issues = []
        self.headings = []
        self.images = []

    def validate_html_file(self, file_path: str) -> Dict:
        """Comprehensive HTML validation"""

        with open(file_path, 'r', encoding='utf-8') as f:
            html_content = f.read()

        issues = []

        # Check 1: Valid HTML structure
        issues.extend(self._check_html_structure(html_content))

        # Check 2: Heading hierarchy
        issues.extend(self._check_heading_hierarchy(html_content))

        # Check 3: Image alt text
        issues.extend(self._check_image_alt_text(html_content))

        # Check 4: Form labels
        issues.extend(self._check_form_labels(html_content))

        # Check 5: Color contrast (WCAG AA)
        issues.extend(self._check_color_contrast(html_content))

        # Check 6: Semantic HTML
        issues.extend(self._check_semantic_html(html_content))

        return {
            'file': file_path,
            'valid': len(issues) == 0,
            'issues': issues,
            'accessibility_score': self._calculate_a11y_score(issues)
        }

    def _check_html_structure(self, html: str) -> List[Dict]:
        """Validate basic HTML structure"""
        issues = []

        # Check for DOCTYPE
        if not re.search(r'<!DOCTYPE\s+html>', html, re.IGNORECASE):
            issues.append({
                'type': 'structure',
                'severity': 'error',
                'message': 'Missing DOCTYPE declaration'
            })

        # Check for lang attribute
        if not re.search(r'<html[^>]*\slang=', html):
            issues.append({
                'type': 'structure',
                'severity': 'warning',
                'message': 'Missing lang attribute on <html>'
            })

        # Check for valid nesting
        if html.count('<main>') > 1:
            issues.append({
                'type': 'structure',
                'severity': 'error',
                'message': 'Multiple <main> elements (should be one)'
            })

        return issues

    def _check_heading_hierarchy(self, html: str) -> List[Dict]:
        """Ensure proper heading hierarchy H1→H2→H3"""
        issues = []

        heading_pattern = r'<h([1-6])[^>]*>'
        headings = [(int(m.group(1)), m.start()) for m in re.finditer(heading_pattern, html)]

        if not headings:
            issues.append({
                'type': 'accessibility',
                'severity': 'error',
                'message': 'No headings found in document'
            })
            return issues

        # First heading should be H1
        if headings[0][0] != 1:
            issues.append({
                'type': 'accessibility',
                'severity': 'error',
                'message': f"First heading should be <h1>, found <h{headings[0][0]}>"
            })

        # Check for hierarchy breaks
        for i in range(1, len(headings)):
            curr_level = headings[i][0]
            prev_level = headings[i-1][0]

            if curr_level > prev_level + 1:
                issues.append({
                    'type': 'accessibility',
                    'severity': 'warning',
                    'message': f"Heading hierarchy broken: <h{prev_level}> → <h{curr_level}>"
                })

        return issues

    def _check_image_alt_text(self, html: str) -> List[Dict]:
        """Ensure all images have alt text"""
        issues = []

        img_pattern = r'<img[^>]*>'
        images = re.finditer(img_pattern, html)

        for img_tag in images:
            if 'alt=' not in img_tag.group(0):
                issues.append({
                    'type': 'accessibility',
                    'severity': 'error',
                    'message': f"Image missing alt text: {img_tag.group(0)[:50]}..."
                })
            else:
                # Check alt text is descriptive (not just "image")
                alt_match = re.search(r'alt=["\']([^"\']*)["\']', img_tag.group(0))
                if alt_match:
                    alt_text = alt_match.group(1)
                    if alt_text.lower() in ['image', 'photo', 'picture', '']:
                        issues.append({
                            'type': 'accessibility',
                            'severity': 'warning',
                            'message': f"Alt text not descriptive: '{alt_text}'"
                        })

        return issues

    def _check_form_labels(self, html: str) -> List[Dict]:
        """Ensure form inputs have associated labels"""
        issues = []

        # Find all inputs
        input_pattern = r'<input[^>]*(?:type=["\']?(text|email|password|number)["\']?)?[^>]*>'
        inputs = re.finditer(input_pattern, html)

        for input_tag in inputs:
            input_id = re.search(r'id=["\']([^"\']+)["\']', input_tag.group(0))

            if input_id:
                # Check if label exists
                label_pattern = f'<label[^>]*for=["\']?{input_id.group(1)}["\']?'
                if not re.search(label_pattern, html):
                    issues.append({
                        'type': 'accessibility',
                        'severity': 'error',
                        'message': f"Input #{input_id.group(1)} missing associated <label>"
                    })

        return issues

    def _check_color_contrast(self, html: str) -> List[Dict]:
        """Basic color contrast check (requires parsing CSS)"""
        # Simplified check - real implementation would parse CSS
        issues = []

        # Flag inline styles with potential contrast issues
        if re.search(r'color:\s*#fff.*background:\s*#fff', html):
            issues.append({
                'type': 'accessibility',
                'severity': 'error',
                'message': 'Potential color contrast issue detected'
            })

        return issues

    def _check_semantic_html(self, html: str) -> List[Dict]:
        """Encourage semantic HTML usage"""
        issues = []

        # Prefer <button> over <div class="button">
        if re.search(r'<div[^>]*class=["\']?button', html):
            issues.append({
                'type': 'semantic',
                'severity': 'warning',
                'message': 'Use <button> element instead of <div class="button">'
            })

        # Prefer <nav> for navigation
        if re.search(r'<div[^>]*class=["\']?nav', html) and '<nav>' not in html:
            issues.append({
                'type': 'semantic',
                'severity': 'warning',
                'message': 'Use <nav> element for navigation sections'
            })

        return issues

    def _calculate_a11y_score(self, issues: List[Dict]) -> int:
        """Calculate accessibility score 0-100"""
        error_count = sum(1 for i in issues if i['severity'] == 'error')
        warning_count = sum(1 for i in issues if i['severity'] == 'warning')

        score = 100 - (error_count * 10) - (warning_count * 2)
        return max(0, score)
```

---

## 3. SEO Content Validation

### SEO Checker Implementation

```python
import re
from typing import Dict, List
from urllib.parse import urlparse

class SEOValidator:
    """Validate content for SEO best practices"""

    def validate_seo(self, html_content: str, url: str) -> Dict:
        """Comprehensive SEO validation"""

        issues = {
            'errors': [],
            'warnings': [],
            'score': 100
        }

        # Title tag
        title_match = re.search(r'<title>([^<]+)</title>', html_content)
        if not title_match:
            issues['errors'].append('Missing <title> tag')
            issues['score'] -= 10
        else:
            title = title_match.group(1)
            if len(title) < 30:
                issues['warnings'].append(f'Title too short ({len(title)} chars), aim for 50-60')
            elif len(title) > 60:
                issues['warnings'].append(f'Title too long ({len(title)} chars), aim for 50-60')

        # Meta description
        meta_desc = re.search(r'<meta\s+name="description"\s+content="([^"]+)"', html_content)
        if not meta_desc:
            issues['errors'].append('Missing meta description')
            issues['score'] -= 10
        else:
            desc = meta_desc.group(1)
            if len(desc) < 120:
                issues['warnings'].append(f'Meta description too short ({len(desc)} chars)')
            elif len(desc) > 160:
                issues['warnings'].append(f'Meta description too long ({len(desc)} chars)')

        # H1 tag
        h1_count = len(re.findall(r'<h1[^>]*>', html_content))
        if h1_count == 0:
            issues['errors'].append('Missing H1 heading')
            issues['score'] -= 10
        elif h1_count > 1:
            issues['warnings'].append(f'Multiple H1 tags ({h1_count}), should have only one')

        # Structured data (Schema.org)
        if not re.search(r'<script[^>]*type="application/ld\+json"', html_content):
            issues['warnings'].append('No structured data (JSON-LD) found')

        # Open Graph tags
        og_tags = re.findall(r'<meta\s+property="og:([^"]+)"', html_content)
        if not og_tags:
            issues['warnings'].append('Missing Open Graph meta tags')

        # Canonical link
        if not re.search(r'<link\s+rel="canonical"', html_content):
            issues['warnings'].append('Missing canonical link')

        # Mobile friendly check (meta viewport)
        if not re.search(r'<meta\s+name="viewport"', html_content):
            issues['errors'].append('Missing viewport meta tag (mobile-unfriendly)')
            issues['score'] -= 10

        # Keyword density
        body_match = re.search(r'<body[^>]*>(.*)</body>', html_content, re.DOTALL)
        if body_match:
            body_text = body_match.group(1)
            # Simple keyword extraction
            words = re.findall(r'\b\w+\b', body_text.lower())
            if words:
                # Check for keyword stuffing or insufficient keywords
                pass

        # URL structure
        parsed_url = urlparse(url)
        if not parsed_url.scheme:
            issues['warnings'].append('Invalid URL format')
        if '_' in parsed_url.path:
            issues['warnings'].append('URL contains underscores (use hyphens)')

        return issues


# Usage
seo_validator = SEOValidator()

with open('index.html', 'r') as f:
    html = f.read()

result = seo_validator.validate_seo(html, 'https://example.com/page')
print(f"SEO Score: {result['score']}/100")
print(f"Errors: {len(result['errors'])}")
print(f"Warnings: {len(result['warnings'])}")
```

### Structured Data Validation

```python
import json
import re

class StructuredDataValidator:
    """Validate JSON-LD structured data"""

    VALID_SCHEMAS = ['Article', 'Person', 'Product', 'Organization', 'Event']

    def extract_structured_data(self, html: str) -> List[Dict]:
        """Extract JSON-LD blocks from HTML"""

        pattern = r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>'
        matches = re.findall(pattern, html, re.DOTALL)

        structured_data = []
        for match in matches:
            try:
                data = json.loads(match)
                structured_data.append(data)
            except json.JSONDecodeError:
                pass

        return structured_data

    def validate_article_schema(self, schema: Dict) -> List[str]:
        """Validate Article schema fields"""
        issues = []

        required = ['headline', 'description', 'image', 'datePublished']
        for field in required:
            if field not in schema:
                issues.append(f"Missing required field: {field}")

        return issues

    def validate_product_schema(self, schema: Dict) -> List[str]:
        """Validate Product schema"""
        issues = []

        required = ['name', 'description', 'image', 'offers']
        for field in required:
            if field not in schema:
                issues.append(f"Missing required field: {field}")

        # Validate offers
        if 'offers' in schema:
            offers = schema['offers']
            if isinstance(offers, dict):
                offers = [offers]

            for offer in offers:
                if 'price' not in offer:
                    issues.append("Offer missing price")
                if 'priceCurrency' not in offer:
                    issues.append("Offer missing priceCurrency")

        return issues
```

---

## 4. Grammar & Spell Checking

### Grammar Checking with PyEnchant

```python
import enchant
from textblob import TextBlob
from typing import List, Dict

class GrammarChecker:
    """Check content for grammar and spelling"""

    def __init__(self, language: str = 'en_US'):
        self.spell_checker = enchant.Dict(language)
        self.language = language

    def check_spelling(self, text: str) -> List[Dict]:
        """Check for spelling errors"""
        issues = []

        words = text.split()
        for word in words:
            if not self.spell_checker.check(word):
                suggestions = self.spell_checker.suggest(word)
                issues.append({
                    'word': word,
                    'type': 'spelling',
                    'suggestions': suggestions[:3]  # Top 3
                })

        return issues

    def check_grammar(self, text: str) -> List[Dict]:
        """Check grammar using TextBlob"""
        issues = []

        blob = TextBlob(text)

        # Check sentence structure
        for sentence in blob.sentences:
            # Simple checks
            if sentence.words[0].lower() in ['and', 'or', 'but']:
                issues.append({
                    'sentence': str(sentence),
                    'type': 'grammar',
                    'message': 'Sentence starts with conjunction'
                })

        return issues

    def check_readability(self, text: str) -> Dict:
        """Calculate readability metrics"""
        from readability import Flesch, FleschKincaid

        # Flesch Reading Ease (0-100)
        # 90-100: Very Easy, 60-70: Standard, 0-30: Very Difficult
        flesch_score = Flesch(text)

        # Flesch-Kincaid Grade Level
        grade_level = FleschKincaid(text)

        return {
            'flesch_ease': flesch_score.score,
            'reading_ease': self._interpret_flesch(flesch_score.score),
            'grade_level': grade_level.score,
            'target_audience': self._interpret_grade_level(grade_level.score)
        }

    @staticmethod
    def _interpret_flesch(score: float) -> str:
        if score >= 90:
            return 'Very Easy'
        elif score >= 80:
            return 'Easy'
        elif score >= 70:
            return 'Fairly Easy'
        elif score >= 60:
            return 'Standard'
        elif score >= 50:
            return 'Fairly Difficult'
        elif score >= 30:
            return 'Difficult'
        else:
            return 'Very Difficult'

    @staticmethod
    def _interpret_grade_level(level: float) -> str:
        if level < 6:
            return 'Elementary'
        elif level < 9:
            return 'Middle School'
        elif level < 13:
            return 'High School'
        else:
            return 'College+'
```

---

## 5. Content Style Guide Enforcement

### Style Guide Validator

```python
import re
from typing import Dict, List

class StyleGuideValidator:
    """Enforce company/project style guide"""

    def __init__(self, style_config: Dict):
        self.config = style_config
        self.issues = []

    def validate_against_guide(self, text: str) -> List[Dict]:
        """Check content against style guide"""
        issues = []

        # Check 1: Tone & Voice
        if self.config.get('tone') == 'formal':
            # Flag contractions
            contractions = re.findall(r"\b(don't|can't|won't|isn't|aren't)\b", text, re.IGNORECASE)
            if contractions:
                issues.append({
                    'type': 'tone',
                    'message': f'Contractions not allowed in formal tone: {contractions}'
                })

        # Check 2: Terminology
        if 'preferred_terms' in self.config:
            for deprecated, preferred in self.config['preferred_terms'].items():
                if re.search(rf'\b{deprecated}\b', text, re.IGNORECASE):
                    issues.append({
                        'type': 'terminology',
                        'message': f'Use "{preferred}" instead of "{deprecated}"'
                    })

        # Check 3: Spacing & Punctuation
        # Double spaces
        if '  ' in text:
            issues.append({
                'type': 'formatting',
                'message': 'Multiple consecutive spaces found'
            })

        # Em dash vs hyphen
        if ' - ' in text and self.config.get('em_dash_style'):
            issues.append({
                'type': 'formatting',
                'message': 'Use em-dash (—) instead of hyphen (-)'
            })

        # Check 4: Numbers
        if self.config.get('number_style') == 'written':
            if re.search(r'\b[0-9]\b', text):
                issues.append({
                    'type': 'numbers',
                    'message': 'Write out single-digit numbers'
                })

        return issues


# Example style guide configuration
STYLE_GUIDE = {
    'tone': 'professional_friendly',
    'preferred_terms': {
        'utilize': 'use',
        'aforementioned': 'previous',
        'please note': 'note that',
    },
    'em_dash_style': True,
    'number_style': 'numeric',  # Use "5" not "five"
    'oxford_comma': True,
    'active_voice': True,
}
```

---

## 6. Translation-Ready Content

### Internationalization Patterns

```python
import re
from typing import List, Dict

class I18nValidator:
    """Ensure content is translation-ready"""

    def check_i18n_readiness(self, html: str, text: str) -> Dict:
        """Verify content can be easily translated"""
        issues = []

        # Check 1: Hardcoded text in HTML
        text_nodes = re.findall(r'>[^<]+<', html)
        hardcoded = [t for t in text_nodes if t.strip() and not re.match(r'>\s*<', t)]

        if hardcoded:
            issues.append({
                'type': 'i18n',
                'severity': 'error',
                'message': f'Found {len(hardcoded)} hardcoded text nodes. Use i18n keys.'
            })

        # Check 2: String concatenation
        if re.search(r'"\s*\+\s*variable|variable\s*\+\s*"', text):
            issues.append({
                'type': 'i18n',
                'severity': 'error',
                'message': 'String concatenation found. Use placeholders instead.'
            })

        # Check 3: HTML in translatable strings
        if re.search(r'<[^>]+>', text):
            issues.append({
                'type': 'i18n',
                'severity': 'warning',
                'message': 'HTML tags in translatable content. Consider extraction.'
            })

        # Check 4: Date/time formatting
        if re.search(r'\d{1,2}/\d{1,2}/\d{4}', text):
            issues.append({
                'type': 'i18n',
                'severity': 'warning',
                'message': 'Hardcoded date format. Use i18n date formatting.'
            })

        return {
            'i18n_ready': len(issues) == 0,
            'issues': issues,
            'recommendations': [
                'Use i18n key system (en.translations.home.title)',
                'Never concatenate translated strings',
                'Use formatting functions for numbers/dates/currency',
                'Keep strings short and context-rich',
                'Avoid idioms and cultural references'
            ]
        }
```

### Translation Key Management

```python
import json
from typing import Dict

class TranslationManager:
    """Manage translation keys and files"""

    def __init__(self, locale_dir: str = 'locales'):
        self.locale_dir = locale_dir

    def extract_keys_from_code(self, code: str) -> Dict[str, str]:
        """Extract i18n keys from code"""
        import ast

        keys = {}
        # Find calls like t('key'), i18n.t('key')
        pattern = r't\([\'"]([^\'\"]+)[\'\"](?:,\s*{([^}]*)})?'
        matches = re.findall(pattern, code)

        for match in matches:
            key = match[0]
            keys[key] = f"Extracted from code: {key}"

        return keys

    def validate_translation_completeness(self, language: str) -> Dict:
        """Check if all keys are translated"""

        with open(f'{self.locale_dir}/en.json', 'r') as f:
            english = json.load(f)

        with open(f'{self.locale_dir}/{language}.json', 'r') as f:
            target_lang = json.load(f)

        en_keys = set(self._flatten_keys(english))
        target_keys = set(self._flatten_keys(target_lang))

        missing = en_keys - target_keys
        extra = target_keys - en_keys

        return {
            'language': language,
            'complete': len(missing) == 0,
            'coverage': len(target_keys) / len(en_keys) * 100,
            'missing_keys': list(missing),
            'extra_keys': list(extra)
        }

    @staticmethod
    def _flatten_keys(obj: Dict, parent_key: str = '') -> List[str]:
        """Flatten nested translation keys"""
        items = []
        for k, v in obj.items():
            new_key = f"{parent_key}.{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(TranslationManager._flatten_keys(v, new_key))
            else:
                items.append(new_key)
        return items
```

---

## 7. CMS Content Type Validation

### Content Type Schema

```python
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime

class ArticleContentType(BaseModel):
    """Define Article content type schema"""

    title: str = Field(..., min_length=10, max_length=100)
    slug: str = Field(..., regex=r'^[a-z0-9-]+$')
    excerpt: str = Field(..., min_length=20, max_length=160)
    body: str = Field(..., min_length=100)
    featured_image: str = Field(...)
    featured_image_alt: str = Field(..., min_length=10)

    author: str
    category: str
    tags: List[str] = Field(min_items=1, max_items=5)

    published_at: datetime
    updated_at: Optional[datetime] = None

    meta_title: str = Field(min_length=30, max_length=60)
    meta_description: str = Field(min_length=120, max_length=160)

    @validator('slug')
    def slug_unique(cls, v):
        # Check database for uniqueness
        return v

    @validator('body')
    def validate_html(cls, v):
        # Validate HTML structure
        return v

    @validator('tags')
    def validate_tags_exist(cls, v):
        # Validate all tags exist in taxonomy
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Getting Started with Kubernetes",
                "slug": "getting-started-kubernetes",
                "excerpt": "Learn the basics of container orchestration",
                "body": "<p>Content here...</p>",
                "featured_image": "/images/k8s.jpg",
                "author": "John Doe",
            }
        }


# Usage
def validate_article(data: Dict) -> bool:
    """Validate article against schema"""
    try:
        article = ArticleContentType(**data)
        return True
    except ValueError as e:
        print(f"Validation error: {e}")
        return False
```

---

## Content Validation Pipeline

```yaml
# .github/workflows/content-validation.yml
name: Content Validation

on:
  pull_request:
    paths:
      - 'content/**'
      - 'docs/**'

jobs:
  validate-content:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Markdown Linting
        run: markdownlint content/ docs/

      - name: HTML Validation
        run: python scripts/validate_html.py

      - name: SEO Check
        run: python scripts/validate_seo.py

      - name: Spell Check
        run: python scripts/check_spelling.py

      - name: Accessibility Check
        run: python scripts/check_a11y.py

      - name: Grammar Check
        run: python scripts/check_grammar.py

      - name: i18n Readiness
        run: python scripts/check_i18n.py

      - name: Report Results
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            // Post validation results as PR comment
```

