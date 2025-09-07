import { GoogleAuthClient } from './lib/auth';
import { RecipesAPI } from './api';
import pRetry from 'p-retry';

interface Config {
  functionBaseUrl: string;
  groupId: string;
  gcpServiceAccountJson: string;
}

function getConfig(): Config {
  const config = {
    functionBaseUrl: process.env.FUNCTION_BASE_URL,
    groupId: process.env.GROUP_ID,
    gcpServiceAccountJson: process.env.GCP_SA_JSON,
  };

  if (!config.functionBaseUrl) {
    throw new Error('FUNCTION_BASE_URL environment variable is required');
  }
  if (!config.groupId) {
    throw new Error('GROUP_ID environment variable is required');
  }
  if (!config.gcpServiceAccountJson) {
    throw new Error('GCP_SA_JSON environment variable is required');
  }

  return config as Config;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function performBenignWrite(api: RecipesAPI): Promise<void> {
  const timestamp = new Date().toISOString();
  const testRecipe = {
    name: `Health Check Recipe - ${timestamp}`,
    description: 'This is a benign write operation for health monitoring',
    ingredients: ['1 cup monitoring', '2 tbsp automation'],
    instructions: ['Mix ingredients', 'Serve with reliability'],
  };

  try {
    const createdRecipe = await api.createRecipe(testRecipe);
    console.log(`✅ Created test recipe: ${createdRecipe.id}`);
    
    await sleep(1000);
    
    await api.deleteRecipe(createdRecipe.id);
    console.log(`🗑️  Cleaned up test recipe: ${createdRecipe.id}`);
  } catch (error) {
    console.error('❌ Failed to perform benign write:', error);
    throw error;
  }
}

async function runHealthCheck(api: RecipesAPI): Promise<void> {
  try {
    const health = await api.healthCheck();
    console.log(`💚 Health check passed:`, health);
  } catch (error) {
    console.error('❌ Health check failed:', error);
    throw error;
  }
}

async function listRecipes(api: RecipesAPI): Promise<void> {
  try {
    const recipes = await api.listRecipes(1, 5);
    console.log(`📋 Found ${recipes.recipes.length} recipes (total: ${recipes.total || 'unknown'})`);
    
    if (recipes.recipes.length > 0) {
      recipes.recipes.forEach(recipe => {
        console.log(`  - ${recipe.name} (${recipe.id})`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to list recipes:', error);
    throw error;
  }
}

async function runCycle(api: RecipesAPI, cycleCount: number): Promise<void> {
  console.log(`🔄 Starting cycle #${cycleCount}`);
  
  await pRetry(async () => {
    await runHealthCheck(api);
  }, {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 10000,
    onFailedAttempt: (error) => {
      console.log(`⏳ Health check attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
    }
  });

  await pRetry(async () => {
    await listRecipes(api);
  }, {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 10000,
    onFailedAttempt: (error) => {
      console.log(`⏳ List recipes attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
    }
  });

  if (cycleCount % 5 === 0) {
    await pRetry(async () => {
      await performBenignWrite(api);
    }, {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 10000,
      onFailedAttempt: (error) => {
        console.log(`⏳ Benign write attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
      }
    });
  }

  console.log(`✅ Completed cycle #${cycleCount}`);
}

async function main(): Promise<void> {
  try {
    console.log('🚀 Starting recipes service...');
    
    const config = getConfig();
    
    const authClient = new GoogleAuthClient({
      gcpServiceAccountJson: config.gcpServiceAccountJson,
      functionBaseUrl: config.functionBaseUrl,
    });
    
    const api = new RecipesAPI(authClient.getClient(), config.groupId);
    
    console.log(`🔗 Connected to: ${config.functionBaseUrl}`);
    console.log(`👥 Group ID: ${config.groupId}`);
    
    let cycleCount = 0;
    const CYCLE_INTERVAL = 30000; // 30 seconds
    
    while (true) {
      cycleCount++;
      
      try {
        await runCycle(api, cycleCount);
      } catch (error) {
        console.error(`❌ Cycle #${cycleCount} failed:`, error);
      }
      
      console.log(`⏰ Waiting ${CYCLE_INTERVAL / 1000} seconds until next cycle...`);
      await sleep(CYCLE_INTERVAL);
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}