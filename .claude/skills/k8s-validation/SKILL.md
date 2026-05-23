# Kubernetes Configuration Validation

Enterprise-grade Kubernetes configuration patterns for production-grade deployments.

## Table of Contents

1. [Resource Requests and Limits](#resource-requests-and-limits)
2. [Pod Security Policies](#pod-security-policies)
3. [RBAC Configuration](#rbac-configuration)
4. [Network Policies](#network-policies)
5. [Helm Chart Validation](#helm-chart-validation)
6. [Health Check Configuration](#health-check-configuration)
7. [ConfigMaps and Secrets](#configmaps-and-secrets)
8. [Ingress Configuration](#ingress-configuration)
9. [Service Mesh (Istio)](#service-mesh-istio)
10. [GitOps with ArgoCD/Flux](#gitops-with-argocdflux)

## Resource Requests and Limits

### Best Practices

```yaml
# production-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
        version: v1.0.0
    spec:
      # Resource limits prevent runaway processes
      containers:
      - name: api
        image: myregistry.azurecr.io/api:v1.0.0
        imagePullPolicy: IfNotPresent

        # Requests: guaranteed resources for scheduler
        # Limits: maximum resources container can use
        resources:
          requests:
            memory: "512Mi"      # Guaranteed memory
            cpu: "250m"          # Guaranteed CPU (quarter core)
            ephemeral-storage: "2Gi"
          limits:
            memory: "1024Mi"     # Max memory (2x request for headroom)
            cpu: "1000m"         # Max CPU (4x request for peaks)
            ephemeral-storage: "4Gi"

        # Port configuration
        ports:
        - name: http
          containerPort: 8000
          protocol: TCP

      # Node affinity for resource optimization
      affinity:
        # Spread pods across nodes
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - api-server
              topologyKey: kubernetes.io/hostname

        # Schedule on nodes with specific labels
        nodeAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 50
            preference:
              matchExpressions:
              - key: workload
                operator: In
                values:
                - compute-optimized

      # Resource quotas at namespace level
      terminationGracePeriodSeconds: 30
```

### Resource Sizing Guidelines

```yaml
# Small service (< 1K requests/min)
resources:
  requests:
    memory: "128Mi"
    cpu: "50m"
  limits:
    memory: "256Mi"
    cpu: "200m"

# Medium service (1K-10K requests/min)
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "1024Mi"
    cpu: "1000m"

# Large service (> 10K requests/min)
resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "2000m"

# Database pods (memory-intensive)
resources:
  requests:
    memory: "8Gi"
    cpu: "2000m"
  limits:
    memory: "16Gi"
    cpu: "4000m"
```

### Namespace-Level Resource Quota

```yaml
# namespace-quota.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: production
spec:
  hard:
    requests.cpu: "10"          # Max total CPU requests
    requests.memory: "20Gi"     # Max total memory requests
    limits.cpu: "20"            # Max total CPU limits
    limits.memory: "40Gi"       # Max total memory limits
    pods: "100"                 # Max pod count
    services.loadbalancers: "2" # Max load balancers
---
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: production
spec:
  limits:
  - type: Pod
    max:
      memory: "2Gi"
      cpu: "2000m"
    min:
      memory: "64Mi"
      cpu: "10m"
    default:
      memory: "512Mi"
      cpu: "250m"
    defaultRequest:
      memory: "256Mi"
      cpu: "100m"
```

## Pod Security Policies

### Pod Security Standards (PSS)

```yaml
# For Kubernetes 1.25+, use Pod Security Standards
apiVersion: v1
kind: Namespace
metadata:
  name: secure-apps
  labels:
    # Enforce pod security at namespace level
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
# Restricted Pod Configuration
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  # Security context for pod
  securityContext:
    runAsNonRoot: true         # Must run as non-root user
    runAsUser: 1000            # Specific UID
    runAsGroup: 3000           # Specific GID
    fsGroup: 2000              # Volume group
    seccompProfile:
      type: RuntimeDefault     # Use default seccomp
    seLinuxOptions:
      level: "s0:c123,c456"

  containers:
  - name: app
    image: myapp:v1.0.0

    # Container security context
    securityContext:
      allowPrivilegeEscalation: false  # Prevent privilege escalation
      readOnlyRootFilesystem: true     # Read-only root filesystem
      runAsNonRoot: true
      runAsUser: 1000
      capabilities:
        drop:
        - ALL                          # Drop all capabilities
        add:
        - NET_BIND_SERVICE             # Add only needed ones

    # Volume mounts with read-only where possible
    volumeMounts:
    - name: config
      mountPath: /etc/config
      readOnly: true
    - name: cache
      mountPath: /tmp/cache

  # Service account with minimal permissions
  serviceAccountName: app-sa
  automountServiceAccountToken: true

  volumes:
  - name: config
    configMap:
      name: app-config
      defaultMode: 0444  # Read-only
  - name: cache
    emptyDir: {}
```

### Pod Security Policy (Legacy)

```yaml
# For Kubernetes < 1.25 (PSP deprecated)
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'MustRunAs'
    seLinuxOptions:
      level: "s0:c123,c456"
  supplementalGroups:
    rule: 'MustRunAs'
    ranges:
      - min: 1000
        max: 65535
  fsGroup:
    rule: 'MustRunAs'
    ranges:
      - min: 1000
        max: 65535
  readOnlyRootFilesystem: true
```

## RBAC Configuration

### Service Account with Minimal Permissions

```yaml
# app-rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-sa
  namespace: production
---
# Role: Permissions within namespace
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: app-role
  namespace: production
rules:
# Read ConfigMaps
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list", "watch"]
  resourceNames: ["app-config"]  # Specific ConfigMap only

# Read Secrets
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get"]
  resourceNames: ["app-secrets"]  # Specific Secret only

# Read Pods (for debugging)
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list"]

# Write to specific namespace
- apiGroups: [""]
  resources: ["endpoints"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
---
# RoleBinding: Connect ServiceAccount to Role
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-rolebinding
  namespace: production
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: app-role
subjects:
- kind: ServiceAccount
  name: app-sa
  namespace: production
---
# ClusterRole: For cluster-wide permissions (use sparingly)
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: read-nodes-logs
rules:
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "list"]
- apiGroups: [""]
  resources: ["nodes/log"]
  verbs: ["get"]
---
# ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: read-nodes-logs-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: read-nodes-logs
subjects:
- kind: ServiceAccount
  name: app-sa
  namespace: production
```

## Network Policies

### Default Deny with Selective Allow

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}  # Applies to all pods
  policyTypes:
  - Ingress
  # No ingress rules = deny all ingress

---
# Allow traffic from frontend to api
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-api
  namespace: production
spec:
  podSelector:
    matchLabels:
      tier: api
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: frontend
    ports:
    - protocol: TCP
      port: 8000

---
# Allow api to database
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-to-db
  namespace: production
spec:
  podSelector:
    matchLabels:
      tier: database
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: api
    ports:
    - protocol: TCP
      port: 5432

---
# Allow external ingress to frontend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-external-to-frontend
  namespace: production
spec:
  podSelector:
    matchLabels:
      tier: frontend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 80
    - protocol: TCP
      port: 443

---
# Deny egress except DNS and specified services
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: restrict-egress
  namespace: production
spec:
  podSelector:
    matchLabels:
      tier: api
  policyTypes:
  - Egress
  egress:
  # Allow DNS
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: UDP
      port: 53

  # Allow to database
  - to:
    - podSelector:
        matchLabels:
          tier: database
    ports:
    - protocol: TCP
      port: 5432

  # Allow to external services
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443  # HTTPS only
```

## Helm Chart Validation

### Helm Values Validation

```yaml
# values.yaml
# Default values with comments for required fields
replicaCount: 3

image:
  repository: myregistry.azurecr.io/api
  pullPolicy: IfNotPresent
  tag: "1.0.0"

imagePullSecrets:
  - name: registry-credentials

nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "8000"
  prometheus.io/path: "/metrics"

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000

securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: api.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: api-tls
      hosts:
        - api.example.com

resources:
  limits:
    cpu: 1000m
    memory: 1024Mi
  requests:
    cpu: 250m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
  targetMemoryUtilizationPercentage: 80

env:
  ENVIRONMENT: production
  LOG_LEVEL: info

configMap:
  data:
    app.properties: |
      server.port=8000
      server.timeout=30000

secrets:
  create: false  # Use external secret management
  name: app-secrets
```

### Helm Template with Values

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "chart.fullname" . }}
  labels:
    {{- include "chart.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "chart.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
        {{- with .Values.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "chart.selectorLabels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "chart.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}

      containers:
      - name: {{ .Chart.Name }}
        securityContext:
          {{- toYaml .Values.securityContext | nindent 12 }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}

        ports:
        - name: http
          containerPort: 8000
          protocol: TCP

        env:
        {{- range $key, $value := .Values.env }}
        - name: {{ $key }}
          value: "{{ $value }}"
        {{- end }}
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace

        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10

        readinessProbe:
          httpGet:
            path: /ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5

        resources:
          {{- toYaml .Values.resources | nindent 12 }}

        volumeMounts:
        - name: config
          mountPath: /etc/config
          readOnly: true

      volumes:
      - name: config
        configMap:
          name: {{ include "chart.fullname" . }}
```

### Helm Chart Linting

```bash
# Validate chart syntax
helm lint ./my-chart

# Template rendering validation
helm template my-release ./my-chart --values values.yaml

# Dry-run installation
helm install my-release ./my-chart --values values.yaml --dry-run --debug

# Schema validation
helm lint ./my-chart --values values.yaml --strict

# Check for best practices
helm lint ./my-chart --strict --values values.yaml 2>&1 | grep -E "(error|warning)"
```

## Health Check Configuration

### Liveness, Readiness, Startup Probes

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-probes
spec:
  containers:
  - name: app
    image: myapp:v1.0.0
    ports:
    - containerPort: 8000

    # Liveness Probe: Is the process still running?
    # If fails 3 times, Kubernetes restarts the pod
    livenessProbe:
      httpGet:
        path: /health
        port: 8000
        scheme: HTTP
      initialDelaySeconds: 30    # Wait 30s before first check
      periodSeconds: 10          # Check every 10s
      timeoutSeconds: 5          # Wait 5s for response
      failureThreshold: 3        # Restart after 3 failures
      successThreshold: 1        # Mark alive after 1 success

    # Readiness Probe: Is the pod ready to receive traffic?
    # If fails, remove from service endpoints
    readinessProbe:
      httpGet:
        path: /ready
        port: 8000
      initialDelaySeconds: 5     # Check sooner than liveness
      periodSeconds: 5           # Check frequently
      timeoutSeconds: 2
      failureThreshold: 3
      successThreshold: 1

    # Startup Probe: Has the application started?
    # Gives slow-starting apps time to initialize
    startupProbe:
      httpGet:
        path: /startup
        port: 8000
      initialDelaySeconds: 0
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 30       # 30 * 10s = 5 min max startup time
      successThreshold: 1

---
# TCP probe example (for databases)
apiVersion: v1
kind: Pod
metadata:
  name: postgres-pod
spec:
  containers:
  - name: postgres
    image: postgres:15
    ports:
    - containerPort: 5432

    livenessProbe:
      tcpSocket:
        port: 5432
      initialDelaySeconds: 20
      periodSeconds: 10

    readinessProbe:
      exec:
        command:
        - /bin/sh
        - -c
        - pg_isready -U postgres
      initialDelaySeconds: 5
      periodSeconds: 5

---
# Complex startup check
apiVersion: v1
kind: Pod
metadata:
  name: app-complex-startup
spec:
  containers:
  - name: app
    image: myapp:v1.0.0

    startupProbe:
      exec:
        command:
        - /bin/sh
        - -c
        - |
          # Check dependencies are ready
          curl -f http://localhost:8000/api/dependencies || exit 1
          # Check database connectivity
          curl -f http://localhost:8000/api/db-check || exit 1
      initialDelaySeconds: 0
      periodSeconds: 10
      failureThreshold: 30

    livenessProbe:
      httpGet:
        path: /health
        port: 8000
      # Only start checking after startup probe succeeds
      initialDelaySeconds: 0
      periodSeconds: 10
      failureThreshold: 3
```

## ConfigMaps and Secrets

### ConfigMap Management

```yaml
# app-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: production
data:
  # Simple key-value
  LOG_LEVEL: "info"
  ENVIRONMENT: "production"
  API_TIMEOUT: "30"

  # File contents
  app.properties: |
    server.port=8000
    server.threads=100
    cache.ttl=3600

  nginx.conf: |
    server {
      listen 80;
      location / {
        proxy_pass http://backend:8000;
      }
    }

---
# Secret with sensitive data (encrypted at rest)
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: production
type: Opaque
data:
  # Base64 encoded (use stringData for plaintext)
  db-password: cGFzc3dvcmQxMjM=  # password123
  api-key: c2VjcmV0LWtleTEyMw==  # secret-key123
---
# Using stringData (automatically base64 encoded)
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets-v2
  namespace: production
type: Opaque
stringData:
  db-password: "actual-password-here"
  api-key: "actual-key-here"

---
# Docker registry credentials
apiVersion: v1
kind: Secret
metadata:
  name: registry-credentials
  namespace: production
type: kubernetes.io/dockercfg
data:
  .dockercfg: eyJteXJlZ2lzdHJ5LmF6dXJlY3IuaW8iOnsidXNlcm5hbWUiOiAidXNlciIsICJwYXNzd29yZCI6ICJwYXNzIn19
---
# TLS certificate secret
apiVersion: v1
kind: Secret
metadata:
  name: tls-cert
  namespace: production
type: kubernetes.io/tls
data:
  tls.crt: LS0tLS1CRUdJTi... # Base64 encoded cert
  tls.key: LS0tLS1CRUdJTi... # Base64 encoded key
```

### Using ConfigMap and Secret in Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-config
spec:
  containers:
  - name: app
    image: myapp:v1.0.0

    # Environment variables from ConfigMap
    env:
    - name: LOG_LEVEL
      valueFrom:
        configMapKeyRef:
          name: app-config
          key: LOG_LEVEL

    # Environment variables from Secret
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: app-secrets
          key: db-password

    # Volume mounts for file-based configs
    volumeMounts:
    - name: config-volume
      mountPath: /etc/config
      readOnly: true

  volumes:
  # Mount ConfigMap as volume
  - name: config-volume
    configMap:
      name: app-config
      defaultMode: 0444  # Read-only
```

## Ingress Configuration

### TLS and Security

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: production
  annotations:
    # Certificate management
    cert-manager.io/cluster-issuer: "letsencrypt-prod"

    # Security headers
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/ssl-protocols: "TLSv1.2 TLSv1.3"
    nginx.ingress.kubernetes.io/hsts: "true"
    nginx.ingress.kubernetes.io/hsts-max-age: "31536000"
    nginx.ingress.kubernetes.io/hsts-include-subdomains: "true"

    # Rate limiting
    nginx.ingress.kubernetes.io/limit-rps: "100"
    nginx.ingress.kubernetes.io/limit-connections: "10"

    # WAF
    nginx.ingress.kubernetes.io/enable-modsecurity: "true"

    # CORS
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://frontend.example.com"

spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.example.com
    secretName: api-tls  # Auto-managed by cert-manager
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8000
      - path: /health
        pathType: Exact
        backend:
          service:
            name: api-service
            port:
              number: 8000
```

## Service Mesh (Istio)

### Istio VirtualService and DestinationRule

```yaml
# Destination rule: How to route to pods
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: api-destination-rule
  namespace: production
spec:
  host: api  # Kubernetes service name
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 100
        maxRequestsPerConnection: 2
    loadBalancer:
      consistentHash:
        httpCookie:
          name: "session"
          ttl: "1h"
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2

---
# Virtual service: How to route traffic
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-virtual-service
  namespace: production
spec:
  hosts:
  - api
  http:
  # Canary deployment: 90% to v1, 10% to v2
  - match:
    - uri:
        prefix: "/api"
    route:
    - destination:
        host: api
        subset: v1
      weight: 90
    - destination:
        host: api
        subset: v2
      weight: 10
    timeout: 30s
    retries:
      attempts: 3
      perTryTimeout: 10s

  # Circuit breaker
  - match:
    - uri:
        prefix: "/legacy"
    route:
    - destination:
        host: api
        subset: v1
    timeout: 60s

---
# PeerAuthentication: mTLS configuration
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT  # Require mTLS for all services
```

## GitOps with ArgoCD/Flux

### ArgoCD Application

```yaml
# argocd-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: api-app
  namespace: argocd
spec:
  project: production

  source:
    repoURL: https://github.com/myorg/k8s-configs
    targetRevision: main
    path: deployments/production/api

  destination:
    server: https://kubernetes.default.svc
    namespace: production

  syncPolicy:
    automated:
      prune: true      # Delete resources removed from git
      selfHeal: true   # Sync when cluster drift detected
    syncOptions:
    - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m

  # Health assessment
  ignoreDifferences:
  - group: apps
    kind: Deployment
    jsonPointers:
    - /spec/replicas  # Ignore if HPA manages replicas

---
# ApplicationSet: Deploy multiple environments
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: api-apps
  namespace: argocd
spec:
  generators:
  - list:
      elements:
      - env: development
        replicas: 1
        cpu: "100m"
      - env: staging
        replicas: 2
        cpu: "250m"
      - env: production
        replicas: 3
        cpu: "500m"

  template:
    metadata:
      name: api-{{env}}
    spec:
      project: {{env}}
      source:
        repoURL: https://github.com/myorg/helm-charts
        targetRevision: main
        chart: api
        helm:
          values: |
            replicas: {{replicas}}
            resources:
              requests:
                cpu: {{cpu}}

      destination:
        server: https://kubernetes.default.svc
        namespace: {{env}}
```

### Flux Configuration

```yaml
# flux-install
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: GitRepository
metadata:
  name: myapp-config
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/myorg/k8s-configs
  ref:
    branch: main

---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: api-production
  namespace: flux-system
spec:
  interval: 10m
  sourceRef:
    kind: GitRepository
    name: myapp-config
  path: ./deployments/production/api
  prune: true
  wait: true
  timeout: 5m0s
  validation: client
  postBuild:
    substitute:
      version: v1.2.3
      image: myregistry.azurecr.io/api:v1.2.3
```

---

**Remember**: Kubernetes security is layered. Implement multiple controls at every level - pod security, RBAC, network policies, and resource limits.
