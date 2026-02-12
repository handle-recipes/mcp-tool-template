import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import "./global.css";
import styles from "./recipe-viewer.module.css";

interface RecipeIngredient {
  ingredientId: string;
  quantity?: number;
  unit: string;
  quantityText?: string;
  note?: string;
}

interface RecipeStep {
  text: string;
  equipment?: string[];
}

interface Recipe {
  name: string;
  description: string;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  tags: string[];
  categories: string[];
  sourceUrl?: string;
  createdByGroupId: string;
}

function formatQuantity(ing: RecipeIngredient): string {
  if (ing.unit === "free_text") {
    return ing.quantityText ?? "";
  }
  const qty = ing.quantity != null ? String(ing.quantity) : "";
  return `${qty} ${ing.unit}`.trim();
}

function parseRecipe(content: Array<{ type: string; text?: string }>): Recipe | null {
  for (const block of content) {
    if (block.type === "text" && block.text) {
      try {
        return JSON.parse(block.text) as Recipe;
      } catch {
        // not JSON, ignore
      }
    }
  }
  return null;
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{recipe.name}</h1>
        <p className={styles.description}>{recipe.description}</p>
      </div>

      <div className={styles.meta}>
        <span className={styles.metaBadge}>{recipe.servings} servings</span>
        <span className={styles.metaBadge}>by {recipe.createdByGroupId}</span>
        {recipe.sourceUrl && (
          <span className={styles.metaBadge}>has source</span>
        )}
      </div>

      {recipe.ingredients.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Ingredients</h2>
          <ul className={styles.ingredientList}>
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className={styles.ingredientItem}>
                <span className={styles.ingredientName}>
                  {ing.ingredientId}
                  {ing.note && (
                    <span className={styles.ingredientNote}> ({ing.note})</span>
                  )}
                </span>
                <span className={styles.ingredientQty}>
                  {formatQuantity(ing)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recipe.steps.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Steps</h2>
          <ol className={styles.stepList}>
            {recipe.steps.map((step, i) => (
              <li key={i} className={styles.stepItem}>
                {step.text}
              </li>
            ))}
          </ol>
        </div>
      )}

      {(recipe.tags.length > 0 || recipe.categories.length > 0) && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Tags</h2>
          <div className={styles.tags}>
            {recipe.categories.map((c) => (
              <span key={c} className={styles.tag}>{c}</span>
            ))}
            {recipe.tags.map((t) => (
              <span key={t} className={styles.tag}>{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { app, isConnected } = useApp({
    appInfo: { name: "recipe-viewer", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (params) => {
        if (params.isError) {
          setError("Tool returned an error");
          return;
        }
        const parsed = parseRecipe(params.content as Array<{ type: string; text?: string }>);
        if (parsed) {
          setRecipe(parsed);
        } else {
          setError("Could not parse recipe data");
        }
      };
    },
  });

  useHostStyles(app, app?.getHostContext());

  if (error) {
    return (
      <div className={styles.container}>
        <div className={`${styles.status} ${styles.error}`}>{error}</div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className={styles.container}>
        <div className={styles.status}>Connecting...</div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className={styles.container}>
        <div className={styles.status}>Waiting for recipe data...</div>
      </div>
    );
  }

  return <RecipeCard recipe={recipe} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
