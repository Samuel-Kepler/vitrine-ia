# A2UI Protocol v1.0: research report

Date of research: 2026-11-17. Spec "Last Updated" per the page: Jun 8, 2026.

## 0. Sources and how they were verified

| Source | How read | Status |
| --- | --- | --- |
| https://a2ui.org/llms.txt | curl, full text | VERIFIED. Lists v1.0 as "current"; v0.9.1 and v0.9 "previous"; v0.8 "deprecated". |
| https://a2ui.org/specification/v1.0-a2ui/ (Markdown twin `.../v1.0-a2ui.md`) | curl, read in full (1694 lines, saved at `scratchpad/research/spec-v1.0.md`) | VERIFIED |
| https://a2ui.org/concepts/inference-formats.md | curl, read in full | VERIFIED |
| https://a2ui.org/specification/v1.0-evolution-guide.md | curl, read in full | VERIFIED |
| https://a2ui.org/concepts/messages.md, catalogs.md, guides/macros.md | curl, read in the sections relevant to this report | VERIFIED |
| Schema JSON files (`a2ui.org/specification/v1_0/json/*.json`) | curl, saved locally, parsed with `python -I` | VERIFIED |
| Basic catalog JSON (`a2ui.org/specification/v1_0/catalogs/basic/catalog.json`) | curl, parsed, components and functions enumerated with a script | VERIFIED |
| GitHub `a2ui-project/a2ui` `catalogs/basic/v1/catalog.json` | raw.githubusercontent.com, HTTP 200 | VERIFIED. JSON content identical to the a2ui.org copy (`==` comparison True). |
| GitHub `a2ui-project/a2ui` `specification/v1_0/json/` | GitHub API listing | VERIFIED. Same 12 files as a2ui.org. |
| GitHub path `specification/v1_0/catalogs/...` | 404 | VERIFIED. This path does NOT exist. The catalog lives at `catalogs/basic/v1/`. |
| npm registry (`npm view`) | `npm view <pkg> version` | VERIFIED (see section 10) |
| PyPI `a2ui-agent-sdk` | pypi.org JSON API | VERIFIED: 0.11.0 |

Not verified in this run: the `docs/` pages `/concepts/data-binding`, `/concepts/actions-and-functions`, `/concepts/overview`, `/guides/agent-integration`, the A2A extension spec, and the MCP guides. They were downloaded but not read in full. Nothing in this report depends on them.

Local copies of the schemas are in `<scratchpad>/research/a2ui-schemas/` (see section 9). That directory also contains other files (`catalogs/`, `docs/`, `examples/`, `json/`, `test/`, `basic_catalog_v1.json`, and others) that were not created by this task and that I did not review.

---

## 1. Agent to renderer (server to client) messages

### 1.1 Envelope

VERIFIED from spec "Envelope message structure" and `agent_to_renderer.json` (top-level `oneOf` has 6 branches).

Every streamed message is a JSON object with a `"version": "1.0"` field and **exactly one** of six message keys:

```
createSurface | updateComponents | updateDataModel | deleteSurface | callRendererFunction | agentFunctionResponse
```

- Envelope version string is exactly `"1.0"`. The v0.9.1 value was `"v0.9"`. The spec notes that a renderer can route payloads by inspecting this field.
- Transport: the spec defines A2UI as a JSON stream and does NOT mandate a transport. Transport contract (verbatim requirements): **reliable, in-order delivery**; **message framing** (JSONL newlines, WebSocket frames, or SSE events); **metadata support**; and optionally a bidirectional return channel for actions. Concrete bindings in the spec: AG-UI, A2A extension, MCP, plus SSE+JSON-RPC, WebSockets, REST.
- The spec says "End of agent turn is signaled by transport layer" (the protocol itself has no end-of-turn message).
- Recommended MIME type: `application/a2ui+json` (v0.9.1 used `application/json+a2ui`; evolution guide section 3).

### 1.2 createSurface

VERIFIED (spec "createSurface" section, example verbatim):

```json
{
  "version": "1.0",
  "createSurface": {
    "surfaceId": "user_profile_card",
    "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
    "sendDataModel": true,
    "components": [
      {
        "id": "root",
        "component": "Column",
        "children": ["user_name"]
      },
      {
        "id": "user_name",
        "component": "Text",
        "text": {"@path": "/name"}
      }
    ],
    "dataModel": {
      "name": "John Doe"
    }
  }
}
```

Properties (spec, verbatim meaning):
- `surfaceId` (string, required). Must be globally unique for the renderer lifetime. Creating an existing surfaceId without first sending `deleteSurface` is a `INTEGRITY_ERROR`.
- `catalogId` (string, optional). The surface's default catalog. It is an identifier, not a resolvable URL. Once set, `surfaceId` and default `catalogId` are fixed; to change them you must delete and recreate.
- `sendDataModel` (boolean, optional, default false). If true, the renderer attaches the full surface data model to the metadata of every message it sends to the agent.
- `components` (array, optional). Same shape as `updateComponents.components`. Renderer builds the tree immediately.
- `dataModel` (object, optional). Initial root data. When both `dataModel` and `components` are present, the renderer applies `dataModel` first.
- `metadata` (object, optional): `{"extensions": {...}}`.
- `theme` is REMOVED in v1.0. A `createSurface` carrying `theme` is invalid (strict validators reject it; relaxed renderers drop it).

Implicit container: `createSurface` implicitly creates a canonical `Surface` container with `"child": "root"`. It cannot be modified with `updateComponents`. A component with `"id": "root"` must exist for anything to render.

### 1.3 updateComponents

VERIFIED (spec example, verbatim):

```json
{
  "version": "1.0",
  "updateComponents": {
    "surfaceId": "user_profile_card",
    "components": [
      {
        "id": "root",
        "component": "Column",
        "children": ["user_name", "user_title"]
      },
      {
        "id": "user_name",
        "component": "Text",
        "text": "John Doe"
      },
      {
        "id": "user_title",
        "component": "Text",
        "text": "Software Engineer"
      }
    ]
  }
}
```

- `surfaceId` (required), `components` (required, flat array).
- Requires the surface to exist already.
- Upsert: a component whose `id` already exists is replaced IN FULL (including its `@metadata`; omitting `@metadata` clears it).
- Missing references (child IDs or data paths not yet delivered) are NOT errors. The renderer renders placeholders (progressive rendering).
- Nothing is visible until a component with `id: "root"` is defined. Earlier updates are buffered.

### 1.4 updateDataModel

VERIFIED (spec, verbatim):

```json
{
  "version": "1.0",
  "updateDataModel": {
    "surfaceId": "user_profile_card",
    "path": "/user/name",
    "value": "Jane Doe"
  }
}
```

- `surfaceId` (required). `path` (optional JSON Pointer, RFC 6901, default `/`). `value` (required). Omitting `value` is a schema validation error (v1.0 change).
- Upsert semantics: existing path is updated, missing path is created, `value: null` deletes the key.
- Omitting `path` (or `"/"`) replaces the whole data model. Example from spec:

```json
{
  "version": "1.0",
  "updateDataModel": {
    "surfaceId": "surface_123",
    "value": {
      "user": {"firstName": "Alice", "lastName": "Smith"},
      "preferences": {"theme": "dark"}
    }
  }
}
```

- Deleting a key: `{"version":"1.0","updateDataModel":{"surfaceId":"surface_123","path":"/user/tempData","value":null}}`.

### 1.5 deleteSurface

VERIFIED (spec, verbatim):

```json
{
  "version": "1.0",
  "deleteSurface": {
    "surfaceId": "user_profile_card"
  }
}
```

Removes the surface, its components and its data. After deletion, the surfaceId can be reused.

### 1.6 callRendererFunction (NEW in v1.0)

VERIFIED (spec, verbatim):

```json
{
  "version": "1.0",
  "callRendererFunction": {
    "functionCallId": "get_device_resolution_123",
    "callFunction": {
      "@call": "getScreenResolution",
      "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
      "args": {
        "screenIndex": 0
      }
    }
  }
}
```

Shape: `callRendererFunction` object with:
- `surfaceId` (optional). If given, `DataBinding`s in `args` resolve against that surface's data model. If omitted, the call runs in an isolated empty root model `{}`.
- `functionCallId` (required). Renderer must copy it verbatim into the response.
- `callFunction` (required): `@call` (function name), `catalogId` (REQUIRED on this message; the schema rejects a missing one), `args` (optional).

Renderer MUST always reply with `rendererFunctionResponse` (with either `value` or `error`), even for void functions. Only functions with `allowedCallers` = `"agentOnly"` or `"rendererOrAgent"` may be called by the agent. A `rendererOnly` function called this way gets an `INVALID_FUNCTION_CALL` error response.

### 1.7 agentFunctionResponse (NEW in v1.0)

VERIFIED (spec, verbatim, success example):

```json
{
  "version": "1.0",
  "agentFunctionResponse": {
    "functionCallId": "verify_provider_99",
    "value": {
      "valid": true,
      "name": "Acme Provider"
    }
  }
}
```

Failure example: same wrapper with `"error": {"code": "PROVIDER_NOT_FOUND", "message": "Provider ID PRV-102 was not found."}`. The payload MUST include `value` or `error`.

### 1.8 Ordering rules

VERIFIED (spec):
1. Messages are dispatched in arrival order.
2. Surface mutations (`createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`) that precede a `callRendererFunction` or `agentFunctionResponse` take effect before that RPC is dispatched. Async renderer function execution does not block later envelopes.
3. A surface must exist before `updateComponents` or `updateDataModel` can target it. The agent may skip `createSurface` only for a pre-existing surface it has permission to modify.
4. Components can arrive in any order. Non-root components are buffered until `root` exists.
5. Within one `createSurface`, `dataModel` is applied before `components` resolve.
6. Reliable, ordered delivery is a transport requirement, because later messages depend on earlier state.

### 1.9 Typical sequence (verbatim from spec, sequence diagram and text)

1. `createSurface(surfaceId: "main")`
2. `updateComponents(surfaceId: "main", components: [...])`
3. `updateDataModel(surfaceId: "main", path: "/user", value: "Alice")`
4. Dynamic `updateComponents` / `updateDataModel`
5. `deleteSurface(surfaceId: "main")`

### 1.10 Full JSONL example from the spec (contact form), first two lines verbatim

```jsonl
{"version": "1.0", "createSurface":{"surfaceId":"contact_form_1","catalogId":"https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"}}
{"version": "1.0", "updateComponents":{"surfaceId":"contact_form_1","components":[{"id":"root","component":"Card","child":"form_container"},{"id":"form_container","component":"Column","children":["header_row","name_row","email_group","phone_group","pref_group","divider_1","newsletter_checkbox","submit_button"],"justify":"start","align":"stretch"}, ...]}}
{"version": "1.0", "updateDataModel":{"surfaceId":"contact_form_1","path":"/contact","value":{"firstName":"John","lastName":"Doe","email":"john.doe@example.com","phone":"1234567890","preference":["email"],"subscribe":true}}}
{"version": "1.0", "deleteSurface":{"surfaceId":"contact_form_1"}}
```

(Full line in the spec at lines 485-489 of `spec-v1.0.md`.)

---

## 2. Renderer to agent (client to server) messages

Source: spec "Renderer-to-agent event messages"; `renderer_to_agent.json` has top-level `oneOf` of 4 branches, property keys `version`, `action`, `callAgentFunction`, `rendererFunctionResponse`, `error`. Exactly one of `action`, `callAgentFunction`, `rendererFunctionResponse`, or `error` per message.

### 2.1 action (user event)

VERIFIED (spec, verbatim):

```json
{
  "version": "1.0",
  "action": {
    "name": "submitForm",
    "surfaceId": "contact_form_1",
    "sourceComponentId": "submit_button",
    "timestamp": "2026-06-02T08:57:23Z",
    "userMessage": "Submitted contact form",
    "context": {
      "isSubscribed": true
    }
  }
}
```

Properties: `name` (required), `surfaceId` (required), `sourceComponentId` (required), `timestamp` (required, ISO 8601), `userMessage` (optional, from `action.event.userMessage`), `context` (required, object, bindings resolved), `metadata` (optional, `{"extensions": {...}}`).

Authoring side, VERIFIED (spec "Agent actions"):

```json
{
  "id": "submit_button",
  "component": "Button",
  "child": "submit_button_label",
  "action": {
    "event": {
      "name": "submit_form",
      "userMessage": "Submitted order #123",
      "context": {
        "itemId": "123"
      }
    }
  }
}
```

Local action (no agent round-trip), VERIFIED:

```json
"action": {
  "functionCall": {
    "@call": "openUrl",
    "args": {
      "url": {"@path": "/url"}
    }
  }
}
```

### 2.2 callAgentFunction (renderer asks agent to run a function)

VERIFIED (spec, verbatim):

```json
{
  "version": "1.0",
  "callAgentFunction": {
    "surfaceId": "contact_form_1",
    "functionCallId": "verify_provider_99",
    "callFunction": {
      "@call": "verifyProvider",
      "catalogId": "https://example.com/catalogs/healthcare.json",
      "args": {
        "providerId": "PRV-102"
      }
    }
  }
}
```

Routing (VERIFIED, spec "Function Location Resolution & Fallback Routing"):
1. Resolve the catalog (explicit `catalogId`, else surface default).
2. `@`-prefixed system functions (for example `@index`) are always local.
3. If a local implementation exists, the renderer runs it (enforcing `allowedCallers` and `requiresUserActivation`). Otherwise it routes a `callAgentFunction` to the agent. This includes functions declared in the catalog but not implemented locally.
4. Agent answers `agentFunctionResponse` with `error.code` `UNKNOWN_FUNCTION` or `INVALID_FUNCTION_CALL` if it does not know the function or validation fails.

Caching: for data bindings and checks, the renderer MAY share or reuse identical in-flight calls. Actions MUST send a new call each time, so side-effecting agent functions should be invoked from actions.

### 2.3 rendererFunctionResponse

VERIFIED (spec, verbatim, success):

```json
{
  "version": "1.0",
  "rendererFunctionResponse": {
    "functionCallId": "get_device_resolution_123",
    "value": [1920, 1080]
  }
}
```

Failure (verbatim):

```json
{
  "version": "1.0",
  "rendererFunctionResponse": {
    "functionCallId": "get_device_resolution_123",
    "error": {
      "code": "EXECUTION_ERROR",
      "message": "Failed to query screen resolution."
    }
  }
}
```

### 2.4 error (renderer reports a fault)

VERIFIED (spec, verbatim):

```json
{
  "version": "1.0",
  "error": {
    "code": "INVALID_FUNCTION_CALL",
    "message": "Malformed callRendererFunction payload.",
    "functionCallId": "delete_file_call_9"
  }
}
```

Fields: `code` (required), `message` (required), `surfaceId` (optional) XOR `functionCallId` (optional, mutually exclusive with `surfaceId`).

Error codes named in the spec (VERIFIED): `VALIDATION_FAILED`, `UNALLOWED_PARENT`, `UNALLOWED_CHILD`, `INTEGRITY_ERROR`, `INVALID_FUNCTION_CALL`, `EXECUTION_ERROR`, `EXPRESSION_ERROR`, `UNKNOWN_FUNCTION`, `INVALID_RESERVED_KEY` (evolution guide).

The standard validation error payload for feeding back to an LLM (VERIFIED, spec "Standard validation error format"):

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "surfaceId": "user_profile_card",
    "path": "/components/0/text",
    "message": "Expected stringOrPath, got integer"
  }
}
```

### 2.5 Capabilities and metadata (NOT messages in v1.0)

VERIFIED (spec "Capabilities and metadata"): in v1.0, capabilities are carried in **transport metadata or a transport handshake**, not as A2UI messages. Each transport defines where.

Renderer to agent, transport metadata (VERIFIED, `messages.md` "Metadata" example):

```json
{
  "metadata": {
    "a2uiRendererCapabilities": {
      "1.0": {
        "supportedCatalogIds": [
          "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
          "travel:flights"
        ]
      }
    },
    "a2uiRendererDataModel": {
      "version": "1.0",
      "surfaces": {
        "flight_search": {
          "selectedFlight": "LH458",
          "passengers": 2
        }
      }
    }
  }
}
```

- `a2uiRendererCapabilities["1.0"]`: `supportedCatalogIds` (array, required), `inlineCatalogs` (array, optional; each item is a full catalog definition per `catalog_definition.json`; functions may declare `allowedCallers`).
- `a2uiRendererDataModel`: present only when a surface was created with `sendDataModel: true`. Sent only to the agent that created the surface. Attached to the transport metadata, not the action payload.
- Scope: per-message capabilities apply to that turn only. Omitting them withdraws A2UI for that turn. Session-level capabilities apply to the session. Each transport decides which applies.

Agent to renderer (VERIFIED, `agent_capabilities.json`): `{"1.0": {"supportedCatalogIds": [...], "acceptsInlineCatalogs": false}}` (`acceptsInlineCatalogs` defaults to false).

v0.9.1 transport metadata keys were `a2uiClientCapabilities` and `a2uiClientDataModel`, with a `"v0.9"` version key. Do not mix them.

---

## 3. Component model

### 3.1 Flat adjacency list (VERIFIED)

Components are a flat array. Parents reference children by `id`. Tree shape is implicit. The renderer stores a map (`id -> component`) and builds the tree at render time. The spec's own mermaid example: `root: {id:'root', component:'Column', children:['title','button']}`.

The single structural anchor is a component with `"id": "root"`.

### 3.2 Component object (VERIFIED, spec "The component object")

- `id` (required): ComponentId. Must follow UAX #31 identifier rules. `user_card` and `userCard` are valid. `user-card` and `1st_item` are not.
- `component` (required): type name, e.g. `"Text"`. Must match a key in the catalog's `components`.
- `@catalogId` (optional): overrides the surface default catalog for this one component.
- `@accessibility` (optional): `{label, description, live: "off"|"polite"|"assertive", hidden}`.
- `@metadata` (optional): `{"extensions": {...}}`.
- `@checks` (optional, on `Checkable` components only): array of `CheckRule`.
- Other keys: component properties from the catalog.

Envelope keys use the `@` prefix in v1.0 so that catalog components may have their own `metadata`, `catalogId`, `accessibility` or `checks` properties. In v0.9.1 these were bare `accessibility` and `checks`.

### 3.3 Children references (VERIFIED, `common_types.json` types)

- `ComponentId`: a string ID of another component in the same surface. Catalog authors MUST use `"$ref": "common_types.json#/$defs/ComponentId"` for ID references, so validators can check referential integrity. Using `"type": "string"` makes the validator treat it as static text.
- `Child`: `$ref` to `ComponentId` (used by Card.child, Button.child, Modal.trigger/content, Tabs.tabs[].child).
- `ChildList`: either
  - an **array** of ComponentId strings: `"children": ["user_name", "user_title"]`, or
  - a **template object**: `{"componentId": "<template id>", "path": "/employees"}`. Here `path` is a plain JSON Pointer string, NOT a `{"@path"}` binding.

Template example, VERIFIED (spec "Example: scope resolution"):

```json
{
  "id": "employee_list",
  "component": "List",
  "children": {
    "path": "/employees",
    "componentId": "employee_card_template"
  }
},
{
  "id": "employee_card_template",
  "component": "Column",
  "children": ["name_text", "company_text"]
},
{
  "id": "name_text",
  "component": "Text",
  "text": { "@path": "name" }
},
{
  "id": "company_text",
  "component": "Text",
  "text": { "@path": "/company" }
}
```

Data model used with it: `{"company": "Acme Corp", "employees": [{"name": "Alice", "role": "Engineer"}, {"name": "Bob", "role": "Designer"}]}`.

Scope rules (VERIFIED):
- Absolute path (`/...`): always from data model root.
- Relative path (no leading `/`) inside a template: resolves to `/employees/N/name` for item N.
- Components inside a child scope can still use absolute paths.
- `@index` returns the 0-based index in the innermost template scope. `{"@call": "@index", "args": {"offset": 1}}` gives a 1-based index. Calling it outside a template is an error (`EXECUTION_ERROR` or invalid).

### 3.4 Bindings and values (VERIFIED, `common_types.json` and spec)

Dynamic properties are typed `DynamicString`, `DynamicNumber`, `DynamicBoolean`, `DynamicStringList`, `DynamicValue`. Each accepts:
1. A **literal** (`"text": "John Doe"`),
2. A **DataBinding** `{"@path": "/user/name"}` (JSON Pointer, RFC 6901),
3. A **FunctionCall** `{"@call": "formatString", "args": {...}}`.

`formatString` interpolation syntax: `${/absolute/path}`, `${relative}`, `${now()}`, `${formatDate(value:${/currentDate}, format:'yyyy-MM-dd')}`, escape literal `${` as `\${`. VERIFIED example:

```json
{
  "id": "user_welcome",
  "component": "Text",
  "text": {
    "@call": "formatString",
    "args": {
      "value": "Hello, ${/user/firstName}! Welcome back to ${/appName}."
    }
  }
}
```

Type conversion when interpolating: numbers and booleans become strings; null/undefined become `""`; objects and arrays are JSON-stringified.

Reserved prefix (VERIFIED): `@` is reserved for protocol directives: `@path`, `@call`, `@index`. Custom catalogs MUST NOT define functions starting with `@`. A plain object needing a literal key that starts with `@` escapes by doubling: `"@@path"` means the literal `"@path"`. Keys matching `^@([^@]|$)` that are not recognized directives are rejected.

### 3.5 Two-way binding for inputs (VERIFIED, spec "Two-Way Binding & Input Components")

Input components: `TextField`, `CheckBox`, `Slider`, `ChoicePicker`, `DateTimeInput`.
- Read: component renders from the bound path.
- Write: user interaction IMMEDIATELY updates the LOCAL data model at the bound path, creating the path if absent.
- Reactive: other components bound to the same path update as the user types.
- Local only: input changes do NOT send anything to the agent. The agent receives values only when an action fires. Put the bindings in `action.event.context`:

```json
"action": {
  "event": {
    "name": "submit_form",
    "context": {
      "email": { "@path": "/formData/email" }
    }
  }
}
```

With `sendDataModel: true`, the full model also rides in transport metadata on each outgoing message.

Example input component, VERIFIED (contact form in spec): `{"id":"first_name_field","component":"TextField","label":"First Name","value":{"@path":"/contact/firstName"},"variant":"shortText"}`.

### 3.6 Composition rules (VERIFIED, spec "Composition validation rules")

Catalog component definitions can declare:
- `allowedParents`: array of component type names allowed to contain this one. `"Surface"` is the top-level parent (valid only for `id: "root"`).
- `allowedChildren`: array of component type names allowed inside this container.

Error codes: `UNALLOWED_PARENT`, `UNALLOWED_CHILD`.

The name `"Surface"` is reserved: catalogs MUST NOT define a component named `Surface`.

---

## 4. Catalogs

### 4.1 Catalog object (VERIFIED, spec "Catalog structure" and `catalog_definition.json`)

Required top-level key: `catalogId`. Allowed root keys (strict, any other root key is rejected): `$schema`, `$id`, `protocolVersion`, `title`, `description`, `catalogId`, `instructions`, `metadata`, `components`, `functions`, `$defs`.

- `catalogId` (string): an identifier, conventionally a URI. Not fetched. Set `$id` and `catalogId` to the same URI.
- `protocolVersion`: MUST be `"1.0"` for catalogs targeting v1.0. If omitted, it defaults to `"0.9"`.
- `instructions` (Markdown): design rules that go into the LLM prompt.
- `components`: map of component name to JSON Schema. Each schema: `"type": "object"`, flat `properties` (no root `oneOf`/`anyOf`), a required `component` property with `const` equal to the key. Base envelope properties are NOT re-wrapped in catalog schemas.
- `functions`: map of function name to definition. Each defines `"properties": {"@call": {"const": "<name>"}, "args": {...}}` and metadata outside `properties`: `returnType` (`string|number|boolean|array|object|validationResult|any|void`), `allowedCallers` (`rendererOnly|agentOnly|rendererOrAgent`, default `rendererOnly`), optional `requiresUserActivation` (bool).
- `$defs`: ONLY `anyComponent` (`oneOf` of `#/components/X` refs plus a `discriminator` on `propertyName: "component"`), `anyFunction`, and optional leaf types. Component schemas must NOT live under `$defs`.
- `$ref` targets allowed externally: only `common_types.json#/$defs/{ComponentId, Child, ChildList, DynamicString, DynamicNumber, DynamicBoolean, DynamicStringList, DynamicValue, AccessibilityAttributes, CheckRule, Checkable, Action, DataBinding, FunctionCall}`. Any other external `$ref` makes the catalog invalid. Implementations MUST NOT fetch it over the network.
- `deprecated: true` and `x-deprecated-reason` are allowed on components, functions and properties.

Complete minimal template, VERIFIED (spec "Example Schema Template", trimmed to the structure):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
  "protocolVersion": "1.0",
  "title": "A2UI Basic Catalog Template",
  "description": "An annotated example showcasing structural rules and conventions.",
  "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
  "instructions": "Design instructions for LLMs when generating layouts under this catalog.",
  "components": {
    "Text": {
      "type": "object",
      "properties": {
        "component": {"const": "Text"},
        "text": {"$ref": "common_types.json#/$defs/DynamicString", "description": "Text content to display."}
      },
      "required": ["component", "text"]
    }
  },
  "functions": {
    "required": {
      "type": "object",
      "returnType": "validationResult",
      "allowedCallers": "rendererOnly",
      "properties": {
        "@call": {"const": "required"},
        "args": {
          "type": "object",
          "properties": {"value": {"description": "The value to check."}},
          "required": ["value"],
          "additionalProperties": false
        }
      },
      "required": ["@call", "args"],
      "unevaluatedProperties": false
    }
  },
  "$defs": {
    "anyComponent": {
      "oneOf": [{"$ref": "#/components/Text"}],
      "discriminator": {"propertyName": "component"}
    },
    "anyFunction": {
      "oneOf": [{"$ref": "#/functions/required"}]
    }
  }
}
```

(The spec's template also shows `allowedParents`, `metadata.extensions` and a leaf `ColorToken` `$defs` entry. Those are omitted here. See `spec-v1.0.md` lines 652-771.)

### 4.2 Basic catalog (VERIFIED: enumerated from `catalogs/basic/catalog.json`)

Basic catalog `catalogId` and `$id`: `https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json`. `protocolVersion: "1.0"`. The GitHub copy at `catalogs/basic/v1/catalog.json` has identical JSON content.

18 components (all have `weight` except where noted; `weight` is a number, valid only as a direct child of Row or Column):

| Component | Required | Other properties (enums and defaults where listed) |
| --- | --- | --- |
| Text | component, text | text: DynamicString. variant: `caption`\|`body` (default body). |
| Image | component, url | url. description. fit: `contain`\|`cover`\|`fill`\|`none`\|`scaleDown` (default fill). variant: `icon`\|`avatar`\|`smallFeature`\|`mediumFeature`\|`largeFeature`\|`header`. |
| Icon | component, name | name: enum of about 55 names (`accountCircle`, `add`, `arrowBack`, ... `warning`) OR an object form with a custom SVG path (`oneOf`, second branch). |
| Video | component, url | url. posterUrl. |
| AudioPlayer | component, url | url. description. |
| Row | component, children | children: ChildList. justify: `center`\|`end`\|`spaceAround`\|`spaceBetween`\|`spaceEvenly`\|`start`\|`stretch` (default start). align: `start`\|`center`\|`end`\|`stretch`. |
| Column | component, children | children: ChildList. justify: `start`\|`center`\|`end`\|`spaceBetween`\|`spaceAround`\|`spaceEvenly`\|`stretch`. align: `center`\|`end`\|`start`\|`stretch`. |
| List | component, children | children: ChildList. direction: `vertical`\|`horizontal` (default vertical). align: `start`\|`center`\|`end`\|`stretch` (default stretch). |
| Card | component, child | child: Child. |
| Tabs | component, tabs | tabs: array (minItems 1) of `{title: DynamicString, child: Child}`, both required, no extra keys. |
| Modal | component, trigger, content | trigger: Child (opens the modal). content: Child. |
| Divider | component | axis: `horizontal`\|`vertical` (default horizontal). |
| Button | component, child, action | child: Child. variant: `default`\|`primary`\|`borderless`. action: Action. Plus Checkable (`@checks`). |
| TextField | component, label, value | label, value (DynamicString). placeholder. variant: `longText`\|`number`\|`shortText`\|`obscured` (default shortText). Plus Checkable. |
| CheckBox | component, label, value | label: DynamicString. value: DynamicBoolean. Plus Checkable. |
| ChoicePicker | component, options, value | options: array of `{label: DynamicString, value: string}` (both required per option). label. variant: `multipleSelection`\|`mutuallyExclusive` (default mutuallyExclusive). displayStyle: `checkbox`\|`chips`. value. Plus Checkable. |
| Slider | component, value, max | value: DynamicNumber. max: number. min: number (default 0). steps: integer >= 1. label. Plus Checkable. |
| DateTimeInput | component, value | value: DynamicString (ISO 8601). enableDate, enableTime: boolean (default false). min, max: date/time strings. Plus Checkable. |

Note: `Button`, `TextField`, `CheckBox`, `ChoicePicker`, `Slider`, `DateTimeInput` have no direct `properties` in the raw file. They use `allOf: [{$ref: common_types.json#/$defs/Checkable}, {type: object, properties: {...}}]`. This is allowed in the basic catalog; the spec's "components MUST remain flat" rule applies to the structure, and `Checkable` is a permitted trait. Custom catalogs that copy this pattern should be checked against the validator.

14 functions (VERIFIED from catalog; `allowedCallers` absent means default `rendererOnly`):

| Function | returnType | Notes |
| --- | --- | --- |
| required | validationResult | value not null/undefined/empty |
| regex | validationResult | pattern in A2UI regex dialect (section 6.4) |
| length | validationResult | string length bounds |
| numeric | validationResult | numeric range bounds |
| email | validationResult | email format |
| formatString | string | `${...}` interpolation (sections 3.4, 6.5) |
| formatNumber | string | grouping and precision |
| formatCurrency | string | currency formatting |
| formatDate | string | date pattern |
| pluralize | string | localized string by count |
| openUrl | void | `requiresUserActivation: true`, must not be called from a passive binding |
| and | boolean | list of DynamicBoolean |
| or | boolean | list of DynamicBoolean |
| not | boolean | one DynamicBoolean |

Plus the system function `@index` (not in the catalog file; defined in common_types as `IndexSystemFunction`).

Instructions in the basic catalog (VERIFIED): "For layout, use the Row and Column components to organize other components." Concatenation rule: A2UI does not support `+` or format symbols; use `formatString("Hello ${/user/name}")`. Strict hierarchy: keep the requested nesting. Validation checks: put custom error text in `message` inside the check, not in a separate Text component.

### 4.3 Negotiation (VERIFIED, `concepts/catalogs.md` and spec "Mixable catalogs")

1. Renderer advertises `a2uiRendererCapabilities["1.0"].supportedCatalogIds` (and optionally `inlineCatalogs`) in transport metadata or the handshake.
2. Agent chooses a default catalog per surface with `createSurface.catalogId`. It may also set `@catalogId` on individual components and `catalogId` on individual function calls, which is how catalogs are mixed in one surface.
3. Resolution order (VERIFIED, spec, strict): (1) explicit `@catalogId` / `catalogId`, (2) surface default `catalogId`, (3) error, the component is not rendered and the call is rejected. There is NO fallback to `supportedCatalogIds`.
4. All catalogs mixed on one surface must share the same A2UI spec version.
5. The agent SDK reads the catalog schemas and `instructions` to build the system prompt and to validate its output.

Example from spec `concepts/catalogs.md` (VERIFIED):

```json
[
  {
    "version": "1.0",
    "createSurface": {
      "surfaceId": "salesDashboard",
      "catalogId": "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"
    }
  },
  {
    "version": "1.0",
    "updateComponents": {
      "surfaceId": "salesDashboard",
      "components": [
        {"id": "root", "component": "Column", "children": ["title", "chart"]},
        {"id": "title", "component": "Text", "text": "Quarterly sales"},
        {
          "id": "chart",
          "component": "BarChart",
          "@catalogId": "https://example.com/catalogs/charts/v1/catalog.json",
          "data": {"@path": "/sales"}
        }
      ]
    }
  }
]
```

### 4.4 Declaring a custom catalog

- Author a catalog JSON per 4.1, with `protocolVersion: "1.0"`, a unique `catalogId`, and `$id` equal to `catalogId`.
- Renderer side: the renderer implements each component natively (React, Lit, Angular, Flutter, SwiftUI, Compose). The concept doc lists the renderer SDKs: `@a2ui/web_core`, `a2ui_core`, `A2UICore`, `androidx.a2ui`.
- Agent side: pass the catalog to `CatalogConfig` (TypeScript and Python) or `CatalogConfig(catalog=...)`, as shown in `concepts/inference-formats.md`.
- Inline catalogs: the renderer can send a full catalog definition in `a2uiRendererCapabilities["1.0"].inlineCatalogs`. This is allowed only if the agent sends `acceptsInlineCatalogs: true` in its capabilities. Inline functions can declare `allowedCallers` so that remote invocation is explicitly allowed or forbidden.
- Catalog authoring guide on the site: `https://a2ui.org/guides/defining-a-catalog/` (not read in this run).

---

## 5. Data binding detail (summary, VERIFIED from spec)

- Paths: RFC 6901 JSON Pointer. Leading `/` is absolute. No leading `/` is relative inside a template.
- Missing data: during streaming, a path may be `undefined`. Render a placeholder or empty string.
- Deletion: `updateDataModel` with `value: null` removes the key.
- Upsert for `updateDataModel` and input components.

---

## 6. Validation

### 6.1 Structural validation (VERIFIED)

- Envelope against `agent_to_renderer.json` (or `renderer_to_agent.json`).
- Component objects against the catalog (`anyComponent` discriminator on `component`).
- Referential integrity: only fields whose schema `$ref`s `ComponentId` or `ChildList` / `Child` are checked for existing targets.

### 6.2 Name rules (VERIFIED)

Catalog entity names (component names, function names, argument names) and component `id`s must match `^[\p{XID_Start}_][\p{XID_Continue}]*$` (UAX #31). No whitespace, no `Pattern_Syntax` symbols, no leading digit. `Surface` is reserved as a component name.

### 6.3 Check rules (VERIFIED)

`CheckRule`: `condition` (DataBinding or FunctionCall, required) and `message` (optional string).

`ValidationResult`: `valid` (bool, required), `code` (string), `message` (string), `severity` (`error`|`warning`|`info`, default `error`). Extra fields are allowed.

Coercion rules (VERIFIED):
1. `ValidationResult` to `boolean` in `DynamicBoolean`: uses `result.valid`.
2. `boolean` to `ValidationResult` in `CheckRule.condition`: `true` gives `{"valid": true}`; `false` gives `{"valid": false, "message": <CheckRule.message>, "severity": "error"}`. A `ValidationResult` with `valid: false` uses its own `message` and falls back to `CheckRule.message`.
3. Any value to `boolean` in `DynamicBoolean`:

| Resolved value | Boolean |
| --- | --- |
| boolean | unchanged |
| ValidationResult (object with boolean `valid`) | result.valid |
| string "true" or "false" (any case) | true or false |
| any other string, including "" and "hello" | false |
| number 0 | false |
| any other number | true |
| null or absent | false |
| any other object or array | false |

A Button with `@checks` is disabled when any check fails. Full example in spec lines 1184-1226.

### 6.4 Regex dialect (VERIFIED)

The `regex` function (and `regexCapture`, `split`) uses the A2UI dialect: a subset of ECMAScript in Unicode mode (`u`) with no flags. Matching is case-sensitive, uses search semantics (like `RegExp.test`), `^`/`$` anchor to the whole value, and `\d \w \b` are ASCII-only.

Not allowed: backreferences (`\1`, `\k<name>`), lookbehind, named groups, `\p{}`, `\cX`, legacy octal, inline flags.

Safety rejections (`EXPRESSION_ERROR`):
1. Pattern longer than 256 code points.
2. A quantifier with upper bound above 1 applied to a subexpression containing an unbounded quantifier.
3. An unbounded quantifier on an alternation where two branches can start with the same character.
4. Two unbounded-quantified atoms with overlapping character sets adjacent in a concatenation.

Value longer than 4,096 code points: `{"valid": false}` with no error.

Examples (VERIFIED): accepted `^[a-z]+@[a-z]+\.com$`, `^(?=.*\d).{8,}$`, `\w+\s+\w+`. Rejected `(a+)+$` (rule 2), `(a|ab)*c` (rule 3), `\d+\s*\d+` (rule 4), `(\w)\1` (backreference).

### 6.5 Error handling rules (VERIFIED)

- Dynamic value failure: binding resolves to `null` (no fallback in v1.0); error `EXPRESSION_ERROR`; the component stays mounted.
- Check failure: `{"valid": false, "message": ..., "severity": "error"}`.
- Action pipeline failure: stop remaining steps, emit `error`, keep the surface mounted. Steps that already ran are not rolled back.
- Calling an unregistered, `rendererOnly`, or `requiresUserActivation` function from a passive binding is blocked with `EXPRESSION_ERROR` (or `INVALID_FUNCTION_CALL` over RPC).

### 6.6 Composition validation (VERIFIED)

`UNALLOWED_PARENT` and `UNALLOWED_CHILD` (section 3.6).

---

## 7. How the spec recommends prompting an LLM

### 7.1 The prompt-generate-validate loop (VERIFIED, spec "Usage pattern")

1. **Prompt**: include (a) the desired UI, (b) the A2UI JSON schema with the catalog, (c) examples of valid A2UI JSON.
2. **Generate**: the model returns JSON.
3. **Validate** against the A2UI schema. Valid output goes to the renderer. Invalid output goes back to the LLM as a `VALIDATION_FAILED` error (format in section 2.4), so the model can self-correct.

The spec describes this loop only. It does not prescribe a specific schema-serialization format.

### 7.2 Inference formats (VERIFIED, `concepts/inference-formats.md`)

The agent SDKs separate the model-facing notation from the wire JSON. The server compiles model output to wire messages.

| Format | Sentinel tags | SDK support | Description |
| --- | --- | --- | --- |
| Express (default) | `<a2ui>...</a2ui>` | TypeScript, Python, Dart | Compact positional DSL. Nested constructor calls. `$/path = value` for data. Compiled to flat wire JSON with deterministic IDs. |
| Direct JSON | `<a2ui-json>...</a2ui-json>` | TypeScript, Python, Dart | Standard wire JSON from the model. Markdown fence stripping and incremental string healing. |
| Custom | format-defined | TypeScript, Python, Dart | Implement `InferenceFormatFactory`, `PromptGenerator`, `Parser`. |

Express example (VERIFIED, verbatim):

```text
<a2ui>
$/flight/number = "NH 105"
$/flight/gate = "B12"
root = Card(
  Column([
    Text($/flight/number),
    Text($/flight/gate, "caption"),
    Button(Text("Board now"), action=Event("check_in", {flight: $/flight/number}))
  ])
)
</a2ui>
```

It compiles to the v1.0 wire JSON with `createSurface` carrying `components` and `dataModel`, and IDs `root`, `root_child`, `root_child_children_0`, and so on. The full wire output is in `inference-formats.md` lines 53-112.

Properties of the design (VERIFIED):
- Catalog-agnostic prompt synthesis: the `PromptGenerator` reads the negotiated catalog schemas and derives signatures at runtime.
- Bidirectional translation: `parseResponse` / `parse_response` and `decompile` let few-shot examples be written once as wire JSON and shown in whichever format is active.
- Incremental streaming: `openStream` / `open_stream` heals in-progress string literals on `progressiveKeys` (such as `"text"`) and validates every message against `RendererState`.

Code (VERIFIED, `inference-formats.md`, TypeScript):

```typescript
import {
  A2uiGenerator,
  CatalogConfig,
  DirectJsonFormatFactory,
  ExpressFormatFactory,
} from '@a2ui/agent';

const generator = new A2uiGenerator(
  [new CatalogConfig(catalog)],
  undefined,
  new ExpressFormatFactory(),
);
const processor = generator.createProcessor(rendererCapabilities, new DirectJsonFormatFactory());
const systemPrompt = processor.promptSnippet;
const parts = processor.parseResponse(llmOutput);
```

Python (VERIFIED):

```python
from a2ui.inference_formats import DirectJsonFormatFactory, ExpressFormatFactory
from a2ui.processor import A2uiGenerator, CatalogConfig

generator = A2uiGenerator(
    catalogs=[CatalogConfig(catalog=catalog)],
    inference_format_factory=ExpressFormatFactory(),
)
processor = generator.create_processor(
    renderer_capabilities,
    inference_format_factory=DirectJsonFormatFactory(),
)
system_prompt = processor.prompt_snippet
parts = processor.parse_response(llm_output)
```

Token benchmark (VERIFIED as published on the page; not reproduced here). Their suite: 54 samples `core_v1_0`, model `gemini-3.8-flash`, temperature 0.0. Median input tokens: Direct JSON 10,980 vs Express 6,000 (-45.4%). Median code tokens (thinking disabled): 807 vs 297 (-63.2%). Pass@1 98.1% for both (53/54). Vendor-run benchmark; treat as ASSUMED for other models.

The page says Express covers v0.9, v0.9.1 and v1.0. Direct JSON is kept for legacy v0.8 in Python, debugging, and models fine-tuned on A2UI JSON.

Full Express grammar: `https://github.com/a2ui-project/a2ui/blob/main/specification/proposals/express/a2ui_express.md` (not read).

Deterministic path: wire messages may be built in server code (classifier, state machine or macro) with no LLM compile step (VERIFIED, inference-formats.md line 29).

### 7.3 Macros (VERIFIED, `guides/macros.md`)

- Macros are `@macro`-decorated server functions that expand into catalog components before messages reach the renderer. Python agent SDK only at this time.
- Before inference, `MacroExpander` adds each macro's signature to the system prompt catalog. After inference, it runs the macro and emits flat catalog components.
- Benefits listed by the doc: fewer output tokens, consistent layouts, server-side data lookup, and new domain components shipped without client changes.
- Macros work with the basic catalog and with custom catalogs. Custom catalogs need the A2UI CLI to generate builder classes (`Step 1: Install the A2UI CLI`, section "Macros with custom catalogs").
- Macro arguments: `on_error`, `passthrough_components`, `protocol_version`, `catalog_id` options exist (headings only read).

### 7.4 "Jev-style decision models"

VERIFIED that the phrase appears in `https://a2ui.org/llms.txt` ("Agents compose declarative surfaces ... (via A2UI Express, Jev-style decision models, or server-side macros)"). NOT FOUND in any downloaded concept, guide, or spec page (`grep -i jev` over all downloaded `.md` pages returned nothing). I could not verify what it means. Do not implement it based on this report. Ask the user or check the A2UI Discord or repo before relying on it. ASSUMED: it is a decision-model/state-machine approach to generation, similar to section 7.2's "deterministic path", but this is not confirmed.

---

## 8. Differences from v0.8 / v0.9 / v0.9.1

VERIFIED from `specification/v1.0-evolution-guide.md`. Most of these break code written against older knowledge.

1. **Envelope names and version**: `server_to_client` becomes `agent_to_renderer`; `client_to_server` becomes `renderer_to_agent`; `client` becomes `renderer`; `server` becomes `agent` everywhere. `"version": "1.0"` (not `"v0.9"`).
2. **Renamed files**: `server_to_client.json` becomes `agent_to_renderer.json`; `client_capabilities.json` becomes `renderer_capabilities.json`; etc. (table in section 2.8 of the evolution guide).
3. **Function calls on the wire**: `callFunction` (the old message) is replaced by `callRendererFunction`. New `callAgentFunction`, `rendererFunctionResponse`, `agentFunctionResponse`.
4. **Data binding prefix**: `{"path": "/x"}` becomes `{"@path": "/x"}`. `{"call": "f"}` becomes `{"@call": "f"}`. Do NOT do a blind find-and-replace. `ChildList` templates keep `"path": "/items"` (plain). The `updateDataModel` envelope keeps `path` (plain). `FunctionCall.catalogId` stays unprefixed.
5. **Component envelope keys**: `accessibility` becomes `@accessibility`; `checks` becomes `@checks`; new `@catalogId` and `@metadata`. `id` and `component` stay bare.
6. **Theme removed**: `createSurface.theme`, catalog `$defs/theme`, and `primaryColor` are removed. A `theme` field makes the message invalid.
7. **Single-message creation**: `createSurface` can carry `components`, `dataModel`, and `metadata`. `catalogId` is now optional.
8. **Delete semantics**: `updateDataModel.value` is REQUIRED. Omitting it is a validation error. `null` deletes the key.
9. **Multi-catalog surfaces**: `@catalogId` per component, `catalogId` per function call. Resolution is strict (no fallback to capabilities).
10. **Functions are an object map**: catalog `functions` is `{name: definition}`, not an array.
11. **Catalog metadata**: `protocolVersion: "1.0"` required for v1.0 catalogs. `instructions` field added. `$schema`, `$id`, `title`, `description` now allowed root keys. `allowedParents` / `allowedChildren` added. `allowedCallers` and `requiresUserActivation` added to function definitions.
12. **Validation returns**: `required`, `regex`, `length`, `numeric`, `email` return `validationResult` (was `boolean`). `CheckRule.message` is optional. `DynamicBoolean` coerces `ValidationResult` to `valid`.
13. **Basic catalog changes**: `TextField.validationRegexp` removed (use `@checks` with `regex`). `TextField.value` is required. `TextField.placeholder` added. `Video.posterUrl` added. `Slider.steps` added. `openUrl` gets `requiresUserActivation: true`. `$defs/theme` removed. `Tabs`, `Modal`, `Icon` remain.
14. **Function discovery**: `allowedCallers` and `returnType` must NOT appear in wire-level `FunctionCall` payloads. They belong only in the catalog definition.
15. **Naming rules**: UAX #31 for every catalog entity and component `id`. `user-card` is invalid in v1.0 (VERIFIED in spec). Whether v0.9 accepted it was NOT checked, so do not state a v0.9 behaviour from this report.
16. **Reserved `@`**: `@` keys are reserved; `@index` is built in. Custom functions must not start with `@`. Escape literal `@` keys by doubling (`"@@path"`).
17. **Accessibility**: `live` (`off`|`polite`|`assertive`) and `hidden` (DynamicBoolean) added. Renderers MUST map `label`/`description` to native a11y APIs, and explicit labels override inferred ones.
18. **Transport metadata keys**: `a2uiClientCapabilities` becomes `a2uiRendererCapabilities`; `a2uiClientDataModel` becomes `a2uiRendererDataModel`. Capability version key `"v0.9"` becomes `"1.0"`.
19. **MIME type**: `application/json+a2ui` becomes `application/a2ui+json`.
20. **Inline catalogs**: `inlineCatalogs` is now a direct `$ref` to `catalog_definition.json`.
21. **Extensions**: `metadata.extensions` is allowed at several scopes; extension keys must be UAX #31 names; third-party keys should be prefixed by a reversed domain; `a2ui_` is reserved for official ones.
22. **`Surface` reserved**: `"Surface"` is a reserved component name.
23. **v0.8 specifically**: the llms.txt marks v0.8 as deprecated. The inference-formats page keeps Direct JSON only for legacy v0.8 payloads in Python.

Catalogs written for v0.9 do NOT work directly on v1.0 runtimes (evolution guide section 3, "For catalog authors").

---

## 9. Schema files: URLs and local copies

### 9.1 Canonical URLs (VERIFIED, HTTP 200)

Base: `https://a2ui.org/specification/v1_0/` (also mirrored on GitHub under `specification/v1_0/json/`).

| File | Raw URL | Local copy (scratchpad) |
| --- | --- | --- |
| agent_to_renderer.json | https://a2ui.org/specification/v1_0/json/agent_to_renderer.json | research/a2ui-schemas/agent_to_renderer.json |
| renderer_to_agent.json | https://a2ui.org/specification/v1_0/json/renderer_to_agent.json | research/a2ui-schemas/renderer_to_agent.json |
| common_types.json | https://a2ui.org/specification/v1_0/json/common_types.json | research/a2ui-schemas/common_types.json |
| catalog_definition.json | https://a2ui.org/specification/v1_0/json/catalog_definition.json | research/a2ui-schemas/catalog_definition.json |
| renderer_capabilities.json | https://a2ui.org/specification/v1_0/json/renderer_capabilities.json | research/a2ui-schemas/renderer_capabilities.json |
| agent_capabilities.json | https://a2ui.org/specification/v1_0/json/agent_capabilities.json | research/a2ui-schemas/agent_capabilities.json |
| renderer_data_model.json | https://a2ui.org/specification/v1_0/json/renderer_data_model.json | research/a2ui-schemas/renderer_data_model.json |
| Basic catalog | https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json | research/a2ui-schemas/basic_catalog.json |
| Basic catalog (GitHub) | https://raw.githubusercontent.com/a2ui-project/a2ui/main/catalogs/basic/v1/catalog.json | same JSON as above |
| List wrappers | `.../json/agent_to_renderer_list.json`, `..._list_wrapper.json`, `renderer_to_agent_list.json`, `..._list_wrapper.json` | research/a2ui-schemas/ (same name) |
| sample.json | https://a2ui.org/specification/v1_0/json/sample.json | research/a2ui-schemas/sample.json |

GitHub repo: `https://github.com/a2ui-project/a2ui`, folder `specification/v1_0/` (`README.md`, `docs/`, `extensions/`, `json/`, `test/`). Basic catalog at `catalogs/basic/v1/` (`catalog.json`, `basic_catalog_implementation_guide.md`, `examples/`).

Schema docs page with the Schema Explorer: https://a2ui.org/specification/v1.0/schemas/ .

Note: `https://a2ui.org/specification/v1_0/catalogs/...` is the catalog `catalogId`. The GitHub path `specification/v1_0/catalogs/` does NOT exist (404).

### 9.2 Schema structure (VERIFIED by parsing)

- `agent_to_renderer.json`: `$id` `https://a2ui.org/specification/v1_0/agent_to_renderer.json`. Top-level `oneOf` of 6 envelopes. `$defs`: `AgentFunctionResponseMessage`, `CallRendererFunctionMessage`, `Component`, `ComponentsList`, `CreateSurfaceMessage`, `DeleteSurfaceMessage`, `UpdateComponentsMessage`, `UpdateDataModelMessage`. Refers to `catalog.json#/$defs/anyComponent`, which must be mapped to the actual catalog file at validation time.
- `renderer_to_agent.json`: top-level properties `version`, `action`, `callAgentFunction`, `rendererFunctionResponse`, `error`. `oneOf` of 4.
- `common_types.json`: `$defs` include `ComponentId`, `Child`, `ChildList`, `DynamicString`, `DynamicNumber`, `DynamicBoolean`, `DynamicStringList`, `DynamicValue`, `DataBinding`, `FunctionCall`, `FunctionCommon`, `ComponentCommon`, `Checkable`, `CheckRule`, `Action`, `AccessibilityAttributes`, `Extensions`, `Surface`, `IndexSystemFunction`, `FunctionResponse`, `ValidationResult`, `Weight`.
- `catalog_definition.json`: root `required: ["catalogId"]`. `$defs`: `ComponentDefinition`, `FunctionCallValidationSchema`, `FunctionDefinition`, `LeafDefinition`, `ValidationResult`.
- `renderer_capabilities.json`: required top key `"1.0"`.
- `agent_capabilities.json`: required top key `"1.0"`.

Validation of the basic catalog schema (with `python -I`): 18 components, 14 functions, `$defs` = `anyComponent`, `anyFunction`, `Weight`.

Not done in this run: a live JSON Schema validation pass against sample messages (needs a validator). The schemas parse as valid JSON.

---

## 10. SDK versions (VERIFIED via npm and PyPI today)

- `@a2ui/web_core` 0.15.0 (modified 2026-11-02)
- `@a2ui/react` 0.15.0 (2026-11-02)
- `@a2ui/lit` 0.15.0 (2026-11-02)
- `@a2ui/angular` 0.14.0 (2026-11-02)
- `@a2ui/agent` 0.1.0 (2026-11-02)
- Python `a2ui-agent-sdk` 0.11.0 (PyPI)

Install commands from the llms.txt (VERIFIED): `npm install @a2ui/react @a2ui/web_core`, `npm install @a2ui/lit @a2ui/web_core`, `npm install @a2ui/angular @a2ui/web_core`, `npm install @a2ui/agent`, `pip install a2ui-agent-sdk` (also `a2ui-adk` and `a2ui-a2a`), Flutter `flutter pub add a2ui_flutter a2ui_core`, Swift SPM `https://github.com/a2ui-project/a2ui`.

Note: `@a2ui/agent` at 0.1.0 is a much lower version than the renderer packages. Treat the agent SDK as early-stage, and check the API against the installed `.d.ts` before depending on it. Not verified in this run.

---

## 11. Open questions and ASSUMED items

1. ASSUMED: the `Jev-style decision models` in llms.txt is a generation strategy. Its definition is not in any page read here. See 7.4.
2. VERIFIED but unexpected: the basic catalog defines `Button`, `TextField`, `CheckBox`, `ChoicePicker`, `Slider` and `DateTimeInput` through `allOf` with `Checkable`, not as flat objects. Decide whether a custom catalog may do the same.
3. VERIFIED (resolved after first draft): `ChoicePicker` required = `component, options, value`. `DateTimeInput` required = `component, value`.
4. VERIFIED (resolved): `Icon.name` is either one of the enum strings, or an object whose property is `svgPath` (second `oneOf` branch). Exact `svgPath` schema not extracted.
5. Not verified: the full text of `concepts/data-binding`, `concepts/actions-and-functions`, `guides/agent-integration`, `guides/defining-a-catalog`, the A2UI Express proposal, and the A2A extension spec. Any claim about them is out of scope here.
6. Not verified: that `@a2ui/react` or `@a2ui/web_core` 0.15.0 implements all of v1.0 (`callRendererFunction`, mixable catalogs). Check the release notes or source.
7. VERIFIED (resolved after first draft): each message definition in `agent_to_renderer.json` and `renderer_to_agent.json` has `version: {"const": "1.0"}`. The top-level envelope object has no `version` property of its own, so the constant is enforced per message definition.

---

## 12. Quick reference: the minimal valid v1.0 surface

VERIFIED pattern from the spec, combined as one message stream:

```jsonl
{"version":"1.0","createSurface":{"surfaceId":"main","catalogId":"https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json","dataModel":{"name":"Ana"}}}
{"version":"1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Column","children":["greet"]},{"id":"greet","component":"Text","text":{"@call":"formatString","args":{"value":"Hello, ${/name}!"}}}]}}
{"version":"1.0","updateDataModel":{"surfaceId":"main","path":"/name","value":"Bia"}}
{"version":"1.0","deleteSurface":{"surfaceId":"main"}}
```

Note: the `formatString` form is the spec's recommended way to mix text and data. The `Text` component's `text` also accepts `{"@path": "/name"}` directly.
