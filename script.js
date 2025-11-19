// --- DOM elements ---
const randomBtn = document.getElementById("random-btn");
const recipeDisplay = document.getElementById("recipe-display");
const remixBtn = document.getElementById("remix-btn");
const remixDisplay = document.getElementById("remix-output");
// Keep the last fetched recipe so the remix function can access the raw JSON
let currentRecipe = null;
// Recommendations array holds recipe objects fetched for the floating box
let recommendations = [];

// This function creates a list of ingredients for the recipe from the API data
// It loops through the ingredients and measures, up to 20, and returns an HTML string
// that can be used to display them in a list format
// If an ingredient is empty or just whitespace, it skips that item 
function getIngredientsHtml(recipe) {
  let html = "";
  for (let i = 1; i <= 20; i++) {
    const ing = recipe[`strIngredient${i}`];
    const meas = recipe[`strMeasure${i}`];
    if (ing && ing.trim()) html += `<li>${meas ? `${meas} ` : ""}${ing}</li>`;
  }
  return html;
}

// This function displays the recipe on the page
function renderRecipe(recipe) {
  recipeDisplay.innerHTML = `
    <div class="recipe-title-row">
      <h2>${recipe.strMeal}</h2>
    </div>
    <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" />
    <h3>Ingredients:</h3>
    <ul>${getIngredientsHtml(recipe)}</ul>
    <h3>Instructions:</h3>
    <p>${recipe.strInstructions.replace(/\r?\n/g, "<br>")}</p>
    <button id="save-btn" class="accent-btn save-inline-btn">
      <span class="material-symbols-outlined icon-btn">bookmark</span>
      Save Recipe
    </button>
  `;

  // Wire up the save button after rendering so it isn't lost when innerHTML is replaced
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveCurrentRecipe();
    });
  }
}

// Saved recipes helpers
function getSavedRecipes() {
  try {
    return JSON.parse(localStorage.getItem('savedRecipes') || '[]');
  } catch (e) {
    return [];
  }
}

function updateSavedRecipesUI() {
  const container = document.getElementById('saved-recipes-container');
  const list = document.getElementById('saved-recipes-list');
  const items = getSavedRecipes();
  if (!items || items.length === 0) {
    container.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  container.style.display = 'block';
  list.innerHTML = items.map(name => `
    <li class="saved-recipe-item">
      <span tabindex="0">${name}</span>
      <button class="delete-btn">Delete</button>
    </li>
  `).join('');

  // attach delete and load handlers
  list.querySelectorAll('.delete-btn').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const arr = getSavedRecipes();
      arr.splice(idx, 1);
      localStorage.setItem('savedRecipes', JSON.stringify(arr));
      updateSavedRecipesUI();
    });
  });
  list.querySelectorAll('.saved-recipe-item span').forEach((span, idx) => {
    span.addEventListener('click', () => {
      // Load the saved recipe by name using MealDB lookup
      const name = getSavedRecipes()[idx];
      if (!name) return;
      fetchAndDisplayRecipeByName(name);
    });
  });
}

function saveCurrentRecipe() {
  if (!currentRecipe) return;
  const arr = getSavedRecipes();
  if (!arr.includes(currentRecipe.strMeal)) {
    arr.push(currentRecipe.strMeal);
    localStorage.setItem('savedRecipes', JSON.stringify(arr));
    updateSavedRecipesUI();
  }
}

async function fetchAndDisplayRecipeByName(name) {
  recipeDisplay.innerHTML = '<p>Loading saved recipe...</p>';
  try {
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(name)}`);
    const data = await res.json();
    const recipe = data.meals && data.meals[0];
    if (recipe) {
      currentRecipe = recipe;
      renderRecipe(recipe);
    } else {
      recipeDisplay.innerHTML = '<p>Could not find that saved recipe.</p>';
    }
  } catch (e) {
    recipeDisplay.innerHTML = "<p>Sorry, couldn't load the saved recipe.</p>";
  }
}

// ---- Recommendations: fetch multiple random recipes and show in the floating box ----
async function loadRecommendations(count = 4) {
  const listEl = document.getElementById('recommend-list');
  const box = document.getElementById('recommendations');
  if (!listEl || !box) return;
  listEl.innerHTML = 'Loading...';
  box.hidden = false;

  const calls = Array.from({length: count}).map(() =>
    fetch('https://www.themealdb.com/api/json/v1/1/random.php').then(r => r.json()).catch(() => null)
  );

  const results = await Promise.all(calls);
  recommendations = results
    .map(r => (r && r.meals && r.meals[0]) ? r.meals[0] : null)
    .filter(Boolean);

  if (recommendations.length === 0) {
    listEl.innerHTML = '<p>Could not load recommendations.</p>';
    return;
  }

  listEl.innerHTML = recommendations.map((rec, idx) => `
    <div class="recommend-item" data-idx="${idx}" title="${rec.strMeal}">
      <img src="${rec.strMealThumb}" alt="${rec.strMeal}" />
      <span>${rec.strMeal}</span>
    </div>
  `).join('');

  // attach click handlers that render the recipe directly
  listEl.querySelectorAll('.recommend-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = Number(el.getAttribute('data-idx'));
      const rec = recommendations[idx];
      if (rec) {
        currentRecipe = rec;
        renderRecipe(rec);
      }
    });
  });
}

// Wire the refresh button if present
const refreshRecsBtn = document.getElementById('refresh-recs');
if (refreshRecsBtn) {
  refreshRecsBtn.addEventListener('click', () => loadRecommendations(4));
}

// This function gets a random recipe from the API and shows it
async function fetchAndDisplayRandomRecipe() {
  recipeDisplay.innerHTML = "<p>Loading...</p>"; // Show loading message
  try {
    // Fetch a random recipe from the MealDB API
    const res = await fetch('https://www.themealdb.com/api/json/v1/1/random.php'); // Replace with the actual API URL
    const data = await res.json(); // Parse the JSON response
    const recipe = data.meals[0]; // Get the first recipe from the response

    // Save the raw recipe JSON for remixing, then render it
    currentRecipe = recipe;
    renderRecipe(recipe); // Display the recipe

  } catch (error) {
    recipeDisplay.innerHTML = "<p>Sorry, couldn't load a recipe.</p>";
  }
}

async function remixRecipe()
{
  remixDisplay.innerHTML = "<p>Remixing...</p>"; // Show loading message
  try{
    // Ensure we have a recipe to remix
    if (!currentRecipe) {
      remixDisplay.innerHTML = "<p>No recipe loaded. Click 'Surprise Me Again!' to load one.</p>";
      return;
    }

    // Get the selected theme (user-facing short description)
    const remixThemeEl = document.getElementById('remix-theme');
    const remixTheme = remixThemeEl ? remixThemeEl.value : 'Give it a fun twist';

    // Build the messages for the Chat Completions API
    const systemPrompt = `You are a creative but practical recipe remixer. Given a MealDB recipe JSON and a short remix theme, produce a short, fun, creative, and totally doable remixed recipe. Highlight any changed ingredients or changed cooking instructions clearly. Keep the response concise (about 150-250 words) and user-friendly.`;

    const userPrompt = `Recipe JSON:\n${JSON.stringify(currentRecipe)}\n\nRemix theme: ${remixTheme}\n\nRespond with a one-line title, then a short list of any ingredient changes (or 'No ingredient changes' if none), then clear step-by-step instructions for the remixed recipe. Use plain text only.`;

    const body = {
      model: "gpt-4.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 400,
      temperature: 0.9
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI API error ${resp.status}: ${errText}`);
    }

    const json = await resp.json();
    const aiMessage = json?.choices?.[0]?.message?.content;
    if (!aiMessage) throw new Error('No response from AI');

    // Display AI output, preserving line breaks
    remixDisplay.innerHTML = aiMessage.replace(/\n/g, '<br>');

  }catch{
    remixDisplay.innerHTML = "<p>Sorry, couldn't remix the recipe.</p>";
  }
}

// --- Event listeners ---

// When the button is clicked, get and show a new random recipe
randomBtn.addEventListener("click", fetchAndDisplayRandomRecipe);

// When the page loads, show a random recipe right away
document.addEventListener("DOMContentLoaded", () => {
  fetchAndDisplayRandomRecipe();
  updateSavedRecipesUI();
  // Load a few quick recommendations for the floating box
  loadRecommendations(4);
});

remixBtn.addEventListener("click", () => {
  remixRecipe();
});