type Recipe = {
  id: string;
  name: string;
  content: string;
};

type RecipePanelProps = {
  recipes: Recipe[];
  selectedRecipeId: string | null;
  onAddRecipe: () => void;
  onSelectRecipe: (id: string) => void;
};

const RecipePanel = ({
  recipes,
  selectedRecipeId,
  onAddRecipe,
  onSelectRecipe,
}: RecipePanelProps) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Recipes</h2>
        <button className="button" onClick={onAddRecipe} type="button">
          Add Recipe
        </button>
      </div>

      <div className="recipe-list">
        {recipes.map((recipe) => (
          <div
            key={recipe.id}
            className={`recipe-item ${selectedRecipeId === recipe.id ? "selected" : ""}`}
            onClick={() => onSelectRecipe(recipe.id)}
          >
            {recipe.name}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecipePanel;
