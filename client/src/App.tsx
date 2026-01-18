import { useState } from "react";

import CalorieLookupModal from "./CalorieLookupModal";
import RecipeList from "./RecipeList";
import RecipePanel from "./RecipePanel";

type Recipe = {
  id: string;
  name: string;
  content: string;
};

const App = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddRecipe = () => {
    const newRecipe: Recipe = {
      id: crypto.randomUUID(),
      name: `Recipe ${recipes.length + 1}`,
      content: "",
    };
    setRecipes([...recipes, newRecipe]);
    setSelectedRecipeId(newRecipe.id);
  };

  const handleSelectRecipe = (id: string) => {
    setSelectedRecipeId(id);
  };

  const handleUpdateRecipe = (id: string, content: string) => {
    setRecipes(
      recipes.map((recipe) =>
        recipe.id === id ? { ...recipe, content } : recipe
      )
    );
  };

  return (
    <div className="app-container">
      <div className="top-bar">
        <h1>Calorie Optimizer</h1>
        <button className="button" onClick={() => setIsModalOpen(true)} type="button">
          Calorie Lookup
        </button>
      </div>

      <div className="content-container">
        <RecipePanel
          recipes={recipes}
          selectedRecipeId={selectedRecipeId}
          onAddRecipe={handleAddRecipe}
          onSelectRecipe={handleSelectRecipe}
        />

        <RecipeList
          recipes={recipes}
          selectedRecipeId={selectedRecipeId}
          onUpdateRecipe={handleUpdateRecipe}
        />
      </div>

      <CalorieLookupModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default App;
