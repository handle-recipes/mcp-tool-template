# mcp-tool-template

## Local Development

Run locally to set up:
```
npm run setup           # sets up environment configuration
```

Then run:
```
npm run dev             # for development
npm run build           # to build
npm start               # to run built version
```

## GCP Deployment Setup

### Prerequisites

1. **Enable Required APIs**:
```bash
gcloud services enable artifactregistry.googleapis.com --project=bekk-
gcloud services enable cloudbuild.googleapis.com --project=bekk-
gcloud services enable run.googleapis.com --project=bekk-
gcloud services enable secretmanager.googleapis.com --project=bekk-
```

2. **Get your project number** (needed for Cloud Build service account):
```bash
gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)"
# Save this PROJECT_NUMBER for the next steps
```

### Service Accounts

Create three service accounts with appropriate permissions:

#### 1. Cloud Run Deployer (for GitHub Actions)
```bash
# Create service account
gcloud iam service-accounts create cloud-run-deployer \
  --display-name="Cloud Run Deployer" \
  --project=YOUR_PROJECT_ID

# Grant deployment permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cloud-run-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cloud-run-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cloud-run-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.repoAdmin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cloud-run-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cloud-run-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cloud-run-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:cloud-run-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageConsumer"

# Create and download key
gcloud iam service-accounts keys create deployer-key.json \
  --iam-account=cloud-run-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

#### 2. Cloud Build Service Account Permissions
The Cloud Build service account already exists, just grant it permissions:

```bash
# Replace PROJECT_NUMBER with the number from step 2
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageConsumer"
```

#### 3. MCP Invoker (for runtime Firebase Functions authentication)
```bash
# Create service account
gcloud iam service-accounts create mcp-invoker \
  --display-name="MCP Invoker" \
  --project=YOUR_PROJECT_ID

# Grant Cloud Functions Invoker role (for Cloud Functions v2)
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:mcp-invoker@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.invoker"

# Grant Cloud Run Invoker role (since Cloud Functions v2 runs on Cloud Run)
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:mcp-invoker@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# Create JSON key
gcloud iam service-accounts keys create mcp-invoker-key.json \
  --iam-account=mcp-invoker@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

**Important**: Cloud Functions v2 run on Cloud Run and require service-level IAM permissions. You have two options:

**Option A: Make functions publicly accessible (simpler, but less secure)**

This allows unauthenticated access to the Cloud Run endpoints. Security still relies on the `x-group-id` header for multi-tenancy.

```bash
# Make all functions public (replace with your actual function names)
for service in ingredientscreate ingredientsupdate ingredientsdelete ingredientsget ingredientslist recipescreate recipesupdate recipesdelete recipesget recipeslist recipessearch; do
  curl -X POST \
    "https://run.googleapis.com/v2/projects/YOUR_PROJECT_ID/locations/YOUR_REGION/services/$service:setIamPolicy" \
    -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    -H "Content-Type: application/json" \
    -d '{"policy":{"bindings":[{"role":"roles/run.invoker","members":["allUsers"]}]}}'
done
```

**Option B: Grant specific service account access (more secure, but complex)**

If service account authentication doesn't work, you may need to debug the ID token generation in [src/lib/auth.ts](src/lib/auth.ts).

```bash
# List all Cloud Run services (Cloud Functions v2)
gcloud run services list --platform=managed --region=YOUR_REGION --project=YOUR_PROJECT_ID

# Grant invoker permission to a specific function (example: recipesList)
gcloud run services add-iam-policy-binding recipesList \
  --region=YOUR_REGION \
  --member="serviceAccount:mcp-invoker@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --project=YOUR_PROJECT_ID

# Repeat for each function you need to call
```

#### 4. Recipes Runtime (Cloud Run service identity)
```bash
# Create service account
gcloud iam service-accounts create recipes-runtime \
  --display-name="Recipes Runtime" \
  --project=YOUR_PROJECT_ID

# Grant Secret Manager access
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:recipes-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Secret Manager Setup

Store the MCP invoker credentials in Secret Manager:

```bash
# Create the secret
gcloud secrets create MCP_INVOKER_JSON \
  --data-file=mcp-invoker-key.json \
  --project=YOUR_PROJECT_ID

# Grant recipes-runtime access to read it
gcloud secrets add-iam-policy-binding MCP_INVOKER_JSON \
  --member="serviceAccount:recipes-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=YOUR_PROJECT_ID
```

### Artifact Registry Setup

Pre-create the Docker repository (optional - Cloud Run can create it automatically):

```bash
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker \
  --location=YOUR_REGION \
  --project=YOUR_PROJECT_ID
```

### GitHub Secrets

Add these secrets to your GitHub repository in Settings → Secrets and variables → Actions:

- `GCP_SA_KEY`: Contents of `deployer-key.json` (paste the entire JSON)
- `GCP_PROJECT_ID`: Your GCP project ID
- `GCP_REGION`: Your deployment region (e.g., `europe-west3`)
- `FUNCTION_BASE_URL`: Your Firebase Functions base URL (e.g., `https://europe-west3-YOUR_PROJECT_ID.cloudfunctions.net`)