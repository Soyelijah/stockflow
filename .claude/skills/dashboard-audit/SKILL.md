# Dashboard Audit Skill

Professional dashboard design and optimization for enterprise analytics, monitoring, and business intelligence platforms.

## Dashboard Architecture Patterns

### Three-Level Hierarchy

Modern dashboards follow a three-level information hierarchy:

1. **KPI Layer (Top)** - Critical metrics at a glance
   - 3-6 top-level KPIs maximum
   - Large, readable numbers with context
   - Color coding for status (green/amber/red)
   - Sparklines or small trend indicators
   - Year-over-year or period-over-period comparison

2. **Analysis Layer (Middle)** - Detailed views and comparisons
   - Charts showing trends, distributions, segments
   - Comparative visualizations (actual vs. target)
   - Drill-down entry points
   - Time period filters
   - Dimension selectors

3. **Detail Layer (Bottom)** - Raw data and exploration
   - Data tables with sorting and filtering
   - Export capabilities
   - Row-level actions
   - Related record links
   - Audit trails

### KPI Card Component Pattern

```typescript
interface KPICardProps {
  label: string;
  value: number | string;
  unit?: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    period: string;
  };
  target?: number;
  status: 'healthy' | 'warning' | 'critical';
  sparklineData?: number[];
  onClick?: () => void;
  comparison?: {
    label: string;
    value: number;
  };
}

const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  unit,
  trend,
  target,
  status,
  sparklineData,
  onClick,
  comparison
}) => {
  const statusColors = {
    healthy: 'bg-green-500/20 border-green-500/50',
    warning: 'bg-amber-500/20 border-amber-500/50',
    critical: 'bg-red-500/20 border-red-500/50'
  };

  return (
    <div
      onClick={onClick}
      className={`p-6 rounded-lg border backdrop-blur-xl cursor-pointer transition-all hover:scale-105 ${statusColors[status]}`}
    >
      <div className="flex justify-between items-start mb-4">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${
            trend.direction === 'up' ? 'text-green-400' :
            trend.direction === 'down' ? 'text-red-400' :
            'text-slate-400'
          }`}>
            {trend.direction === 'up' && '↑'}
            {trend.direction === 'down' && '↓'}
            {Math.abs(trend.percentage)}% {trend.period}
          </div>
        )}
      </div>

      <div className="mb-4">
        <div className="text-3xl font-bold text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit && <span className="text-lg text-slate-400 ml-2">{unit}</span>}
        </div>
        {target && (
          <div className="text-xs text-slate-400 mt-1">
            Target: {target.toLocaleString()}
          </div>
        )}
      </div>

      {sparklineData && (
        <div className="h-8 opacity-60">
          <Sparkline data={sparklineData} color={statusColors[status]} />
        </div>
      )}

      {comparison && (
        <div className="mt-4 pt-4 border-t border-slate-700/50 text-xs">
          <span className="text-slate-400">{comparison.label}: </span>
          <span className="text-slate-200 font-semibold">{comparison.value.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
};
```

## KPI Selection Framework

### Metric Selection Criteria

Each dashboard KPI must satisfy these criteria:

1. **Business Relevance** - Directly impacts business objectives
   - Revenue generation
   - Cost reduction
   - User engagement
   - Market position
   - Operational efficiency

2. **Actionability** - Users can take action based on metric
   - Is the metric under user/team control?
   - Can they influence the value?
   - Are there clear levers to pull?
   - Does variance indicate needed action?

3. **Accuracy** - Data is trustworthy and validated
   - Source system is authoritative
   - Calculation logic is documented
   - Data freshness is appropriate
   - Anomalies are detectable

4. **Clarity** - Metric is unambiguous to stakeholders
   - Name clearly describes the metric
   - Calculation is documented
   - Context is provided
   - Comparison basis is clear

### KPI Selection Checklist

- [ ] List all potential metrics for the dashboard
- [ ] Map each metric to business objectives
- [ ] Evaluate user's ability to impact each metric
- [ ] Validate data source reliability
- [ ] Determine appropriate refresh frequency
- [ ] Define target/goal values
- [ ] Establish alert thresholds
- [ ] Document calculation methodology
- [ ] Test metric calculations with real data
- [ ] Validate metric values with stakeholders
- [ ] Plan metric evolution over time

### Leading vs. Lagging Indicators

Effective dashboards balance both types:

**Lagging Indicators** (backward-looking outcomes):
- Revenue
- Customer churn
- Quality defects
- Market share

**Leading Indicators** (forward-looking predictors):
- Pipeline opportunities
- Customer health score
- Code quality metrics
- Employee engagement

Ratio: 2-3 lagging to 1 leading indicator recommended.

## Data Visualization Best Practices

### Chart Type Selection

| Metric Type | Best Chart | Secondary Options |
|------------|-----------|------------------|
| Change over time | Line chart | Area chart, bar chart |
| Comparison across categories | Bar chart | Dot plot, small multiples |
| Part-to-whole relationship | Pie chart* | 100% stacked bar |
| Correlation | Scatter plot | Bubble chart |
| Distribution | Histogram | Box plot, violin plot |
| Hierarchical data | Treemap | Sunburst, dendrogram |
| Flow/funnel | Funnel chart | Sankey diagram |
| Actual vs. target | Bullet graph | Gauge, bar |

*Pie charts should be used sparingly - bar charts often superior for comparing values.

### Dashboard Visualization Code Pattern

```typescript
interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'funnel';
  title: string;
  dataKey: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  colors?: string[];
  animationDuration?: number;
  enableTooltip?: boolean;
  enableLegend?: boolean;
  enableExport?: boolean;
  drillDownKey?: string;
}

const DashboardChart: React.FC<{
  config: ChartConfig;
  data: any[];
  onDrillDown?: (dimension: string, value: any) => void;
  isLoading?: boolean;
}> = ({ config, data, onDrillDown, isLoading }) => {
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="h-80 bg-slate-800/50 rounded-lg flex items-center justify-center">
        <div className="animate-spin text-blue-400">⟳</div>
      </div>
    );
  }

  const handleSegmentClick = (segment: any) => {
    setSelectedSegment(segment.name);
    onDrillDown?.(config.drillDownKey || config.dataKey, segment);
  };

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{config.title}</h3>

      <ResponsiveContainer width="100%" height={300}>
        {config.type === 'line' && (
          <LineChart data={data}>
            <CartesianGrid stroke="#334155" />
            <XAxis dataKey="time" stroke="#94a3b8" />
            <YAxis label={{ value: config.yAxisLabel, angle: -90, position: 'insideLeft' }} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
            {config.enableLegend && <Legend />}
            <Line
              dataKey={config.dataKey}
              stroke="#3b82f6"
              dot={false}
              strokeWidth={2}
              isAnimationActive={true}
              animationDuration={config.animationDuration || 500}
            />
          </LineChart>
        )}

        {config.type === 'bar' && (
          <BarChart data={data}>
            <CartesianGrid stroke="#334155" />
            <XAxis dataKey="category" stroke="#94a3b8" />
            <YAxis />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
            {config.enableLegend && <Legend />}
            <Bar
              dataKey={config.dataKey}
              fill="#3b82f6"
              onClick={(e) => handleSegmentClick(e)}
              cursor="pointer"
            />
          </BarChart>
        )}
      </ResponsiveContainer>

      {config.enableExport && (
        <div className="mt-4 flex gap-2">
          <button className="text-xs px-3 py-1 bg-blue-500/20 border border-blue-500/50 rounded hover:bg-blue-500/30">
            Export CSV
          </button>
          <button className="text-xs px-3 py-1 bg-blue-500/20 border border-blue-500/50 rounded hover:bg-blue-500/30">
            Share
          </button>
        </div>
      )}
    </div>
  );
};
```

## Real-Time Data Display

### Update Strategy

Real-time dashboards require careful update management:

```typescript
interface RealtimeDataConfig {
  updateFrequency: number; // milliseconds
  dataSource: 'websocket' | 'polling' | 'server-sent-events';
  staleDataThreshold: number; // milliseconds before marking stale
  showUpdateIndicator: boolean;
  animateChanges: boolean;
}

const RealtimeDashboard: React.FC<RealtimeDataConfig> = (config) => {
  const [data, setData] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [isStale, setIsStale] = useState(false);
  const updateIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard/realtime');
        const newData = await response.json();

        setData(newData);
        setLastUpdate(Date.now());
        setIsStale(false);
      } catch (error) {
        console.error('Failed to fetch realtime data:', error);
        setIsStale(true);
      }
    };

    // Initial fetch
    fetchData();

    // Set up polling
    updateIntervalRef.current = setInterval(fetchData, config.updateFrequency);

    // Monitor staleness
    const staleCheckInterval = setInterval(() => {
      if (Date.now() - lastUpdate > config.staleDataThreshold) {
        setIsStale(true);
      }
    }, 5000);

    return () => {
      clearInterval(updateIntervalRef.current);
      clearInterval(staleCheckInterval);
    };
  }, [config.updateFrequency, config.staleDataThreshold]);

  return (
    <div className={isStale ? 'opacity-60' : ''}>
      {config.showUpdateIndicator && (
        <div className="text-xs text-slate-400 mb-2">
          Last updated: {new Date(lastUpdate).toLocaleTimeString()}
          {isStale && <span className="text-amber-400 ml-2">⚠ Data may be stale</span>}
        </div>
      )}
      {/* Dashboard content */}
    </div>
  );
};
```

### WebSocket Connection Pattern

```typescript
class DashboardWebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(url: string, onMessage: (data: any) => void) {
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('Dashboard WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = () => {
        console.error('WebSocket error');
        this.attemptReconnect(url, onMessage);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.attemptReconnect(url, onMessage);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }

  private attemptReconnect(url: string, onMessage: (data: any) => void) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      setTimeout(() => this.connect(url, onMessage), delay);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

## Alert Systems

### Alert Configuration Pattern

```typescript
interface DashboardAlert {
  id: string;
  title: string;
  description: string;
  metric: string;
  condition: 'above' | 'below' | 'change' | 'missing';
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  notificationChannels: ('in-app' | 'email' | 'slack' | 'webhook')[];
  quietPeriod?: number; // minutes before re-alerting
}

const AlertManager: React.FC<{ alerts: DashboardAlert[] }> = ({ alerts }) => {
  const [activeAlerts, setActiveAlerts] = useState<DashboardAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const evaluateAlerts = (metrics: Record<string, number>) => {
    const triggered = alerts.filter(alert => {
      if (!alert.enabled || dismissedAlerts.has(alert.id)) return false;

      const metricValue = metrics[alert.metric];

      switch (alert.condition) {
        case 'above':
          return metricValue > alert.threshold;
        case 'below':
          return metricValue < alert.threshold;
        case 'change':
          return Math.abs(metricValue - (metrics[`${alert.metric}_previous`] || 0)) > alert.threshold;
        case 'missing':
          return metricValue === undefined || metricValue === null;
        default:
          return false;
      }
    });

    setActiveAlerts(triggered);

    // Send notifications
    triggered.forEach(alert => {
      if (alert.notificationChannels.includes('in-app')) {
        // Show in-app notification
      }
      if (alert.notificationChannels.includes('email')) {
        // Send email
      }
      if (alert.notificationChannels.includes('slack')) {
        // Send to Slack
      }
    });
  };

  const dismissAlert = (alertId: string) => {
    const newDismissed = new Set(dismissedAlerts);
    newDismissed.add(alertId);
    setDismissedAlerts(newDismissed);
  };

  return (
    <div className="fixed top-4 right-4 max-w-sm space-y-2 z-50">
      {activeAlerts.map(alert => (
        <div
          key={alert.id}
          className={`p-4 rounded-lg border backdrop-blur-xl flex justify-between items-start ${
            alert.severity === 'critical'
              ? 'bg-red-500/20 border-red-500/50'
              : alert.severity === 'warning'
              ? 'bg-amber-500/20 border-amber-500/50'
              : 'bg-blue-500/20 border-blue-500/50'
          }`}
        >
          <div>
            <h4 className="font-semibold text-white">{alert.title}</h4>
            <p className="text-sm text-slate-300">{alert.description}</p>
          </div>
          <button
            onClick={() => dismissAlert(alert.id)}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
```

## Drill-Down Navigation

### Drill-Down Architecture

```typescript
interface DrillDownContext {
  path: string[]; // breadcrumb trail: ['Revenue', 'Q1 2026', 'Product A']
  filters: Record<string, any>;
  metric: string;
}

const DrillDownDashboard: React.FC = () => {
  const [drillDown, setDrillDown] = useState<DrillDownContext>({
    path: [],
    filters: {},
    metric: 'revenue'
  });

  const handleDrill = (dimension: string, value: any) => {
    setDrillDown(prev => ({
      ...prev,
      path: [...prev.path, `${dimension}: ${value}`],
      filters: {
        ...prev.filters,
        [dimension]: value
      }
    }));
  };

  const handleBreadcrumbClick = (index: number) => {
    const newPath = drillDown.path.slice(0, index);
    const newFilters = Object.fromEntries(
      newPath.map((item, i) => {
        const [key] = item.split(': ');
        return [key, drillDown.filters[key]];
      })
    );

    setDrillDown(prev => ({
      ...prev,
      path: newPath,
      filters: newFilters
    }));
  };

  return (
    <div>
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <button
          onClick={() => setDrillDown({ path: [], filters: {}, metric: drillDown.metric })}
          className="text-blue-400 hover:text-blue-300"
        >
          Overview
        </button>
        {drillDown.path.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-slate-400">/</span>
            <button
              onClick={() => handleBreadcrumbClick(index)}
              className="text-blue-400 hover:text-blue-300"
            >
              {item}
            </button>
          </div>
        ))}
      </div>

      {/* Dashboard content with drill-down handlers */}
    </div>
  );
};
```

## Responsive Dashboard Layout

### Mobile-First Grid System

```typescript
interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  gap?: number;
}

const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 4
}) => {
  return (
    <div
      className={`
        grid gap-${gap}
        grid-cols-${columns.mobile}
        sm:grid-cols-${columns.tablet}
        lg:grid-cols-${columns.desktop}
      `}
    >
      {children}
    </div>
  );
};

// Stacked mobile layout (1 column)
// Tablet: 2-column grid
// Desktop: 3-column grid with custom sizing

const DashboardLayout = () => (
  <div className="space-y-6">
    {/* KPI Row - always full width on mobile, 2 cols tablet, 3-4 cols desktop */}
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard {...kpi1Props} />
      <KPICard {...kpi2Props} />
      <KPICard {...kpi3Props} />
      <KPICard {...kpi4Props} />
    </div>

    {/* Main chart - full width */}
    <div className="lg:col-span-2">
      <DashboardChart {...mainChartProps} />
    </div>

    {/* Secondary charts - stack on mobile, 2-up on larger screens */}
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      <DashboardChart {...secondaryChart1Props} />
      <DashboardChart {...secondaryChart2Props} />
    </div>

    {/* Data table - scrollable on mobile */}
    <div className="overflow-x-auto">
      <DataTable {...tableProps} />
    </div>
  </div>
);
```

## Performance Metrics

### Core Web Vitals Monitoring

Dashboards must track:

1. **Largest Contentful Paint (LCP)** < 2.5s
   - Dashboard hero metrics visible within 2.5s
   - Skeleton loaders for initial render

2. **First Input Delay (FID)** < 100ms
   - Chart interactions responsive
   - Filter controls snappy

3. **Cumulative Layout Shift (CLS)** < 0.1
   - Fixed header heights
   - Skeleton placeholders match content size
   - No late-loading ads/elements

### Dashboard Performance Checklist

- [ ] Initial KPI load < 1.5s
- [ ] Chart render < 2s
- [ ] Data updates < 500ms
- [ ] Filter interactions < 200ms
- [ ] Drill-down transitions < 300ms
- [ ] Mobile viewport < 3s
- [ ] Bundle size < 200KB gzipped
- [ ] WebSocket connection < 1s
- [ ] Database queries < 500ms
- [ ] No layout shifts during data updates

## User Engagement Analytics

### Engagement Metrics Dashboard

```typescript
interface EngagementMetrics {
  activeUsers: number;
  sessionDuration: number; // seconds
  pageViews: number;
  bounceRate: number;
  returnRate: number;
  featureAdoption: Record<string, number>;
  errorRate: number;
}

const EngagementDashboard: React.FC<{ metrics: EngagementMetrics }> = ({ metrics }) => (
  <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
    <KPICard
      label="Active Users"
      value={metrics.activeUsers}
      trend={{ direction: 'up', percentage: 12, period: 'YoY' }}
      status={metrics.activeUsers > 1000 ? 'healthy' : 'warning'}
    />

    <KPICard
      label="Avg Session Duration"
      value={`${Math.round(metrics.sessionDuration / 60)}m`}
      trend={{ direction: 'up', percentage: 8, period: 'WoW' }}
      status="healthy"
    />

    <KPICard
      label="Bounce Rate"
      value={`${metrics.bounceRate.toFixed(1)}%`}
      trend={{ direction: 'down', percentage: 3, period: 'MoM' }}
      status={metrics.bounceRate < 40 ? 'healthy' : 'warning'}
    />

    <KPICard
      label="Return Rate"
      value={`${metrics.returnRate.toFixed(1)}%`}
      trend={{ direction: 'up', percentage: 5, period: 'QoQ' }}
      status={metrics.returnRate > 30 ? 'healthy' : 'critical'}
    />
  </div>
);
```

## A/B Test Results Dashboard

### Experiment Tracking Pattern

```typescript
interface Experiment {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'paused';
  control: {
    name: string;
    samples: number;
    metric: number;
    confidence: number;
  };
  variant: {
    name: string;
    samples: number;
    metric: number;
    confidence: number;
  };
  lift: number; // percentage improvement
  pValue: number;
  confidenceLevel: number; // 95%, 99%, etc.
  startDate: Date;
  endDate?: Date;
}

const ExperimentCard: React.FC<{ experiment: Experiment }> = ({ experiment }) => {
  const isSignificant = experiment.pValue < 0.05;
  const winnerFound = isSignificant && experiment.lift > 0;

  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-white">{experiment.name}</h3>
        <span className={`text-xs px-2 py-1 rounded ${
          experiment.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
          experiment.status === 'completed' ? 'bg-green-500/20 text-green-400' :
          'bg-amber-500/20 text-amber-400'
        }`}>
          {experiment.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-slate-400">{experiment.control.name}</p>
          <p className="text-2xl font-bold text-white">{experiment.control.metric.toFixed(2)}%</p>
          <p className="text-xs text-slate-400">{experiment.control.samples.toLocaleString()} samples</p>
        </div>

        <div>
          <p className="text-sm text-slate-400">{experiment.variant.name}</p>
          <p className={`text-2xl font-bold ${winnerFound ? 'text-green-400' : 'text-white'}`}>
            {experiment.variant.metric.toFixed(2)}%
          </p>
          <p className="text-xs text-slate-400">{experiment.variant.samples.toLocaleString()} samples</p>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-700/50">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-slate-300">Lift</span>
          <span className={`font-bold ${experiment.lift > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {experiment.lift > 0 ? '+' : ''}{experiment.lift.toFixed(1)}%
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">Confidence</span>
          <span className={`text-sm font-semibold ${isSignificant ? 'text-green-400' : 'text-amber-400'}`}>
            {(experiment.confidenceLevel * 100).toFixed(0)}% {isSignificant ? '✓ Significant' : '⚠ Not significant'}
          </span>
        </div>
      </div>
    </div>
  );
};
```

## Dashboard Design Checklist

- [ ] **KPI Selection** - 3-6 metrics maximum, all actionable and measurable
- [ ] **Hierarchy** - Clear visual hierarchy: KPIs → Analysis → Details
- [ ] **Color Coding** - Red/amber/green status indicators consistent
- [ ] **Context** - Trends, comparisons, targets included with each metric
- [ ] **Visualization** - Appropriate chart types for metric types
- [ ] **Real-Time Updates** - Clear indication of data freshness
- [ ] **Alerts** - Critical thresholds trigger notifications
- [ ] **Drill-Down** - Path to deeper investigation clear via breadcrumbs
- [ ] **Responsive** - Mobile-first layout works on all screen sizes
- [ ] **Performance** - Initial load < 2s, updates < 500ms
- [ ] **Accessibility** - Color-blind friendly, keyboard navigable
- [ ] **Export** - Data downloadable in CSV/PDF format
- [ ] **Permissions** - Users see only metrics they have access to
- [ ] **Caching** - Frequently-accessed data cached appropriately

