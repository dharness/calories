type Recipe = {
  id: string;
  name: string;
  content: string;
};

import { useEffect, useState } from "react";

import type { Ingredient } from "../../server/services/ingredientParser";
import { apiClient } from "./apiClient";

type RecipeListProps = {
  recipes: Recipe[];
  selectedRecipeId: string | null;
  onUpdateRecipe: (id: string, content: string) => void;
};

const RecipeList = ({ recipes, selectedRecipeId, onUpdateRecipe }: RecipeListProps) => {
  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Reset ingredients when recipe changes
  useEffect(() => {
    setIngredients([]);
  }, [selectedRecipeId]);

  const handleOptimize = async () => {
    if (!selectedRecipe) return;

    setIsOptimizing(true);
    try {
      const result = await apiClient.optimize.query({
        recipeText: selectedRecipe.content,
      });
      setIngredients(result.ingredients);
    } catch (err) {
      console.error("Failed to optimize recipe:", err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleIngredientClick = async (ingredientName: string) => {
    try {
      const result = await apiClient.getFoodDetails.query({
        ingredientName: ingredientName,
      });
      console.log("Food details:", result.foodDetails);
    } catch (err) {
      console.error("Failed to get food details:", err);
    }
  };

  if (recipes.length === 0) {
    return (
      <div className="main-content">
        <div className="empty-state">
          <p className="muted">No recipes yet. Add a recipe to get started.</p>
        </div>
      </div>
    );
  }

  if (!selectedRecipe) {
    return (
      <div className="main-content">
        <div className="empty-state">
          <p className="muted">Select a recipe to edit.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="recipe-editor-main">
        <div className="recipe-editor-header">
          <h2>{selectedRecipe.name}</h2>
        </div>
        <div className="recipe-editor-split">
          <div className="recipe-editor-input">
            <label className="label">
              Recipe Input
              <textarea
                className="textarea"
                value={selectedRecipe.content}
                onChange={(e) => onUpdateRecipe(selectedRecipe.id, e.target.value)}
                placeholder="Enter your recipe here..."
              />
            </label>
          </div>

          <div className="recipe-editor-actions">
            <button
              className="button"
              onClick={handleOptimize}
              type="button"
              disabled={isOptimizing}
            >
              {isOptimizing ? "Optimizing..." : "Optimize →"}
            </button>
          </div>

          <div className="recipe-editor-output">
            <label className="label">
              Optimized Recipe
              <div className="optimized-content">
                {ingredients.length > 0 ? (
                  ingredients.map((ingredient, index) => {
                    const displayText = [
                      ingredient.quantity > 0 ? String(ingredient.quantity) : "",
                      ingredient.unit,
                      ingredient.name,
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <div key={index} className="ingredient-line">
                        <span
                          className="ingredient-item"
                          onClick={() => handleIngredientClick(ingredient.name)}
                        >
                          {displayText}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="placeholder-text">Optimized recipe will appear here...</div>
                )}
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeList;
