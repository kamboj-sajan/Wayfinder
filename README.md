# Wayfinder

An autonomous testing agent that explores a running web application, decides what
to do next from live runtime behaviour, and reports what broke — with no
pre-written test scripts.

Point it at a URL. It discovers the interactive elements on the page, picks an
action, executes it in a real browser, checks the result against a set of
invariants, records what it learned, and repeats. The traversal is captured as a
state graph you can replay in a dashboard, with a screenshot and the agent's
stated reasoning attached to every step.

**[▶ Watch the demo](https://drive.google.com/file/d/1-7oueO3SMrvWXI1vLhPWmnbxOXuc2fpt/view?usp=sharing)** (90 s):
the agent logs in to and explores saucedemo.com, then the run is replayed in the
dashboard.

```bash
cd wayfinder
npm install
npx playwright install chromium
npm start https://your-app.com
```

## How it works

Each turn of the agent has two phases:

**Reflect** — interpret what the last action produced.
`anomalyDetector` runs three invariants over the observation (failed network
calls, console errors, off-site navigation), `diagnoser` normalises any error
into a stable signature, `validator` judges whether the step succeeded, and
`learner` writes the outcome to the knowledge base.

**Plan** — decide what to do next.
`memory` retrieves semantically similar past runs from Qdrant, `decisionEngine`
prefers a proven fix, then a learned pattern, then systematic exploration of
untried actions, and `controlRouter` halts the run on a critical anomaly.

Execution happens in the run loop rather than inside the graph, because it needs
the live Playwright page and returns an observation the next turn reflects on.
Actions below a confidence threshold are refused before they reach the browser.

### State identity

Pages are keyed by a SHA-256 hash of the pathname plus the sorted set of
discovered action ids, so revisiting a page maps to the same node. Element ids
are normalised to strip mutable text — counters (`Cart (3)`) and toggle state
(`currently dark mode`) — which otherwise renames an element on every click and
traps the agent in a loop.

## Layout

All paths below are relative to `wayfinder/`, where the project lives.

| Path | Role |
| --- | --- |
| `langraph/` | Agent graph: nodes, invariants, traversal tracking |
| `runtime-discovery/` | Playwright driver, action discovery, the run loop |
| `knowledge/` | Qdrant vector store, embeddings, confidence feedback |
| `error-intelligence/` | Post-run analysis pipeline and reporters |
| `azure-integration/` | Fastify API over Cosmos DB, Vision, and Monitor |
| `wayfinder-graph-ui/` | React + React Flow dashboard for replaying runs |
| `vscode-extension/` | Run the agent from inside VS Code |

## Setup

### 1. Dependencies

```bash
cd wayfinder
npm install
cd runtime-discovery && npm install && npx playwright install chromium
cd ../azure-integration && npm install
cd ../wayfinder-graph-ui && npm install
```

### 2. Vector database

```bash
docker run -p 6333:6333 -v $(pwd)/qdrant_data:/qdrant/storage qdrant/qdrant
npm run create-collection
```

The agent degrades gracefully when Qdrant is unavailable — it explores without
memory rather than failing.

### 3. Configuration

Every service reads its secrets from the environment; nothing is committed.

```bash
cp .env.example .env
cp .env.example runtime-discovery/.env
cp azure-integration/.env.example azure-integration/.env
cp wayfinder-graph-ui/.env.example wayfinder-graph-ui/.env
```

One shared API key protects the backend. It must match in three places:
`API_KEY` (backend), `WAYFINDER_API_KEY` (agent), `VITE_API_KEY` (dashboard).

Embeddings default to a local MiniLM model (384-dim, no API key needed). Set
`EMBEDDING_PROVIDER=azure` to use Azure OpenAI instead.

## Usage

```bash
npm start https://your-app.com          # headless
npm run start-headful https://your-app.com   # watch it work

npm run server        # backend API on :5050
npm run dashboard     # run replay UI on :5173

npm test              # unit tests
npm run typecheck     # strict TypeScript, no emit
```

Post-run analysis:

```bash
npx tsx error-intelligence/pipeline.ts runs/<run-id>-graph.json reports/analysis.json
```

## Output

- `runs/` — traversal graph per run (nodes, edges, metadata)
- `screenshots/` — a capture per state and per action
- `reports/` — analysis output
- Cosmos DB — run, step, and anomaly records when the backend is configured

## VS Code extension

```bash
npm run compile-extension
# then press F5 to launch an extension development host
```

Adds a **Wayfinder** activity-bar view and a `Wayfinder: Start` command that
prompts for a URL and runs the agent in an integrated terminal.

## Deploying to Azure

| Component | Azure target |
| --- | --- |
| `azure-integration/` (API) | Container Apps, image built from its `Dockerfile` |
| `wayfinder-graph-ui/` (dashboard) | Blob Storage static website |
| Screenshots | Blob Storage, private `screenshots` container |
| Run data | Cosmos DB (free tier, one database sharing 1000 RU/s) |
| Qdrant | Local, alongside the agent |
| Agent | Runs locally or in CI, pointed at the deployed API |

These steps work on an Azure for Students subscription, which only allows a
few regions (Static Web Apps is unavailable in all of them) and blocks ACR
Tasks, so the image is built locally with Docker and pushed.

### First deployment

```bash
RG=rg-wayfinder; LOC=koreacentral; SUFFIX=<unique>; ST=wayfinder$SUFFIX; ACR=<registry-name>

az group create -n $RG -l $LOC

# Storage: screenshots + dashboard hosting
az storage account create -n $ST -g $RG -l $LOC --sku Standard_LRS \
  --allow-blob-public-access false --min-tls-version TLS1_2
az storage blob service-properties update --account-name $ST --static-website \
  --index-document index.html --404-document index.html

# Cosmos DB (free tier) - containers share the database throughput
az cosmosdb create -n wayfinder-cosmos-$SUFFIX -g $RG --enable-free-tier true \
  --locations regionName=$LOC failoverPriority=0 isZoneRedundant=false
az cosmosdb sql database create -a wayfinder-cosmos-$SUFFIX -g $RG -n wayfinder-db --throughput 1000
for c in test_runs test_steps anomalies; do
  az cosmosdb sql container create -a wayfinder-cosmos-$SUFFIX -g $RG -d wayfinder-db \
    -n $c --partition-key-path /runId
done

# Computer Vision (free tier)
az cognitiveservices account create -n wayfinder-vision-$SUFFIX -g $RG -l $LOC \
  --kind ComputerVision --sku F0 --custom-domain wayfinder-vision-$SUFFIX --yes

# Registry + Container Apps environment
az acr create -n $ACR -g $RG -l $LOC --sku Basic --admin-enabled true
az containerapp env create -n wayfinder-env -g $RG -l $LOC

# Build for amd64 (required on Apple Silicon) and push
az acr login -n $ACR
docker build --platform linux/amd64 -t $ACR.azurecr.io/wayfinder-api:v1 azure-integration
docker push $ACR.azurecr.io/wayfinder-api:v1

# API - keys are stored as Container Apps secrets
az containerapp create -n wayfinder-api -g $RG --environment wayfinder-env \
  --image $ACR.azurecr.io/wayfinder-api:v1 --registry-server $ACR.azurecr.io \
  --registry-username $ACR --registry-password <acr-password> \
  --ingress external --target-port 5050 --min-replicas 0 --max-replicas 1 \
  --secrets api-key=<key> cosmos-key=<...> vision-key=<...> storage-cs=<...> \
  --env-vars PORT=5050 API_KEY=secretref:api-key \
    AZURE_COSMOS_ENDPOINT=<...> AZURE_COSMOS_KEY=secretref:cosmos-key AZURE_COSMOS_DB=wayfinder-db \
    AZURE_VISION_ENDPOINT=<...> AZURE_VISION_KEY=secretref:vision-key \
    AZURE_STORAGE_CONNECTION_STRING=secretref:storage-cs \
    CORS_ORIGINS=https://<storage-web-endpoint>
```

### Dashboard

`VITE_*` values are baked in at build time, so rebuild whenever they change:

```bash
cd wayfinder-graph-ui
VITE_GRAPH_API=$API_URL/graph VITE_VISION_API=$API_URL/vision VITE_API_KEY=<key> npm run build
az storage blob upload-batch -d '$web' -s dist --account-name $ST --overwrite
```

### Redeploying the API

```bash
docker build --platform linux/amd64 -t $ACR.azurecr.io/wayfinder-api:v2 azure-integration
docker push $ACR.azurecr.io/wayfinder-api:v2
az containerapp update -n wayfinder-api -g $RG --image $ACR.azurecr.io/wayfinder-api:v2
```

### Running the agent against it

Set `WAYFINDER_API_URL` and `WAYFINDER_API_KEY` in `.env` and
`runtime-discovery/.env`, start Qdrant locally, and run `npm start <url>`.
Screenshots are uploaded to the API, which stores them in Blob Storage.

**The dashboard exposes the API key.** `VITE_API_KEY` is compiled into the
public JavaScript bundle, so anyone who can load the dashboard can read it and
call the API. Keep the dashboard URL private, and rotate the key (update the
`api-key` secret, then rebuild the dashboard) if it leaks.

## Troubleshooting

**Qdrant unreachable** — `curl http://localhost:6333/collections`. The agent
logs a warning and continues without memory.

**Backend returns 401** — `WAYFINDER_API_KEY` does not match `API_KEY`.

**Agent finds no actions** — the page may render after `networkidle`; the
stability wait is in `runtime-discovery/src/waitForStability.ts`.
