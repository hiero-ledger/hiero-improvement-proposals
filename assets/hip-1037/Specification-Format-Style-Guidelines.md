# Protocol Buffer Style Guidelines
## Style Guidelines for "specification" comments
### General Style
- Wrapping is 80 characters for top-level messages.
- Wrap everything else to 80 characters or 100, depending
   - Prefer to wrap lines to 80 characters
   - It is OK to go over 80, but less than 100, if it makes the
     text clearer and easier to read.
     - This SHOULD be rare, however.
   - If you have links or tags, wrapping at 100 characters for clarity
     is acceptable.
   - We choose 80 characters here to work better in reviews because Github
     comment boxes are limited to roughly 80 characters width. The primary
     "code" interaction with proto files and markdown files is in review.
     Also, some markdown processors struggle with longer lines.
- Use HTML tags where appropriate, but stick to markdown as much as possible.
- Use blank lines (with `*` prefix) for paragraph breaks in message or
  enum declarations, regardless of where defined.
   - Use `<p>` tags for _fields_, and _no_ "empty" lines (it breaks the tables).
   - For messages (including `enum` or `service` messages), we prefer to use
     blank lines exclusively, and _not_ use a `<p>` tag.
- We use line breaks (`<br/>`) in several areas of the specification text.
  All such line breaks should be placed at the _end_ of the prior line, and
  should not be placed alone on a line, in the middle of a line, or at the
  beginning of a line.
- Certain elements (headings, code blocks, lists, etc...) are "block" elements
  in markdown and HTML.  Such elements _should not_ be followed by either
  a break (`<br/>`) or paragraph (`<p>`) tag (or equivalent markdown).
- Use formal US-English spelling and grammar to the maximum extent possible.
   - Write proper and complete sentences, avoid partial sentences and
     unnecessary abbreviations.
   - Do not use partial words (e.g. instead of "spec" write "specification").
   - Explain all acronyms on first use in a document.
      - Use "Hedera Consensus Service(HCS)" the first time "HCS" is written
        but "HCS" may be used thereafter.
      - Extremely common acronyms (e.g. RAM or LASER) do not need
        to be expanded.

#### Specification Equivalency
For the purposes of specification document comments, _only_, the following
protocol buffer "types" are considered equivalent.
- Message
   - `service`
   - `enum`
- Field
   - `rpc`
Equivalent types require equivalent specification, so a `service` should be
specified using the same guidelines as a `message` or `enum`.  A `rpc` should
be specified using the same guidelines as a "field".

### Description
- The first line of each document block is "what is this", and should be a
  single sentence.  Examples: "An identifier for an account." or
  "A `tokenTransfer` transaction request body.".
   - Avoid "this is a thing" (or shorter "thing") type sentences,
     write "A thing" instead.
      - This applies for the _first sentence_ only, **not** elsewhere.
        The first sentence is a "what is this" answer, not full description
        and mostly just translates from "code" syntax to plain English.
   - Minimize detail here, qualifiers, usage, etc... belong in the brief
     description or requirements, not here.
      - A good rule of thumb is that if this first sentence exceeds 60
        characters, then it is trying to describe too much.
- An optional description _may_ be added to any field or message.
   - Include a line break (`<br/>`) after the first line, then a brief
     description, if appropriate.
      - Not every field needs additional description,
        but nearly all `message` blocks do.
      - Descriptions may be detailed, but should not include internal
        implementation details or requirements. The description _should_ be
        detailed enough to explain to an external contributor what the
        message or field contains, where it fits within the overall network
        system, and why it is needed.
         - This is a long-term goal; we have a long way to go to get to this
           level of description. Every PR to change `.proto` files should seek
           to improve the documentation for that file.
      - Avoid describing what must, should, must not, or should not be
        sent, or how the field values affect output. Those items belong in the
        _requirements_, instead.

### Requirements
- After a paragraph break (a blank line for messages), one requirement per
  line. Use break tags at the end of each requirement except the last.
   - In field comments a `<p>` tag is _required_ for paragraph breaks.
     Blank lines break the automated documentation generator in **fields**
     because fields are output as markdown tables, and markdown tables require
     each row to be a single long line.
- Be _prescriptive_ in requirements.  Do not _describe_ the behavior.
   - Declare what MUST be done for valid inputs, and what SHALL be present in
     valid outputs (or in state messages).
   - Declare what SHALL happen as a result of a successful, or failed,
     transaction.
   - The word `will` usually means `SHALL` or `MUST`.
   - The word `is` often means `SHALL be`.
   - Document both positive (`SHALL` or `MUST`) and negative (`SHALL NOT` or
     `MUST NOT`) requirements.
   - Avoid "perfect" or "imperfect" verb aspects and "wiggle" words
     (might, could, perhaps, etc...).
      - The specification items MAY, SHOULD, and RECOMMENDED serve to fill
        the _occasional_ need for less imperative requirements.
   - Also avoid "progressive" verbs (e.g. working, writing, going, deleting).
- Requirements should be short and focused.
   - Better to have three separate lines for three items than one longer
     line with three clauses.
   - Duplicating text across lines with slightly different requirements
     is not only acceptable, but often recommended.
   - Well written specification tends to be much more short and clipped
     sentences than "normal" prose. Some describe the flow as "staccato".
- Required and Optional fields
   - The default state for any field is "optional", and all required fields
     should be specified as `REQUIRED`. If the presence or absence of a field
     must be clear _separate_ from the default value of that field, that field
     should use proto3 "explicit presence" and be marked with
     the `optional` keyword.
- Add another blank line after requirements for `message` documents only.

### Other elements
- Each message that represents a transaction body **must** document the
  Block Stream effects with a heading `### Block Stream Effects`.
- General notes go last, for `message` only, with a heading
  `#### Additional Notes`.
- There are cases where description text for a message or field is
  exceptionally detailed. In these cases it _may_ be appropriate to
  separate broad categories of information with a single horizontal line
  (i.e. an `<hr>` tag, `---` in markdown). These cases _should_ be quite
  rare, however; we prefer to avoid the need for such large blocks of
  specification text.
- Line oriented comments (i.e. lines prefixed with `//`) may be used for
  any comments needed in a proto file that are not intended for API
  specification.  Examples include explaining an `oneof` block, or describing
  why a particular field number or name is reserved.

## Content Guidelines
### General `proto` File Guidelines
- Protocol buffers are compiled for the `hedera-services` codebase using a
  custom processor 'PBJ'. While no other entity is required to use `PBJ`, all
  Hiero protocol buffer files MUST be compatible with `PBJ` processing.<br/>
  Currently, this requires implementing the proposed changes in a branch
  on the `hedera-protobufs` repository, and running the integration test
  sub-project of the `PBJ` project.

### Field Type Guidelines
- There are some negative patterns present in existing `proto` files.  These
  SHOULD NOT be replicated in new files, when possible.
   - Older files may use `int64` or `int32` when a `uint` is more appropriate,
     and document a "non-negative" requirement.  This SHOULD NOT be replicated.
     in new content (files, messages, fields) we SHOULD use _unsigned_ numeric
     types where appropriate.
      - We MUST NOT change existing field types without very careful
        consideration for binary compatibility and impact to clients.
- Protocol buffer encoding for Hedera MUST be deterministic.
   - For this reason `Map' fields CANNOT be used because most protocol buffer
     implementations are _intentionally_ non-deterministic in
     serializing and parsing those fields.
   - Unknown fields are, likewise, not handled deterministically by most
     protocol buffer implementations, so unknown fields MUST NOT be used.
      - One exception here is forward compatibility, as implemented in the
        `PBJ` processor, which is supported in selected scenarios where
        deterministic behavior is not strictly required.

### Package Directive Guidelines
- There are some negative patterns present in existing `proto` files.  These
  SHOULD NOT be replicated in new files, when possible.
   - Older files have a `package proto;` directive.  This is leftover from
     _sample_ content, and SHOULD NOT be used in new files.
      - To avoid major compatibility issues, particularly for SDK authors, we
        SHOULD NOT change the `package` directive in _existing_ files.
- For _new_ `proto` files only, the file SHOULD use a `package` directive with
  a package that is identical to the value in the
  `pbj.java_package` pseudo-directive.
   - One exception to this guideline is that gRPC `service` and `rpc`
     definitions include the package name in the url path.  As a result we
     cannot easily use full package names for these.
      - Completely new services and gRPC endpoints SHOULD be defined alone in a
        separate `thing_service.proto` file _without_ transaction bodies. The
        endpoint MAY, then, be defined in a proper package.
      - Transaction body messages and any component messages SHOULD be defined
        in a proper package, and references in the gRPC service definition may
        then use the full package prefix when referring to those messages.
   - The "namespace" behavior of package names is not well supported by PBJ at
     this time, so packages must be fully specified whenever used.

## Examples
### General Samples
```protobuf
/**
 * A selection of positive and negative examples
 *
 * ## Summary and optional description.
 * A simple Summary.<br/>
 * This example shows recommended structure of summary line and detail
 * description, including line length limits.
 *
 * ## An example for line break placement.
 * text ending in a break.<br/>
 * is generally easier to read than
 * <br/>text starting with a break or
 * text that contains<br/>a line break mid-line.
 */
message SampleMessage {
    // OneOf does not become an element in the final protobuf, so any
    // description needed for oneof blocks must be in "code" comments.
    // Such "code" comments are permitted anywhere a comment is permitted,
    // but writers should be aware that these comments are not processed and
    // remain local to the proto file.
    oneof samples {
        // We may present "code" level comments, that are not API specification
        // wherever needed and appropriate. These comments are not processed
        // into documentation, and should be used for information specific to
        // the "code" of the protocol buffer definitions, not the API that
        // those protocol buffers represent.
        /**
         * A sample 32-bit integer field.
         * <p>
         * This block MUST NOT contain a blank line, as fields are presented
         * using tables in markdown, so we use a paragraph tag instead.<br/>
         * We SHALL separate requirements with a single `<br/>` tag as used
         * at the end of the line above.
         * <p>
         * ### Headings in fields
         * We MAY use headings in fields, but it is important to note
         * that Javadoc's exceptionally strict view of headings means that
         * headings in fields MAY NOT be rendered correctly and MAY cause
         * javadoc errors for "out of order" headings.
         */
        int32 field_one = 1;

        // This field does not require description or specific requirements
        // so those are not present. Lack of requirements is very rare indeed,
        // so most fields should have a bit more than we see here.
        /**
         * A simple unsigned 64-bit integer field.
         */
        uint64 field_two = 2;
    }
}
```

### A Message Example
```protobuf
/**
 * A transaction body to add a new consensus node to the network
 * address book.<br/>
 * This transaction, once complete, enables a new consensus node
 * to join the network, and requires governing council authorization.
 *
 * This transaction body SHALL be considered a "privileged transaction".<br/>
 * A `NodeCreateTransactionBody` MUST be signed by the governing council.<br/>
 * A `NodeCreateTransactionBody` MUST be signed by the `Key` assigned to the
 * `admin_key` field.<br/>
 * The newly created node information SHALL be added to the network address
 * book information in the network state.<br/>
 * The new entry SHALL be created in "state" but SHALL NOT participate in
 * network consensus and SHALL NOT be present in network "configuration"
 * until the next "upgrade" transaction (as noted below).<br/>
 * All new address book entries SHALL be added to the active network
 * configuration during the next `freeze` transaction with the field
 * `freeze_type` set to `PREPARE_UPGRADE`.
 *
 * ### Block Stream Effects
 * Upon completion the newly assigned `node_id` SHALL be recorded in
 * the transaction receipt.<br/>
 * This value SHALL be the next available node identifier.<br/>
 * Node identifiers SHALL NOT be reused.
 */
```

### A Field Example
```protobuf
    /**
     * A list of service endpoints for gossip.
     * <p>
     * These endpoints SHALL represent the published endpoints to which other
     * consensus nodes may _gossip_ transactions.<br/>
     * These endpoints MUST specify a port.<br/>
     * This list MUST NOT be empty.<br/>
     * This list MUST NOT contain more than `10` entries.<br/>
     * The first two entries in this list SHALL be the endpoints published to
     * all consensus nodes.<br/>
     * All other entries SHALL be reserved for future use.
     * <p>
     * Each network may have additional requirements for these endpoints.
     * A client MUST check network-specific documentation for those
     * details.<br/>
     * If the network configuration value `gossipFqdnRestricted` is set, then
     * all endpoints in this list MUST supply only IP address.<br/>
     * If the network configuration value `gossipFqdnRestricted` is _not_ set,
     * then endpoints in this list MAY supply either IP address or FQDN, but
     * MUST NOT supply both values for the same endpoint.
     */
```

### An Enum Example
Note that this example is _all_ description, there are no requirements
listed.  This is unusual, but does occur.
```protobuf
/**
 * An informational enumeration of all known states.<br/>
 * This enumeration is included here So that people know the mapping from
 * integer to state "name".<br/>
 * State changes are expressed in terms of changes to named states at the
 * high level conceptual model of the state type like map key/values or
 * queue appends. To say which state the change is on we will include an
 * `integer` number for the state name. This is done for performance and
 * efficiency as there will be 10s of thousands of state changes in a block.
 *
 * We use an integer, and provide this enumeration, for the following reasons.
 * - If we have a extra 8-10 bytes per state change at 40-50K state changes
 *   per second then that is an extra 2.5-4 megabits of bandwidth. Compression
 *   should help a lot but that is not guaranteed.
 * - When the state name is used as part of complex key in the big state
 *   merkle map. The smaller the key is, in bytes, the more efficient the
 *   database is, because more keys can fit in a single disk page.
 * - When parsing keys, parsing a UTF-8 string to a Java String is a many
 *   times more expensive than parsing a VARINT to an integer.
 *
 * Note: This enumeration is never transmitted directly in the block stream.
 * This enumeration is provided for clients to _interpret_ the value
 * of the `StateChange`.`state_id` field.
 */
```

### A Complex Message Example
Note the added block for the "Alias" detail, which specifies some complex
behavior that has, historically, caused much confusion.
```protobuf
/**
 * A single Account in the Hedera distributed ledger.
 * 
 * Each Account SHALL have a unique three-part identifier, a Key, and one
 * or more token balances.<br/>
 * Each Account SHALL have an alias, which has multiple forms, and MAY be
 * set automatically.<br/>
 * Several additional items SHALL be associated with the Account to enable
 * full functionality.<br/>
 * Assets SHALL be represented as linked-lists with only the "head" item
 * referenced directly in the Account, and the remaining items SHALL be
 * accessible via the token relation or unique tokens maps.<br/>
 * Accounts, as most items in the network, SHALL have an expiration time,
 * recorded as seconds since the epoch, and MUST be "renewed" for a small fee
 * at expiration. This helps to reduce the amount of inactive accounts retained
 * in state.<br/>
 * Another account MAY be designated to pay any renewal fees and automatically
 * renew an account for (by default) 30-90 days at a time as a means to
 * optionally ensure important accounts remain active.<br/>
 * Accounts MAY participate in securing the network by "staking" the account
 * balances to a particular network node, and receive a portion of network
 * fees as a reward. An account MAY optionally decline these rewards but still
 * stake its balances.<br/>
 * An account MAY optionally require that inbound transfer transactions be
 * signed by that account as receiver
 * (in addition to the sender's signature).<br/>
 * As with all network entities, Account ID SHALL be represented as
 * shard.realm.X.<br/>
 * Alias and contractId SHALL be additional identifiers used to connect accounts
 * to transactions before the account is fully enabled,
 * or in EVM contracts.<br/>
 *
 * ---
 *
 * #### Alias
 * There is considerable complexity with `alias` (aka `evm_address`) for
 * Accounts. Much of this comes from the existence of a "hidden" alias for
 * almost all accounts, and the reuse of the alias field for both EVM reference
 * and "automatic" account creation.
 *
 * For the purposes of this specification, we will use the following terms for
 * clarity.
 *   - `key_alias` is the account public key as a protobuf serialized message
 *     and used for auto-creation and subsequent lookup. This is only valid if
 *     the account key is a
 *     single `primitive` key, either ED25519 or ECDSA_SECP256K1.
 *   - `evm_address` exists for every account and is one of
 *      - `contract_address`, which is the 20 byte EVM contract address per
 *        EIP-1014
 *      - `evm_key_address`, which is the keccak-256 hash of a ECDSA_SECP256K1
 *        `primitive` key.
 *         - This is for accounts lazy-created from EVM public keys, when the
 *           corresponding ECDSA_SECP256K1 public key is presented in a
 *           transaction signed by the private key for that public key, the
 *           account is created that key assigned, and the protobuf-serialized
 *           form is set as the account alias.
 *      - `long_zero`, is a synthetic 20 byte address inferred for "normally"
 *        created accounts. It is constructed from the "standard" AccountID as
 *        follows.
 *         - 4 byte big-endian shard number
 *         - 8 byte big-endian realm number
 *         - 8 byte big-endian entity number
 *
 * The `alias` field in the `Account` message SHALL contain one of four values
 * for any given account.
 *   - The `key_alias`, if the account was created by transferring HBAR to the
 *     account referenced by `key_alias`.
 *   - The `evm_key_address` if the account was created from an EVM public key
 *   - The `contract_address` if the account belongs to an EVM contract
 *   - Not-Set/null/Bytes.EMPTY (collectively `null`) if the account was
 *     created normally
 *
 * If the `alias` field of an `Account` is any form of `null`, then the account
 * MAY be referenced by `alias` in an `AccountID` by using the `long_zero`
 * address for the account. This "hidden default" alias SHALL NOT be stored,
 * but is synthesized by the node software as needed, and may be synthesized by
 * an EVM contract or client software as well.<br/>
 * An AccountID in a transaction MAY reference an `Account` with
 * `shard`.`realm`.`alias`.<br/>
 * If the account `alias` field is set for an Account, that value SHALL be the
 * account alias.<br/>
 * If the account `alias` field is not set for an Account, the `long_zero`
 * alias SHALL be the account alias.
 */
```
