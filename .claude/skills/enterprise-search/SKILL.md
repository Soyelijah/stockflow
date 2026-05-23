# Enterprise Search Skill

## Overview

Enterprise search requires careful index design, query parsing strategies, relevance tuning, and performance optimization. This skill covers industry-standard search engines and patterns for building production-grade search systems.

---

## Elasticsearch Search Architecture

### Index Design and Mapping

```javascript
// elasticsearch/searchIndexSetup.js
const { Client } = require('@elastic/elasticsearch');

const client = new Client({ node: 'http://localhost:9200' });

async function setupProductIndex() {
  // Create index with optimized mappings
  const indexConfig = {
    settings: {
      number_of_shards: 5,
      number_of_replicas: 1,
      analysis: {
        analyzer: {
          // Standard analyzer for most fields
          standard_analyzer: {
            type: 'standard',
            stopwords: '_english_'
          },
          // Edge-gram analyzer for auto-complete
          autocomplete: {
            type: 'custom',
            tokenizer: 'edge_gram_tokenizer',
            filter: ['lowercase']
          },
          // Custom analyzer for faceted search
          facet_analyzer: {
            type: 'keyword',
            tokenizer: 'keyword',
            filters: ['lowercase']
          }
        },
        tokenizer: {
          edge_gram_tokenizer: {
            type: 'edge_ngram',
            min_gram: 2,
            max_gram: 20,
            token_chars: ['letter', 'digit']
          }
        }
      }
    },
    mappings: {
      properties: {
        // Full-text searchable fields
        name: {
          type: 'text',
          fields: {
            keyword: { type: 'keyword' },
            suggest: { type: 'completion' }
          },
          analyzer: 'standard_analyzer',
          boost: 2.0 // Higher weight for product names
        },
        description: {
          type: 'text',
          analyzer: 'standard_analyzer'
        },
        content: {
          type: 'text',
          analyzer: 'standard_analyzer'
        },

        // Auto-complete field
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete',
          search_analyzer: 'standard_analyzer'
        },

        // Faceted search fields
        category: {
          type: 'keyword'
        },
        brand: {
          type: 'keyword'
        },
        tags: {
          type: 'keyword'
        },
        price: {
          type: 'float'
        },
        rating: {
          type: 'integer'
        },

        // Metadata
        id: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
        isActive: { type: 'boolean' },
        viewCount: { type: 'long' },

        // Geo-spatial
        location: { type: 'geo_point' }
      }
    }
  };

  try {
    await client.indices.create({
      index: 'products',
      body: indexConfig
    });
    console.log('Index created successfully');
  } catch (error) {
    console.log('Index already exists');
  }
}

async function indexDocuments(products) {
  const bulkOperations = [];

  for (const product of products) {
    bulkOperations.push({ index: { _index: 'products', _id: product.id } });
    bulkOperations.push({
      name: product.name,
      description: product.description,
      content: product.content,
      autocomplete: product.name, // For auto-complete
      category: product.category,
      brand: product.brand,
      tags: product.tags,
      price: product.price,
      rating: product.rating,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      isActive: product.isActive,
      viewCount: product.viewCount,
      location: product.location
    });
  }

  try {
    const result = await client.bulk({ body: bulkOperations });
    console.log(`Indexed ${result.items.length} documents`);
  } catch (error) {
    console.error('Bulk indexing error:', error);
  }
}

module.exports = { setupProductIndex, indexDocuments };
```

### Full-Text Search with Relevance Ranking

```javascript
// elasticsearch/searchQueries.js
class ProductSearcher {
  constructor(client) {
    this.client = client;
  }

  // Multi-field search with custom scoring
  async search(query, options = {}) {
    const {
      page = 1,
      pageSize = 20,
      filters = {},
      sortBy = '_score',
      boostRecency = false
    } = options;

    const must = [];
    const filter = [];
    const should = [];

    // Main multi-field query with boosting
    if (query) {
      should.push({
        match: {
          name: {
            query,
            boost: 3,
            operator: 'and'
          }
        }
      });

      should.push({
        match: {
          description: {
            query,
            boost: 2
          }
        }
      });

      should.push({
        match: {
          content: {
            query,
            boost: 1
          }
        }
      });

      // Fuzzy match for misspellings
      should.push({
        match: {
          name: {
            query,
            fuzziness: 'AUTO',
            boost: 0.5
          }
        }
      });
    }

    // Apply filters
    if (filters.category) {
      filter.push({ term: { category: filters.category } });
    }

    if (filters.brand) {
      filter.push({ term: { brand: filters.brand } });
    }

    if (filters.priceRange) {
      filter.push({
        range: {
          price: {
            gte: filters.priceRange.min,
            lte: filters.priceRange.max
          }
        }
      });
    }

    if (filters.minRating) {
      filter.push({
        range: { rating: { gte: filters.minRating } }
      });
    }

    if (filters.tags) {
      filter.push({
        terms: { tags: filters.tags }
      });
    }

    // Only active products
    filter.push({ term: { isActive: true } });

    // Build score calculation
    let scriptScore = null;
    if (boostRecency) {
      scriptScore = {
        script: {
          source: "_score * Math.log(2 + doc['viewCount'].value)",
          lang: 'painless'
        }
      };
    }

    const searchBody = {
      query: {
        function_score: {
          query: {
            bool: {
              must: must.length > 0 ? must : [{ match_all: {} }],
              should: should,
              filter: filter,
              minimum_should_match: should.length > 0 ? 1 : 0
            }
          },
          functions: [
            // Boost higher rated products
            {
              filter: { range: { rating: { gte: 4 } } },
              weight: 1.2
            },
            // Boost recently updated
            {
              filter: {
                range: {
                  updatedAt: {
                    gte: 'now-30d'
                  }
                }
              },
              weight: 1.1
            }
          ],
          score_mode: 'sum',
          boost_mode: 'multiply'
        }
      },
      from: (page - 1) * pageSize,
      size: pageSize,
      sort: [
        { _score: { order: 'desc' } },
        { viewCount: { order: 'desc' } },
        { updatedAt: { order: 'desc' } }
      ],
      highlight: {
        fields: {
          name: {},
          description: {},
          content: {}
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>']
      }
    };

    try {
      const result = await this.client.search({
        index: 'products',
        body: searchBody
      });

      return {
        total: result.hits.total.value,
        page,
        pageSize,
        results: result.hits.hits.map(hit => ({
          ...hit._source,
          _score: hit._score,
          _highlight: hit.highlight
        }))
      };
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  // Faceted search aggregations
  async getFacets(query, filters = {}) {
    const searchBody = {
      query: {
        bool: {
          must: query ? [{ multi_match: { query } }] : [{ match_all: {} }],
          filter: this.buildFilters(filters)
        }
      },
      aggs: {
        categories: {
          terms: { field: 'category', size: 20 }
        },
        brands: {
          terms: { field: 'brand', size: 50 }
        },
        priceRange: {
          range: {
            field: 'price',
            ranges: [
              { to: 50 },
              { from: 50, to: 100 },
              { from: 100, to: 500 },
              { from: 500 }
            ]
          }
        },
        rating: {
          range: {
            field: 'rating',
            ranges: [
              { from: 4 },
              { from: 3, to: 4 },
              { from: 2, to: 3 }
            ]
          }
        }
      },
      size: 0
    };

    const result = await this.client.search({
      index: 'products',
      body: searchBody
    });

    return {
      categories: result.aggregations.categories.buckets,
      brands: result.aggregations.brands.buckets,
      priceRanges: result.aggregations.priceRange.buckets,
      ratings: result.aggregations.rating.buckets
    };
  }

  buildFilters(filters) {
    const filterClauses = [];

    if (filters.category) {
      filterClauses.push({ term: { category: filters.category } });
    }
    if (filters.minPrice || filters.maxPrice) {
      const range = {};
      if (filters.minPrice) range.gte = filters.minPrice;
      if (filters.maxPrice) range.lte = filters.maxPrice;
      filterClauses.push({ range: { price: range } });
    }

    return filterClauses;
  }
}

module.exports = ProductSearcher;
```

### Auto-Complete with Completion Suggester

```javascript
// elasticsearch/autoComplete.js
class AutoCompleteService {
  constructor(client) {
    this.client = client;
  }

  // Index setup for completion suggester
  async setupCompletionField() {
    const updateMapping = {
      mappings: {
        properties: {
          productSuggest: {
            type: 'completion',
            analyzer: 'simple',
            search_analyzer: 'simple',
            preserve_separators: true,
            preserve_position_increments: true
          }
        }
      }
    };

    await this.client.indices.putMapping({
      index: 'products',
      body: updateMapping
    });
  }

  // Get suggestions
  async getSuggestions(prefix, category = null, limit = 10) {
    const suggestionQuery = {
      productSuggest: {
        prefix: prefix,
        completion: {
          size: limit,
          fuzzy: {
            fuzziness: 'AUTO'
          }
        }
      }
    };

    const searchBody = {
      suggest: suggestionQuery
    };

    // If category filter, add it
    if (category) {
      searchBody.query = {
        term: { category: category }
      };
    }

    try {
      const result = await this.client.search({
        index: 'products',
        body: searchBody
      });

      return result.suggest.productSuggest[0].options.map(option => ({
        text: option.text,
        score: option._score
      }));
    } catch (error) {
      console.error('Suggestion error:', error);
      return [];
    }
  }

  // Popular searches (based on analytics)
  async getPopularSearches(limit = 10) {
    // This would use a separate analytics index
    const searchBody = {
      aggs: {
        popular_searches: {
          terms: {
            field: 'search_query.keyword',
            size: limit,
            order: { '_count': 'desc' }
          }
        }
      },
      size: 0
    };

    const result = await this.client.search({
      index: 'search_analytics',
      body: searchBody
    });

    return result.aggregations.popular_searches.buckets.map(b => ({
      query: b.key,
      frequency: b.doc_count
    }));
  }
}

module.exports = AutoCompleteService;
```

---

## Meilisearch Implementation

### Index Setup and Configuration

```javascript
// meilisearch/setup.js
const MeiliSearch = require('meilisearch');

const client = new MeiliSearch({
  host: 'http://localhost:7700',
  apiKey: 'masterKey'
});

async function setupMeilisearchIndex() {
  // Create index
  const index = await client.createIndex('products');

  // Configure searchable attributes
  await index.updateSearchableAttributes([
    'name',
    'description',
    'category',
    'brand',
    'tags'
  ]);

  // Configure filterable attributes
  await index.updateFilterableAttributes([
    'category',
    'brand',
    'price',
    'rating',
    'isActive',
    'createdAt'
  ]);

  // Configure sortable attributes
  await index.updateSortableAttributes([
    'price',
    'rating',
    'viewCount',
    'createdAt'
  ]);

  // Configure displayed attributes (what's returned)
  await index.updateDisplayedAttributes([
    'id',
    'name',
    'description',
    'category',
    'brand',
    'price',
    'rating'
  ]);

  // Configure ranking rules
  await index.updateRankingRules([
    'sort',
    'words',
    'typo',
    'proximity',
    'attribute',
    'exactness',
    'custom_rating:desc'
  ]);

  // Configure synonyms
  await index.updateSynonyms({
    'smart': ['intelligent', 'clever'],
    'phone': ['mobile', 'smartphone', 'cellular'],
    'beautiful': ['gorgeous', 'stunning', 'lovely']
  });
}

async function indexDocumentsMeilisearch(products) {
  const index = client.index('products');

  try {
    const response = await index.addDocuments(products, {
      primaryKey: 'id'
    });
    console.log(`Indexed ${response.enqueuedAt}`);
  } catch (error) {
    console.error('Indexing error:', error);
  }
}

module.exports = { setupMeilisearchIndex, indexDocumentsMeilisearch, client };
```

### Advanced Search with Meilisearch

```javascript
// meilisearch/search.js
class MeilisearchSearcher {
  constructor(client) {
    this.client = client;
  }

  async search(query, options = {}) {
    const {
      page = 1,
      pageSize = 20,
      filters = [],
      sort = [],
      attributesToRetrieve = null
    } = options;

    let filterString = '';
    if (filters.length > 0) {
      filterString = this.buildFilterString(filters);
    }

    const searchOptions = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      attributesToHighlight: ['name', 'description']
    };

    if (filterString) {
      searchOptions.filter = filterString;
    }

    if (sort && sort.length > 0) {
      searchOptions.sort = sort;
    }

    try {
      const index = this.client.index('products');
      const results = await index.search(query, searchOptions);

      return {
        total: results.estimatedTotalHits,
        page,
        pageSize,
        query: results.query,
        results: results.hits
      };
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  buildFilterString(filters) {
    // Meilisearch uses a custom filter syntax
    const conditions = [];

    for (const filter of filters) {
      if (filter.type === 'equals') {
        conditions.push(`${filter.field} = ${this.escapeFilter(filter.value)}`);
      } else if (filter.type === 'range') {
        if (filter.min !== undefined) {
          conditions.push(`${filter.field} >= ${filter.min}`);
        }
        if (filter.max !== undefined) {
          conditions.push(`${filter.field} <= ${filter.max}`);
        }
      } else if (filter.type === 'in') {
        const values = filter.values
          .map(v => this.escapeFilter(v))
          .join(', ');
        conditions.push(`${filter.field} IN [${values}]`);
      }
    }

    return conditions.join(' AND ');
  }

  escapeFilter(value) {
    if (typeof value === 'string') {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }

  // Faceted search
  async getFacets(query, filters = []) {
    const searchOptions = {
      facets: ['category', 'brand', 'price', 'rating']
    };

    if (filters.length > 0) {
      searchOptions.filter = this.buildFilterString(filters);
    }

    const index = this.client.index('products');
    const results = await index.search(query, searchOptions);

    return {
      facets: results.facetDistribution
    };
  }

  // Detailed query debugging
  async debugQuery(query) {
    const index = this.client.index('products');

    // Get cached key
    const key = await index.getRawSearch({
      q: query,
      attributesToRetrieve: ['id', 'name']
    });

    return {
      processingTimeMs: key.processingTimeMs,
      query: key.query
    };
  }
}

module.exports = MeilisearchSearcher;
```

---

## Typesense Implementation

### Setup and Configuration

```javascript
// typesense/setup.js
const Typesense = require('typesense');

const client = new Typesense.Client({
  nodes: [
    {
      host: 'localhost',
      port: 8108,
      protocol: 'http'
    }
  ],
  apiKey: 'xyz',
  connectionTimeoutSeconds: 2
});

async function setupTypesenseSchema() {
  const schema = {
    name: 'products',
    fields: [
      {
        name: 'id',
        type: 'string',
        facet: false
      },
      {
        name: 'name',
        type: 'string',
        facet: false,
        infix: true // Enable infix search
      },
      {
        name: 'description',
        type: 'string',
        facet: false
      },
      {
        name: 'category',
        type: 'string',
        facet: true
      },
      {
        name: 'brand',
        type: 'string',
        facet: true
      },
      {
        name: 'price',
        type: 'float',
        facet: true
      },
      {
        name: 'rating',
        type: 'int32',
        facet: true
      },
      {
        name: 'viewCount',
        type: 'int64',
        sort: true
      },
      {
        name: 'createdAt',
        type: 'int64',
        sort: true
      },
      {
        name: 'tags',
        type: 'string[]',
        facet: true
      }
    ],
    default_sorting_field: 'viewCount'
  };

  try {
    await client.collections('products').delete();
  } catch (error) {
    // Collection doesn't exist
  }

  const collection = await client.collections().create(schema);
  console.log('Collection created:', collection.name);
  return collection;
}

async function indexDocumentsTypesense(products) {
  const collection = client.collections('products');

  try {
    const response = await collection.documents().import(products);
    console.log(`Imported ${response.length} documents`);
  } catch (error) {
    console.error('Import error:', error);
  }
}

module.exports = { setupTypesenseSchema, indexDocumentsTypesense, client };
```

### Search Implementation

```javascript
// typesense/search.js
class TypesenseSearcher {
  constructor(client) {
    this.client = client;
  }

  async search(query, options = {}) {
    const {
      page = 1,
      pageSize = 20,
      filters = {},
      sortBy = '_text_match:desc'
    } = options;

    const searchParams = {
      q: query,
      query_by: 'name,description,category,brand,tags',
      page: page,
      per_page: pageSize,
      sort_by: sortBy,
      facet_by: 'category,brand,rating',
      max_facet_values: 20,
      highlight_full_fields: 'name,description',
      snippet_threshold: 30
    };

    // Build filter query
    if (Object.keys(filters).length > 0) {
      const filterConditions = [];

      if (filters.category) {
        filterConditions.push(`category:=${filters.category}`);
      }
      if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
        filterConditions.push(
          `price:[${filters.minPrice},${filters.maxPrice}]`
        );
      }
      if (filters.minRating) {
        filterConditions.push(`rating:>=${filters.minRating}`);
      }

      if (filterConditions.length > 0) {
        searchParams.filter_by = filterConditions.join(' && ');
      }
    }

    try {
      const results = await this.client
        .collections('products')
        .documents()
        .search(searchParams);

      return {
        total: results.found,
        page,
        pageSize,
        results: results.hits.map(hit => ({
          ...hit.document,
          highlight: hit.highlights,
          snippet: hit.snippet
        })),
        facets: results.facet_counts
      };
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  // Geo-spatial search
  async nearbySearch(query, latitude, longitude, radiusKm = 10) {
    const searchParams = {
      q: query,
      query_by: 'name,description',
      sort_by: `_geo(latitude, longitude, ${latitude}, ${longitude}):asc`
    };

    const results = await this.client
      .collections('products')
      .documents()
      .search(searchParams);

    return results.hits;
  }

  // Multi-field faceted search
  async getFacets(query) {
    const results = await this.client
      .collections('products')
      .documents()
      .search({
        q: query,
        facet_by: 'category,brand,rating,price',
        max_facet_values: 50
      });

    return {
      facets: results.facet_counts
    };
  }
}

module.exports = TypesenseSearcher;
```

---

## Query Parsing and Fuzzy Matching

### Advanced Query Parser

```javascript
// search/queryParser.js
class SearchQueryParser {
  parse(query) {
    const tokens = [];
    let current = '';
    let inQuotes = false;
    let inField = false;
    let field = '';

    for (let i = 0; i < query.length; i++) {
      const char = query[i];

      if (char === '"' && !inField) {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === ':' && !inQuotes && i > 0) {
        const precedingText = query.substring(
          Math.max(0, query.lastIndexOf(' ', i) + 1),
          i
        );
        if (/^[a-z_]+$/.test(precedingText)) {
          field = precedingText;
          inField = true;
          current = '';
          continue;
        }
      }

      if (char === ' ' && !inQuotes && current) {
        tokens.push(this.createToken(field, current));
        current = '';
        field = '';
        inField = false;
        continue;
      }

      current += char;
    }

    if (current) {
      tokens.push(this.createToken(field, current));
    }

    return this.normalizeTokens(tokens);
  }

  createToken(field, value) {
    const token = {
      value: value.toLowerCase(),
      field: field || null,
      type: 'term'
    };

    // Detect special operators
    if (value.startsWith('-')) {
      token.type = 'exclude';
      token.value = value.substring(1);
    } else if (value.includes('*')) {
      token.type = 'wildcard';
    }

    return token;
  }

  normalizeTokens(tokens) {
    const normalized = {
      must: [],
      should: [],
      must_not: [],
      fields: {}
    };

    for (const token of tokens) {
      if (token.type === 'exclude') {
        normalized.must_not.push(token);
      } else if (token.field) {
        if (!normalized.fields[token.field]) {
          normalized.fields[token.field] = [];
        }
        normalized.fields[token.field].push(token);
      } else {
        normalized.must.push(token);
      }
    }

    return normalized;
  }
}

module.exports = SearchQueryParser;
```

### Fuzzy Matching with Levenshtein Distance

```javascript
// search/fuzzyMatching.js
class FuzzyMatcher {
  levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  findMatches(query, candidates, threshold = 2) {
    return candidates
      .map(candidate => ({
        candidate,
        distance: this.levenshteinDistance(query, candidate),
        similarity: 1 - this.levenshteinDistance(query, candidate) / Math.max(query.length, candidate.length)
      }))
      .filter(match => match.distance <= threshold)
      .sort((a, b) => a.distance - b.distance);
  }

  phonetic(str) {
    // Soundex algorithm
    const firstLetter = str[0].toUpperCase();
    let encoded = firstLetter;
    let lastCode = this.soundexCode(firstLetter);

    for (let i = 1; i < str.length && encoded.length < 4; i++) {
      const code = this.soundexCode(str[i]);
      if (code !== '0' && code !== lastCode) {
        encoded += code;
        lastCode = code;
      } else if (code !== '0') {
        lastCode = code;
      }
    }

    return encoded.padEnd(4, '0');
  }

  soundexCode(char) {
    const codes = {
      'B': '1', 'F': '1', 'P': '1', 'V': '1',
      'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
      'D': '3', 'T': '3',
      'L': '4',
      'M': '5', 'N': '5',
      'R': '6'
    };
    return codes[char.toUpperCase()] || '0';
  }
}

module.exports = FuzzyMatcher;
```

---

## Search Analytics and Monitoring

### Search Metrics Tracking

```javascript
// search/analytics.js
class SearchAnalytics {
  constructor(elasticsearchClient) {
    this.client = elasticsearchClient;
  }

  async trackSearch(query, userId, results, metadata = {}) {
    const document = {
      query,
      userId,
      resultsCount: results.length,
      timestamp: new Date().toISOString(),
      responseTimeMs: metadata.responseTime,
      filters: metadata.filters,
      sort: metadata.sort,
      clicked: metadata.clicked || null,
      ...metadata
    };

    try {
      await this.client.index({
        index: 'search_analytics',
        body: document
      });
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  async getSearchMetrics(timeRangeMinutes = 1440) {
    const searchBody = {
      query: {
        range: {
          timestamp: {
            gte: `now-${timeRangeMinutes}m`
          }
        }
      },
      aggs: {
        totalSearches: { value_count: { field: 'query.keyword' } },
        avgResponseTime: { avg: { field: 'responseTimeMs' } },
        p95ResponseTime: {
          percentiles: { field: 'responseTimeMs', percents: [95] }
        },
        topQueries: {
          terms: { field: 'query.keyword', size: 20 }
        },
        zeroResults: {
          filter: { term: { resultsCount: 0 } }
        },
        userRetention: {
          cardinality: { field: 'userId' }
        }
      },
      size: 0
    };

    const result = await this.client.search({
      index: 'search_analytics',
      body: searchBody
    });

    return {
      totalSearches: result.aggregations.totalSearches.value,
      avgResponseTime: result.aggregations.avgResponseTime.value,
      p95ResponseTime: result.aggregations.p95ResponseTime.values['95.0'],
      topQueries: result.aggregations.topQueries.buckets,
      zeroResultCount: result.aggregations.zeroResults.doc_count,
      uniqueUsers: result.aggregations.userRetention.value
    };
  }

  async getZeroResultQueries() {
    const searchBody = {
      query: { term: { resultsCount: 0 } },
      aggs: {
        queries: {
          terms: { field: 'query.keyword', size: 100 }
        }
      },
      size: 0
    };

    const result = await this.client.search({
      index: 'search_analytics',
      body: searchBody
    });

    return result.aggregations.queries.buckets;
  }
}

module.exports = SearchAnalytics;
```

---

## Multi-Language Search

### Language-Aware Indexing

```javascript
// search/multiLanguage.js
class MultiLanguageSearch {
  constructor(elasticsearchClient) {
    this.client = elasticsearchClient;
    this.supportedLanguages = ['en', 'es', 'fr', 'de', 'ja'];
  }

  async setupLanguageIndex() {
    const mapping = {
      mappings: {
        properties: {
          content_en: {
            type: 'text',
            analyzer: 'english'
          },
          content_es: {
            type: 'text',
            analyzer: 'spanish'
          },
          content_fr: {
            type: 'text',
            analyzer: 'french'
          },
          content_de: {
            type: 'text',
            analyzer: 'german'
          },
          content_ja: {
            type: 'text',
            analyzer: 'kuromoji'
          },
          language: {
            type: 'keyword'
          },
          id: {
            type: 'keyword'
          }
        }
      }
    };

    await this.client.indices.create({
      index: 'multilang_content',
      body: mapping
    });
  }

  async search(query, language = 'en') {
    const fieldName = `content_${language}`;

    const searchBody = {
      query: {
        match: {
          [fieldName]: {
            query,
            fuzziness: 'AUTO'
          }
        }
      }
    };

    const result = await this.client.search({
      index: 'multilang_content',
      body: searchBody
    });

    return result.hits.hits;
  }

  async searchMultiLanguage(query, languages = ['en', 'es', 'fr']) {
    const shouldClauses = languages.map(lang => ({
      match: {
        [`content_${lang}`]: {
          query,
          boost: lang === 'en' ? 2 : 1
        }
      }
    }));

    const searchBody = {
      query: {
        bool: {
          should: shouldClauses,
          minimum_should_match: 1
        }
      }
    };

    const result = await this.client.search({
      index: 'multilang_content',
      body: searchBody
    });

    return result.hits.hits;
  }
}

module.exports = MultiLanguageSearch;
```

---

## Performance Optimization

### Index Optimization Strategies

```javascript
// search/optimization.js
class SearchOptimization {
  constructor(elasticsearchClient) {
    this.client = elasticsearchClient;
  }

  // Force merge to improve search performance
  async optimizeIndex(indexName) {
    try {
      await this.client.indices.forcemerge({
        index: indexName,
        max_num_segments: 1
      });
      console.log(`Index ${indexName} optimized`);
    } catch (error) {
      console.error('Optimization error:', error);
    }
  }

  // Refresh index for near real-time search
  async refreshIndex(indexName) {
    await this.client.indices.refresh({ index: indexName });
  }

  // Monitor index statistics
  async getIndexStats(indexName) {
    const stats = await this.client.indices.stats({ index: indexName });
    const settings = await this.client.indices.getSettings({ index: indexName });

    return {
      docsCount: stats.indices[indexName].primaries.docs.count,
      storeSize: stats.indices[indexName].primaries.store.size_in_bytes,
      segmentCount: stats.indices[indexName].primaries.segments.count,
      settings: settings[indexName].settings.index
    };
  }

  // Implement index lifecycle management
  async setupILM() {
    const policy = {
      policy: 'search-policy',
      phases: {
        hot: {
          min_age: '0d',
          actions: {
            rollover: { max_primary_store_size: '50gb' },
            set_priority: { priority: 100 }
          }
        },
        warm: {
          min_age: '30d',
          actions: {
            set_priority: { priority: 50 },
            forcemerge: { max_num_segments: 1 }
          }
        },
        cold: {
          min_age: '60d',
          actions: {
            searchable_snapshot: {}
          }
        },
        delete: {
          min_age: '90d',
          actions: { delete: {} }
        }
      }
    };

    await this.client.ilm.putLifecycle(policy);
  }
}

module.exports = SearchOptimization;
```

---

## Best Practices Summary

1. **Choose the Right Engine**: Elasticsearch for complex queries, Meilisearch for simplicity, Typesense for speed
2. **Index Design First**: Proper field analysis, tokenization, and mappings are critical
3. **Test Relevance**: Relevance tuning is an iterative process—collect feedback
4. **Monitor Zero-Results**: Track searches with no results and improve accordingly
5. **Optimize for Latency**: P99 search latency matters more than average
6. **Use Fuzzy Matching Judiciously**: Balance relevance with typo tolerance
7. **Implement Facets**: Help users narrow results before searching
8. **Track User Behavior**: Learn from what queries return 0 results
9. **Plan for Scale**: Consider sharding and replication before they're needed
10. **Maintain Index Health**: Regular optimization and cleanup

---

## Resources

- Elasticsearch Documentation: https://www.elastic.co/guide/en/elasticsearch/reference/
- Meilisearch Official Docs: https://docs.meilisearch.com/
- Typesense Documentation: https://typesense.org/docs/
- Search Relevance Tuning: https://www.elastic.co/guide/en/elasticsearch/guide/current/relevance-intro.html
