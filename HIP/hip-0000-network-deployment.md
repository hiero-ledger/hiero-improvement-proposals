---
hip: XXXX1
title: Kubernetes-Native Consensus Node Deployment
author: Lenin Mehedy (@leninmehedy), Nathan Klick (@nathanklick)
working-group: Bruno Marques (@brunodam), Artur Reznikov (@arturre)
requested-by: Hashgraph
discussions-to: TBD
type: Standards Track
category: Core
needs-hiero-approval: Yes
needs-hedera-review: Yes
status: Draft
created: 2026-05-01
updated: 2026-05-03
requires: XXXX0
release: TBD
---

# HIP XXXX1 - Kubernetes-Native Consensus Node Deployment

## Abstract

This proposal introduces a Kubernetes-native deployment model for Hedera consensus nodes (CNs), designed to address the
operational challenges and limitations of the legacy Docker Compose approach. Instead of a disruptive cut-over, the new
model provisions a single-node Kubernetes cluster in parallel on each bare-metal host, isolated from the existing Docker
environment via CRI-O. Consensus nodes are managed as Kubernetes pods, with lifecycle automation provided by a new
kubernetes operator (`solo-operator`) and host-level integration are handled by `solo-provisioner` and background
services.

This architecture brings declarative management, improved reliability, and streamlined upgrades to Hedera node
operations. The document details the architecture, components, and provisioning sequence, while migration procedures are
covered in a separate HIP.

---

## Motivation

### Current Deployment Model

Each Hedera consensus node runs on a dedicated bare-metal machine. Today, the node software and its ancillary services
(stream uploaders, Upgrade Controller) are managed by Docker Compose:

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         Bare Metal Host Machine                      │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                        Docker Compose                          │  │
│  │                                                                │  │
│  │  ┌─────────────────────┐   ┌────────────────────────────────┐  │  │
│  │  │  Consensus Node     │   │  Record Stream Uploader        │  │  │
│  │  │  (HederaNode.jar)   │   └────────────────────────────────┘  │  │
│  │  │                     │   ┌────────────────────────────────┐  │  │
│  │  │                     │   │  Event Stream Uploader         │  │  │
│  │  │                     │   └────────────────────────────────┘  │  │
│  │  │                     │   ┌────────────────────────────────┐  │  │
│  │  │                     │   │  Account Balance Uploader      │  │  │
│  │  └─────────────────────┘   └────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Upgrade Controller (UC) — native host process                 │  │
│  │  Watches marker files, rebuilds images, restarts containers    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

This model has served the network well, but as the network grows, it presents several critical disadvantages:

- **Manual, Imperative Operations**: Node deployment and upgrades rely on a collection of bash scripts, many of which
  run with root privileges. This approach is opaque, hard to audit, and error-prone. Failures are difficult to debug,
  and there is no built-in mechanism for retry or crash recovery—leading to increased downtime risk and operational
  toil.
- **Lack of Deterministic Builds**: Each node builds its own Docker images from JAR files in the upgrade package. This
  can result in subtle inconsistencies between nodes, making troubleshooting and root-cause analysis more difficult.
- **Cumbersome, Slow Upgrades**: Upgrade packages are large (~100 MB) and must be uploaded to the Hedera File System in
  thousands of transactions, taking significant time and increasing the chance of errors or partial upgrades.
- **No Declarative Source of Truth**: There is no single, authoritative description of the desired state for each node.
  This makes it easy for configuration drift to occur, and hard to ensure all nodes are running the correct software and
  settings.
- **Limited Observability and Self-Healing**: The current orchestration does not automatically recover from failures,
  nor does it provide detailed, structured status reporting. Operators may not be alerted to issues until they cause
  outages or data loss.
- **Rigid Docker Dependency**: Docker is tightly coupled as both the container runtime and the upgrade execution
  environment. This makes it difficult to adopt new runtimes, isolate workloads, or migrate to more modern orchestration
  platforms.

As the network scales and the need for reliability, security, and operational efficiency increases, these limitations
become unsustainable. A new approach is required to support future growth and resilience.

### Motivation for a New Model

The new model is built on two distinct layers, each solving a different set of problems.

#### What Kubernetes Provides

Replacing Docker Compose with Kubernetes as the container orchestration layer directly addresses the operational pain
points of the current model:

- **Declarative, auditable state**: Kubernetes resources provide a single source of truth for node configuration,
  software versions, and sidecars — making configuration drift detectable and every change trackable.
- **Self-healing**: Kubernetes continuously monitors workload health and automatically recovers from container crashes,
  OOM kills, and scheduling failures — without manual intervention.
- **Infrastructure-as-Code**: Cluster provisioning, OS tuning, and workload deployment are encoded as reproducible
  workflows, not manual runbooks — making node setup repeatable and auditable.
- **Seamless migration**: CRI-O runs in parallel with Docker, enabling a non-disruptive per-node migration path without
  requiring a coordinated network-wide cutover (see HIP XXXX3).
- **Consistent tooling across environments**: The same Kubernetes primitives (StatefulSet, ConfigMap, Service, Secret)
  underpin development, testnet, and mainnet deployments — reducing the gap between what is tested and what runs in
  production.

These benefits apply to any Kubernetes-based deployment, with or without a custom operator.

#### What the Kubernetes Operator (`solo-operator`) Adds

Standard Kubernetes primitives are not sufficient for Hedera-specific lifecycle management. The `solo-operator` provides
the domain logic that Kubernetes itself cannot:

- **Network upgrade protocol**: The NetworkUpgrade CR chain (`NetworkUpgradePrepare` → `NetworkUpgradeFreeze` →
  `NetworkUpgradeExecute`) encodes the globally-synchronized, council-governed upgrade protocol defined in HIP XXXX2.
  No generic Kubernetes primitive can model this multi-phase, cross-node-coordinated state machine.
- **Operator-managed configuration**: All CN configuration files (`log4j2.xml`, `throttles.json`,
  `application.properties`, and any future types) are managed through the operator as Kubernetes ConfigMaps via
  dedicated CRs — the same mechanism at initial provisioning and at upgrade time. The CN never receives
  configuration from outside this path.
- **Faster, smaller upgrades**: The upgrade package shrinks from ~100 MB (JARs + scripts) to a few kilobytes (manifest
  only). Software is delivered as OCI images pulled from council-hosted registries, eliminating thousands of HFS
  transactions.
- **Secure, verifiable upgrades**: Upgrade manifests include cryptographic hashes for all container images, allowing
  each council member to independently verify the software running on their node before it is applied.
- **Profile-driven lifecycle**: The operator adapts node behaviour based on the deployment profile
  (`provisionerDaemonEnabled`), supporting both bare-metal mainnet nodes and fully-managed cluster-only environments
  through a single CR-driven interface.

By separating what Kubernetes provides from what the operator adds, it is clear that the operator is not a workaround
for Kubernetes limitations — it is the Hedera-domain layer that makes Kubernetes operationally meaningful for consensus
node management.

---

## Rationale

### Why a Single-Node Kubernetes Cluster Per Host?

Each council member controls exactly one node, and there is no operational reason to federate control planes. A
single-node cluster gives each council member:

- **Full operator ownership**: The operator (and its RBAC) is entirely under the control of the council member.
- **No cross-node cluster risk**: A fault in one node's cluster cannot affect any other node's cluster.
- **Simpler networking**: No multi-node CNI configuration; Cilium runs in single-node mode.

### Why CRI-O Instead of containerd?

Podman and Docker are not supported Kubernetes runtimes. CRI-O is developed in lockstep with the CNCF
and is the de facto container runtime with direct support from the Kubernetes team.

containerd is a viable option but would directly conflict with the version installed by Docker Engine.
containerd uses hardcoded paths in its code, making it impossible to easily install another version
alongside the one installed with Docker Engine. CRI-O has no such constraint.

CRI-O has an identical stability level compared to containerd, but is also typically certified by the
Kubernetes team to work with new and upcoming features before containerd has been fully vetted. CRI-O
has better integration with Kubernetes in some aspects and an easier to manage configuration and
deployment model.

We are already running CRI-O on every block node deployed by `solo-provisioner` today. Switching to
containerd would be a major change with no material benefit.

### Why etcd on hostPath?

Storing etcd data on a `hostPath` volume (rather than an in-cluster PVC) allows the Kubernetes cluster itself to
be torn down and reinstalled as part of an infrastructure upgrade, without losing any CR state. All CRDs, operator
state, and upgrade audit records are immediately available to the newly-installed cluster without any restore step.

### Why a Host Daemon for Infrastructure Upgrades?

Operations that require changing the Kubernetes cluster itself (e.g., upgrading kubeadm, reinstalling the CNI,
upgrading the CRI-O runtime) cannot be performed from within a pod running on that cluster. A host-level daemon with
`systemd` management is the natural fit: it has root access, can tear down and reinitialise the cluster, and can
update its own binary as part of a self-upgrade protocol.

### Why Are Proxies Optional on Mainnet?

On mainnet, each council member's bare-metal machine must dedicate its full CPU, memory, and I/O capacity to the
consensus node. Co-locating proxy processes on the same machine would introduce resource contention that could
degrade consensus performance. Mainnet proxies are therefore expected to run on separate infrastructure — a
separate machine or VM — managed independently by the node operator using whatever tooling they already have in
place (HAProxy, Envoy, or otherwise).

Mandating a migration to `solo-operator`-managed proxies on mainnet would impose an unnecessary coordination burden
and risk for a migration that delivers no direct consensus benefit. The `HAProxyCapsule` and `EnvoyProxy` CRDs ship
with solo-operator and are available to mainnet node operators who wish to adopt them, but are primarily intended for
the
development and testing deployment profile where a unified single-cluster setup dramatically simplifies tooling.

### Why Keep the Marker File Protocol?

The `hiero-consensus-node` upgrade protocol (writing `execute_immediate.mf`, `freeze_scheduled.mf`, etc.) is a
well-tested, battle-hardened mechanism. Changing it would require modifying the consensus node itself, which is a
much higher-risk change. Instead, the UC sidecar acts as a translator: it observes the existing marker files and
emits the corresponding Kubernetes CRs, giving the Kubernetes-native control plane a clean interface without
requiring protocol changes in the CN.

### Why Is the Operator the Single Source of Truth for CN Configuration?

All CN configuration files — `log4j2.xml`, `settings.txt`, and any future types — are managed exclusively by
`solo-operator` via dedicated Kubernetes CRs (`NodeSettings`, `Log4j2Config`, `ApplicationProperties`, etc.). The
daemon/UC creates these CRs; the operator validates and reconciles them into the appropriate ConfigMap volumes that
the CN reads. The CN never receives configuration from outside this path. This design ensures:

- **Consistency across topologies**: Whether running with `provisionerDaemonEnabled: true` (Mainnet) or `false`
  (cluster-only), the CN always gets its configuration from the same operator-managed ConfigMaps — there is no
  topology-specific config delivery path to maintain.
- **Single source of truth**: Configuration state lives in etcd (persisted on hostPath), not scattered across
  upgrade packages or host filesystems. Drift is detectable and reconcilable.
- **Auditability**: Every config change is a CR update, versioned in etcd, visible via `kubectl`.

**ConsensusConfig files** (`application.properties`, `throttles.json`, `feeSchedules.json`,
`api-permission.properties`, etc.): delivered under `data/config/`; `log4j2.xml` and `settings.txt` are
delivered at the **package root** (K8s-native tooling has explicit logic to find them there). The daemon
scans `data/config/` and the package root for these two, and for each recognised filename creates the corresponding
dedicated Kubernetes CR → operator's CR reconciler performs domain-specific validation and updates the
ConfigMap → CN picks up via volume mount. The filename-to-CR-kind mapping is hardcoded in the daemon/UC; no
dispatch field is required in the package manifests. Files must be under **1 MB**.

**Large files** (too large for CR delivery): referenced in `manifests/external-files.yaml` and downloaded by
the UC sidecar or daemon before or during the freeze window as specified by the `phase` field.

> The full package directory structure and manifest schemas (`consensus-node-components.yaml`,
> `infrastructure-versions.yaml`, `state-sources.yaml`, `external-files.yaml`) are specified in
> **HIP XXXX0 — Consensus Node Deployment Package Specification**.

**Adding a new ConsensusConfig file type** — because config file dispatch is driven by filename, introducing a
new ConsensusConfig file type requires no change to the package manifest schema. The package simply includes the
new file alongside an updated `infrastructure-versions.yaml` that declares the minimum infra version required to
handle it. During the execute phase, the daemon upgrades infra first (daemon/UC and operator, which now recognise
the new filename and CR kind), and only then proceeds to ConsensusConfig CR creation — so the new file type and
its handler are guaranteed to be co-deployed in the same freeze window. The `infrastructure-versions.yaml`
minimum-version gate prevents any node from processing the new file if its infra is below the required version.

### Single-Window Upgrade: Infra and CN Together

Every upgrade — whether it includes infrastructure changes, CN changes, or both — is executed within a
**single freeze window**. The freeze protocol is unchanged: every window goes through the same
`PREPARE_UPGRADE → FREEZE_UPGRADE → FREEZE_COMPLETE` sequence.

During the execute phase, the daemon performs in order: InfraConfig file placement, infra upgrade (if needed),
ConsensusConfig CR creation, wait for operator reconciliation, then signals `PendingNodeUpgrade`. The
`manifests/infrastructure-versions.yaml` file in the package specifies the required infra component versions.
The daemon reads this file as a safety gate — if the installed operator or daemon is below the declared
minimum, the UC blocks the upgrade and the node operator must manually upgrade the infra stack first.
Once all steps complete, the daemon signals `PendingNodeUpgrade` by setting a status condition on the
`NetworkUpgradeExecute` CR — see **HIP XXXX2** for the full daemon-to-operator handoff protocol.

---

## User Stories

> "As a **council member**, I want each consensus node to run as a Kubernetes pod with a declarative CR, so that the
> desired state of every node is auditable and version-controlled."

> "As a **council member**, I want OCI container images built deterministically from the published Dockerfile, so that I
> can independently verify the software running on any node matches what I reviewed and approved."

> "As a **node operator**, I want the K8s cluster and all node services to be provisioned by `solo-provisioner` in a
> single, idempotent workflow, so that I can reproducibly set up and recover a node without manual steps."

> "As a **node operator**, I want `solo-operator` to automatically reconcile the desired state from CRs and restart pods
> on failure, so that transient process crashes are self-healing without my intervention."

> "As a **node operator**, I want etcd state to be preserved on a hostPath volume that survives cluster teardown, so
> that infrastructure upgrades do not lose in-flight upgrade CR state."

> "As a **node operator**, I want the Mainnet deployment profile to use hostPath volumes for node state, so that the ~10
> TB saved state is never copied during upgrades or migrations."

> "As a **node operator**, I want to configure whether `solo-provisioner-daemon`-assisted upgrades are enabled
> via a single boolean field (`provisionerDaemonEnabled`) on the Orbit CR, so that the correct volume type, daemon
> configuration, and infra upgrade behaviour are applied automatically for my environment."

---

## Specification

### Deployment Topology

This HIP defines two deployment profiles that share the same Kubernetes-native foundation but differ in
host access and infrastructure ownership:

- **Mainnet profile** — the node runs on a dedicated bare-metal host. The operator controls the full
  machine: the Kubernetes cluster is self-provisioned by `solo-provisioner`, the `solo-provisioner-daemon`
  runs as a systemd service outside the cluster, and node state is stored on `hostPath` volumes that
  survive cluster teardown. Infrastructure upgrades (Kubernetes, CRI-O, host binaries) are performed by
  the daemon.

- **Cluster-only profile** — the Kubernetes cluster is pre-provisioned and managed by an external
  platform (e.g. GKE, EKS, AKS, or any managed Kubernetes service). There is no bare-metal host access
  and no `solo-provisioner-daemon`. Node state is stored on `PersistentVolumeClaim` volumes. The UC
  sidecar absorbs the daemon's role at upgrade time. Infrastructure upgrades are not supported — the
  platform manages the cluster lifecycle. This profile is also used for development and testing
  single-machine deployments.

#### Mainnet Topology

On mainnet, each council member's bare-metal host runs only the consensus node and its directly-coupled sidecars.
Proxies are managed independently by the node operator — existing proxy infrastructure (e.g., HAProxy running
outside Kubernetes) is expected to remain in place on mainnet and is not required to migrate to the
`solo-operator` model:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    Bare Metal Host Machine (Mainnet CN)                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │            Single-Node Kubernetes Cluster (CRI-O)               │    │
│  │                                                                 │    │
│  │  ┌──────────────────────────────────────────────────────────┐   │    │
│  │  │  ConsensusCapsule Pod                                    │   │    │
│  │  │                                                          │   │    │
│  │  │  ┌──────────────┐  ┌───────────┐  ┌──────────────────┐   │   │    │
│  │  │  │ consensus-   │  │  UC       │  │  telemetry       │   │   │    │
│  │  │  │ node         │  │ sidecar   │  │  sidecar         │   │   │    │
│  │  │  └──────────────┘  └───────────┘  └──────────────────┘   │   │    │
│  │  │                                                          │   │    │
│  │  │  ┌──────────────┐  ┌───────────┐  ┌──────────────────┐   │   │    │
│  │  │  │ blocks-      │  │ records-  │  │ events-          │   │   │    │
│  │  │  │ uploader     │  │ uploader  │  │ uploader         │   │   │    │
│  │  │  └──────────────┘  └───────────┘  └──────────────────┘   │   │    │
│  │  └──────────────────────────────────────────────────────────┘   │    │
│  │                                                                 │    │
│  │  ┌────────────────────────┐                                     │    │
│  │  │  solo-operator         │                                     │    │
│  │  │  (in-cluster pod)      │                                     │    │
│  │  └────────────────────────┘                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Host-Level Services                                            │    │
│  │  • solo-provisioner daemon  (systemd service, host-level, outside cluster) │
│  │  • Docker Compose CN        (present only during migration transition)     │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘

         ▲ network traffic
         │
┌────────┴─────────────────────────────────────────────────────────────────┐
│  Proxy Infrastructure  (managed independently by the node operator)      │
│  • HAProxy / Envoy / other — existing tooling, separate machine or VM    │
│  • How proxies are deployed and managed is the node operator's choice    │
│  • solo-operator HAProxyCapsule / EnvoyProxy CRDs are available for      │
│    operators who choose to adopt them, but are NOT required on mainnet   │
└──────────────────────────────────────────────────────────────────────────┘
```

All 39 council-member nodes on mainnet run independent single-node Kubernetes clusters. They are not federated or
connected at the Kubernetes level; coordination happens exclusively through Hedera network transactions (freeze
transactions signed by the council).

> **Note**: The Docker daemon shown above is present only during the migration transition window, while the legacy
> Docker Compose CN runs in parallel on the same host. Once migration is complete, Docker is removed. How the two
> models coexist during migration and how Docker is decommissioned is specified in HIP XXXX3.

Auxiliary services that are logically associated with a node but not required for consensus — mirror node, relay,
block node — are deployed on separate machines and are entirely outside the scope of this HIP.

#### Cluster-Only Topology

For non-mainnet deployments, all components can be co-located in a single Kubernetes cluster managed by
`solo-operator`. On Linux hosts, the same CRI-O approach and `solo-provisioner` toolchain used for mainnet
applies directly. On developer machines (macOS/Windows), `kind` (Kubernetes IN Docker) is used as
the cluster provider instead of CRI-O, since CRI-O requires a Linux kernel; provisioning in that case is
handled by [`solo`](https://github.com/hiero-ledger/solo) — a separate developer-facing CLI. In the future,
`solo` will adopt `solo-operator` to deploy and manage all components declaratively, converging on the same
operator model used on mainnet.

In dev/test, auxiliary services (mirror node, block node, relay, explorer) can be deployed into the same cluster
using `HelmCapsule` CRs, which auto-inject network topology from the `Orbit` and `ConsensusCapsule` specs.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│              Single Machine (Dev / CI / Cluster-Only)                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │   Single-Node Kubernetes Cluster (CRI-O on Linux / kind on Mac) │    │
│  │                                                                 │    │
│  │  ┌──────────────────────────────────┐                           │    │
│  │  │  ConsensusCapsule Pod (node-0)   │  ... (node-1, node-2)     │    │
│  │  │  consensus-node │ UC │ Alloy     │                           │    │
│  │  │  uploaders                       │                           │    │
│  │  └──────────────────────────────────┘                           │    │
│  │                                                                 │    │
│  │  ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │    │
│  │  │ solo-operator  │  │ HAProxyCapsule  │  │  EnvoyProxy     │   │    │
│  │  └────────────────┘  └─────────────────┘  └─────────────────┘   │    │
│  │                                                                 │    │
│  │  ┌─────────────────┐  ┌─────────────────┐                       │    │
│  │  │  Mirror Node    │  │  Block Node      │  (optional)          │    │
│  │  └─────────────────┘  └─────────────────┘                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Component Overview

| Component                     | Location             | Mainnet profile | cluster-only profile | Dev/Test (Linux) | Dev/Test (macOS/Win) | Role                                                                                                                                                              |
|-------------------------------|----------------------|:---------------:|:--------------------:|:----------------:|:--------------------:|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **solo-provisioner CLI**      | Host binary          |        ✓        |          ✓           |        ✓         |          —           | Provisions the K8s cluster and deploys solo-operator; creates initial CRs                                                                                         |
| **solo** CLI                  | Host binary          |        —        |          —           |        —         |          ✓           | Developer CLI for spinning up local networks via `kind`; `solo-provisioner` equivalent for macOS/Windows                                                          |
| **solo-operator**             | In-cluster pod       |        ✓        |          ✓           |        ✓         |          ✓           | Kubernetes operator that reconciles Orbit, ConsensusCapsule, and NetworkUpgrade CRDs                                                                              |
| **solo-provisioner** (daemon) | Host systemd service |        ✓        |          —           |        ✓         |          —           | Permanent daemon; started at install time; monitors K8s API; executes host-level upgrade and migration soak operations; requires `provisionerDaemonEnabled: true` |
| **UC sidecar**                | Pod container        |        ✓        |          ✓           |        ✓         |          ✓           | Watches CN marker files; translates upgrade events into Kubernetes CRs; in cluster-only profile also handles daemon handoff                                       |
| **Telemetry sidecar**         | Pod container        |        ✓        |          ✓           |        ✓         |          ✓           | Collects logs and metrics; exports via OpenTelemetry (OTLP) to operator-chosen backends (currently Grafana Alloy)                                                  |
| **Stream uploader sidecars**  | Pod containers       |        ✓        |          ✓           |        ✓         |          ✓           | Upload block, record, and event streams to cloud storage                                                                                                          |
| **HelmCapsule**               | In-cluster resource  |        —        |       optional       |        ✓         |          ✓           | Helm-managed in-cluster services: mirror node, block node, relay, explorer                                                                                        |
| **HAProxyCapsule**            | In-cluster pod       |    optional     |       optional       |        ✓         |          ✓           | gRPC load balancer; managed by solo-operator when adopted — node operator's choice on mainnet                                                                     |
| **EnvoyProxy**                | In-cluster pod       |    optional     |       optional       |        ✓         |          ✓           | HTTP/gRPC routing proxy; managed by solo-operator when adopted — node operator's choice on mainnet                                                                |

> How `solo` on macOS/Windows integrates with or replaces the `solo-provisioner-daemon` is a separate design
> question outside the scope of this HIP. See Open Items.

> **Sidecar lifecycle coupling**: All containers in a `ConsensusCapsule` pod — `consensus-node`, `uc`,
> `alloy`, and all stream uploader sidecars (`blocks-uploader`, `records-uploader`,
> `events-uploader`) — share the same pod lifecycle. A pod restart restarts every container simultaneously;
> there is no Kubernetes-native mechanism to restart a single sidecar in isolation. Cheetah stream uploaders
> support config hot-reload, so their configuration can be updated without a pod restart. All other
> configuration and image changes — including telemetry sidecar config — are applied during planned upgrade
> windows where a pod restart is expected.

---

### Deployment Profiles

The `Orbit.Spec.Consensus.ProvisionerDaemonEnabled` boolean field controls how the operator and UC sidecar behave
based on whether a host-level `solo-provisioner-daemon` is present:

| Dimension                      | `provisionerDaemonEnabled: true` (Mainnet)                 | `provisionerDaemonEnabled: false` (cluster-only)                              |
|--------------------------------|------------------------------------------------------------|-------------------------------------------------------------------------------|
| **Upgrade staging volume**     | `hostPath`                                                 | `PersistentVolumeClaim`                                                       |
| **InfraConfig files**          | Present (`infrastructure-versions.yaml`); placed by daemon | Not present; all config is ConsensusConfig                                    |
| **Infrastructure upgrades**    | Supported (K8s, CRI-O, operator, binary)                   | Not supported; explicit failure if manifest contains `infrastructure` section |
| **solo-provisioner**           | Required; handles `ReadyForProvisionerDaemon`              | Not deployed; UC sidecar handles `ReadyForProvisionerDaemon` directly         |
| **UC sidecar role at execute** | Creates CRs only; daemon executes host-level work          | Creates CRs AND sets `PendingNodeUpgrade` directly after scale-down           |
| **etcd persistence**           | `hostPath` (survives cluster teardown)                     | Standard cluster storage (no teardown expected)                               |

**`provisionerDaemonEnabled: true`** targets bare-metal machines (Mainnet) where the `solo-provisioner-daemon` runs
outside the cluster. Three parties share the upgrade staging directory — the `consensus-node` container, the
`uc` sidecar, and the host daemon — which is why a `hostPath` mount is mandatory.

**`provisionerDaemonEnabled: false`** targets fully Kubernetes-managed environments (cloud or on-premises)
where no bare-metal host daemon is present. In this profile, the operator integrates directly with the CN pod,
bypassing the `solo-provisioner` CLI. The upgrade staging directory is a PVC shared between the `consensus-node`
and `uc` containers within the pod. The UC sidecar absorbs the role of the missing daemon: after the operator
scales the CN pod to zero and sets `ReadyForProvisionerDaemon`, the UC spawns a **dedicated Go coroutine** that
absorbs the missing daemon's handoff role: it verifies no InfraConfig files are present, then sets
`PendingNodeUpgrade` directly on the Execute CR status. ConsensusConfig files are still delivered by the
operator via ConfigMap updates — the coroutine does not place config files. If an upgrade
manifest contains an `infrastructure` section, both the UC coroutine and the operator reject it with an explicit
error.

---

### Sandboxed Kubernetes Installation via CRI-O

#### Why CRI-O?

Podman and Docker are not supported Kubernetes runtimes. CRI-O is developed in lockstep with the CNCF
and is the de facto container runtime with direct support from the Kubernetes team. It is the permanent
container runtime for the Kubernetes cluster described in this HIP.

containerd is a viable option but would directly conflict with the version installed by Docker Engine.
containerd uses hardcoded paths in its code, making it impossible to easily install another version
alongside the one installed with Docker Engine. CRI-O has no such constraint.

CRI-O has an identical stability level compared to containerd, but is also typically certified by the
Kubernetes team to work with new and upcoming features before containerd has been fully vetted. CRI-O
has better integration with Kubernetes in some aspects and an easier to manage configuration and
deployment model.

We are already running CRI-O on every block node deployed by `solo-provisioner` today.

During the migration transition window, Docker continues to run the legacy consensus node containers on
the same host. CRI-O provides a clean isolation boundary: the Kubernetes cluster uses CRI-O exclusively,
while Docker manages the legacy containers. The two runtimes share the host kernel but have fully
separate namespaces, networking stacks, and storage layers and cannot interfere with each other. Once
migration is complete and Docker is decommissioned, CRI-O remains as the sole container runtime on the
host.

CRI-O's socket path is configured to a non-default location (`/opt/solo/weaver/sandbox/var/run/crio/crio.sock`)
so it does not conflict with the Docker socket at `/var/run/docker.sock`.

#### Provisioning Sequence

The `solo-provisioner` CLI orchestrates cluster setup through a deterministic, multi-step workflow:

```text
Phase 1: Preflight
  └── Hardware checks (CPU cores, RAM, disk, OS version)

Phase 2: Host Setup
  ├── NodeSetup          — OS-level configuration (limits, kernel modules)
  ├── DisableSwap        — required for kubelet stability
  ├── ConfigureSysctl    — kernel parameters for Kubernetes networking
  └── SetupBindMounts    — persistent volume directories on hostPath

Phase 3: Binary Installation
  ├── SetupKubelet       — kubelet systemd service
  ├── SetupKubectl       — kubectl CLI
  ├── SetupHelm          — Helm package manager
  ├── SetupK9s           — cluster TUI (optional, for operators)
  ├── SetupCrio          — CRI-O container runtime
  └── SetupKubeadm       — cluster bootstrapping tool

Phase 4: Cluster Initialization
  ├── InitializeCluster  — kubeadm init with CRI-O socket
  │                         pod subnet defaults to 10.4.0.0/14 (configurable);
  │                         preflight validates it does not overlap host or Docker bridge networks
  ├── SetupCilium        — CNI networking (eBPF-based, no kube-proxy)
  ├── SetupMetalLB       — bare-metal software load balancer; assigns external IPs to
  │                         LoadBalancer-type Services (consensus gRPC, Envoy, HAProxy);
  │                         IP address pool must be configured to match the host's network
  └── DeployMetricsServer — pod/node resource metrics

Phase 5: Operator & CR Deployment
  ├── Deploy solo-operator         — Helm chart install
  ├── Create Orbit CR              — network-wide topology configuration
  ├── Create ConsensusCapsule CR   — per-node desired state (images, volumes, topology)
  ├── Apply deployment package     — provisioner scans data/config/, creates dedicated config CRs,
  │                                  operator reconcilers create ConfigMaps before CN pod starts
  └── solo-provisioner provisioner daemon install — creates daemon ServiceAccount + RBAC, writes kubeconfig + daemon.yaml, installs systemd service, starts daemon
```

The cluster is initialized with `kubeadm init` pointing at the CRI-O socket:

```yaml
# kubeadm config (simplified)
apiVersion: kubeadm.k8s.io/v1beta3
kind: ClusterConfiguration
networking:
  serviceSubnet: "10.0.0.0/14"  # configurable; must not overlap host or Docker bridge networks
  podSubnet: "10.4.0.0/14"      # configurable; must not overlap host or Docker bridge networks
---
apiVersion: kubeadm.k8s.io/v1beta3
kind: InitConfiguration
nodeRegistration:
  criSocket: unix:///opt/solo/weaver/sandbox/var/run/crio/crio.sock
```

All cluster state (including etcd data) is stored under `/opt/solo/weaver/sandbox/` on the host filesystem. This
means the entire cluster is contained within a directory subtree and survives reboots; it also means the cluster can
be torn down and reinstalled without losing CR state, because etcd is persisted on a `hostPath` volume.

#### Sandbox Directory Layout and Convention

The `/opt/solo/weaver/sandbox/` directory is the single root for all host-level infrastructure managed by
`solo-provisioner`. The design principle is: **nothing is installed directly into system
directories**. Every managed binary and service file lives under the sandbox; system-level paths are symlinks only.

```text
/opt/solo/weaver/sandbox/
├── bin/                              ← All managed host binaries
│   ├── solo-provisioner              ← CLI binary and daemon (single binary, two modes)
│   ├── kubelet                       ← Kubernetes node agent
│   ├── kubeadm                       ← Cluster bootstrapping tool
│   ├── kubectl                       ← Cluster CLI
│   ├── crio                          ← CRI-O container runtime
│   └── ...                           ← Other solo-weaver-managed binaries
│
├── usr/lib/systemd/system/           ← All managed systemd unit files
│   ├── solo-provisioner.service
│   ├── kubelet.service
│   └── kubelet.service.d/10-kubeadm.conf
│
├── etc/
│   ├── weaver/
│   │   ├── kubeconfig                ← Daemon K8s credential (scoped; separate from CLI kubeconfig)
│   │   └── solo-provisioner.env      ← Daemon environment file (loaded by systemd EnvironmentFile=)
│   ├── containers/
│   │   └── registries.conf.d/        ← CRI-O registry mirrors and pull-through config
│   └── cni/net.d/                    ← CNI (Cilium) network config
│
├── var/
│   ├── run/crio/crio.sock            ← CRI-O socket (non-default path; avoids /var/run/docker.sock conflict)
│   └── lib/
│       ├── etcd/                     ← etcd data (persisted across cluster teardown/reinstall)
│       ├── kubelet/                  ← kubelet working directory
│       └── containers/storage/       ← CRI-O container image storage
│
└── run/runc/                         ← OCI runtime state
```

**System symlinks** — created at install time by `solo-provisioner operator cluster install`; node operators should
never edit files at these paths directly:

```text
/usr/local/bin/solo-provisioner         → /opt/solo/weaver/sandbox/bin/solo-provisioner
/usr/local/bin/kubelet                  → /opt/solo/weaver/sandbox/bin/kubelet
/usr/local/bin/crio                     → /opt/solo/weaver/sandbox/bin/crio
... (one symlink per managed binary)

/usr/lib/systemd/system/solo-provisioner.service
    → /opt/solo/weaver/sandbox/usr/lib/systemd/system/solo-provisioner.service
/usr/lib/systemd/system/kubelet.service
    → /opt/solo/weaver/sandbox/usr/lib/systemd/system/kubelet.service
... (one symlink per managed unit file)
```

**Why this layout?**

| Reason                            | Detail                                                                                                                                                                                                                                                   |
|-----------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Single backup target**          | `tar -C /opt/solo/weaver/sandbox/ .` captures every managed binary, unit file, and config in one operation.                                                                                                                                              |
| **Auditable**                     | Operators can inspect exactly what `solo-provisioner` installed without scanning system directories.                                                                                                                                                     |
| **Clean uninstall**               | Removing all symlinks and deleting `/opt/solo/weaver/sandbox/` restores the host to its pre-install state.                                                                                                                                               |
| **No system directory pollution** | Standard package managers (`apt`, `yum`) cannot conflict with solo-weaver-managed binaries because they occupy different namespaces.                                                                                                                     |
| **`ExecStart` uses sandbox path** | Service files reference the sandbox binary path directly (not the `/usr/local/bin` symlink). This ensures systemd always loads the binary from the canonical managed location, regardless of symlink state.                                              |
| **Self-upgrade safety**           | During `provisioner self upgrade`, the daemon binary at `sandbox/bin/solo-provisioner` is archived in place, replaced atomically, and the symlink remains valid throughout — no window where `/usr/local/bin/solo-provisioner` points to a missing file. |

#### CRI-O Registry Configuration and Proxy Support

Solo-weaver has first-class proxy support driven by a `proxy` section in its config file
(`/opt/solo/weaver/sandbox/etc/weaver/config.yaml`). When `proxy.enabled: true`, the
`solo-provisioner kube cluster install` workflow calls `proxy.Activate()` which does two things:

**1. Sets host environment variables** so all binary downloads (CRI-O, kubelet, kubeadm, etc.) route
through the proxy automatically:

- `HTTP_PROXY` / `HTTPS_PROXY` → `http://<proxy.url>`
- `NO_PROXY` → defaults to `localhost,127.0.0.1,::1,.local,.svc,.cluster.local,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16`
- `SSL_CERT_FILE` → operator-supplied CA bundle (for TLS-inspecting proxies)

**2. Writes a CRI-O `registries.conf`** so the container runtime tries a local pull-through cache
before reaching out to the upstream registry:

```toml
# /opt/solo/weaver/sandbox/etc/containers/registries.conf.d/registries.conf
# (generated from template; symlinked from /etc/containers/registries.conf.d/)
[[registry]]
location = "registry.k8s.io"
prefix = "registry.k8s.io"
insecure = false

[[registry.mirror]]
location = "localhost:5050"   # value of proxy.containerRegistryProxy in config
insecure = true
```

The relevant config fields (`pkg/models/config.go`):

```yaml
proxy:
  enabled: true
  url: "127.0.0.1:3128"             # HTTP/HTTPS proxy for binary downloads (optional)
  noProxy: ""                        # comma-separated bypass list; defaults to private networks
  sslCertFile: "/etc/ssl/ca.crt"    # CA bundle for TLS-inspecting proxies (optional)
  containerRegistryProxy: "localhost:5050"  # CRI-O mirror endpoint (host:port)
```

The `containerRegistryProxy` field points CRI-O at a **local pull-through cache** — typically an SSH
port-forward to a council-member registry (`ssh -L 5050:registry-host:5000 jump-host`). Solo-weaver
configures CRI-O to use whatever `host:port` is specified; the operator is responsible for ensuring
that endpoint is reachable before image pulls are attempted. The current template only configures a
mirror for `registry.k8s.io` (K8s infrastructure images such as `pause`, `coredns`, `etcd`). Hedera
application images (`ghcr.io/hashgraph/*`) are pulled directly unless the proxy `url` is also set.

---

### Custom Resource Definitions

`solo-operator` ships CRDs in two categories. **Core CRDs** are always deployed and express the complete desired
state of a node. **Optional CRDs** are deployed only when the deployment profile requires them.

| Category | CRD                         | Scope     |
|----------|-----------------------------|-----------|
| Core     | `Orbit`                     | Cluster   |
| Core     | `ConsensusCapsule`          | Namespace |
| Optional | `HelmCapsule`               | Namespace |
| Core     | `NetworkGenesis`            | Namespace |
| Core     | `NetworkUpgradePrepare`     | Namespace |
| Core     | `NetworkUpgradeFreeze`      | Namespace |
| Core     | `NetworkUpgradeExecute`     | Namespace |
| Core     | `NetworkUpgradeFreezeAbort` | Namespace |
| Optional | `HAProxyCapsule`            | Namespace |
| Optional | `EnvoyProxy`                | Namespace |

The `NetworkGenesis` and `NetworkUpgrade*` CRDs are purpose-built dedicated resources following the same design
pattern: created by external actors (solo-provisioner CLI or UC sidecar), reconciled by the operator, never
created by the operator itself.

#### Orbit (cluster-scoped)

`Orbit` is the root resource representing a logical Hedera network. It holds network-wide configuration that is
shared by all consensus nodes in the deployment. Each node manages its own Orbit CR independently — there is no
cross-node CR sync; council coordination happens through the upgrade package and HFS protocol, not through CR
replication. Orbit is cluster-scoped; see Open Issues for a discussion of namespace-scoped alternatives.

> **Namespace lifecycle is outside Orbit's scope.** Although Orbit is cluster-scoped, it does not create or
> delete the namespaces in which `ConsensusCapsule` and other CRs live. Namespaces are pre-created before Orbit
> is applied (by `solo-provisioner`, Helm, or manually) and are decommissioned by the node operator using
> whatever tooling they prefer (`solo-provisioner`, Terraform, `kubectl`, etc.). This keeps Orbit focused on
> network configuration and avoids the operator silently owning infrastructure primitives that the node operator
> may manage independently.

```yaml
apiVersion: operator.solo.hedera.com/v1alpha1
kind: Orbit
metadata:
  name: mainnet
spec:
  consensus:
    provisionerDaemonEnabled: true       # true = hostPath volumes + daemon-assisted upgrades (Mainnet); false = PVC volumes + UC-direct upgrades (cluster-only)
    networkSettings: # settings.txt — key/value pairs (ConsensusConfig: ConfigMap)
      maxTransactionCountPerSecond: "10000"
      ...
    applicationConfiguration: # application.properties — key/value pairs (ConsensusConfig: ConfigMap)
      hedera.recordStream.logPeriod: "2"
      ...
    permissionConfiguration: # api-permission.properties — key/value pairs (ConsensusConfig: ConfigMap)
      ...
    genesisProperties: # genesis.properties — key/value pairs (ConsensusConfig: ConfigMap)
      ...
    genesis:
      # externalAddresses lists nodes NOT managed by this solo-operator instance.
      # Operator-managed nodes are discovered automatically from ConsensusCapsule specs.
      # The full address book (public information, stored as a ConfigMap) is assembled
      # by the NetworkGenesis CR reconciler at genesis time.
      externalAddresses: [ ]
      throttlesJson: |           # genesis-throttles.json content
        ...
  telemetry:
    alloy:
      config: |                  # Grafana Alloy config (applied to all nodes)
        ...
```

#### ConsensusCapsule (namespace-scoped)

`ConsensusCapsule` (short name: `cc`) describes a single consensus node pod. The operator creates and manages a
`StatefulSet` to match this spec:

```yaml
apiVersion: operator.solo.hedera.com/v1alpha1
kind: ConsensusCapsule
metadata:
  name: node-0
  namespace: hedera
spec:
  orbit: mainnet
  nodeId: 0
  accountId: "0.0.3"
  log4j2Config: |              # log4j2.xml content
    ...
  podProperties:
    containers:
      consensusNode:
        softwareVersion:
          repository: ghcr.io/hashgraph
          imageName: consensus-node
          imageTag: v0.68.6
          manifestHash: sha256:abc123...
        javaHeapMin: 8g
        javaHeapMax: 26g
        javaOpts: "-XX:+UseZGC ..."
      uc:
        softwareVersion:
          repository: ghcr.io/hashgraph
          imageName: uc
          imageTag: v1.2.3           # can be updated independently via upgrade manifest
          manifestHash: sha256:def456...
        markerPath: /opt/hgcapp/services-hedera/HapiApp2.0/data/upgrade/current
        eventsPath: /opt/solo/weaver/uc/events
        crPersistPath: /opt/solo/weaver/uc/crs
        pollInterval: 60s
      alloy:
        enabled: true
      blocksUploader:
        enabled: true
        s3:
          bucketName: mainnet-blocks
          bucketPath: node0/
      recordsUploader:
        enabled: true
      eventsUploader:
        enabled: true
      backupUploader:
        enabled: false               # enable if PostgreSQL state backup is required
  # When Orbit.Spec.Consensus.ProvisionerDaemonEnabled is true (Mainnet profile), the operator
  # uses hostPath volume mounts for all CN state directories — no PVCs are created.
  # (See Volume Architecture section.) The persistentVolumeClaims field is omitted for Mainnet specs.
```

The `StatefulSet` the operator creates from this CR contains the following containers in a single pod:

| Container          | Image source                   | Purpose                                             |
|--------------------|--------------------------------|-----------------------------------------------------|
| `consensus-node`   | Council registry               | Hedera consensus node (HederaNode.jar in OCI image) |
| `uc`               | solo-operator release          | Upgrade Controller sidecar                          |
| `alloy`            | Grafana Alloy (current)        | Telemetry sidecar: exports logs and metrics via OTLP |
| `blocks-uploader`  | Cheetah release                | Block stream upload to S3/GCS                       |
| `records-uploader` | Cheetah release                | Record stream upload to S3/GCS                      |
| `events-uploader`  | Cheetah release                | Event stream upload to S3/GCS                       |
| `backup-uploader`  | Custom backup uploader release | State file backup upload to S3/GCS                  |

#### HelmCapsule (namespace-scoped)

`HelmCapsule` manages Helm chart deployments inside the cluster. Its primary use is in the dev/test profile,
where auxiliary services such as mirror node, block node, relay, and explorer are deployed into the same cluster
as the consensus nodes. It auto-injects network topology values (node endpoints, ports, genesis config) from
the referenced `Orbit` and `ConsensusCapsule` CRs when a `component` type is set.

On mainnet, auxiliary services are deployed on separate machines and `HelmCapsule` is not used.

#### NetworkGenesis CR (namespace-scoped)

`NetworkGenesis` is a dedicated CR for network genesis operations. It is created by `solo-provisioner` to
initiate the genesis sequence and reconciled by the operator — never created by the operator itself.

The `NetworkGenesis` reconciler assembles the full network roster by reading all `ConsensusCapsule` specs and
their referenced Secrets (TLS certs, signing certs, ports). The resulting address book is public information
and is stored as a ConfigMap (not a Secret). Nodes not managed by this operator instance are specified via
`Orbit.Spec.Genesis.ExternalAddresses`.

#### NetworkUpgrade CRs (namespace-scoped)

The four `NetworkUpgrade*` CRDs represent the lifecycle phases of a network upgrade event. They are always
created by the UC sidecar (never by the operator directly) and are described in full in HIP XXXX2:

- `NetworkUpgradePrepare` — image validation and ConsensusConfig config file staging
- `NetworkUpgradeFreeze` — registry health re-check at freeze time
- `NetworkUpgradeExecute` — pod scale-down, daemon handoff, pod scale-up with new images
- `NetworkUpgradeFreezeAbort` — abort signal when the upgrade is cancelled before the freeze completes

#### HAProxyCapsule and EnvoyProxy (namespace-scoped)

`solo-operator` ships `HAProxyCapsule` and `EnvoyProxy` CRDs for operators who choose to manage their proxy tier
through Kubernetes. When adopted, HAProxy distributes gRPC consensus traffic and Envoy handles HTTP/gRPC routing,
both managed by the operator independently of the CN pod.

**These CRDs are optional on mainnet.** On mainnet, node operators are expected to continue using their existing
proxy infrastructure (which typically runs outside Kubernetes on a separate machine or VM). The decision of how to
deploy and manage proxies — including whether to migrate to the `solo-operator` model — is left entirely to each
council member.

The proxy CRDs primarily serve two use cases:

1. **Development and testing**: where a fully unified single-cluster setup is desirable for simplicity.
2. **Custom deployment models** (e.g., cluster-only deployments and similar): where proxies are co-located in the same
   Kubernetes cluster as the CN and the standard upgrade protocol needs to coordinate proxy version changes
   alongside node upgrades.

Mainnet operators who choose to adopt these CRDs may do so, but it is not required.

---

### Volume Architecture

The volume type used for CN state directories and upgrade staging depends on the deployment profile. In the
Mainnet profile, all CN state directories use `hostPath` volumes — preserving Docker CN data in place with no
copy and no restructure (see HIP XXXX3). In the cluster-only profile, all CN state directories use
`PersistentVolumeClaim` (PVC) volumes.

#### Mainnet Profile (hostPath volumes)

```text
/opt/solo/weaver/sandbox/                 ← cluster sandbox root (see Sandbox Directory Layout below)
  var/run/crio/crio.sock                  ← CRI-O socket

/opt/hgcapp/services-hedera/HapiApp2.0/  ← HapiApp working directory (hostPath)
  data/upgrade/current/                   ← upgrade staging (shared CN ↔ UC ↔ daemon via hostPath)
    execute_immediate.mf
    freeze_scheduled.mf
    now_frozen.mf
    freeze_aborted.mf
    manifests/                           ← package manifests (consensus-node-components.yaml, etc.)
    VERSION

/opt/solo/weaver/                         ← solo tooling base (hostPath)
  sandbox/                               ← managed binaries and system files (see below)
    bin/
      solo-provisioner                   ← CLI binary and daemon (single binary, two modes)
      kubelet, crio, kubeadm, ...        ← all solo-weaver-managed host binaries
    usr/lib/systemd/system/
      solo-provisioner.service           ← daemon systemd unit file (started at install time)
      kubelet.service, ...               ← other solo-weaver-managed unit files
    etc/weaver/
      kubeconfig                         ← daemon K8s credential (scoped)
      solo-provisioner.env               ← daemon environment file (systemd EnvironmentFile)
    var/run/crio/crio.sock               ← CRI-O socket (non-default path)
    var/lib/etcd/                        ← etcd data (survives cluster reinstall)
  provisioner/
    daemon.sock                          ← daemon health socket
    self-upgrade.yaml                   ← self-upgrade in-progress state
    events/<op-id>.jsonl                 ← daemon JSONL event log
  uc/crs/                               ← UC CR persistence (crash safety)
  data/upgrade/backup/                   ← pre-upgrade state backups

System symlinks (created at install; point into sandbox):
  /usr/local/bin/solo-provisioner        → /opt/solo/weaver/sandbox/bin/solo-provisioner
  /usr/lib/systemd/system/solo-provisioner.service
      → /opt/solo/weaver/sandbox/usr/lib/systemd/system/solo-provisioner.service

hostPath mounts (all shared with host filesystem — no data copy required):
  /opt/hgcapp/services-hedera/HapiApp2.0/data/upgrade/current/
      → upgrade staging (shared CN ↔ UC ↔ daemon; must be hostPath — see note below)
  /opt/hgcapp/services-hedera/HapiApp2.0/data/saved/
      → Merkle state snapshots (2–10 TB; reused from Docker CN in place — no copy)
  /opt/hgcapp/services-hedera/HapiApp2.0/data/stats/
      → node statistics
  /opt/hgcapp/services-hedera/HapiApp2.0/output/
      → application logs
  /opt/hgcapp/services-hedera/HapiApp2.0/state/
      → runtime state
  /opt/hgcapp/services-hedera/HapiApp2.0/config/
      → config.txt (ConsensusCapsule.Spec.ConfigFolder — deprecated; replaced by NetworkGenesis CR)
```

**Volume ownership and permissions**: Two OS accounts exist on every node host. `/opt/hgcapp/` is owned by
`hedera:hedera` (UID/GID **2000**) — the user the consensus-node process runs as, defined by the legacy
installation. `/opt/solo/weaver/` is owned by `weaver:weaver` (UID/GID **2500**) — the user created by solo-weaver
at install time. The UC sidecar and `solo-provisioner-daemon` both run as `weaver` but must write into
`/opt/hgcapp/data/upgrade/current/`. This cross-ownership is resolved by:

1. Adding `weaver` to the `hedera` supplementary group (`sudo usermod -aG hedera weaver`) and setting
   `g+rwx` on the upgrade staging directory — done once by `solo-provisioner kube cluster install` preflight.
2. Setting `supplementalGroups: [2000]` in the UC sidecar container `securityContext` so the in-pod `weaver`
   process inherits the `hedera` group and can read/write the hostPath-mounted staging dir.

The `consensus-node` container continues to run as `hedera:hedera` (2000:2000) — no change required there.

The upgrade staging directory **must be a `hostPath` mount** in the Mainnet profile. Three parties access it: the
`consensus-node` container (which extracts the upgrade archive and writes marker files), the `uc` sidecar
(which polls for those marker files), and the `solo-provisioner-daemon` (which runs on the host, outside the
cluster, and places InfraConfig config files). A PVC with `ReadWriteOnce` cannot span the pod and the host process
simultaneously; only a `hostPath` mount satisfies all three requirements.

#### Cluster-Only Profile (PVC upgrade staging)

```text
PersistentVolumeClaims (ReadWriteOnce):
  <capsule>-upgrade  → HapiApp2.0/data/upgrade/current/   ← upgrade staging (CN ↔ UC in-pod only)
  <capsule>-logs     → HapiApp2.0/output/
  <capsule>-saved    → HapiApp2.0/data/saved/
  <capsule>-stats    → HapiApp2.0/data/stats/
  <capsule>-state    → HapiApp2.0/state/
```

In the cluster-only profile, no host process outside the pod needs to access the upgrade staging directory — the
`solo-provisioner-daemon` is not deployed, and there are no InfraConfig files. A `ReadWriteOnce` PVC shared between
the `consensus-node` and `uc` containers within the same pod is sufficient.

The etcd directory being on a `hostPath` is a separate deliberate design decision specific to the Mainnet profile:
it means that tearing down and reinstalling the Kubernetes cluster (during an infrastructure upgrade) does not
lose any CR state — all CRs are immediately visible to the operator once the new cluster starts. In the cluster-only
profile, no cluster teardown occurs, so standard cluster storage is used for etcd.

---

### Solo-Operator Architecture

`solo-operator` is a Kubernetes operator built with `controller-runtime` and generated using `kubebuilder`. It runs
as a pod inside the cluster and holds the reconciliation logic for all CRD types.

#### Reconciler Structure

```text
solo-operator
├── OrbitReconciler
│   └── Manages cluster-scoped resources for a logical network:
│       namespace, consensus-config ConfigMap (s6-overlay scripts),
│       consensus-capsule Role (RBAC), headless Service (pod DNS discovery)
│
├── ConsensusCapsuleReconciler
│   ├── Creates/updates a StatefulSet matching the CR spec
│   ├── Manages per-capsule ConfigMaps:
│   │   ├── <capsule>-hapi-app-cm     — log4j2.xml + settings.txt
│   │   ├── <capsule>-data-config-cm  — application.properties + api-permission.properties
│   │   ├── <capsule>-alloy-config    — telemetry sidecar config
│   │   └── <capsule>-block-nodes-cm  — block node endpoints (optional)
│   ├── Manages PVCs, ServiceAccount, RoleBinding, Service
│   └── Detects spec changes and triggers rolling restarts
│
├── NetworkGenesisReconciler
│   ├── Created by: solo-provisioner CLI (never by operator)
│   ├── Reads all ConsensusCapsule specs + Secrets to assemble network roster
│   ├── Generates: addressbook-bin ConfigMap (protobuf NodeAddressBook),
│   │   genesis-network.json ConfigMap, public-keys ConfigMap, cluster-config ConfigMap
│   └── Address book is public information — stored as ConfigMap, not Secret
│
├── NetworkUpgradePrepareReconciler   ─┐
├── NetworkUpgradeFreezeReconciler     │  Described in detail in HIP XXXX2.
├── NetworkUpgradeExecuteReconciler    │  All created by UC sidecar, never by operator.
├── NetworkUpgradeFreezeAbortReconciler┘
│
├── HelmCapsuleReconciler
│   │  Installs/upgrades Helm releases in-cluster.
│   │  Auto-injects network topology from Orbit/ConsensusCapsule when component type is set.
│   │  Used in dev/test for mirror node, block node, relay, explorer.
│   └── Manages Helm release lifecycle via Helm SDK
│
├── HAProxyCapsuleReconciler
│   │  Optional — only active when HAProxyCapsule CRs are present (dev/test and custom deployments).
│   │  On mainnet, proxy management is expected to be handled outside this operator.
│   └── Manages HAProxy Deployment, ConfigMap, and Service
│
└── EnvoyProxyReconciler
    │  Optional — only active when EnvoyProxy CRs are present (dev/test and custom deployments).
    │  On mainnet, proxy management is expected to be handled outside this operator.
    └── Manages Envoy Deployment, ConfigMap, and Service
```

The operator uses a **sub-reconciler pattern**: each major resource type managed by a reconciler (e.g.,
ConfigMaps, StatefulSet, PVCs) is handled by a discrete sub-reconciler that produces a deterministic patch. This
makes reconciliation composable and individually testable.

**Error handling**: All reconcilers follow a consistent error strategy. Transient errors (API server unavailable,
network timeout) return an error to controller-runtime, which re-queues the CR with exponential backoff (base 5s,
max 5m). Permanent errors (invalid CR spec, unsatisfiable desired state) set a `Ready=False` condition on the CR
status with a descriptive `Reason` and `Message`, and do not re-queue automatically — node operator intervention or
a spec update is required to unblock. Reconcilers emit Kubernetes events for both cases to aid observability.

#### RBAC Model

The operator requires the following permissions:

- **Full control** over its own CRD types (Orbit, ConsensusCapsule, NetworkUpgrade*); optionally HAProxyCapsule and
  EnvoyProxy when proxy management is delegated to the operator
- **Read/write** StatefulSets, Deployments, ConfigMaps, Secrets, Services, PersistentVolumeClaims, ServiceAccounts,
  Roles, RoleBindings in its managed namespaces
- **Read** Nodes (for single-node cluster health checks)
- **Create** Events (for Kubernetes event emission)

The **UC sidecar** ServiceAccount is created by `solo-provisioner operator cluster install` with permissions
scoped to the deployment profile read from the Orbit CR at install time:

| Verb           | Resource                                                                                                  | Mainnet | cluster-only                            |
|----------------|-----------------------------------------------------------------------------------------------------------|---------|-----------------------------------------|
| `create`       | `networkupgradeprepares`, `networkupgradefreezes`, `networkupgradeexecutes`, `networkupgradefreezeaborts` | ✓       | ✓                                       |
| `get`, `watch` | own pod                                                                                                   | ✓       | ✓                                       |
| `update`       | `networkupgradeexecutes/status`                                                                           | —       | ✓ (coroutine sets `PendingNodeUpgrade`) |

**UC startup RBAC preflight**: Before entering the marker file poll loop, the UC binary performs a
`SelfSubjectAccessReview` for every K8s API verb it will call based on its configured profile. If any
check fails the UC **refuses to start**: it emits a Kubernetes Event on its own pod with `Reason=RBACPreflight`
and a structured `Message` listing each missing permission, then exits with a non-zero code. The pod enters
`CrashLoopBackOff`, making the misconfiguration immediately visible to the node operator — at pod startup time,
never mid-upgrade.

The `solo-provisioner-daemon` has a separate ServiceAccount with `get`, `list`, and `watch` on the
four upgrade CR types, plus `update` on their `/status` subresources. The daemon performs the same
`SelfSubjectAccessReview` preflight at startup before entering its Execute CR poll loop. The
ServiceAccount, RBAC, kubeconfig, and systemd service are all created by
`solo-provisioner provisioner daemon install` — a dedicated command separate from
`solo-provisioner operator cluster install`.

---

### Solo-Provisioner Daemon

> **Naming disambiguation**: The `solo-provisioner` CLI (interactive, run by the operator) and the
> `solo-provisioner-daemon` (long-running systemd service, started at install time) are two separate binaries.
> The CLI provisions infrastructure; the daemon is the autonomous control-plane agent that handles host-level
> upgrade execution and migration soak monitoring.

The `solo-provisioner-daemon` is a Go binary installed as a `systemd` service on the host, outside the
Kubernetes cluster. It is the bridge between the Kubernetes control plane and host-level operations that
cannot be performed from within a pod.

```text
Host
├── systemd: solo-provisioner-daemon.service
│   ├── Binary:    /opt/solo/weaver/bin/solo-provisioner-daemon
│   ├── Config:    /opt/solo/weaver/config/daemon.yaml          # written by `provisioner daemon install`
│   ├── K8s creds: /opt/solo/weaver/config/daemon-cn.kubeconfig # scoped SA credential (consensus node)
│   │              /opt/solo/weaver/config/daemon-bn.kubeconfig # scoped SA credential (block node)
│   └── Health:    GET /health  on  /opt/solo/weaver/daemon/daemon.sock  (Unix socket, chmod 0660)
```

Each managed component (consensus-node, block-node) has its own scoped kubeconfig written by
`solo-provisioner daemon install` — isolated credentials, independent RBAC blast radius. The control plane
is a Unix socket only (no TCP listener). `sd_notify READY=1` is sent to systemd once the socket is serving;
all watch loops start after that without blocking readiness.

The daemon is responsible for three distinct functions:

**1. Consensus node upgrade execution.** The daemon watches the Kubernetes API for `NetworkUpgradeExecute`
CRs. When the operator sets the CR's `status.phase` to `ReadyForProvisionerDaemon` — signalling that the CN
pod has been stopped and the upgrade package is staged — the daemon takes over. It places infrastructure
configuration files from the upgrade staging directory to their correct host paths, determines whether a
host-level infrastructure upgrade is required by reading `manifests/infrastructure-versions.yaml` from the
package, runs the upgrade if needed (via the `solo-provisioner` CLI binary), and then patches the CR to
`PendingNodeUpgrade` so the operator can proceed with restarting the CN pod with the new image. The watch
loop is self-healing: transient errors and auth failures are retried with exponential backoff; the kubeconfig
is re-read from disk on auth errors so credential rotation after a cluster rebuild takes effect without a
daemon restart.

**2. Infrastructure upgrade.** When `infrastructure-versions.yaml` declares a new version for a host-level
component (CRI-O, kubelet, CNI, solo-operator, or the `solo-provisioner` binary itself), the daemon drives
the upgrade by invoking the `solo-provisioner` CLI with the appropriate subcommand and the path to the
manifest. This includes the daemon's own self-upgrade: when the binary version changes, the daemon performs
a nohup handoff — downloading the new binary, spawning it, and exiting — so the upgrade completes without
a systemd-managed restart and without dropping the Unix socket between the old and new process.

**3. Migration soak monitoring.** During the network migration from Docker Compose to Kubernetes-native
(defined in HIP XXXX3), each migrated node runs a time-bounded soak period to validate stability before
the legacy Docker Compose stack is decommissioned. The daemon manages this soak lifecycle: it accepts a
start request (via its HTTP API) that records the cutover timestamp, then polls soak criteria every 15
minutes — uploader backlog cleared, CN pod restart count within bounds — emitting a `SoakCheck` heartbeat
event on every tick. When all criteria are met and a fleet-level threshold (≥ 26/39 mainnet nodes migrated)
is reached, the daemon triggers the decommission of the legacy stack for that node. Soak state is persisted
to disk so the watcher resumes automatically if the daemon restarts mid-soak, preserving elapsed soak time
across reboots.

---

### Configuration File Types

#### ConsensusConfig — CN Application Configuration

ConsensusConfig files configure the running consensus node process. They are delivered in `data/config/` inside
the upgrade package and reach the CN via Kubernetes ConfigMaps:

| Files                                                                                                                               | Profile          |
|-------------------------------------------------------------------------------------------------------------------------------------|------------------|
| `application.properties`, `api-permission.properties`, `bootstrap.properties`, `node.properties`, `application-override.properties` | All profiles     |
| `throttles.json`, `feeSchedules.json`, `simpleFeesSchedules.json`                                                                   | All profiles     |
| `log4j2.xml`, `settings.txt` *(package root, not `data/config/`)*                                                                   | All profiles     |
| `genesis-network.json` *(optional)*                                                                                                 | Non-mainnet only |

ConsensusConfig files are **never embedded in `Orbit` or `ConsensusCapsule` CR specs**. The same mechanism
applies at both initial provisioning and upgrade time: the provisioner/daemon/UC scans `data/config/` in the
deployment package and creates a dedicated Kubernetes CR for each recognised filename. `log4j2.xml` and
`settings.txt` are the exception: they reside at the **package root** (not under `data/config/`), and the
K8s-native daemon/UC has explicit logic to find them there. Each CR's reconciler
owns all domain-specific logic: key mapping and semantic content validation. The
operator creates and updates the necessary ConfigMaps before the CN pod is started — no new mount points are
ever added; only the ConfigMap data changes. ConfigMap naming is an operator-internal detail.

The filename-to-CR-kind mapping is hardcoded in the daemon/UC. No dispatch field is needed in the package.
All ConsensusConfig files are optional. If a file is absent, the CN uses defaults baked into its container
image or the values from the most recently applied CR.

> **Size limit**: Because each ConsensusConfig file's content is embedded in a dedicated CR stored in etcd,
> individual files **must not exceed 1 MB**. Kubernetes enforces a hard 1.5 MB etcd object limit; staying
> below 1 MB leaves headroom for CR metadata and other fields. The daemon/UC must reject any file in
> `data/config/` that exceeds this limit and emit a `ConfigFileTooLarge` error event, halting the upgrade
> rather than creating an oversized CR.
>
> For configuration assets larger than 1 MB, use `manifests/external-files.yaml` instead. The UC or daemon
> downloads the file from the declared URL, verifies its hash, and copies it to the declared hostPath
> destination. This path is available for both the prepare phase (before the freeze window) and the freeze
> phase, as specified per entry in `external-files.yaml`.

#### Infrastructure Version Specification

Infrastructure upgrade decisions are driven by `manifests/infrastructure-versions.yaml` in the upgrade package.
This is a **version specification**, not a configuration file — it declares the required versions of host-level
components (CRI-O, kubelet, solo-operator, etc.) but carries no CN application configuration. The
`solo-provisioner-daemon` reads it to determine whether an infra upgrade is needed and what versions to
install. There are no other configuration file requirements for the infrastructure upgrade path.

**`config.txt`** *(deprecated)* is a legacy address book file managed separately by the node operator and
mounted via a `hostPath` volume (`ConsensusCapsule.Spec.ConfigFolder`). It is not part of the upgrade package
flow and will be removed once the address book is fully managed through the `NetworkGenesis` CR and the roster
mechanism.

In the **cluster-only profile**, no infrastructure upgrade is supported. The UC sidecar and operator must reject
any upgrade package that contains an `infrastructure` section in `manifests/infrastructure-versions.yaml` with
an explicit error.

#### `build/jobs/` Execution During Install

The deployment package may include a `build/jobs/` folder with phase-scoped K8s Job descriptors. During a fresh node install, the daemon or UC executes only descriptors with `context: install` (`pre-install` and `post-install` phases); descriptors with `context: upgrade` are silently skipped. See HIP XXXX0 for the full descriptor schema, phase vocabulary, execution rules, and idempotency model.

---

### Observability

Each `ConsensusCapsule` pod includes a **telemetry sidecar** (currently Grafana Alloy) that provides unified
telemetry via the OpenTelemetry protocol:

- **Log collection**: The telemetry sidecar tails the CN log output and exports log lines via OTLP to the operator's chosen backend.
- **Metrics scraping**: The telemetry sidecar scrapes the CN metrics endpoint (`:9999`) and exports metrics via OTLP to the operator's chosen backend.
- **Configuration**: Sidecar config is stored in a per-capsule ConfigMap (`<capsule-name>-alloy-config`) managed by
  the operator. Configuration changes are always applied as part of a planned infrastructure or CN upgrade
  window — the pod is restarted as part of that process, so the updated ConfigMap takes effect naturally on
  pod start. Sidecar config is therefore treated as part of the upgrade payload, not as an independent day-2
  operation. Out-of-band changes (e.g. rotating an OTLP endpoint) must be applied by directly patching the
  ConfigMap via `kubectl` and manually restarting the pod; this is a node operator responsibility outside
  the upgrade protocol.
- **Telemetry backends**: Each council member routes telemetry to the OpenTelemetry-compatible backend of their
  choice. This HIP does not prescribe where those backends run or how they are deployed — that is the node
  operator's responsibility. Council members may optionally share a central observability stack during the network
  upgrade window to simplify cross-node coordination; in that case, credentials are shared through a separate
  trusted channel, which is outside the scope of this HIP.

Kubernetes events are emitted by solo-operator at every significant lifecycle transition (image validation,
registry failover, upgrade phase changes, pod readiness) so that node operators can use standard `kubectl get events`
to trace upgrade progress.

---

## Impact on Mirror Node

No impact. The mirror node does not interact with consensus node deployment infrastructure, CRI-O, Kubernetes, or the
solo-operator. Stream file delivery to the mirror node is unchanged.

## Impact on SDK

No impact. This HIP changes how consensus nodes are deployed and managed internally. No public APIs, transaction types,
SDK interfaces, or protobuf definitions are modified.

## Backwards Compatibility

This HIP introduces a new deployment model that runs **in parallel** with the existing Docker Compose deployment.
No changes to the `hiero-consensus-node` codebase are required to adopt this model. The migration from Docker
Compose to Kubernetes-native is addressed in a separate HIP (XXXX3).

**Upgrade package format**: The archive format is unchanged — the CN unzips it identically to the current
process. The only differences are that the archive is smaller (no JAR files) and contains a `manifests/` directory
with package manifests in addition to the existing files. The CN extracts the archive and writes marker files exactly as
it does today;
no CN code changes are needed. The upgrade protocol changes (smaller manifest, OCI images) are described in
HIP XXXX2.

The UC sidecar (`uc`) is a new binary but it consumes the same marker file protocol as the existing UC, so the
consensus node software requires no modification.

---

## Security Implications

- **Image verification**: Every container image in a `ConsensusCapsule` is specified with a `manifestHash` (OCI
  image manifest digest) and per-layer `layerHashes`. The operator validates layer hashes against the
  manifest before any upgrade is applied.
- **RBAC least-privilege**: The UC sidecar's ServiceAccount can only create upgrade CRs, not modify or delete any
  other resource. The `solo-provisioner-daemon`'s ServiceAccount is a scoped credential created by
  `solo-provisioner provisioner daemon install` — separate from the cluster-admin kubeconfig produced by `kubeadm`.
  It has read access to `NetworkUpgrade*` CRs and write access only to their status subresources. This ensures the
  daemon cannot modify cluster state beyond its narrow operational scope.
- **Daemon kubeconfig protection**: The daemon's kubeconfig file is owned by the daemon's service user with mode
  `0600`. Using a scoped ServiceAccount credential (rather than cluster-admin) limits the blast radius if the file
  is compromised.
- **Daemon Unix socket**: The `solo-provisioner-daemon` exposes a Unix domain socket
  (`/opt/solo/weaver/daemon/daemon.sock`) used exclusively by the `solo-provisioner` CLI running on the same
  host to trigger mode transitions (upgrade execution, migration soak activation, health checks). The socket is
  owned by `weaver:weaver` (UID/GID 2500) with mode `0600`. It is not mounted into any Kubernetes pod and is
  unreachable from any container process — the UC sidecar communicates with the daemon exclusively via the
  Kubernetes CR API.
- **ConsensusConfig file hash verification**: The daemon verifies SHA256 hashes of all ConsensusConfig files
  against the upgrade manifest before placement. A hash mismatch causes the daemon to abort and set
  `DaemonResult: False` on the Execute CR — the CN is not restarted.
- **Atomic config placement**: InfraConfig files are written to a `.tmp` path and atomically renamed into position,
  ensuring no half-written config is ever read by the CN.
- **etcd data protection**: etcd data is stored on a `hostPath` volume on the host filesystem. Protection relies
  on host-level disk encryption (e.g., LUKS). Kubernetes `EncryptionConfiguration` for etcd encryption at rest
  is an open hardening item — see Open Issues.
- **Node credential Secrets**: Each `ConsensusCapsule` references Kubernetes Secrets holding the node's gRPC
  TLS certificate pair, gossip signing certificate pair, and optionally ledger encryption and signing keys.
  These Secrets must be created by the node operator before the ConsensusCapsule is applied, stored with
  `0600` permissions, and never included in upgrade packages or transmitted over unencrypted channels.
- **Sandboxed runtime**: CRI-O's separate socket and storage prevent container processes managed by Kubernetes
  from accessing or interfering with any other container runtime on the host.

---

## How to Teach This

### For Node Operators

The new deployment model replaces Docker Compose with a single-node Kubernetes cluster managed by `solo-provisioner`.
Key concepts to understand:

- **Orbit CR**: The top-level declaration for a node — identity, deployment profile, and version pinning. Create or
  update it with `kubectl apply` or via `solo-provisioner` commands.
- **ConsensusCapsule CR**: Describes the CN pod — container images, volume mounts, and topology. Managed by
  `solo-operator`; do not edit directly during an upgrade. CN application configuration is managed separately
  via dedicated config CRs, not embedded in this spec.
- **Deployment profile**: Set `spec.consensus.provisionerDaemonEnabled: true` (hostPath volumes, daemon-assisted
  upgrades — Mainnet) or `false` (PVC volumes, UC-direct upgrades — cluster-only). This is a one-time configuration at
  provisioning time.
- **Day-to-day operations**: The cluster is self-healing. Pod crashes trigger automatic restarts. Configuration changes
  are applied by updating the CR, not by SSH-ing into the host.
- **Observability**: Use `kubectl get pods,events -n <namespace>` for live status. The telemetry sidecar exports metrics and logs via OpenTelemetry to operator-chosen backends for dashboards and alerting.

### For Council Members

No change to how you submit freeze transactions. The deployment model change is entirely internal to each operator's
host.

## Reference Implementation

Links will be added when the following repositories have merged the implementation:

- `hashgraph/solo-operator` — Orbit and ConsensusCapsule CRDs, reconcilers, UC sidecar
- `hashgraph/solo-provisioner` (solo-weaver) — `kube cluster install/uninstall`, `operator cluster install/upgrade`,
  `consensus node` commands
- `hashgraph/hedera-deployment-automation` — CRI-O installation scripts, MetalLB configuration

## Rejected Ideas

**Running multiple consensus nodes per host in the same K8s cluster.** A mainnet CN is tuned to consume the full
machine. Sharing a host between two CN pods would cause resource contention. The single-node-per-host model is
preserved.

**Using containerd instead of CRI-O.** containerd shares the Docker daemon socket namespace on many distributions,
creating potential interference with the existing Docker CN during the migration window. CRI-O is completely isolated
from Docker, making Phase 0 pre-migration preparation non-disruptive. See the Rationale section for full analysis.

**Using a managed Kubernetes service (EKS, GKE, AKS).** Council members run on bare-metal hosts. A managed K8s service
would add a cloud dependency to a deliberately decentralized infrastructure. The single-node CRI-O sandbox keeps all
control on the operator's own hardware.

**Storing etcd data on a PersistentVolume.** In a single-node cluster, a PV is just a hostPath anyway. Using hostPath
directly means etcd survives cluster teardown without any PV migration. This was the cleaner design.

**Making `Orbit` namespace-scoped.** Namespace lifecycle is managed by `solo-provisioner` and external tooling,
not by the operator. Making `Orbit` namespace-scoped would save some RBAC surface, but cluster-level resources
(MetalLB, Cilium network policies) require cluster-scoped RBAC regardless — the saving would be partial. `Orbit`
remains cluster-scoped.

**Embedding all configuration files in the Orbit CR.** InfraConfig files (`infrastructure-versions.yaml`) are consumed
by the daemon on the host, not by the CN pod. Embedding them in a CR would require the daemon to extract them from the
K8s API on every upgrade — unnecessary indirection. InfraConfig uses hostPath placement; ConsensusConfig uses ConfigMap
mounts.

**Embedding genesis data in the `Orbit` CR.** Proposed as a simplification for environments where a dedicated genesis
CR is unnecessary (dev/test, cluster-only deployments). Rejected: `Orbit` is node-scoped and cannot authoritatively
represent
network-wide genesis data without replicating it across all nodes. `NetworkGenesis` also needs to do more than
populate a single ConfigMap — a dedicated CR is the correct abstraction and is consistent across all deployment
profiles.

## Open Issues

- **etcd encryption at rest**: Protection of etcd data currently relies on host-level disk encryption (e.g.,
  LUKS). Enabling Kubernetes `EncryptionConfiguration` for etcd encryption at rest is a hardening step to be
  addressed before mainnet deployment.
- **Observability prerequisite for migration**: Dashboard definitions, alert rules, and OpenTelemetry pipeline
  configuration required for migration monitoring are out of scope for this HIP and must be prepared by the platform
  engineering team as a prerequisite deliverable before the migration window opens.

---

## References

- [HIP XXXX0 - Consensus Node Deployment Package](hip-xxxx0%20-%20consensus-node-deployment-package.md)
- [HIP XXXX2 - Globally Synchronized Network Upgrade Process](hip-xxxx2%20-%20network-upgrade.md)
- [HIP XXXX3 - Consensus Node Migration to Kubernetes-Native Deployment](hip-xxxx3%20-%20network-migration.md)
- [CRI-O Container Runtime](https://cri-o.io/)
- [MetalLB Load Balancer](https://metallb.universe.tf/)
- [Kubernetes Operator Pattern](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/)
- [OCI Image Specification](https://github.com/opencontainers/image-spec)
- [Grafana Alloy](https://grafana.com/docs/alloy/latest/)

## Copyright/License

This document is licensed under the Apache License, Version 2.0 — see [LICENSE](../LICENSE)
or https://www.apache.org/licenses/LICENSE-2.0.
