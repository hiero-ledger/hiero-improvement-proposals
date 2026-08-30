---
hip: 0000
title: HBAR Vaulted Balances with Delayed Release and Recovery
author: Schayan Salehi (@shayansal)
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/pull/1539
type: Standards Track
category: Service
needs-hiero-approval: Yes
needs-hedera-review: Yes
status: Draft
created: 2026-08-31
updated: 2026-08-31
---

## Abstract

This HIP proposes an account-native HBAR vault that limits the damage caused by
compromise of an account's ordinary signing key. An opted-in account divides its
HBAR into an available balance and a vaulted balance under the same account ID.
Available HBAR behaves normally. Vaulted HBAR remains native, participates in
staking, and cannot fund transfers, allowances, contract calls, or transaction
fees. Moving vaulted HBAR requires a destination-bound release request followed
by a configurable delay. During that delay, a distinct guardian key may cancel
the release or recover the vault only to a precommitted recovery account.

The design deliberately separates spending authority from emergency authority.
A guardian cannot send HBAR to an arbitrary destination, and an ordinary-key
attacker cannot silently change the guardian, recovery account, or delay:
security-reducing configuration changes are themselves delayed and cancellable.
Execution of a matured release is permissionless, but its amount and destination
are immutable, eliminating execution-time redirection and fee races. The first
version permits one pending release and one pending configuration update per
account, keeping consensus state bounded.

The proposal adds explicit HAPI operations, state, response codes, record
output, Mirror Node representation, and SDK builders. Existing accounts remain
unchanged unless they opt in. The intended result is a practical, protocol-level
blast-radius control for individual holders, treasuries, exchanges, and staking
accounts without wrapping HBAR or migrating to a smart-contract wallet.

## Motivation

An account key authorizes nearly every consequential action for a conventional
Hiero account. If that key is stolen through malware, phishing, leaked backups,
or a compromised signing device, an attacker may transfer the account's full
liquid HBAR balance before the owner or a monitoring service can respond.
Key rotation helps only if the legitimate owner acts first. Scheduled
transactions can delay a particular action, but they do not make the source
balance unavailable to ordinary transfers in the meantime.

Users can approximate stronger controls with multiple accounts, multisignature
keys, or contracts. Those approaches are valuable but impose operational costs:

- a second account changes the account identifier and requires balance movement;
- a threshold key adds friction to every transaction rather than only large
  withdrawals;
- a smart-contract vault changes the custody and integration model, consumes EVM
  resources, and may not retain the same native-account behavior; and
- an off-ledger custodian substitutes institutional trust for protocol-enforced
  self-custody.

The missing primitive is a balance compartment in which HBAR remains associated
with its account and staking configuration, but cannot be immediately spent by
the account's routine key. A time delay is useful only if it creates an
intervention window, and an intervention window is useful only if a separate
authority can act without gaining unilateral theft authority.

This HIP therefore targets a precise guarantee: when an attacker controls the
ordinary account key but not the guardian key, the attacker's immediate HBAR
exfiltration is bounded by the available balance and fees the attacker can
authorize. Vaulted HBAR can leave only through a visible, destination-bound
release that survives the configured delay, or through recovery to the account's
precommitted recovery destination.

This is a mitigation, not an absolute guarantee against all loss. It does not
protect an already-available balance, an executed release, simultaneous
compromise of all relevant keys and destinations, or protocol-authorized
network charges. The purpose is to turn a common single-key catastrophe into a
bounded and observable incident.

## Rationale

### Same account, two balance compartments

Keeping available and vaulted HBAR under one account preserves the account's
identity, staking election, and reward relationship. It avoids a synthetic
token, wrapper contract, or custody transfer. Nodes continue to enforce HBAR
conservation over the sum of both compartments.

### Destination-bound delayed release

A release request commits to both amount and destination. After maturity,
anyone may execute that exact transfer. Permissionless execution allows a user
or service to complete a release without keeping the ordinary key online, while
the immutable destination means a third party cannot steal the funds by racing
the owner. Changing amount or destination requires cancellation or expiry and a
new delay.

The alternative of unlocking HBAR into the available balance after a delay was
rejected because an ordinary-key attacker could race the owner immediately
after unlock. A self-directed release remains available for users who explicitly
want funds returned to their available balance.

### Guardian with constrained power

The guardian is an emergency authority, not a second spending authority. It may
cancel, suspend, or recover only to a destination committed in advance. A
compromised guardian can cause denial of service, but cannot redirect the vault
to itself unless the recovery destination was already under its control. This
asymmetry makes it practical to keep the guardian key offline or distribute it
as a threshold key.

### Delayed configuration changes

Immediate guardian removal, delay shortening, or recovery-destination changes
would let an ordinary-key attacker disable the vault before stealing it.
Configuration changes therefore wait under the old configuration delay and can
be cancelled by the current guardian. The new guardian must sign a change that
installs it, preventing accidental installation of an unusable key. This also
supports recovery from a lost guardian: the account key and replacement
guardian may propose a rotation, then wait through the public challenge period.

### Bounded state in the first version

One pending release and one pending configuration update per account provide the
core security property with constant state. Multiple withdrawal queues,
recurring policies, per-destination limits, and HTS assets can be considered
later without making the initial consensus implementation unbounded.

### Relationship to existing work

[HIP-406](./hip-406.md) intentionally keeps staked HBAR liquid. This HIP does
not alter staking or require lock-up for staking; it gives an account owner a
separate, optional security policy while preserving the staking contribution of
both balance compartments.

[HIP-796](./hip-796.md) describes issuer-administered locking for Hedera Token
Service assets. An HBAR vault is holder-controlled, applies to the native
currency, and assigns only constrained emergency powers to a guardian. It is not
an issuer freeze or compliance control.

[HIP-423](./hip-423.md) provides long-term scheduled transactions. A scheduled
transfer does not reserve its source balance against other spending and does not
provide the guardian cancellation and recovery model specified here.

Bitcoin's BIP-345 explored delayed withdrawal and recovery through UTXO
covenants. ERC-7093 defines an interface for social recovery of smart-contract
wallets. Both inform the threat model, but this HIP uses Hiero account state and
HAPI semantics rather than a UTXO covenant or application contract.

## User stories

- As a holder, I want most of my HBAR to remain under my familiar account ID but
  require advance notice before it can leave.
- As a staking participant, I want vaulted HBAR to continue contributing to my
  staking election and rewards.
- As a treasury operator, I want routine payments to use a limited available
  balance while large reserves have an intervention window.
- As an exchange, I want hot-key compromise to expose only an intentionally
  funded operational balance.
- As an account owner, I want an offline guardian to cancel an unexpected
  withdrawal without making that guardian a general-purpose spender.
- As an account owner who lost the routine key, I want the guardian to recover
  vaulted HBAR only to a destination I selected in advance.
- As an account owner who lost the guardian key, I want to rotate it after a
  delayed, observable challenge period.
- As a wallet developer, I want structured state and events for release and
  configuration countdowns so users can recognize and respond to attacks.
- As an auditor, I want the immediate-loss bound to be derivable from consensus
  state rather than from an off-ledger policy.

## Specification

### Terminology and invariants

An account with an active vault has these HBAR quantities:

- `available_hbar`: HBAR usable by ordinary account-authorized operations;
- `vaulted_hbar`: HBAR protected by the vault; and
- `total_hbar = available_hbar + vaulted_hbar`.

The implementation MUST maintain the following invariants:

1. `available_hbar` and `vaulted_hbar` are non-negative signed 64-bit tinybar
   quantities, and their sum MUST NOT overflow.
2. Existing transfer, allowance, contract, fee-payment, and account-deletion
   paths MUST NOT debit `vaulted_hbar`, except for the explicit exceptions in
   this HIP.
3. A normal release MUST transfer only the amount and to the destination stored
   in the pending release.
4. Guardian recovery MUST transfer only to the active `recovery_account_id`.
5. Consensus time, not submitting-client time, determines maturity and expiry.
6. At most one pending release and one pending configuration update may exist
   for an account.
7. HBAR conservation and existing maximum-supply invariants apply to the sum of
   both compartments.

### Applicability

The first version applies to non-contract accounts with a fully resolved account
key. Hollow accounts MUST complete before enabling a vault. Contract accounts
and contract-controlled accounts are outside the first version. An account opts
in explicitly; accounts without a vault retain existing behavior and state
representation.

### Vault configuration

An active vault configuration contains:

```protobuf
message HbarVaultConfig {
  Key guardian_key = 1;
  AccountID recovery_account_id = 2;
  google.protobuf.Duration release_delay = 3;
  google.protobuf.Duration release_execution_window = 4;
  google.protobuf.Duration config_update_delay = 5;
  HbarVaultRewardDestination reward_destination = 6;
}

enum HbarVaultRewardDestination {
  HBAR_VAULT_REWARD_DESTINATION_UNSPECIFIED = 0;
  HBAR_VAULT_REWARD_DESTINATION_AVAILABLE = 1;
  HBAR_VAULT_REWARD_DESTINATION_VAULTED = 2;
}
```

The network properties define inclusive minimum and maximum values for each
duration. `config_update_delay` MUST be at least `release_delay`. The recovery
account MUST exist, MUST NOT be deleted, and MUST differ from the protected
account. The guardian key MUST be present and valid.

Creation requires signatures from the account key and proposed guardian key.
If the recovery account requires a receiver signature, that signature is also
required. Vault creation MAY include an initial deposit and is atomic: if any
validation fails, neither configuration nor balance changes.

### Consensus state

Illustrative state is:

```protobuf
message HbarVaultState {
  int64 vaulted_tinybar = 1;
  bool suspended = 2;
  uint64 next_release_nonce = 3;
  PendingHbarVaultRelease pending_release = 4;
  PendingHbarVaultConfigUpdate pending_config_update = 5;
}

message PendingHbarVaultRelease {
  uint64 nonce = 1;
  int64 amount = 2;
  AccountID destination = 3;
  Timestamp requested_at = 4;
  Timestamp executable_at = 5;
  Timestamp expires_at = 6;
}

message PendingHbarVaultConfigUpdate {
  HbarVaultConfig proposed_config = 1;
  Timestamp requested_at = 2;
  Timestamp executable_at = 3;
  bool remove_vault = 4;
}
```

The physical schema MAY store the available balance as the account's current
balance field and add only `vaulted_tinybar`. External representations MUST
still distinguish available, vaulted, and total balances.

### Operations

This HIP introduces a single transaction body with an operation `oneof`.
Implementations MAY use separate protobuf messages internally, but their
consensus semantics MUST be equivalent.

```protobuf
message CryptoHbarVaultTransactionBody {
  AccountID account_id = 1;

  oneof operation {
    HbarVaultCreate create = 2;
    HbarVaultDeposit deposit = 3;
    HbarVaultRequestRelease request_release = 4;
    HbarVaultExecuteRelease execute_release = 5;
    HbarVaultCancelRelease cancel_release = 6;
    HbarVaultRecover recover = 7;
    HbarVaultSuspend suspend = 8;
    HbarVaultProposeConfigUpdate propose_config_update = 9;
    HbarVaultExecuteConfigUpdate execute_config_update = 10;
    HbarVaultCancelConfigUpdate cancel_config_update = 11;
  }
}
```

#### Create

`create` installs a valid configuration and optionally moves `initial_amount`
from available to vaulted HBAR. It requires the account, guardian, and any
receiver-required recovery signature described above. It MUST fail if a vault
already exists or if the initial amount plus transaction fees exceeds available
HBAR.

#### Deposit

`deposit` moves a positive amount from available to vaulted HBAR immediately.
It requires the account key. Depositing is permitted while suspended because it
cannot weaken protection. The transaction fee is assessed against available
HBAR or another authorized payer before the deposit is applied.

Ordinary incoming transfers credit available HBAR. Automatic routing of incoming
transfers is outside this version so that a sender's existing expectations and
the recipient's fee liquidity are not changed implicitly.

#### Request release

`request_release` contains a positive `amount`, a `destination`, and the
account's expected `next_release_nonce`. It requires the account key and any
receiver-required destination signature. It MUST fail if the vault is
suspended, a release is already pending, the nonce is stale, or vaulted HBAR is
insufficient.

On success, the node stores:

- `executable_at = consensus_time + release_delay`; and
- `expires_at = executable_at + release_execution_window`.

The node then increments `next_release_nonce`. The requested amount remains part
of vaulted HBAR, continues to participate in staking, and is marked reserved.
It cannot be used for another release. A release is publicly observable as soon
as the request reaches consensus.

#### Execute release

`execute_release` identifies the protected account and pending-release nonce. It
requires no account or guardian signature and may be submitted by any payer. It
MUST succeed only during the half-open interval
`[executable_at, expires_at)`. It atomically debits vaulted HBAR, credits the
stored destination, and clears the pending release. Neither the submitter nor
the transaction may supply a replacement amount or destination.

If the destination is the protected account, the released amount becomes
available HBAR. Otherwise it is credited under ordinary `CryptoTransfer`
recipient semantics. A receiver signature required when the request reaches
consensus records the destination's consent to this later credit; execution does
not require a fresh signature. Destination deletion after a valid request causes
execution to fail without clearing the release; the guardian may recover, or the
release may expire.

When `consensus_time >= expires_at`, the release is expired. Any subsequent
vault transaction MAY clear the expired record before processing, and Mirror
Node representations MUST report the expiry. Expiry does not move HBAR; it
removes the reservation and leaves the amount vaulted.

#### Cancel release

`cancel_release` requires the guardian key and the pending-release nonce. It may
execute at any time before successful release execution, clears the release,
and leaves all HBAR vaulted. The account key alone MUST NOT cancel a pending
release because cancellation followed by a modified request could obscure a
compromise signal; the owner can ask the guardian or wait for expiry.

#### Suspend

`suspend` requires the guardian key. It immediately sets `suspended = true` and
cancels any pending release. While suspended, new release requests and normal
release execution MUST fail. Deposit, guardian recovery, and configuration
management remain available. Clearing suspension requires a delayed
configuration update; it is not an immediate account-key operation.

#### Recover

`recover` requires the guardian key. It cancels a pending release, transfers all
vaulted HBAR to the active `recovery_account_id`, and leaves the vault enabled
and suspended. It MUST NOT accept an amount or destination. If the recovery
account requires receiver signature, that signature is required. An authorized
third-party payer may pay the transaction fee, so recovery does not depend on an
available balance.

Recovery does not transfer available HBAR. That balance remains controlled by
the ordinary account key and is outside the vault's guarantee.

#### Propose configuration update

`propose_config_update` supplies a complete replacement configuration or a
request to remove the vault. A replacement requires the account key and the
proposed guardian key. A receiver-required new recovery account must also sign.
Removal requires the account key and is valid only when vaulted HBAR is zero and
no release is pending.

The operation MUST fail if another configuration update is pending. Its
`executable_at` is calculated with the active, old `config_update_delay`.
Reducing a delay or changing the recovery account therefore cannot shorten the
challenge period already in progress. Proposing an update does not clear
suspension.

#### Execute configuration update

`execute_config_update` is permissionless and identifies the protected account.
It applies the complete pending update only after `executable_at`. The operation
MUST revalidate the proposed guardian, recovery-account existence, and duration
limits that can change over time. Any receiver signature required at proposal
time records advance consent to the delayed change and is not required again at
execution. A normal configuration update MAY explicitly set
`suspended = false`.

Removal additionally requires vaulted HBAR to be zero and no pending release at
execution time. On success, the pending update is cleared. A failed revalidation
leaves it pending so the current guardian can cancel it.

#### Cancel configuration update

`cancel_config_update` requires the current guardian key and clears the pending
configuration update. The proposed guardian has no cancellation authority until
the update is executed.

### Signature and key-rotation rules

The ordinary account key continues to authorize non-vault account operations.
Rotating the ordinary key does not alter vault state, cancel a release, or
change the guardian. Existing key-update authorization rules still apply.

A scheduled transaction, allowance, delegated contract, or Ethereum signature
MUST NOT substitute for the guardian signature unless it directly satisfies the
stored protobuf `Key`. Guardian signatures MUST be evaluated with the same key
semantics and signature-prefix rules as other HAPI keys.

### Spending, fees, allowances, and contracts

Only available HBAR may fund:

- `CryptoTransfer` debits;
- approved HBAR allowances;
- smart-contract value and internal value transfers;
- contract-creation endowment;
- transaction fees and maximum-fee solvency checks; and
- scheduled transaction execution.

The protected account may use an independent payer. EVM and native-service
paths MUST share the same available-balance check so no internal dispatch path
can bypass the vault.

Account auto-renew is the sole non-vault-operation exception: it debits available
HBAR first and MAY debit vaulted HBAR for the remaining network-assessed renewal
charge. This prevents account expiry from permanently stranding vaulted HBAR.
The debit MUST be identified as an auto-renew charge in records and Mirror Node
data. It cannot name a user-controlled destination and remains bounded by the
network fee schedule.

Account deletion MUST fail while a vault configuration, vaulted balance,
pending release, or pending configuration update exists. The vault must first be
emptied and removed through its delayed process.

### Staking and rewards

Staking weight and reward calculations use `total_hbar`. Vaulting and releasing
HBAR within the same account MUST NOT independently trigger a staking-period
reset. A release to another account follows existing transfer and staking
semantics.

When staking rewards are paid, the active `reward_destination` determines
whether the reward is credited to available or vaulted HBAR. A value of
`UNSPECIFIED` is invalid in an active configuration. Wallets SHOULD recommend
`VAULTED` for cold-storage accounts and clearly explain the fee-liquidity
tradeoff.

### Query and record semantics

`CryptoGetAccountBalance` and account-info responses MUST add available and
vaulted quantities. Their legacy `balance` field MUST continue to report total
HBAR for supply and accounting compatibility. New clients MUST use
`available_hbar` when assessing spendability.

Transaction records for vault operations MUST contain the protected account,
operation, affected amount, release nonce, immutable destination where
applicable, and relevant consensus timestamps. Records MUST NOT disclose key
material beyond existing key representations.

Ethereum JSON-RPC `eth_getBalance` MUST report available HBAR for a vaulted
account because an Ethereum balance represents value the EVM account can spend.
Relay implementations SHOULD expose total and vaulted balances through a
separate documented Hiero-specific method. This distinction applies only to
opted-in accounts; for all other accounts, available equals total.

### Throttles and fees

The new functionality receives dedicated throttles and fee schedules. Fees MUST
reflect signature verification, state reads and writes, record bytes, and the
duration of pending state where rent is applicable. Execute and cancel
operations must be cheap enough for reliable monitoring response without being
free to spam.

### Response codes

Implementations SHOULD define specific response codes equivalent to:

- `HBAR_VAULT_NOT_ENABLED`
- `HBAR_VAULT_ALREADY_ENABLED`
- `HBAR_VAULT_SUSPENDED`
- `HBAR_VAULT_INVALID_CONFIG`
- `HBAR_VAULT_INVALID_GUARDIAN_SIGNATURE`
- `HBAR_VAULT_INVALID_RECOVERY_ACCOUNT`
- `HBAR_VAULT_INSUFFICIENT_AVAILABLE_BALANCE`
- `HBAR_VAULT_INSUFFICIENT_VAULTED_BALANCE`
- `HBAR_VAULT_RELEASE_ALREADY_PENDING`
- `HBAR_VAULT_RELEASE_NOT_PENDING`
- `HBAR_VAULT_RELEASE_NOT_MATURE`
- `HBAR_VAULT_RELEASE_EXPIRED`
- `HBAR_VAULT_RELEASE_NONCE_MISMATCH`
- `HBAR_VAULT_CONFIG_UPDATE_ALREADY_PENDING`
- `HBAR_VAULT_CONFIG_UPDATE_NOT_PENDING`
- `HBAR_VAULT_CONFIG_UPDATE_NOT_MATURE`
- `HBAR_VAULT_MUST_BE_EMPTY`

The final names and numeric assignments are implementation details, but clients
must be able to distinguish these failure classes.

### Impact on Mirror Node

Mirror Node account models must preserve total balance and add available and
vaulted balances, active configuration, suspension state, pending release,
pending configuration update, and their timestamps. A suggested endpoint is:

```text
GET /api/v1/accounts/{accountId}/hbar-vault
```

The response should include `available_balance`, `vaulted_balance`,
`reserved_release_balance`, `guardian_key`, `recovery_account_id`, active
durations, reward destination, suspension state, release nonce and destination,
and consensus timestamps. Historical transaction APIs should identify every
vault state transition.

Mirror ingestion must treat expiry deterministically. It may derive an
`EXPIRED` presentation state from consensus timestamps even before a later
transaction clears the consensus record, but must not represent the HBAR as
having moved.

Operators and monitoring services should be able to subscribe to release
requests, suspensions, recoveries, and configuration changes without polling
account balance alone.

### Impact on SDK

SDKs should provide builders for every operation, typed configuration and state
models, transaction-record decoding, and checksum-aware account identifiers.
Wallet-facing helpers should:

- compute maturity and expiry from network consensus timestamps;
- label available balance as spendable and vaulted balance as protected;
- require explicit confirmation of release destination and delay;
- warn when guardian and recovery credentials appear co-located;
- support an independent payer for execute, cancel, and recovery; and
- surface pending release and configuration changes prominently.

SDK balance helpers must not silently substitute total HBAR where a transaction
requires available HBAR. Existing methods may retain total-balance behavior for
compatibility, but new spendability methods should be explicit.

## Backwards Compatibility

The feature is opt-in. Account state and transaction behavior are unchanged for
accounts without a vault. Existing protobuf fields retain their wire numbers,
and new fields must use new numbers according to repository conventions.

The most important compatibility distinction is that a vaulted account's total
balance is no longer fully spendable. Legacy clients that read only the existing
native `balance` field may overestimate spendability and receive an insufficient
available-balance response. New fields and SDK helpers provide the correct
value. Wallets should not offer vault activation until they understand these
fields.

For JSON-RPC, `eth_getBalance` reports the EVM-spendable available balance for an
opted-in account. Indexers that need accounting balance must use Mirror Node or
the Hiero-specific extension. This is a deliberate semantic choice to prevent
clients from constructing transactions that consensus must reject.

No migration is required. Nodes that do not support the functionality must
reject its transaction body as unsupported before the feature is activated.
Feature activation must occur at a network upgrade boundary with corresponding
Mirror Node, relay, and SDK support.

## Security Implications

### Security property and loss bound

Assuming the guardian key and active recovery destination remain uncompromised,
an attacker controlling only the ordinary account key cannot immediately debit
vaulted HBAR. The attacker's immediate HBAR loss bound is the account's available
HBAR plus fees or value already authorized outside the vault. The attacker may
request a release, but the amount, destination, maturity, and expiry become
public before execution, giving the guardian a cancellation or recovery window.

This property depends on operational monitoring. A delay without observation
does not prevent a patient attacker from executing a matured release.

### Compromise cases

- **Ordinary key only:** The attacker may spend available HBAR, deposit it into
  the vault, request one release, and propose a configuration change. The
  guardian can cancel, suspend, recover, or cancel the configuration change.
- **Guardian only:** The attacker may cancel releases, suspend the vault, and
  recover only to the precommitted destination. This permits denial of service
  but not arbitrary redirection.
- **Recovery destination only:** No immediate authority is gained over the
  source vault, but a later legitimate or malicious guardian recovery would
  deliver funds to the compromised destination. Owners must rotate it using the
  delayed process.
- **Ordinary and guardian keys:** The attacker can recover to the existing
  recovery account and can eventually change configuration. Protection then
  depends on control of the recovery destination and observation during the
  configuration delay.
- **All authorities or an executed release:** The HIP cannot prevent loss.

### Front-running and replay

Execution is safe to front-run because amount and destination are stored in
consensus state. Nonces prevent replay of an old request or cancellation against
a newer release. Consensus timestamps prevent local-clock manipulation.

### Griefing and liveness

A malicious guardian can repeatedly cancel releases or suspend the vault. This
is an accepted consequence of constraining the guardian away from theft while
preserving emergency power. The account and a new guardian can rotate the
guardian after the configuration delay; the current guardian may contest the
change until execution. Users needing different availability guarantees should
encode threshold or time-varying logic in the guardian `Key` when supported.

An ordinary-key attacker can create a pending release or configuration update,
but constant per-account state and transaction fees bound storage amplification.

### Destination and signature changes

Receiver-signature requirements are validated when a release or configuration
change is requested and record consent to the delayed action. A destination that
becomes deleted or otherwise invalid cannot cause redirection; execution fails
and the funds remain vaulted. Recovery-account changes wait under the old
configuration delay.

### Cross-service bypass prevention

Every debit path, including internal EVM transfers, allowances, scheduled
transactions, fees, and account deletion, must use available balance unless this
HIP explicitly permits otherwise. Implementation review should centralize this
check rather than independently reproducing it in each service.

### Explicit non-goals

The vault does not protect:

- available HBAR;
- HTS tokens or NFTs;
- authorized network fees such as account auto-renew;
- failures in staking, fee, or consensus accounting;
- a user who approves a malicious destination and ignores the delay; or
- keys and recovery accounts that are compromised together.

## How to Teach This

Wallets should present the vault as two visible amounts under one account:
"available now" and "protected by delay." Activation education should explain
three independent elements: the everyday account key, an offline guardian, and
a recovery account that the guardian cannot replace immediately.

The primary workflow should be taught as:

1. Deposit routine savings into the vault.
2. Request a release to an exact destination.
3. Review the public countdown.
4. Execute after maturity, or have the guardian cancel if the request is not
   recognized.

Wallets must not describe vaulted HBAR as impossible to steal. They should state
the assumptions and immediate-loss bound, test guardian access during setup,
recommend independent monitoring, and provide an emergency recovery rehearsal
with a small amount before large deposits.

## Reference Implementation

A reference implementation is not yet available. An implementation should be
split into reviewable changes for protobuf/API definitions, Services state and
handlers, fee and throttle configuration, staking integration, Mirror Node,
JSON-RPC Relay, and SDKs.

The conformance suite must include at least:

- conservation and overflow tests across both balance compartments;
- every native, scheduled, allowance, fee, and EVM debit path;
- boundary timestamps immediately before, at, and after maturity and expiry;
- nonce replay, duplicate submission, and out-of-order transaction tests;
- ordinary-key, guardian-key, and combined-compromise scenarios;
- guardian cancellation racing release execution in consensus order;
- recovery-account deletion and receiver-signature changes;
- account-key and guardian-key rotation during pending operations;
- staking reward and period behavior for deposit, release, and recovery;
- auto-renew debits with zero available HBAR;
- state-proof, record-stream, restart, reconnect, and migration tests;
- Mirror Node ingest and REST compatibility tests; and
- differential tests confirming total HBAR supply is unchanged.

A property-based model should generate arbitrary valid sequences of vault
operations and assert conservation, non-negative balances, fixed release
destinations, recovery-destination confinement, and the one-pending-item bounds.

## Rejected Ideas

### A second ordinary account as the protocol design

Users can already separate hot and cold balances across accounts, but that
changes identity and requires operational reconciliation. The proposal seeks a
native policy under one account ID.

### Guardian as a general co-signer

Requiring the guardian for every spend turns the vault into an ordinary
multisignature account and encourages the guardian to remain online. The delayed
challenge model keeps routine operation simple and emergency authority offline.

### Guardian recovery to an arbitrary destination

This would turn guardian compromise directly into theft. Recovery is therefore
confined to the active, delayed-change destination.

### Delay followed by automatic unlock to available balance

An attacker with the ordinary key could race to spend the balance at maturity.
Destination-bound execution removes that race.

### Immediate vault disable or delay reduction

Either operation would let an ordinary-key attacker remove the protection
before exfiltration. All weakening changes use the old configuration delay.

### Unlimited concurrent releases

Multiple releases improve throughput but add queues, reservation complexity,
and potentially unbounded state. One pending release is sufficient to validate
the security primitive.

### Wrapping HBAR in an HTS token or EVM contract

Wrapping changes asset and custody semantics and makes protection dependent on
application code. This HIP is intentionally a native-account feature.

## Open Issues

1. Should network policy set a stronger minimum configuration delay than the
   minimum release delay?
2. Should auto-renew be configurable to fail rather than debit vaulted HBAR,
   despite the risk of account expiry and stranded funds?
3. Should a later version allow multiple pending releases with an explicit,
   network-bounded maximum?
4. Should incoming transfers or staking rewards support amount thresholds and
   automatic vault routing?
5. Should HTS balances receive a separate holder-controlled vault primitive, or
   should that work extend HIP-796?
6. What Hiero-specific JSON-RPC method should expose total and vaulted HBAR?
7. Should contract-controlled accounts be supported through a system-contract
   interface after native semantics are proven?
8. Should the release execution window be optional, and if so, what maximum
   lifetime prevents abandoned pending state?

## References

- [HIP-1: HIP Purpose and Guidelines](./hip-1.md)
- [HIP-406: Staking](./hip-406.md)
- [HIP-423: Long Term Scheduled Transactions](./hip-423.md)
- [HIP-796: Lockable Fractional Amounts of Fungible Tokens](./hip-796.md)
- [BIP-345: OP_VAULT](https://bips.dev/345/)
- [ERC-7093: Social Recovery Interface](https://eips.ethereum.org/EIPS/eip-7093)

## Copyright/license

This document is licensed under the Apache License, Version 2.0 —
see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>.
