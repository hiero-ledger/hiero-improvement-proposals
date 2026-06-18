---
hip: XXXX3
title: Consensus Node Migration to Kubernetes-Native Deployment
author: Lenin Mehedy (@leninmehedy), Nathan Klick (@nathanklick)
working-group: Bruno Marques (@brunodam), Artur Reznikov (@arturre)
requested-by: Hashgraph
discussions-to: TBD
type: Standards Track
category: Core
needs-hiero-approval: Yes
needs-hedera-review: Yes
status: Draft
created: 2026-05-03
updated: 2026-06-18
requires: XXXX0, XXXX1, XXXX2
release: TBD
---

# HIP XXXX3 - Consensus Node Migration to Kubernetes-Native Deployment

## Abstract

This proposal defines the procedure for migrating each Hedera consensus node (CN) from the
legacy Docker Compose deployment model to the Kubernetes-native Provisioner model introduced
in HIP XXXX1. Migration is a per-node, independently-timed operation that keeps the network
live throughout. Each council member migrates their own node on their own schedule using
`solo-provisioner`, with no network-wide freeze and no disruption to other nodes.

The migration procedure:

- Reuses existing host filesystem state in place — no data copy for the 2–10 TB `data/saved/`
- Targets **minutes** of actual node downtime per cutover (stop Docker CN, start K8s CN pod,
  rejoin network) — the rolling model tolerates longer downtime per node as long as the
  network-wide 1/3 threshold is respected, but minimising individual downtime reduces the
  window in which a second unexpected node failure could threaten the network
- Provides an idempotent, resumable workflow with rollback at every step before the
  point of no return
- Relies on the `solo-provisioner-daemon` (a single persistent process started at install time by
  `solo-provisioner`) to monitor the soak period via an internal goroutine and automatically
  decommission Docker once all stability criteria are met
- Allows network upgrades to proceed normally throughout the migration window via dual-format
  artifacts that serve both old-model and Provisioner-model nodes transparently

---

## Motivation

The legacy Docker Compose deployment model for Hedera consensus nodes is being replaced by the Kubernetes-native
Provisioner model defined in HIP XXXX1. This HIP addresses the one-time migration path for each of the 39 mainnet
council nodes from the old model to the new one.

Without a defined migration procedure, council members face an uncoordinated, high-risk manual process: stopping a live
consensus node, setting up a new Kubernetes environment, and restarting — with no rollback plan and no tooling. The 2–10
TB of saved Merkle state on each mainnet node makes naive approaches (copy the data, then switch) infeasible. A poorly
executed migration that takes a node offline for hours rather than minutes would reduce the network's safety margin and
increase operational risk for all participants.

This HIP defines a migration procedure that:

- Targets per-node downtime of **minutes** by reusing existing host filesystem state in place (no data copy) — longer
  downtime is tolerated by the rolling model but increases the risk window
- Provides automated, idempotent tooling (`solo-provisioner consensus node migrate`) with rollback at every step
- Provides a per-node migration cadence that allows the network to stay live throughout the migration window (≥2/3 nodes
  always online), provided operators respect the 1/3 threshold constraint
- Allows network upgrades to continue normally during the migration window via dual-format artifacts
- Provides a structured soak period: as its final step, `solo-provisioner consensus node migrate`
  activates the MigrationMonitor goroutine inside the already-running `solo-provisioner-daemon` (via Unix
  socket), which monitors stability criteria and automatically decommissions Docker when all are met

### Background

HIP XXXX1 introduces a Kubernetes-native deployment model for Hedera consensus nodes. In the
new model, each CN runs as a Kubernetes pod on a single-node cluster provisioned by
`solo-provisioner`, with lifecycle automation handled by `solo-operator` and the Upgrade
Controller (UC) sidecar. The full architecture is described in HIP XXXX1.

The existing deployment model runs each CN inside Docker Compose on a bare-metal host. A native
host daemon — the Upgrade Controller (UC) — monitors marker files written by the CN and
orchestrates container lifecycle during network upgrades.

This HIP addresses the one-time migration from the old model to the new one. It does not
modify the marker file protocol (HIP XXXX2), or the upgrade process itself.
It is purely an operational procedure for each council member to transition their node.

---

## Rationale

### Rolling Migration Instead of a Coordinated Freeze Window

Migration could have been designed as a single, network-wide event where all 39 nodes migrate simultaneously during a
freeze window. This was rejected: a 39-node coordinated migration would require an extended freeze window (hours), carry
enormous coordination risk, and provide no incremental fallback. Rolling per-node migration — one node at a time, each
node operator on their own schedule — keeps the network live throughout, provided operators respect the 1/3 threshold
constraint. Individual node downtime is not strictly bounded by the protocol; minimising it is good practice because
a longer downtime window increases the chance that a second unexpected failure coincides with the migration.

### Reuse Host Filesystem via hostPath — No Move, No Restructure

Moving or copying the Docker CN's state to a new location would be problematic for several compounding reasons:

- **Downtime**: `data/saved/` is 2–10 TB on mainnet. Copying it after stopping the Docker CN would cause
  significant downtime (> 30 minutes) — unnecessarily extending the risk window on a rolling schedule.
- **Path and permission assumptions**: The CN software has deep assumptions baked into its file paths and
  directory structure under `/opt/hgcapp/`. Relocating state or restructuring directories would require
  changes across configuration, tooling, and potentially CN code — introducing a class of subtle,
  hard-to-predict breakage.
- **Ownership and permissions**: File ownership (`hedera:hedera`, UID/GID 2000) and directory permissions
  are set by the legacy installation scripts and must remain intact. Copying or moving files risks
  silently altering ownership or modes, which can cause CN startup failures that are difficult to diagnose.
- **Rollback complexity**: If the K8s CN fails during the soak period, rollback means restarting the
  Docker CN. With files in their original location and permissions intact, this is a single command.
  After a copy or restructure, rollback becomes a multi-step data recovery operation.

Instead, the K8s CN pod is configured with `hostPath` volumes pointing at the exact same directories the
Docker CN used. Since both runtimes run on the same bare-metal host, zero data movement is needed. All
path assumptions, file ownership, and directory permissions remain untouched. The Docker CN is stopped,
the K8s CN starts in its place, and full state continuity is preserved with no copy and no restructure.

This `hostPath` reuse applies to the large, mutable **state** directories. Configuration files
(`settings.txt`, `log4j2.xml`, `application.properties`, `api-permission.properties`) are handled
differently — `plan-migration` reads them from the host and creates a dedicated Kubernetes CR for each
(e.g. `NodeSettings`, `Log4j2Config`). `solo-operator` reconciles each CR into a ConfigMap mounted into
the CN pod, so these files no longer require a `hostPath` mount after migration (see
[Configuration — ConsensusConfig Files](#configuration--consensusconfig-files) below).

### Idempotency and Rollback

The migration cutover is a sequence of steps where failure at any point (K8s API errors, pod scheduling issues, network
partition) must not leave the node in an unknown state. The workflow provides two guarantees: every step is idempotent (
re-run `solo-provisioner consensus node migrate` after fixing the root cause; it resumes from the last incomplete step),
and rollback is available before the point of no return (Step 2: stop Docker CN). Once Docker is stopped and the K8s CN
has started successfully, rollback is still available throughout the soak period because Docker data is preserved
untouched.

### Dual-Format Upgrade Artifacts During Migration Window

During the migration window, nodes are at different stages — some still on Docker Compose, others already on the
Provisioner model. Network upgrades and security patches must continue without interruption regardless of where each
node is in its migration. Upgrade artifacts therefore include both a JAR package (consumed by the legacy UC daemon) and
an OCI manifest (consumed by the UC sidecar). Each node applies whichever format matches its runtime — no cross-node
coordination is required.

### Automated Soak Period via `solo-provisioner-daemon`

A manual soak period (node operator polls metrics and decides when to decommission) is error-prone and inconsistent
across 39 node operators. The `solo-provisioner-daemon` automates this: it monitors four objective criteria (48h
clock, uploader backlog, pod stability, consensus participation) and triggers decommission automatically when all are
green. Node operators who want manual control can interrupt the daemon at any time.

## User Stories

> "As a **node operator**, I want to migrate my consensus node from Docker Compose to the Kubernetes-native model
> without copying 2–10 TB of saved state, so that my node is only offline for minutes instead of hours."

> "As a **node operator**, I want `solo-provisioner consensus node plan-migration` to read my existing Docker CN
> configuration and generate all migration artifacts automatically, so that I do not need to manually translate
> Docker Compose settings to Kubernetes CR format."

> "As a **node operator**, I want the migration workflow to be idempotent and resumable, so that if any step fails I can
> fix the root cause and re-run without repeating completed steps."

> "As a **node operator**, I want a clear rollback path — restarting the Docker CN — available throughout the soak
> period, so that I can recover immediately if the K8s CN degrades after cutover."

> "As a **node operator**, I want the `solo-provisioner-daemon` (already running as a systemd service) to automatically
> decommission Docker once my K8s CN has been stable for 48 hours and all soak criteria are green, so that I do not need
> to manually poll metrics and decide when it is safe."

> "As a **council member**, I want network upgrades to proceed normally during the migration window — without freezing
> the upgrade protocol — so that security patches and planned upgrades are never blocked by the migration schedule."

> "As a **council member**, I want each node's migration to be an independent operation that cannot stall the network,
> so that a single node operator's delay does not block the rest of the council."

## Goals

- Define a safe, repeatable per-node migration procedure that any council member can execute
- Enable network liveness throughout the entire migration window by migrating one node at a time — preserving ≥2/3 of
  nodes online, provided operators coordinate to respect the 1/3 threshold constraint
- Minimise actual node downtime per migration event — the rolling model tolerates longer downtime per node, but shorter
  downtime reduces the risk window for coincident failures
- Preserve all existing state (Merkle snapshots, stream files, credentials) without copying data
- Support network upgrades during the migration window without pausing or freezing
- Provide automated tooling (`solo-provisioner consensus node migrate`, migration soak monitoring via the
  `solo-provisioner-daemon`)
  so node operators do not need to run manual commands

## Non-Goals

- Changes to the CN software, consensus protocol, marker file protocol, or network upgrade process
- Describing the Kubernetes-native deployment architecture (covered in HIP XXXX1)
- A network-wide coordinated cutover event — each node migrates independently on its own schedule

---

## Specification

## Key Constraints

| Constraint                         | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
|------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Network liveness**               | Consensus stalls if ≥1/3 of total **stake weight** goes offline simultaneously. This is a stake-weighted threshold, not a simple node count — a single high-stake node going offline contributes more than a low-stake node. The node operator must verify this constraint via council coordination (or DevOps channels) before proceeding. In interactive (TUI) mode, `solo-provisioner` displays a prominent warning about potential catastrophic consequences and requires explicit acknowledgement. In non-interactive mode, the `--confirm-threshold` flag serves as that acknowledgement. `solo-provisioner` cannot auto-detect network-wide stake participation. |
| **Binary model state**             | A node is either fully on the old Docker Compose model or fully on the Provisioner model. There is no intermediate state. Migration takes minutes; the outcome is success, rollback to old model, or hard failure requiring manual intervention.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **No concurrent CN runtimes**      | A mainnet CN consumes the full machine (CPU, RAM, disk I/O). The Docker CN must be stopped before the K8s CN pod starts. CRI-O and the K8s cluster (without the CN pod) can coexist with Docker during Phase 0 — they are lightweight.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **State frozen at cutover**        | Stopping the Docker CN freezes all state — no new Merkle writes or stream files during the switchover. This eliminates race conditions and means no data copy is required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **No data copy or restructure**    | `data/saved/` is 2–10 TB on mainnet. Copying or relocating state would cause significant downtime and risks altering file ownership and permissions that the CN depends on. The K8s CN pod uses `hostPath` volumes pointing at the same directories the Docker CN used — zero data movement, all path and permission assumptions preserved.                                                                                                                                                                                                                                                                                                                             |
| **IP and port continuity**         | The K8s CN must answer on the same external IP and ports as the Docker CN. MetalLB assigns the same IP to the K8s LoadBalancer Service; port assignments are preserved in the Service spec. Gossip peers, proxies, and clients cannot be reconfigured per-node at migration time.                                                                                                                                                                                                                                                                                                                                                                                       |
| **Marker file protocol preserved** | The UC sidecar consumes the same marker files as the legacy UC (HIP XXXX2). No CN code changes are required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

---

## Migration Overview

Migration is a **rolling, per-node operation** across all 39 council members. Each node migrates
independently on its own schedule. The network remains live as long as operators coordinate to
keep fewer than 1/3 of nodes offline simultaneously — multiple nodes can be migrating at once,
provided the total offline stake weight stays below the threshold.

The migration for each node proceeds through four phases:

```
Phase 0 — Pre-migration preparation   (non-disruptive; Docker CN untouched)
Phase 1 — Cutover                     (brief node downtime; point of no return)
Phase 2 — Validation soak             (K8s CN running; Docker idle; rollback available)
Phase 3 — Docker decommission         (automated by solo-provisioner daemon)
```

The migration window across all 39 nodes is expected to span several weeks, with operators
proceeding on their own schedule. The actual duration depends on council coordination and
operational readiness — no hard deadline is imposed by this protocol. Network upgrades continue normally throughout the
window
using dual-format artifacts.

---

## Network Upgrades During the Migration Window

Network upgrades proceed normally during the migration window — there is no upgrade freeze.

During the window, some nodes run on the old Docker Compose model and others on the new
Provisioner model. Upgrade artifacts include **both formats**:

- **JAR content** (`data/apps/`, `data/lib/`) — consumed by old-model nodes via the legacy UC daemon
- **Manifest-based content** (`manifests/`, `data/config/`) — consumed by Provisioner-model nodes via the UC sidecar →
  NetworkUpgrade CR

Each CN applies whichever format matches its runtime, out of the box, with no cross-node
coordination:

```
Old-model node:         legacy UC daemon reads JAR from HFS → applies upgrade
Provisioner-model node: UC sidecar reads OCI manifest → creates NetworkUpgrade CR
                        → solo-operator applies upgrade
```

Both paths produce the same outcome: the CN binary is updated at the agreed freeze round.
Security patches during the migration window follow the same dual-format approach.

Once all 39 nodes have migrated to the Provisioner model, subsequent upgrade artifacts may
drop the JAR and ship OCI-only. This is the only coordination point at end-of-migration.

---

## Migration Order

Operators should migrate nodes in the following order to build confidence before touching
mainnet:

1. **Previewnet** — first; lowest risk; validates the tooling and procedure end-to-end
2. **Testnet** — second; confirms stability under realistic (but non-production) conditions
3. **Mainnet** — last; operators migrate one node at a time on their own schedule

Within mainnet, there is no prescribed per-node order. Each council member migrates when ready. However, coordination
with DevOps or council channels is strongly recommended before each cutover to confirm that the total offline stake
weight remains below the 1/3 threshold — exceeding it would stall consensus network-wide.

---

## Phase 0 — Pre-Migration Preparation

Phase 0 is fully non-disruptive. The Docker CN continues running normally throughout.
Steps must be performed in order. All Phase 0 commands are idempotent — re-running any command is always safe. Running
`solo-provisioner consensus node plan-migration` on an already-migrated node still completes
successfully: it discovers the current K8s state and produces a new timestamped plan file with a
status field indicating migration is complete and a summary of the live K8s configuration.
Running `solo-provisioner kube cluster install` on an already-provisioned cluster is a no-op.

### Step 1 — Run `solo-provisioner consensus node plan-migration`

This command reads well-known Docker Compose paths on the host and generates
migration artifacts for node operator review. It does **not** start any migration workflow or
touch the running node. No K8s cluster is required at this point.

All artifacts are written to `/opt/solo/weaver/migration/consensus/` (component-scoped subdirectory).

**Output artifacts:**

| Artifact                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `orbit.yaml`             | Pre-filled Orbit CR (node identity, deployment profile, hostPath paths)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `consensus-capsule.yaml` | Pre-filled ConsensusCapsule CR (ConsensusConfig ConfigMaps, volume mounts)                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `secrets/`               | K8s Secret manifests for TLS certs and gossip signing keys. The files contain base64-encoded private key material; do not copy or redistribute them. Apply them to the cluster once it exists (Step 2) and delete the directory immediately — do not leave private key material on disk any longer than necessary.                                                                                                                                                                                                          |
| `preflight-report.txt`   | Disk space, network reachability, IP config, image availability                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `<node-id>-<ISODATETIME>-migration-plan.yaml` | The migration plan. Named with node ID and ISO 8601 compact timestamp (e.g. `0.0.3-20260521T143022Z-migration-plan.yaml`) so multiple plans can coexist without overwriting. Persisted for two reasons: (1) **reviewability** — the node operator reads it to understand exactly what changes will be made before any destructive action is taken; (2) **deterministic resumability** — `solo-provisioner consensus node migrate --plan <path>` reads this file as its authoritative input on every invocation, so re-running after a failure executes the same plan rather than re-discovering a potentially different state. The exact format is defined by the `solo-provisioner` team. |

**Discovered sources:**

- `settings.txt`, `log4j2.xml`, `application.properties`, `api-permission.properties`
  → ConsensusConfig ConfigMap values in ConsensusCapsule spec
- Node credentials (TLS cert, gossip signing key) → K8s Secret manifests
- Stream uploader configuration (bucket name, paths, credentials) → ConsensusCapsule sidecar spec
- External IP and port assignments → K8s LoadBalancer Service manifest (MetalLB assigns the external IP; ports are
  defined in the Service spec)

The node operator reviews the generated artifacts, edits if needed, and confirms the plan
is correct before proceeding. `solo-provisioner consensus node migrate --plan <path>` reads
the specified plan file directly — what was reviewed is exactly what gets executed, with no
re-discovery at Phase 1 time.

### Step 2 — Provision the Kubernetes cluster

Once the node operator is satisfied with the migration plan, run
`solo-provisioner kube cluster install`. This single command provisions the sandboxed
Kubernetes cluster alongside the existing Docker runtime — installing CRI-O, kubelet,
kubeadm, initialising the cluster, and deploying Cilium and MetalLB. No changes are made
to the running Docker CN or its configuration.

Once the cluster is up, apply the K8s Secret manifests generated in Step 1 and immediately
delete the directory — do not leave private key material on disk any longer than necessary:

```bash
kubectl apply -f /opt/solo/weaver/migration/secrets/
rm -rf /opt/solo/weaver/migration/secrets/
```

`solo-provisioner consensus node migrate` Step 1 preflight verifies the Secrets exist in the
cluster and fails fast with a clear error if any are missing — it does not re-read or re-apply
the directory.

After the cluster is provisioned, the node operator installs the Grafana Alloy observability
stack via `solo-provisioner alloy cluster install`. This deploys Alloy as a **host-level
DaemonSet** responsible for infrastructure telemetry: host metrics (node exporter), Kubernetes
control-plane metrics (kubelet/cAdvisor), and journald logs — including all migration workflow
events from `solo-provisioner.service` and the cutover CLI commands. Alloy exports all telemetry
via OpenTelemetry (OTLP) to the operator's chosen backend.

> **Two-tier Alloy model:** `solo-operator` independently manages a separate **Alloy sidecar**
> inside the CN pod, which collects CN-specific telemetry: application metrics from `:9999` and
> the CN application log (`hgcaa.log`). The sidecar is configured via the `ConsensusCapsule` CR.
> `solo-provisioner` populates the sidecar's remote endpoint configuration when it creates the
> `ConsensusCapsule` CR during `consensus node migrate` — so node operators supply remote
> credentials **once** and `solo-provisioner` wires them into both the host DaemonSet and the
> CN sidecar.

**Configuring remote observability endpoints:**

Remote endpoint credentials (passwords) must be stored in a Kubernetes Secret named
`grafana-alloy-secrets` in the `grafana-alloy` namespace before running `alloy cluster install`.
Each password key follows the convention `PROMETHEUS_PASSWORD_<NAME>` or `LOKI_PASSWORD_<NAME>`
where `<NAME>` is the remote name in uppercase (e.g., `LOKI_PASSWORD_COUNCIL`).

The node operator provides endpoint URLs and usernames via flags at install time:

> **Note:** The URLs below are illustrative only. The actual shared council endpoint URLs and
> credentials will be determined and distributed by the council separately before the migration
> window opens.

```bash
# Pre-create the secret with passwords (provided via a secure channel before migration)
kubectl create secret generic grafana-alloy-secrets \
  --namespace grafana-alloy \
  --from-literal=LOKI_PASSWORD_COUNCIL=<password> \
  --from-literal=PROMETHEUS_PASSWORD_COUNCIL=<password>

# Install host-level Alloy DaemonSet with remote endpoint configuration
solo-provisioner alloy cluster install \
  --add-loki-remote       "name=council,url=<loki-endpoint-url>,username=<username>" \
  --add-prometheus-remote "name=council,url=<prometheus-endpoint-url>,username=<username>"
```

`solo-provisioner` reads this same configuration when creating the `ConsensusCapsule` CR and
sets the Alloy sidecar's Loki and Prometheus endpoint fields accordingly — no separate
configuration step is needed for the sidecar.

Node operators who prefer a local-only stack (no shared remote) can omit the remote flags
entirely. The shared council remote credentials are distributed to all node operators via a
separate secure channel before the migration window opens (see the Observability section and
Open Issues in HIP XXXX1).

### Step 3 — Pre-pull images

Run `solo-provisioner kube cluster prefetch-images --from-migration-plan <path>` to pre-pull all
container images referenced in the migration plan (CN, `solo-operator`, UC sidecar) into
the local CRI-O cache. This is a network-heavy operation
that should be scheduled when the node operator is comfortable consuming bandwidth and disk I/O on
the live node. Caching images before cutover ensures Phase 1 does not depend on network image
pulls during the downtime window.

`solo-provisioner consensus node migrate` Step 1 preflight verifies that all required images
are cached and fails fast if any are missing, rather than pulling mid-cutover.

---

## Phase 1 — Cutover

Phase 1 is the actual migration event. It executes as an idempotent, resumable workflow via
`solo-provisioner consensus node migrate`, using the artifacts reviewed and confirmed in Phase 0.

The workflow provides:

- **Idempotency** — each step is safe to re-run; if a step fails, fix the root cause and
  re-run `solo-provisioner consensus node migrate`; it resumes from the last incomplete step
- **Rollback** — before the point of no return, the node operator can abort; the workflow
  unwinds completed steps in reverse order, restoring the Docker CN

### Preflight — 1/3 Stake Threshold Check

Before any destructive action, the node operator must confirm that taking this node offline
will not push the total offline stake weight to ≥1/3 of the network total — the point at
which consensus stalls. This is a **stake-weighted** constraint, not a simple node count.
`solo-provisioner` cannot auto-detect network-wide stake participation — this check is the
node operator's responsibility, verified via council coordination or DevOps channels.

`solo-provisioner consensus node migrate` handles the threshold acknowledgement in two ways
depending on how it is invoked:

- **Interactive (TUI) mode** (default when run in a terminal): `solo-provisioner` displays a
  prominent warning before Step 2 explaining the stake threshold, flagging the potentially
  catastrophic consequences if ≥1/3 of stake is already offline, and recommending the node
  node operator verify with DevOps or council coordination channels first. The node operator must
  explicitly confirm in the TUI to proceed.
- **Non-interactive mode** (scripted/automated): pass `--confirm-threshold` to bypass the
  interactive prompt. The node operator is asserting they have already verified the threshold
  and takes responsibility for the check.

```
# interactive mode (default) — TUI warning displayed; node operator confirms before Step 2
solo-provisioner consensus node migrate

# non-interactive mode — threshold check bypassed; node operator has verified manually
solo-provisioner consensus node migrate --confirm-threshold
```

> **Note:** `solo-provisioner` cannot determine actual stake participation from the mirror
> node REST API — the `/api/v1/network/nodes` endpoint exposes stake values but not
> real-time consensus participation status (see Open Issues — fleet threshold detection).
> An account key is only required if `solo-provisioner` also submits HCS transactions.

### Cutover Steps

```
[Step 1]  Preflight validation
          • Disk space, network reachability, image availability
          • Verifies K8s Secrets (TLS cert, gossip key) exist in cluster; fails fast if missing
          • 1/3 stake threshold check: TUI warning + node operator acknowledgement
            (bypassed if --confirm-threshold flag is passed)
          • Idempotent; safe to re-run at any time

[Step 2]  Stop Docker Compose CN and uploaders        ← POINT OF NO RETURN
          • State is now frozen — no new Merkle writes or stream files
          • Rollback unwinds from here: Docker CN restarted, data untouched

[Step 3]  Apply LoadBalancer Service manifest + Orbit and ConsensusCapsule CRs
          • LoadBalancer Service: MetalLB (already deployed in Phase 0) assigns the same
            external IP and ports the Docker CN used — gossip peers and proxies see no
            address change. Applied after Docker CN is stopped because Cilium sets up port
            forwarding rules on Service creation — if applied while Docker CN is running,
            Cilium would intercept traffic on those ports before the K8s pod is ready,
            dropping connections meant for the live Docker CN.
          • Orbit + ConsensusCapsule CRs: hostPath volume mounts point at existing Docker
            CN directories — no data copy:
              /opt/hgcapp/services-hedera/HapiApp2.0/data/saved/   (2–10 TB in place)
              /opt/hgcapp/services-hedera/HapiApp2.0/data/stats/
              /opt/hgcapp/services-hedera/HapiApp2.0/output/
          • solo-operator reconciles and starts the K8s CN pod

[Step 4]  K8s CN pod starts
          • CN loads latest Merkle snapshot from data/saved/ (same data Docker CN left)
          • Stream uploaders start uploading from current marker files (catch up normally)
          • UC sidecar begins polling for upgrade marker files

[Step 5]  Wait for CN pod readiness
          • K8s readiness probes confirm CN is healthy

[Step 6]  Validate CN rejoined the network
          • Confirm CN is participating in consensus with gossip peers
```

**On step failure**: the node operator fixes the root cause and re-runs
`solo-provisioner consensus node migrate`.
The workflow resumes from the failed step without repeating completed ones.

**On rollback**: `solo-provisioner consensus node migrate-abort` unwinds to the pre-Step-2 state.
Idempotent — if the Docker CN is already running, the command is a no-op.
Docker CN is restarted; all host directories are unchanged.

### First-Boot Behaviour

When the K8s CN pod starts, it inherits the full directory tree left by the Docker CN — Merkle
state, stream files, logs, and credentials. No special handling is required:

- The CN loads the latest Merkle snapshot normally — it does not require that it wrote
  the snapshot itself
- Stream uploaders upload files they find; cloud object overwrites are idempotent
- The UC sidecar treats old upgrade marker files from completed Docker CN upgrades as stale
  terminal state

No code changes are required in the CN, uploaders, or UC sidecar.

---

## Phase 2 — Validation Soak

After the K8s CN pod has rejoined the network, the node enters a **validation soak period**.
During this phase:

- The node is **fully online and participating in consensus** — it is not considered "down"
- The Docker CN is stopped but **not decommissioned** — volumes and configuration are preserved
  as an immediate rollback target
- The `solo-provisioner-daemon` runs continuously, monitoring soak criteria
  (`solo-provisioner consensus node migrate` signals it to begin at the end of Phase 1)

### `solo-provisioner-daemon` — Migration Soak Monitoring

The `solo-provisioner-daemon` is a single persistent process (started as a systemd service at install time by
`solo-provisioner`) that handles both network upgrade coordination (HIP XXXX2) and migration soak
monitoring. There is no separate soak-watcher binary or service — the soak watcher runs as a **goroutine inside
the daemon process**, activated on demand via the daemon's Unix socket.

When `solo-provisioner consensus node migrate` completes Phase 1 successfully, its final step is to signal the
already-running daemon to activate the MigrationMonitor goroutine:

```
POST /migration/consensus/soak/start  on  /opt/solo/weaver/daemon/daemon.sock
```

The migration plan controls whether soak monitoring is enabled (default: true). Once
activated, the MigrationMonitor goroutine:

1. Continuously monitors all soak criteria (see below)
2. Emits a live soak status report readable at any time via `solo-provisioner consensus node status`
   (which queries `GET /migration/consensus/soak/status` on the daemon socket)
3. Automatically invokes `solo-provisioner consensus node decommission` when **all** criteria turn green
4. Writes a decommission audit log (timestamp + criteria snapshot at the moment of trigger)
5. **The goroutine exits** after decommission completes; the daemon process stays running

If the daemon restarts (crash or systemd restart), it automatically reactivates the MigrationMonitor goroutine
by reading `cutover-state.jsonl` — no re-signalling needed from the CLI.

Operators who prefer manual control can skip or interrupt soak monitoring and run
`solo-provisioner consensus node decommission` directly.

### Soak Criteria (all must be satisfied)

| Criterion                   | Threshold                                                                                                                                                                                                         |
|-----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Minimum soak time**       | ≥ 48 hours of continuous K8s CN operation since rejoining consensus                                                                                                                                               |
| **Stream uploader backlog** | No pending stream files with mtime before the cutover timestamp                                                                                                                                                   |
| **Pod stability**           | No unexpected pod restarts during the soak window — daemon queries the K8s API (`restartCount` on the CN pod) to detect restarts                                                                                  |
| **Consensus participation** | CN pod has been continuously `Ready` for the full soak window with no `CrashLoopBackOff` or scheduling gaps — measured via K8s pod status; fine-grained per-node round attribution is not available from the host |

### Rollback During Soak

If the K8s CN degrades during the soak period, the node operator can roll back at any time:

```
solo-provisioner consensus node migrate-abort
```

This stops the K8s CN pod and restarts the Docker CN. Because no data was moved, the Docker CN
picks up exactly where the K8s CN left off.

Rollback is available until `solo-provisioner consensus node decommission` completes (Phase 3). Once Docker
is decommissioned, rollback to the old model is no longer possible.

---

## Phase 3 — Docker Decommission

Decommission is triggered automatically by the `solo-provisioner-daemon` when all
soak criteria are met, or manually by the node operator.

### `solo-provisioner consensus node decommission`

```
1. Stop and remove Docker Compose services and containers (if not already stopped)
2. Remove Docker CN images and named volumes; uninstall the Docker daemon and CLI
3. Reclaim disk space
4. Write decommission audit log
```

After decommission, CRI-O is the sole container runtime on the host. The node is fully on the
Provisioner model. The `solo-provisioner-daemon`'s migration soak monitoring completes.

### Decommission Timing Recommendation

Operators should **not decommission Docker** until a significant portion of the fleet has
successfully completed Phase 1 cutover. Once Docker is decommissioned, rollback to the old
model is no longer possible on that node — if the K8s CN encounters a problem after
decommission, recovery requires restoring Docker and state from backup rather than a simple
`migrate-abort`. Decommissioning prematurely, while many peer nodes are still on Docker Compose,
leaves the node without a fast rollback path during the highest-risk period of the migration.

The recommended threshold is **≥2/3 of the fleet (≥26 of 39 nodes)** having completed Phase 1
cutover before any node operator proceeds with decommission.

#### Fleet threshold detection

The `solo-provisioner-daemon` has no built-in visibility into the migration status of
peer nodes — it runs on a single host with no central fleet registry. Two approaches are defined:

**Operator-acknowledged flag (fallback):**

The daemon gates decommission on a local flag file:

```
/opt/solo/weaver/migration/fleet-threshold-reached
```

This file is created manually by the node operator once they have received confirmation (via council
coordination channels) that ≥26 nodes have completed Phase 1. `solo-provisioner consensus node
status` displays a persistent warning if the soak criteria are otherwise green but this file
is absent:

```
⚠  Fleet threshold not yet acknowledged. Create the flag file or pass --override-fleet-check
   to decommission without it.
```

**Hedera-native fleet signal:**

`solo-provisioner consensus node migrate` submits a short memo transaction to a well-known
council-controlled Hedera account as the final step of Phase 1 (after Step 6 — CN rejoins
network). The memo encodes the node ID:

```
node-<id>-migrated-<timestamp>
```

**Prerequisite — node operator account key**: `solo-provisioner` requires access to a Hedera
account key to sign and submit this transaction. The node operator must supply their Hedera
account ID and corresponding private key via the `solo-provisioner` configuration before
Phase 1 begins. The key is used solely to sign the fleet-signal memo transaction and is never
transmitted or stored outside the node operator's host.

The daemon queries the mirror node REST API periodically to count unique node IDs in that
account's transaction history. When the count reaches ≥26, the fleet threshold is
automatically satisfied — no manual flag required. This approach is fully decentralized and
verifiable by any participant.

---

## `solo-provisioner` Command Reference

| Command                                                               | Description                                                                                                                                                                                                                                                                                                                                                                                |
|-----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `solo-provisioner kube cluster install`                               | Provision the sandboxed Kubernetes cluster alongside Docker — installs CRI-O, kubelet, kubeadm, initialises the cluster, deploys Cilium and MetalLB. Non-disruptive to the running Docker CN.                                                                                                                                                                                              |
| `solo-provisioner kube cluster prefetch-images --from-migration-plan <path>` | Pre-pull all container images referenced in the migration plan (CN, `solo-operator`, UC sidecar) into the local CRI-O cache. Also accepts a bare image reference for ad-hoc pulls. Run before Phase 1 cutover; `consensus node migrate` Step 1 preflight fails fast if required images are not cached.                                                                                     |
| `solo-provisioner consensus node plan-migration`                      | Read Docker Compose config; generate migration artifacts to `/opt/solo/weaver/migration/consensus/<node-id>-<ISODATETIME>-migration-plan.yaml`. Does not start any workflow or touch the running node.                                                                                                                                                                                    |
| `solo-provisioner consensus node migrate --plan <path>`               | Execute the Phase 1 cutover workflow using the specified plan file (e.g. `/opt/solo/weaver/migration/consensus/0.0.3-20260521T143022Z-migration-plan.yaml`). Idempotent; resumes from last failed step. Activates migration soak monitoring within the `solo-provisioner-daemon` on completion if declared in the migration plan (default: enabled). Pass `--confirm-threshold` in non-interactive/scripted mode to bypass the TUI stake-threshold prompt. |
| `solo-provisioner consensus node migrate-abort`                       | Unwind the cutover workflow; restart Docker CN. Idempotent — if the Docker CN is already running (e.g. migration was never started or rollback was already performed), the command is a no-op. Available until decommission completes.                                                                                                                                                     |
| `solo-provisioner consensus node decommission`                        | Remove Docker daemon and reclaim disk space. Writes audit log.                                                                                                                                                                                                                                                                                                                             |
| `solo-provisioner consensus node status`                              | Show current soak status: criteria met/unmet, time elapsed, outstanding issues.                                                                                                                                                                                                                                                                                                            |

---

## State and Credential Handling

### State — No Copy Required

| Data                                             | Location                                             | Handling                                                                        |
|--------------------------------------------------|------------------------------------------------------|---------------------------------------------------------------------------------|
| `data/saved/` — Merkle state snapshots (2–10 TB) | `/opt/hgcapp/services-hedera/HapiApp2.0/data/saved/` | hostPath mount — same path, no copy                                             |
| `data/stats/` — node statistics                  | `/opt/hgcapp/services-hedera/HapiApp2.0/data/stats/` | hostPath mount — same path, no copy                                             |
| `output/` — logs                                 | `/opt/hgcapp/services-hedera/HapiApp2.0/output/`     | hostPath mount — same path, no copy                                             |
| `config.txt` — legacy address book               | host path                                            | hostPath mount — deprecated; stays in place until NetworkGenesis CR replaces it |

### Configuration — ConsensusConfig Files

`solo-provisioner consensus node plan-migration` reads the following configuration files from the Docker CN
installation and creates a dedicated Kubernetes CR for each, consistent with the ConsensusConfig delivery
model defined in HIP XXXX1:

- `settings.txt` → `NodeSettings` CR
- `log4j2.xml` → `Log4j2Config` CR
- `application.properties` → `ApplicationProperties` CR
- `api-permission.properties` → `ApiPermissions` CR

These configuration files are never embedded in the `Orbit` or `ConsensusCapsule` specs. `solo-operator` reconciles each
CR into a Kubernetes `ConfigMap` and volume-mounts it into the CN pod. After migration, these files are no
longer read from the host filesystem — configuration state lives in etcd as dedicated CRs. Post-migration
config changes follow the standard upgrade path: apply a new deployment package containing updated files
under `data/config/`; the daemon creates updated dedicated CRs; reconcilers update the ConfigMaps.

The one exception is `config.txt` (the legacy address book), which retains a `hostPath` mount. It is an
infrastructure concern (network topology), not a ConsensusConfig file, and does not go through the dedicated
CR path. It stays in place until the `NetworkGenesis` CR supersedes it, at which point the `hostPath` mount
is dropped entirely.

### Credentials

| Credential                      | Migration procedure                                                                                           |
|---------------------------------|---------------------------------------------------------------------------------------------------------------|
| TLS certificate and private key | `consensus node plan-migration` generates a K8s Secret manifest; node operator applies before Phase 1         |
| Gossip signing key              | `consensus node plan-migration` generates a K8s Secret manifest; node operator applies before Phase 1         |
| Stream uploader credentials     | Discovered from Docker Compose config; stored as K8s Secrets; referenced by the ConsensusCapsule sidecar spec |

---

## Stream Uploader Continuity

The stream uploaders (record stream, event stream, account balance) start immediately when the
K8s CN pod starts. They discover stream files via marker files and begin uploading from the
current state — the same behaviour as after any restart.

The Cheetah stream uploader similarly discovers its upload state from marker files on startup
and catches up without cursor preservation.

There is no gap in stream uploads during the cutover. The upload state is frozen at the moment
the Docker CN stops; the K8s uploaders resume from that exact point.

## Impact on Mirror Node

No impact.

## Impact on SDK

No impact.

---

## Backwards Compatibility

During the migration window, nodes on the old Docker Compose model and nodes on the new
Provisioner model coexist on the same network without any protocol changes. This is guaranteed
by HIP XXXX2, which locks in the marker file protocol as the interface between the CN and its
orchestrator — the legacy UC daemon and the new UC sidecar both consume the same marker files.

Nodes on either model participate in consensus identically. Other nodes, clients, proxies, and
monitoring systems observe no difference.

---

## Observability

Migration observability follows the same three-channel model used by the upgrade protocol
(HIP XXXX2): a crash-safe JSONL events file on disk, structured logs exported via OpenTelemetry
to operator-chosen backends, and Kubernetes Events visible via `kubectl describe`.

All JSONL event entries use the same schema as the upgrade protocol (HIP XXXX2 § Observability):

```json
{
  "ts":          "<RFC3339 UTC timestamp>",
  "level":       "INFO | WARN | ERROR",
  "reason":      "<event reason — see tables below>",
  "msg":         "<human-readable detail>",
  "nodeId":      "<account ID of this node, e.g. 0.0.3>"
}
```

Additional context fields (e.g. `step`, `name`, `duration_seconds`, `criteria`) are appended per entry
where relevant.

### `consensus node migrate` — Cutover Workflow Events

The cutover workflow writes a JSONL event file during execution, providing a crash-safe
record of every step. Each entry captures the step name, status, and timestamp. On
re-run after a failure, the file is appended to — it is never overwritten.

| Reason                                  | Level   | When                                                           |
|-----------------------------------------|---------|----------------------------------------------------------------|
| `PreflightStarted`                      | `INFO`  | Step 1 begins                                                  |
| `PreflightPassed` / `PreflightFailed`   | `INFO` / `ERROR` | 1/3 threshold check result                            |
| `CutoverStepStarted`                    | `INFO`  | Each step begins (step name in `name` field)                   |
| `CutoverStepCompleted`                  | `INFO`  | Each step succeeds                                             |
| `CutoverStepFailed`                     | `ERROR` | Any step fails (error detail in `msg`)                         |
| `CutoverCompleted`                      | `INFO`  | All 6 steps succeeded; K8s CN online                           |
| `MigrateSoakActivated`                  | `INFO`  | `solo-provisioner.service` migration soak monitoring activated |

Sample entry:

```jsonl
{
  "ts": "2026-05-13T10:14:22Z",
  "level": "INFO",
  "reason": "CutoverStepCompleted",
  "msg": "Step 2 stop_docker_cn completed in 4s",
  "nodeId": "0.0.3",
  "step": 2,
  "name": "stop_docker_cn",
  "duration_seconds": 4
}
```

### `consensus node migrate-abort` — Abort Audit Trail

`migrate-abort` appends a single entry to the migration audit log and updates
the migration state file (`cutover-state.jsonl`) to `status: aborted`.

```jsonl
{
  "ts": "2026-05-13T11:02:05Z",
  "level": "INFO",
  "reason": "MigrateAbort",
  "msg": "Migration aborted by operator; Docker CN restarted",
  "nodeId": "0.0.3",
  "trigger": "operator_initiated",
  "docker_cn_restarted": true
}
```

### `solo-provisioner-daemon` — Migration Soak Observability

The daemon uses the same three-channel observability model as for network upgrades (HIP XXXX2):

**Channel 1 — JSONL events file (primary, crash-safe)**

Location: `/opt/solo/weaver/migration/soak-events.jsonl` (fixed name — soak monitoring
happens once per node; see the `consensus node migrate` section above for the cutover events
file). No retention rotation is needed — the file is superseded only if the node is fully
decommissioned and re-provisioned from scratch.

| Reason                    | Level   | When                                                                                                       |
|---------------------------|---------|------------------------------------------------------------------------------------------------------------|
| `SoakStarted`             | `INFO`  | Daemon starts; records cutover timestamp and 48h deadline                                                  |
| `SoakCheck`               | `INFO`  | Every polling interval (default 15 min); records all criterion values in context fields                    |
| `CriterionMet`            | `INFO`  | First time any individual criterion transitions to green                                                   |
| `FleetThresholdReached`   | `INFO`  | Flag file detected; ≥26 nodes migrated                                                                     |
| `DecommissionTriggered`   | `INFO`  | All criteria green; invoking `decommission`                                                                |
| `DecommissionCompleted`   | `INFO`  | Docker removed; migration soak monitoring complete; MigrationMonitor goroutine exits; daemon continues running |

**Channel 2 — Structured logs via OpenTelemetry**

The MigrationMonitor goroutine logs to the daemon's stdout (`StandardOutput=journal` in `solo-provisioner.service`). Logs
are collected by journald and picked up by the host-level OpenTelemetry Collector, which exports them to the
operator's chosen backend. This enables real-time alerting — e.g., alert if no `soak_check` event within 30 minutes
(daemon stopped unexpectedly).

**Channel 3 — Kubernetes Events on the ConsensusCapsule**

The daemon has kubeconfig access and emits K8s Events on the ConsensusCapsule resource
for visibility via `kubectl describe consensuscapsule`:

| Reason                  | Type    | When                                                      |
|-------------------------|---------|-----------------------------------------------------------|
| `SoakStarted`           | Normal  | Daemon starts monitoring                                  |
| `FleetThresholdReached` | Normal  | ≥26 of 39 nodes have completed Phase 1                    |
| `DecommissionTriggered` | Normal  | All criteria green; decommission beginning                |
| `DecommissionCompleted` | Normal  | Docker removed; MigrationMonitor goroutine exits; daemon continues running |
| `SoakCriterionFailed`   | Warning | A previously-green criterion regressed                    |

### Decommission Audit Log

The decommission audit log (`/opt/solo/weaver/migration/decommission-audit.log`) is
append-only NDJSON and is written by both the daemon and by manual invocations of
`consensus node decommission`. This ensures the audit record is complete regardless
of whether decommission was triggered automatically or by the node operator.

---

## Security Implications

### Credential Migration

Node credentials (TLS certs, gossip signing keys) are migrated from Docker Compose volume
mounts to Kubernetes Secrets. The `secrets/` output directory produced by `plan-migration`
contains base64-encoded private key material in plain YAML — treat these files as sensitive
and do not copy or redistribute them. Apply them immediately after the cluster is provisioned
(Phase 0 Step 2) and delete the directory in the same step — do not leave private key material
on disk any longer than necessary:

```bash
kubectl apply -f /opt/solo/weaver/migration/secrets/
rm -rf /opt/solo/weaver/migration/secrets/
```

`solo-provisioner consensus node migrate` Step 1 preflight verifies the Secrets exist in the
cluster and fails fast if any are missing. Operators should also confirm that K8s Secrets are
appropriately access-controlled (etcd encryption at rest) on their cluster before proceeding
with Phase 1.

### Rollback Window

Docker data directories are preserved throughout the soak period (Phase 2). The node operator
retains the ability to roll back to the old model at any time before decommission. This window
should be kept as long as needed to establish confidence, but operators should balance this
against the risk of maintaining two runtimes on the host indefinitely.

### Network Liveness During Migration

Step 1 preflight gates each cutover on node operator acknowledgement that at least 1/3 of stake will
remain on the old deployment model (via the TUI or `--confirm-threshold`). Solo-provisioner does
not auto-detect network-wide stake participation, so maintaining liveness during migration depends
on operators honoring this acknowledgement gate when scheduling cutovers.

---

## Rejected Ideas

**Coordinated freeze-window migration (all 39 nodes at once).** A single migration event during an extended freeze
window would require all 39 operators to be ready simultaneously and would freeze the network for hours. Rejected in
favour of rolling per-node migration which keeps the network live and limits coordination requirements.

**Copying or relocating state to a new location before starting the K8s CN.** Beyond the significant downtime (> 30
minutes for 2–10 TB), moving files risks altering ownership (`hedera:hedera`, UID/GID 2000) and permissions, breaking
the path assumptions baked into the CN software, and turning a single-command rollback into a multi-step data recovery.
Rejected in favour of hostPath reuse — the K8s CN mounts the exact same host directories the Docker CN used, with zero
data movement and all assumptions intact.

**Feature flag in the CN for first-boot with inherited directories.** An early proposal required code changes to the CN,
UC sidecar, and stream uploaders to skip processing files written by the Docker CN on first boot. Rejected because the
CN loads the latest Merkle snapshot normally regardless of who wrote it, stream uploads to cloud storage are idempotent,
and old upgrade marker files are stale terminal state. No code changes are required.

**Threshold-based upgrade protocol switch (switch when ≥2/3 nodes on K8s).** An early design proposed switching the
upgrade protocol from JAR-based to OCI-based when the network majority crossed a threshold. This was rejected because it
required cross-node coordination, a central registry of migration status, and complex governance around the crossover
moment. The dual-format artifact approach — each node applies whichever format matches its runtime — is simpler and
requires no coordination.

**Running Docker CN and K8s CN simultaneously during cutover.** Running both runtimes with active CN pods was considered
to reduce downtime. Rejected because a mainnet CN is tuned to consume the full machine (CPU, RAM, disk I/O); concurrent
operation causes resource contention that would degrade consensus performance.

## How to Teach This

This section describes how node operators and council members should be onboarded to the migration procedure.

### For Node Operators

Migration follows four phases. Before starting, ensure you have completed the HIP XXXX1 deployment prerequisites (CRI-O
installed, `solo-provisioner` available).

**Phase 0 — Preparation (non-disruptive, Docker CN untouched):**

1. Run `solo-provisioner consensus node plan-migration` — generates all migration artifacts from your existing Docker CN
   configuration. Review the generated YAML and preflight report. Edit if needed.
2. Pre-pull the CN OCI image via CRI-O to avoid image pull time during cutover.

**Phase 1 — Cutover (brief node downtime; target minutes with Phase 0 complete):**

1. Run `solo-provisioner consensus node migrate --confirm-threshold` — executes the 7-step
   workflow. If any step fails, fix the root cause and re-run; it resumes from where it left off.
2. The node is offline from Step 2 (stop Docker CN) until Step 6 (CN rejoins network) — typically under 10 minutes.
3. If the cutover fails and you want to abort: run `solo-provisioner consensus node migrate-abort` to restart the Docker
   CN.

**Phase 2 — Soak (48h minimum, automated):**

- The `solo-provisioner-daemon` activates migration soak monitoring if declared in the migration plan (default:enabled).
  Check soak
  progress with `solo-provisioner consensus node status`.
- Docker remains stopped but intact — rollback is available at any time via
  `solo-provisioner consensus node migrate-abort`.

**Phase 3 — Decommission (automatic):**

- The daemon triggers `solo-provisioner consensus node decommission` automatically when all soak criteria are green. No
  action required unless you prefer manual control.

### For Council Members

No direct action is required. Each node operator migrates their own node independently. The network remains live
throughout — at most one node is offline at any time during a migration cutover.

Network upgrades continue to work normally during the migration window. If the council issues an upgrade while some
nodes are on Docker Compose and others on K8s, both sets of nodes receive and apply the upgrade using their respective
format (JAR or OCI manifest).

## Reference Implementation

- `hashgraph/solo-provisioner` (solo-weaver) — `consensus node plan-migration/migrate/migrate-abort/decommission/status`
  commands, migration soak monitoring (integrated into the `solo-provisioner-daemon`)
- `hashgraph/solo-operator` — no changes required for migration
- `hiero-ledger/hiero-consensus-node` — no changes required for migration

## Open Issues

| # | Item                                    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
|---|-----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | **Dual-format artifact build pipeline** | The upgrade artifact build process must produce both JAR-based and OCI manifest packages for the full duration of the migration period — not just within a single network's migration window. Because migration proceeds network by network (previewnet → testnet → mainnet) and each network migrates node by node, dual-format output must be sustained until the last mainnet node has completed Phase 3. Once all mainnet nodes have completed migration, JAR-based artifact production is retired and only manifest-based packages are produced going forward. The trigger and retirement process is the responsibility of the platform engineering team; out of scope for this HIP. |
| 2 | **Post-decommission recovery**          | The HIP covers rollback during the soak period (restart Docker CN). Once Docker is decommissioned in Phase 3, no recovery path back to Docker is documented. If the K8s CN degrades after decommission, recovery is via the standard upgrade protocol (solo-provisioner fix) or council coordination. Whether a post-decommission rollback path should be formally specified requires further discussion.                                                                                                                                                                                                                                                                                 |
| 3 | **Migration ordering recommendation**   | The 1/3 offline constraint is specified, but no recommended or required migration order is defined (e.g. whether nodes should be migrated in geographically distributed batches to limit correlated risk). A migration ordering recommendation or policy should be produced before the migration window opens.                                                                                                                                                                                                                                                                                                                                                                            |

---

## References

- [HIP XXXX0 - Consensus Node Deployment Package](hip-xxxx0%20-%20consensus-node-deployment-package.md)
- [HIP XXXX1 - Kubernetes-Native Consensus Node Deployment](hip-xxxx1%20-%20network-deployment.md)
- [HIP XXXX2 - Globally Synchronized Network Upgrade Process](hip-xxxx2%20-%20network-upgrade.md)
- [Grafana Alloy](https://grafana.com/docs/alloy/latest/)

## Copyright/License

This document is licensed under the Apache License, Version 2.0 — see [LICENSE](../LICENSE)
or https://www.apache.org/licenses/LICENSE-2.0.
