---
hip: 28
title: Guardian Type Solution
author: Matthew Smithies <matt.s@dovu.io>, Wes Geisenberger <wes.geisenberger@hedera.com>, Serg Metelin <sergey.metelin@hedera.com>, Ken Anderson <ken@hedera.com>, Daniel Norkin <daniel.norkin@envisionblockchain.com>, Prernaa Agarwal <prernaa.agarwal@envisionblockchain.com>
type: Standards Track
category: Application
needs-council-approval: No
status: Active
created: 2021-10-10
discussions-to: https://github.com/hiero-ledger/hiero-improvement-proposals/discussions/83
updated: 2021-10-27
---

## Abstract

Guardian is a modular open-source solution that includes best-in-class identity management and decentralized ledger technology (DLT) libraries. At the heart of Guardian solution is a sophisticated Policy Workflow Engine (PWE) that enables the ability for applications to offer a requirements-based tokenization implementation.

This document formally specifies Guardian with a specification on the Policy Workflow Engine.

## Motivation

To incentivize good environmental stewardship, regulatory bodies have defined standards and business requirements to incentivize organizations to adopt Carbon Credits. These very specific standards and business requirements offer a good way to demonstrate how a PWE becomes a business-critical component for a requirements-based, trusted tokenization service.

## Rationale

With regards to ecological markets, business leaders will find themselves in these four phases:

* Creating Verified Supply
* Establishing Demand
* Buying & Selling
* Offsetting

There are many rationales that can be applied here such as Greenhouse Gas Emission Profiles and Renewable Energy Credits. For purposes of this rationale we will focus on two types of carbon credits:

* emission allowances and
* carbon offsets.

While emission allowances are subject to government regulation, a carbon offset is an intangible asset that is created in a process involving a project or program whose activity can be claimed to reduce or remove carbon as a result, that is independently verified and turned into a carbon offset. These offsets are minted, or issued, by an environmental registry that created the standard methodology or protocol used to create the verified carbon offset claim. The offset then represents the original owner’s property right claim to the carbon-related benefits. The asset owner(s) can then sell their credits directly to buyers, or at wholesale. The ultimate end-user has the right to claim the benefits, and has the ability to retire the credit permanently – usually as part of a netting process, where the claimed CO2 benefits are subtracted from that end-user’s other Greenhouse Gas (GHG) emissions.

The process to create a carbon offset claim that can be validated and verified to be turned into an offset product is called measurement, reporting and verification (MRV). Today, this process of collecting the supporting data for these carbon offsets is heavily manual and prone to errors. The main factors driving these error-prone are:

* Poor data quality
* Lack of assurance
* Potential double counting
* Greenwashing
* Overall lack of trust.

This is where a Guardian type solution that leverages a PWE, is a sensible approach to ameliorate the issue with the current processes. The dynamic PWE can mirror the standards and business requirements of regulatory bodies. In particular, Guardian solution offers carbon markets the ability to operate in a fully auditable ecosystem by including:

* W3C Decentralized Identifiers (DIDs)
* W3C Verifiable Credentials (VCs)
* W3C Verifiable Presentations (VPs)
* Public decentralized ledger technologies (DLTs).
* Policy workflow engines through fully configurable and human readable “logic blocks” accessible through either a user interface or an application programming interface (API).

## Additional Rationale

Soil is the greatest land store of carbon, and if correct agricultural processes aren't followed this can trigger a negative effect of carbon stores. Organizations such as DOVU believe that such projects should include incentivization structures by default including a layer of accountability so that the carbon capture abilities of soil are optimized.

There are a number of elements that are required:

* A project owner that has been created and is linked to a new Ecological Project (EP).
* A link between HTS (to issue tokenized carbon offsets) and HCS (to log the evidence supporting the issuance of tokenized carbon offsets), a common format.
* A genesis message that would the initial asset in terms of a Core Carbon Principals (CCP) token.
* State changes of the CCP representation, with versions and updates including additionally and leakage.
* Continued messages, with a common schema that can be used as a mechanism to upload evidence.
* I expect that this work will continue to evolve and adjust over time.

These elements listed above would require a dynamic Policy Workflow Engine.

Listed above is just one rationale, however, a similar workflow will be required to fulfill various use cases / polices.

## User stories

N/A

## Specification

In this section, the document discusses Guardian's key concepts and definitions.

### W3C Decentralized Identifier

Uniqueness and security of identifiers used in the issuance of carbon offset claims and associated assets are very important to unambiguously identify entities interacting with and through one or more solutions, such as Guardian, and keep those interactions secure. Furthermore, to facilitate automation and real-time interactions within and through a Guardian-type solution (GTS), the discovery of identifiers and an ability to resolve them to the underlying public keys that secure them is also critical.

This leads to the following specifications:

* Entities interacting with and through a GTS must each have a unique identifier.
* Any unique identifier utilized in a GTS must be associated with a set of public keys.
* Any unique identifier utilized in a GTS must be discoverable by a 3rd party.
* Any unique identifier utilized in a GTS must be resolvable to its associated public keys used for cryptographic authentication of the unique identifier.
* Any unique identifier utilized in a GTS must follow the W3C DID Core specification [[W3C DID](https://www.w3.org/TR/did-core/)].

Per W3C:
> Decentralized identifiers (DIDs) are a new type of identifier that enables verifiable, decentralized digital identity. A DID refers to any subject (e.g., a person, organization, thing, data model, abstract entity, etc.) as determined by the controller of the DID. In contrast to typical, federated identifiers, DIDs have been designed so that they may be decoupled from centralized registries, identity providers, and certificate authorities. Specifically, while other parties might be used to help enable the discovery of information related to a DID, the design enables the controller of a DID to prove control over it without requiring permission from any other party. DIDs are URIs that associate a DID subject with a DID document allowing trustable interactions associated with that subject.
>
> Each DID document can express cryptographic material, verification methods, or services, which provide a set of mechanisms enabling a DID controller to prove control of the DID. Services enable trusted interactions associated with the DID subject. A DID might provide the means to return the DID subject itself, if the DID subject is an information resource such as a data model."
>
> This document specifies the DID syntax, a common data model, core properties, serialized representations, DID operations, and an explanation of the process of resolving DIDs to the resources that they represent.

### W3C Verifiable Credential

Entity identities and credentials, such as carbon offset claims, are established outside of the context, and, therefore, the scope of a GTS. Hence, it is required that GTS participants -- Requesters, Providers, and, if distinct, GTS Operators -- to establish the trust context of acceptable identities and credentials for a GTS, and for a given Policy Context. This statement also applies to a network of GTSs which are to interoperate with one another.

Note that a Policy Context is comprised of the legal and jurisdictional requirements established by a specific Policy issued by the policy issuing organization such as a regulatory or government body.

We follow the definition of a [W3C Verifiable Credential](https://www.w3.org/TR/vc-data-model/#credentials)
> A credential is a set of one or more claims made by the same entity. Credentials might also include an identifier and metadata to describe properties of the credential, such as the issuer, the expiry date and time, a representative image, a public key to use for verification purposes, the revocation mechanism, and so on. The metadata might be signed by the issuer. A verifiable credential is a set of tamper-evident claims and metadata that cryptographically prove who issued it.

The following specifications are made for credentials utilized within the context of one or more GTSs and a specific Policy context:

* A unique identifier utilized within a GTS should be linked to an (Legal) Entity accepted by GTS participants and within the context of a Policy to be applied.
* A Trust context for the unique identifier is to be achieved through a cryptographically signed, cryptographically verifiable, and cryptographically revocable credential based on the public keys associated with the unique identifier of the credential issuer.

In the context of this document, a Legal Entity is an individual, organization, or company that has legal rights and obligations.

Note that credentials utilized within one or more GTSs may be self-issued. The acceptance of self-issued credentials is up to the participants within a Policy context that need to rely on the claim(s) within a self-issued credential.

Furthermore,

* The unique identifier of the (Legal) Entity must be the subject of the credential.
* The unique identifier of the issuer of the (Legal) Entity credential utilized in the context of a Policy must have a credential linking the unique identifier of the issuer to an (Legal) Entity accepted by the participants within the Policy context.
* A credential utilized within a Policy Context must follow the W3C Verifiable Credential specification [[W3C VC](https://www.w3.org/TR/vc-data-model/)].
* A credential utilized within one or more GTSs and a specific Policy context must itself have a unique and resolvable identifier.

Note, that the unique and resolvable identifier of a credential does not have to be associated with any cryptographic keys.

Also, if present, the status of a credential utilized within one or more GTSs and a specific Policy Context must be discoverable by a party verifying the credential, called the credential verifier.

In the context of this document, a credential verifier is defined per the [W3C Verifiable Credential Standard](https://www.w3.org/TR/vc-data-model/).

Finally,

* A credential utilized within one or more GTSs and a specific Policy Context should be discoverable by a participant as defined within within a Policy Context.
* The presentation of a credential utilized within one or more within one or more GTSs and a specific Policy Context must be cryptographically signed by the presenter of the credential, also known as the credential holder.

See the [W3C Verifiable Credential Standard](https://www.w3.org/TR/vc-data-model/) for a definition of credential holder. Also see the next section for definitions and requirements for a W3C verifiable presentation.

Furthermore, if a credential holder is a participant in a specific Policy Context, the holder must have a unique identifier that has been established within the Policy Context the holder operates in.

Also, a credential utilized in a GTS should be stored in the GTS.

This avoids the re-presentation of the credential after the initial presentation.

Finally, a credential holder must be able to prove control over a credential utilized in a Policy Context every time said credential is presented to a GTS or a Participant as defined in a Policy Context.

Note that credential content verification can only be done through the inspection of underlying documentation or verification by the credential issuer, where the issuer(s) is defined in the Policy Context.

### W3C Verifiable Presentation

A verifiable presentation in the context of this document is used according to the [W3C Verifiable Credential Presentation Description](https://www.w3.org/TR/vc-data-model/#presentations)
> A verifiable presentation expresses data from one or more verifiable credentials, and is packaged in such a way that the authorship of the data is verifiable. If verifiable credentials are presented directly, they become verifiable presentations. Data formats derived from verifiable credentials that are cryptographically verifiable, but do not of themselves contain verifiable credentials, might also be verifiable presentations.
>
> The data in a presentation is often about the same subject, but might have been issued by multiple issuers. The aggregation of this information typically expresses an aspect of a person, organization, or entity.

In the context of this document, one or more Verifiable Presentations are made from a Credential Holder to a Credential Verifier as defined in the W3C Verifiable Credential Standard and as established in the applicable Policy Context. Therefore, the Credential Holders and Credential Verifiers must comply with the requirements in [W3C Decentralized Identifier](w3c-decentralized-identifier) and [W3C Verifiable Credential](#w3c-verifiable-credential).

A presentation of one or more credentials must follow the specification in [W3C Verifiable Credential Standard for a Verifiable Presentation](https://www.w3.org/TR/vc-data-model/#presentations-0) such that that the authorship of the data in the Verifiable Presentation is verifiable.

Below is an example that builds a relationship between the aggregated Verifiable Credentials that will be presented within a Verifiable Presentation:

![Verifiable Presentation Example](../assets/hip-28/verifiable-presentation-example.jpg)

### Policy Workflow Engine

Starting with the [Wikipedia definition](https://en.wikipedia.org/wiki/Workflow_engine), this document defines a PWE to be a a software application that manages business processes based on business rules and business data which are defined within the context of a specific policy.

A PWE, therefore, manages and monitors the state of required policy actions and the required information flow in a policy grouped into a policy workflow, and determines which are the next policy actions based on the state of a policy workflow. The policy actions may be anything from saving an application form in a document management system to sending a reminder e-mail to users or escalating overdue items to management.

![Figure_1](../assets/hip-28/conceptual-view-workflow-engine.jpg)

Figure 1: Conceptual view of a general workflow engine. Source: [Yang, Huaizhou & Lv, Bowen & Shi, Wenbo & Sun, Jingxin. (2019). Research and Design of Lightweight Workflow Engine Based on SCA. Journal of Physics: Conference Series. 1237. 052006. 10.1088/1742-6596/1237/5/052006](https://www.researchgate.net/publication/334417867_Research_and_Design_of_Lightweight_Workflow_Engine_Based_on_SCA).

PWEs have mainly three functions:

1. Verification of the current policy process status: Is it valid to execute a given policy action, given a current status?
2. Determine the authority of policy workflow participants: Is the current user is permitted to execute the current policy action?
3. Executing a conditional script: After passing the previous two policy actions, the PWE executes the next policy action, and if the execution successfully completes, it returns the success, if not, it reports the error to trigger and roll back the change.

To summarize, a workflow engine is a core technique for a business process management software in which the workflow engine allocates tasks to different executors while communicating data among participants.

### Policy Workflow Engine Specification

A PWE execution within the context of this document is the deterministic state transition from state A to state B of a policy state object, and where the state object represents a valid policy workflow state between policy workflow participants within a Policy Context. A valid policy workflow state represents a data set that has been obtained from the correct application of a set of policy rules and data to a set of policy action and workflow input data, the output of which has been accepted by the required participants as specified in a policy.

Note that a deterministic state transition in the context of this document is facilitated by the combination of one or more policy actions grouped within a policy workflow. Also, note that a policy workflow is the execution of a series of causally connected and deterministic policy actions where the policy workflow or policy action participants are grouped into one or more workgroups that are attached to policy action of a policy workflow.

![Figure_2](../assets/hip-28/conceptual-view-relationships.jpg)

Figure 2: A Conceptual Overview of the relationships between Policy Workflows, Policy Actions and Workgroups managing Policy Actions and Policy Workflows. Source: This document

#### Policy Action

First, this document will discuss the requirements for policy action that will be implemented in the Virtual State Machine of a Policy Workflow Engine. Note that strictly speaking one needs to differentiate between the policy action as a logical construct defined in a document, and its instantiation within a PWE such as a GTS which is called a policy action instance. In the following, and unless required for disambiguation, this document shall use policy action also to mean policy action instance.

The basic policy action requirements are:

* a policy action must have an input, one or more process steps, and an output. This is just a well-known convention from business process management frameworks.
* The input of a policy action must represent a new, proposed state of a policy workflow state object compliant with a policy.
* The process steps in a policy action must represent a verification system comprised of the set, or subset, of policy rules and policy data such that an input can be validated to comply with the policy rules and policy data, or not.
* The output of a policy action must represent the processed result of an input into a policy workflow as a correct new policy workflow state.

Note that a new policy workflow state after a correct policy action execution is defined as

```plaintext
New Policy Workflow State = Old Policy Workflow State + Validated and Accepted New Policy State Object + Policy Action Output 
```

Below we specify, policy action participants, deployment and identification:

* A Policy Action instance must be associated with only one group of policy participants, or policy workgroup.
* A Policy Action instance must inherit the security and privacy policies of its associated policy workgroup. See the details of policy workgroups and their security and privacy policies below.
* A Policy Action must have a unique identifier within PWE.
* A Policy Action must be updatable.
* A Policy Action instance must not be updated while the policy action is being executed by PWE.

This ensures that no breaking changes with potentially significant negative business impact are introduced while a work step instance is being executed.

Also, a Policy Action must be versioned within a PWE. Furthermore, versions of the same policy action do not have to be compatible with one another.

Below this document specifies policy action execution:

* A Policy Action must be executed by a PWE.
* The input of a policy action must be submitted by an authorized participant of the policy workgroup attached to that policy action.

Note, that this allows for delegation of authorization from the authorization bearing Entity A to Entity B. This concept is also known as attenuated authorization.

Furthermore, and very importantly, a policy action must be deterministic. This means that for a given input, there can be only one valid output from the policy action.

Also, the output from a policy action execution must be finalized the indication of acceptance of a policy defined quorum of policy workgroup participants associated with the policy action. This means that the output of a policy action execution must be verified and agreed upon by a previously defined number of the policy action participants. This naturally extends to the input as well.

#### Policy Workflow

After specifying a policy action, this document will now turn to a policy workflow.

The minimal policy workflow requirements are as follows:

* A policy workflow must contain at least one policy action.
* All requirements for a policy action must also be applied to a policy workflow.

This means that requirements such as determinism, ability to update, versioning, etc. also apply to a policy workflow.

Furthermore, if there is more than one policy action in a policy workflow, the policy actions in a workflow must be causally connected.

This means that the output of one or more parallel policy actions in a workflow is a required input into a subsequent policy action.

Finally, a policy workflow with more than one policy action must have a unique identifier within a PWE. And a policy workflow with more than one policy action and a given set of inputs mut be sequentially executed. This simply means that for a given set of inputs there is only one path through a given policy workflow.

#### Policy Workflow Workgroup

In this section, the document will discuss the requirements for a policy workflow workgroup (PWW). Note that which policy workflow participants may or may not be able to create a policy workgroup is up to the individual PWE implementations. However, there must be at least one policy workflow role that has the authorization to create a PWW. Also, a PWW must consist of at least one participant and must have at least one administrator. Finally, a PWW MUST have at least one security policy.

Note that a security policy consists of authentication and authorization rules for the PWW participants. Note also that one or more PWW administrators define the workgroup security policy.

In addition, a PWW must have at least one privacy policy. A privacy policy defines the data visibility rules for each PWW participant.

Note that a PWW administrator must be able to perform at minimum the following functions:

* add or remove one or more participants
* create, update and delete both security and privacy policies.
* delete or archive a PWW

If a PWW has more than one administrator, there must be a policy defined consensus model for administrative actions.

Finally, a PWW may be attached to one or more policy action instances, and a policy workgroup attached to a policy workflow must be also attached to each policy action in the policy workflow.

#### Policy Workflow State Objects (PWSO)

This document has been defining and discussing policy workflow state objects (PWSOs) in the context of a PWE, hence, it needs to define stateful object processing. This necessitates a state or account-based model for policy workflow state objects. This is analogous to the Ethereum model using accounts and state object for smart contracts.

Therefore,

* A PWSO must have a unique identifier.
* A PWSO must have at least one owner.
* A PWSO may have more than one owner. Note that if a PWSO has more than one owner, the PWSO must have an authorization condition.

A PWSO authorization condition is a condition which has to be met by the owners to authorize a policy action from that PWSO. Therefore, PWSO ownership and associated authorizations must be cryptographically provable. This may be achieved through for example a cryptographic digital signature.

A PWSO must also have a deterministic nonce.

This ensures that policy actions originating from or acting on a PWSO are processed in the correct order.

The state of a PWSO must be represented by a cryptographic vector commitment scheme. Also, the PWSO properties consisting of more than one element must be represented by the same cryptographic vector commitment scheme as the full PWSO and its state.

These last two requirements ensure the structural integrity and cryptographic verifiability of the PWSO at all times.

Furthermore, the history of the state of PWSO must be represented by a cryptographic vector commitment.

This is required because not only does each state have to have structural integrity at all times but also its history with the causal connection between states.

To summarize, the state of a PWSO must be minimally comprised of the following elements:

* unique identifier
* Owner(s)
* Authorization Condition (if more than one owner)
* Nonce
* State Object representation
* State object storage (location)

The state of a PWSO must only be changed based on a valid policy action request initiated by an authorized owner.

This document will discuss the requirements of a policy action request (PAR) and what constitutes a valid PAR in the next section. Note, that PWSO may be associated with the state of a policy action instance.

#### Policy Workflow Engine Transactions

PWSO are altered through PARs submitted by requesters, see also Figure 1. In the following, this document specifies requirements for the structure and characteristics of PARs.

For identification, each PAR must have minimally the following identifiers:

* Policy Workflow Instance ID (UID)
* Policy Action Instance ID (UID)
* PAR ID (UID)

Note that the Policy Workflow ID may be the same as Policy Action ID if the workflow has only one Policy Action.

The minimal PAR requirements are as follows:

* Each PAR ID should be generated by the PAR originator/sender.
* Each PAR must have a `From` (Sender) and a `To` (Receiver) element each containing the respective Sender and Receiver identifiers.
* Each PAR must have a deterministic nonce.
* Each PAR must contain a representation of the PWSO constituting the suggested new policy workflow state, such that it can be validated by the PWSO owners.
* Each PAR must contain the cryptographic digital signature of the Sender.

A PAR must be considered invalid if one of the following conditions is met:

* The PAR nonce is not equal to the account nonce plus 1.
* The cryptographic signature(s) on the PAR cannot be verified
* The PAR does not have an existing Policy Workflow Instance ID and Policy Action Instance ID
* The PAR `From` or `To` are not unique identifiers
* The PAR is not well-formed based on the requirements of the Policy Action

Note, that this is only a minimal set of requirements on an invalid PAR. Each PWE can define other requirements not covered above.

In the following, this document will discuss the requirements on the Policy State Machine calculating the state transition of a PWSO based on a PAR and the relevant Policy Action instance.

Since PWEs are used to verify the correctness of state transitions, they will utilize a Policy State Machine (PSM) for its computations to validate state transitions of PWSOs; a digital computer running on a physical computer. A PSM requires an architecture and execution rules which together define the Execution Framework.

The minimal requirements for an execution framework are:

* The Execution Framework of a VSM MUST be deterministic. Note, any PWE running the same Execution Framework on the same PWSO with the same input data needs to arrive at the same result, in other words, deterministic outcomes. This is only guaranteed if the Execution Framework either does not allow instructions to be executed in parallel, but only strictly sequential, or if the Execution Framework has methods in place that allow the identification and prevention of transactions that would cause state conflicts if processed in parallel. For example, a Requester proposes PAR A which is created at time t, and the Receiver, has just agreed to another PAR, PAR B, acting on the same PWSO at time t-1 but not yet processed. This means that if PAR A is processed in parallel to PAR B the wrong PWSO would be creates depending on which PAR is executed first.
* The Execution Framework of a PSM must ensure that state transition validation computations are either completed or abort in finite time, where what is deemed to be a suitable finite time is determined by the allowable duration of a PAR. This requirement means that infinite computational loops cannot be allowed in a PWE.
* If a PSM can generate a valid state transition based on a PAR, it must update the state of the PWSO and the state history of the PWSO.
* If a PSM can generate a valid state transition and the targeted state object is not the state object of the complete policy workflow state, it must update the PWSO of the policy workflow and its state history besides the PWSO and its history targeted by the PAR.
* A PSM MUST store all PWSOs, their associated data, and their histories in the PWE.
* The integrity of PARs, PWSOs, and their data and histories must be cryptographically verifiable by the owners associated with the PARs, PWSOs, and their data and history.
* All updates to a policy workflow state and its associated PWSOs by a PSM must be communicated to all policy workflow participants based on the relevant privacy policies.

The following requirements are addressing the operating scenario where a PWE consists of more than one node, such as a Guardian Network. This is a perfectly feasible scenario with its pros and cons beyond the scope of this document to discuss. However, certain requirements need to be met for such a scenario to be operationally viable:

* A PWE may consist of more than one processing node. This document will call such a structure a PWE network.
* If there is a PWE network to execute and finalize PARs, it must utilize a policy-based consensus algorithm with a finite time to finality of a PAR, i.e., the time after the processing of PAR is completed and accepted by all relevant policy workflow participants.
* If there is a PWE network and it chooses consensus on the execution of a PAR, there must be consensus on both the order and the correct execution of PARs.
* If there is a PWE network and it chooses consensus on the execution of a PAR, it must use a common execution framework. Note that if more than one execution framework were chosen, no consensus could be reached on the outcome of a because the state representation is execution framework dependent.

Finally, PARs, and PWSO data and their histories must be stored as partially persistent data.

Each Policy Workflow Transaction effects production or modification of a persistent artefact. The data contained within the Policy Workflow Transactions can be used to mint tokens using Hedera Token Service, create verifiable credentials, create verifiable presentations, etc. On the completion of the PWT a message is sent to Hedera Consensus Service Topics for the purposes for immutability, public auditability and discoverability. See more details on mapping and the structure of the messages in the [Policy Workflow Transaction Discoverability](#policy-workflow-transaction-discoverability) section below.

#### Policy Workflow and Policy Action Execution Framework

The following section specifies a framework to create a policy workflow comprised of a modular Policy Actions with associated state transitions.

We are requiring the following prerequisites to instantiate a policy workflow comprised of policy actions in a PWE:

* Each policy workflow participant is present in the PWE minimally represented by a W3C DID and a W3C VC establishing the participants identity based on the policy requirements. Note that a participant may be an organization, a person or a thing such as an IOT sensor
* All data required to be presented and/or collected during a policy workflow has a well-defined VC schema. The schema will be used in the structural conformance verification of a document within a policy workflow.
* All data presented must be in the form of a VP of VCs established in the policy (context).
* Each policy requirement must be expressed as a required set of input data, processing instructions and a required set of output data for a Policy Action.
* A set of causally connected policy actions must be assembled into a specific policy workflow. There might be multiple policy workflows for each policy.
* There must be one or more PWSOs

The following is the set of terms and definitions used to define Policy Actions and Policy Workflows:

| Term            | Definition                                                      | Example                                          |
| --------------- |:--------------------------------------------------------------- |:------------------------------------------------ |
| `block`           | Either a Policy Workflow or a Policy Action                      | MRVDataVerification (Policy Workflow)            |
|`children`|Defines a list of Blocks that are grouped into a Policy Workflow|List of Blocks, see also example given below|
| `defaultActive` | Determines if Policy Workflow or a Policy Action can be executed | `true`                                           |
| `permissions`   | Security Policy associated with a specific role                 | `ROOT_AUTHORITY`                                 |
| `roles`   | Available roles from which the user can choose             | `Installer`                                 |
| `blockType`     | Specifies the type of Policy Workflow or Policy Action          | `interfaceContainerBlock` (policy workflow name) |
|`uiMetaData`|Specifies the data of the policy workflow and/or Policy Action to be displayed|`type: header___` `fields:___________` `name: document.issuer` `title: Owner_____` `type: text`|
|`tag`|Specifies the ID of a policy action which can be referenced in other blocks as a dependency|`Request`|
|`schema`|Defines the data schema for a block|`Installer`|
|`entityType`|Gives the document a label in the DB. Needed for filtering.|`Installer`|
|`dataType`|Specifies the Type of data used in the Block|`source`|
|`dataSource`|Specifies a source to where to send Data|`Database / Hedera`|
|`topic`|Topic to send a document if 'dataSource' = 'Hedera'|`topic`|
|`dependencies`|Specifies on which blocks `tag` or state transition rules `stateMutation`|See `tag` and `stateMutation` for examples|
|`onlyOwnDocuments`|Specifies whether a block applies to only those documents owned by the role specified in `permissions`|`true` or `false`|

In this execution framework a policy workflow as a Block must be defined through a configuration schema based on for example yaml or JSON as the container for Policy Actions which too must be defined through configuration schemas as `children` of the policy workflow block. Parallel processing in this execution framework is possible by defining policy actions as children of a policy action that is defined in the same manner a policy workflow block would be defined, see Figure 3.

![Figure_3](../assets/hip-28/policy-workflow-example.jpg)

Figure 3: Example of Policy Workflows within a Policy and nested Policy Actions as `children` within a Policy Workflow. Source: This document.

Note, that care needs to be taken to ensure that PWSO are modified in a deterministic manner. This can be achieved by defining the proper `dependencies` in a policy action which are defined in the VSM as specific state transition services.

An example of a Policy Workflow with a Policy Action is given below:

```yaml
defaultActive: true
permissions:
    - ROOT_AUTHORITY
    - INSTALLER
blockType: interfaceContainerBlock
uiMetaData:
    type: header
children:
    -
        tag: Request
        defaultActive: true
        permissions:
            - INSTALLER
        blockType: requestVCDocument
        schema: Installer
```

The VSM machine acting on PWSOs is comprised on a per policy basis as a set of services as defined by the configuration schemas acting on state objects which are expressed in this execution framework as documents.

An example of such a service in the TypeScript language based on the workflow configuration example above can be defined as follows:

```typescript
@EventBlock({
    blockType: 'requestVCDocument',
    commonBlock: false,
})
```

where `'requestVCDocument'` is the policy action that was defined above and which can be expressed as follows as a service:

```typescript
export class RequestVCDocumentBlock {

    @Inject()
    private guardians: Guardians;

    @Inject()
    private vcHelper: VcHelper;

    @Inject()
    private wallet: Wallet;

    @Inject()
    private users: Users;

    private _schema: any;
    private get schema(): any {
        if (!this._schema) {
            const ref = PolicyBlockHelpers.GetBlockRef(this);
            throw new BlockActionError('Waiting for schema', ref.blockType, ref.uuid);
        }
        return this._schema;
    }

    private init(): void {
        const {options, blockType, uuid} = PolicyBlockHelpers.GetBlockRef(this);

        if (!options.schema) {
            throw new BlockInitError(`Field "schema" is required`, blockType, uuid);
        }
    }

    constructor() {
        this.guardians.getSchemes({}).then(schemas => {
            this._schema = Schema.map(schemas).find(s => s.type === PolicyBlockHelpers.GetBlockUniqueOptionsObject(this).schema);
        });
    }

    async getData(user: IAuthUser): Promise<any> {
        const options = PolicyBlockHelpers.GetBlockUniqueOptionsObject(this);
        return {
            data: this.schema,
            uiMetaData: options.uiMetaData || {},
            hideFields: options.hideFields || []
        };
    }

    @BlockStateUpdate()
    async update(state: PolicyBlockStateData<any>, user: IAuthUser): Promise<any> {
        return state;
    }

    async setData(user: IAuthUser, document: any): Promise<any> {
        const ref = PolicyBlockHelpers.GetBlockRef(this);
        if (!user.did) {
            throw new BlockActionError('user have no any did', ref.blockType, ref.uuid);
        }

        const userFull = await this.users.getUser(user.username);

        const installerKey = await this.wallet.getKey(userFull.walletToken, KeyType.INSTALLER, userFull.did);
        const vc = await this.vcHelper.createVC(userFull.did, installerKey, ref.options.schema, document._options);

        const {uiMetaData} = PolicyBlockHelpers.GetBlockRef(this).options;

        const data = {
            hash: vc.toCredentialHash(),
            owner: user.did,
            document: vc.toJsonTree(),
            type: this.schema.type,
            uiMetaData
        };
        await this.update(Object.assign(StateContainer.GetBlockState((this as any).uuid, user), {data}), user);
        return {};
    }
}
```

In this example, the service is defined as a service class for the `RequestVcDocumentBlock` policy action and attaches as a child of the `interfaceContainerBlock` policy workflow comprised of

* variables required for the service such as `private users: Users;` where data visibility is either defined as `public` or `private`
* a constructor which loads the configuration schemas into the VSM
* functions such as `async getData(user: IAuthUser)` which define the process steps to facilitate the state -- get data for the VSM, set the PWSO for the VSM and update the PWSO

#### Policy Workflow Transaction Discoverability

For discoverability, Policy Workflow Transaction messages sent to Hedera Consensus Service (HCS) are generated and formatted to enable full traceability (in other words "forward/back navigation") across Topics and messages, exactly mapping the execution of the policy workflow. Policy Workflow Actions are always performed in the context of an HCS Topic. The topics form a 'linked-list' like structure, the very first (root) Topic for the Policy Workflow when a new Policy is first created by 'publishing a policy', which is 'external' for the Policy Engine. This ensures that there always is **at least a single** HCS Topic mapped to any active Policy Workflow, which receives Policy Workflow Transaction messages.

There are separate types of messages that denote different Policy Workflow Actions. All messages share common structure presented below (in the format of TypeScript for convenience):

```typescript
export interface MessageBody {
    id: string;
    status: MessageStatus;
    type: MessageType;
    action: MessageAction;
}
```

The following types of messages are currently available:

| Message type    | Mapped Policy Workflow Action                                 |
| --------------- |:--------------------------------------------------------------|
| DID | Creation of a DID |
| Policy | Creation of a Policy version |
| Schema | Creation of a Schema |
| VC | Creation of a VC |
| VP | Creation of a VP |
| Topic | Creation of a new Topic|

Policy Engine executing the Workflow can freely create HCS Topics as required to allocate for logical or any other grouping of the messages as deemed necessary (and as defined) by the Policy authors. To achieve traceability, whenever a new HCS Topic gets created by the Policy Engine two almost identical messages get posted into the 'current' and the newly created Topics to provide a link between them. The structure of these messages is presented below. They differ in the value of the `parentId` field which would be `null` for the message directed to 'current' topic, and contain the 'current' topic ID in the message posted into the newly created one.

```typescript
export interface TopicMessageBody extends MessageBody {
    name: string;
    description: string;
    owner: string;
    messageType: string;
    childId: string;
    parentId: string;
    rationale: string;
}
```

Other types of messages have the following content.

```typescript
export interface PolicyMessageBody extends MessageBody {
    uuid: string;
    name: string;
    description: string;
    topicDescription: string;
    version: string;
    policyTag: string;
    owner: string;
    topicId: string;
    instanceTopicId: string;
    cid: string;
    url: string;
}

export interface SchemaMessageBody extends MessageBody {
    name: string;
    description: string;
    entity: string;
    owner: string;
    uuid: string;
    version: string;
    document_cid: string;
    document_url: string;
    context_cid: string;
    context_url: string;
}

export interface VcMessageBody extends MessageBody {
    issuer: string;
    cid: string;
    url: string;
    relationships: string[];
}

export interface VpMessageBody extends MessageBody {
    issuer: string;
    cid: string;
    url: string;
    relationships: string[];
}
```

To ensure global discoverability, all root HCS Topics for all Policies are linked with the rigidly defined higher-level Topics structure using the same 'linked-list' technique as described before. This structure and its relationship with the Policy Workflow topics ('dynamic topics') is illustrated on the following diagram.

![Guardian Topics Map](../assets/hip-28/guardian-topics-map.png)

The entry point into this structure is the root topic mapping to the 'Root Authority' (RA) actor, which is the author and the publisher of the policy. There are many RAs in the ecosystem, each can author multiple policies. Thus, there are numerous entry points into the Policy-specific 'chains'. Top-level discovery of these is performed via RA 'hello worlds' messages posted into the predefined HCS Topic after the event of the creation of a new Root Authority.

## Backwards Compatibility

No issues.

## Security Implications

Permissions are defined in Policy Workflow Workgroups.

## How to Teach This

There is an open-source [repository](https://github.com/hashgraph/guardian) with a reference implementation of Guardian Type Solution to learn how to use the components for various applications. Please look at our [GitBook Documentation](https://docs.hedera.com/guardian)

## Reference Implementation

There is an open-source [repository](https://github.com/hashgraph/guardian) with a reference implementation of Guardian Type Solution to learn how to use the components for various applications. This reference implementation is designed with modularity so that different components may be swapped out based on various implementation requirements. Please see the open-source Guardian's architecture diagram below:

![Open Source Guardian Architecture](../assets/hip-28/Detailed%20Architecture.png)

## Rejected Ideas

None.

## Open Issues

None.

## References

* <https://github.com/trustenterprises/hedera-dnft-specification>
* <https://hedera.com/users/dovu>
* <https://hedera.com/blog/why-earth-day-2021-means-the-world-to-dovu>
* <https://github.com/InterWorkAlliance/Sustainability/blob/main/vem/supply/ccp.md>
* <https://github.com/InterWorkAlliance/Sustainability>
* <https://docs.ipfs.io/concepts/content-addressing/>
* <https://www.investopedia.com/terms/e/environmental-social-and-governance-esg-criteria.asp>
* <https://github.com/InterWorkAlliance/Sustainability/blob/main/vem/supply/ep.md>
* <https://github.com/InterWorkAlliance/Sustainability/blob/main/vem/roles.md>

## Copyright/license

This document is licensed under the Apache License, Version 2.0 -- see [LICENSE](../LICENSE) or <https://www.apache.org/licenses/LICENSE-2.0>
