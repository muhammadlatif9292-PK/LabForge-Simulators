# LABFORGE Distributed Deployment Topology

## 1. Overview

LABFORGE is deployed as a set of microservices on a multi-cloud / hybrid infrastructure.  
The deployment follows **landscape-only**, **offline-first**, **realtime collaborative**, **deterministic** principles.  
All components are horizontally scalable, self-healing, and observable.

---

## 2. Service Topology

| Service               | Instances | Scaling Strategy       | Special Requirements                 |
|-----------------------|-----------|------------------------|--------------------------------------|
| Gateway               | 3+        | CPU/memory             | TLS termination, rate limiting       |
| Workspace             | 2+        | session affinity       | sticky sessions via cookie           |
| Simulation            | dynamic   | custom (tick sync)     | deterministic, GPU optional          |
| AI                    | 2-10      | request queue length   | GPU nodes, model caching             |
| Realtime              | 3+        | connection count       | WebSocket clustering                 |
| Asset                 | 2+        | bandwidth              | CDN edge + origin                    |
| Plugin                | 1-2       | resource limits        | sandboxed, isolated                  |
| Telemetry             | 1         | (stateful)             | central event stream                 |
| Recovery              | 1         | static                 | orchestrates failovers               |
| Auth                  | 2+        | CPU                    | JWT validation, distributed revocation|
| Progression           | 1-2       | memory                 | frequent writes                      |
| Analytics             | 1-2       | batch                  | heavy read/write                     |
| World                 | 2+        | custom (streaming)     | asset streaming coordination         |

---

## 3. Kubernetes Cluster Layout

- **Cluster**: `labforge-prod`  
  - **Node pools**:
    - `general` (CPU optimised) – API services
    - `memory` (RAM optimised) – Caches, state stores
    - `gpu-t4` – AI inference, simulation GPU workers
    - `edge` – CDN / streaming edge nodes

- **Namespaces**:
  - `labforge-system` – core platform
  - `labforge-data` – databases, queues
  - `labforge-ai` – AI services
  - `labforge-simulation` – simulation workers
  - `labforge-edge` – CDN / streaming

---

## 4. Data Persistence

- **PostgreSQL** (with TimescaleDB) – event store, user data
- **Redis Cluster** – distributed cache, locks, pub/sub
- **Qdrant** / **pgvector** – vector memory for AI
- **MinIO / S3** – asset storage
- **Kafka** – distributed event streaming backbone

All databases have asynchronous replication and failover (see `recovery-failover-topology.yaml`).

---

## 5. Networking & Ingress

- **Gateway** uses Envoy / Traefik with:
  - TLS termination (Let's Encrypt auto-renew)
  - WebSocket upgrade support
  - HTTP/2 and gRPC
  - Rate limiting per IP / user
  - Circuit breakers

- **World Streaming Edge** deployed with custom caching nodes for resumable downloads.

- **WebSocket Cluster** via Redis Pub/Sub for horizontal scaling of realtime connections.

---

## 6. Observability Stack

- **Metrics**: Prometheus (scrapes `/metrics`) + Grafana dashboards
- **Tracing**: OpenTelemetry → Grafana Tempo / Jaeger
- **Logs**: Structured JSON → Loki or ELK
- **Alerts**: Alertmanager → Recovery Alert Router

---

## 7. CI/CD & GitOps

- Git repository triggers ArgoCD for Kubernetes deployments.
- Every service has a `Dockerfile` and a Helm chart.
- Canary deployments for AI and Simulation to avoid regressions.

---

## 8. Failure Recovery

- All services report health probes.
- Recovery service watches cluster events and restarts/reschedules pods.
- Simulation and AI workers use checkpointing and can be rolled back automatically.
- Distributed cache (Redis) persists snapshots for fast recovery.

---

## 9. Security

- Network policies isolate sensitive services.
- Cert-manager for internal mTLS.
- Kubernetes secrets encrypted at rest.
- RBAC for service accounts.

---

## 10. Scaling Policies

- Horizontal Pod Autoscaler (HPA) for stateless services based on CPU/memory.
- Custom metrics (e.g., queue depth) for AI and Realtime services.
- Simulation workers scaled manually or via predictive autoscaling (see `autoscaling-runtime.yaml`).

---

## 11. Edge Presence

- World streaming edge nodes deployed in multiple regions for low-latency asset delivery.
- Offline-first enabled via service workers and local asset caching.

---

*End of topology document.*