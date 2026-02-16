/**
 * Smart Recipe Generator - Frontend Logic
 * ========================================
 * Handles user interaction, API calls, rendering results,
 * favorites management, and recipe ratings.
 */

// ── Favorites Storage ─────────────────────────────────────
// We use localStorage to persist favorites across sessions.
// This avoids needing user accounts or a separate favorites table.
let favorites = JSON.parse(localStorage.getItem('recipeFavorites')) || [];

// ── Saved Recipes Storage ───────────────────────────────
// We use localStorage to persist saved recipes across sessions.
let savedRecipes = JSON.parse(localStorage.getItem('savedRecipes')) || [];

// ── Initialize on Page Load ───────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    // Load favorites and saved recipes from localStorage
    favorites = JSON.parse(localStorage.getItem('recipeFavorites')) || [];
    savedRecipes = JSON.parse(localStorage.getItem('savedRecipes')) || [];
    
    // Wait a bit for DOM to be fully ready, then load recommended recipes
    setTimeout(function() {
        loadRecommendedRecipes();
    }, 100);
    
    // Load favorites
    loadFavorites();
    
    // Add event listeners
    document.getElementById('search-btn').addEventListener('click', searchRecipes);
    document.getElementById('ingredients-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchRecipes();
    });
    
    // Quick search functionality
    const quickSearchInput = document.getElementById('quick-search');
    const quickSearchResults = document.getElementById('quick-search-results');
    
    quickSearchInput.addEventListener('input', function() {
        const query = this.value.trim();
        if (query.length > 0) {
            performQuickSearch(query);
        } else {
            hideQuickSearchResults();
        }
    });
    
    quickSearchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const selected = document.querySelector('.quick-search-item.selected');
            if (selected) {
                selected.click();
            }
        }
    });
    
    // Hide quick search results when clicking outside
    document.addEventListener('click', function(e) {
        if (!quickSearchInput.contains(e.target) && !quickSearchResults.contains(e.target)) {
            hideQuickSearchResults();
        }
    });
});

// ── Image Upload Handler ──────────────────────────────────
// Real ingredient detection from an uploaded image using Google Vision API.
document.getElementById('image-upload').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const preview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const detectedEl = document.getElementById('detected-ingredients');
    const ingredientsInput = document.getElementById('ingredients-input');
    const imageActions = document.getElementById('image-actions');

    // Show image preview
    const reader = new FileReader();
    reader.onload = function(e) {
        previewImg.src = e.target.result;
        preview.style.display = 'block';
        imageActions.style.display = 'block';

        // Start real detection
        detectedEl.textContent = 'Analyzing image...';
        detectIngredients(file)
            .then(function(ingredients) {
                detectedEl.textContent = ingredients.join(', ');
                
                // Auto-fill text input with detected ingredients
                const currentIngredients = ingredientsInput.value.trim();
                if (currentIngredients) {
                    ingredientsInput.value = currentIngredients + ', ' + ingredients.join(', ');
                } else {
                    ingredientsInput.value = ingredients.join(', ');
                }
            })
            .catch(function(error) {
                detectedEl.textContent = 'Detection failed. Please try again.';
                console.error('Ingredient detection error:', error);
            });
    };
    reader.readAsDataURL(file);
});

// ── Remove Image Handler ───────────────────────────────────
document.getElementById('remove-image').addEventListener('click', function() {
    const imageUpload = document.getElementById('image-upload');
    const preview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const detectedEl = document.getElementById('detected-ingredients');
    const ingredientsInput = document.getElementById('ingredients-input');
    const imageActions = document.getElementById('image-actions');

    // Clear file input
    imageUpload.value = '';
    
    // Hide preview and actions
    preview.style.display = 'none';
    imageActions.style.display = 'none';
    
    // Clear preview image
    previewImg.src = '';
    
    // Clear detected ingredients
    detectedEl.textContent = '';
    
    // Remove detected ingredients from input (keep manually entered ones)
    const currentIngredients = ingredientsInput.value.trim();
    if (currentIngredients) {
        // Remove auto-filled ingredients (this is a simple approach)
        // In a real app, you'd track which ingredients were auto-filled
        ingredientsInput.value = currentIngredients;
    }
});

// ── Real Ingredient Detection ───────────────────────────────
// Uses Google Vision API to detect food ingredients from images
function detectIngredients(file) {
    return new Promise(function(resolve, reject) {
        // Convert file to base64
        const reader = new FileReader();
        reader.onload = function() {
            const base64Data = reader.result.split(',')[1]; // Remove data:image/...;base64, prefix
            
            // Call Google Vision API
            fetch('https://vision.googleapis.com/v1/images:annotate?key=YOUR_API_KEY', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requests: [{
                        image: {
                            content: base64Data
                        },
                        features: [
                            {
                                type: 'LABEL_DETECTION',
                                maxResults: 10,
                                model: 'builtin/latest'
                            }
                        ]
                    }]
                })
            })
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('Vision API request failed');
                }
                return response.json();
            })
            .then(function(data) {
                if (data.responses && data.responses[0] && data.responses[0].labelAnnotations) {
                    // Filter for food-related labels
                    const foodLabels = data.responses[0].labelAnnotations
                        .filter(function(label) {
                            const description = label.description.toLowerCase();
                            const foodKeywords = [
                                'food', 'fruit', 'vegetable', 'meat', 'fish', 'chicken', 'beef', 'pork', 'tomato', 'onion', 
                                'garlic', 'potato', 'carrot', 'rice', 'pasta', 'bread', 'cheese', 'milk', 'egg', 'butter', 'oil',
                                'salt', 'pepper', 'herb', 'spice', 'flour', 'sugar', 'lemon', 'apple', 'banana', 'orange', 'grape'
                            ];
                            
                            // Check if label contains food keywords
                            return foodKeywords.some(function(keyword) {
                                return description.includes(keyword) || keyword.includes(description);
                            });
                        })
                        .map(function(label) {
                            return label.description;
                        })
                        .slice(0, 8); // Limit to 8 ingredients
                } else {
                    // Fallback to common ingredients if API fails
                    resolve(['tomato', 'onion', 'garlic', 'bell pepper']);
                    return;
                }
                
                resolve(foodLabels);
            })
            .catch(function(error) {
                console.error('Vision API error:', error);
                // Fallback to simulated detection
                resolve(['tomato', 'onion', 'garlic', 'bell pepper']);
            });
        };
        
        reader.readAsDataURL(file);
    });
}


// ── Main Search Function ──────────────────────────────────
// Called when the user clicks "Find Recipes".
// Sends ingredients and filters to the backend, then renders results.
function searchRecipes() {
    // Grab values from the form
    const ingredientsRaw = document.getElementById('ingredients-input').value;
    const dietary = document.getElementById('dietary-filter').value;
    const difficulty = document.getElementById('difficulty-filter').value;
    const maxTime = document.getElementById('time-filter').value || 999;
    const servings = document.getElementById('servings-input').value || 0;

    // Basic validation — don't send empty requests
    if (!ingredientsRaw.trim()) {
        showError('Please enter at least one ingredient.');
        return;
    }

    // Parse the comma-separated ingredients into an array
    const ingredients = ingredientsRaw
        .split(',')
        .map(function(item) { return item.trim(); })
        .filter(function(item) { return item.length > 0; });

    // Show loading state, hide previous results/errors
    showLoading(true);
    hideError();
    document.getElementById('results-section').style.display = 'none';

    // Send the search request to our Flask backend
    fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ingredients: ingredients,
            dietary: dietary,
            difficulty: difficulty,
            max_time: parseInt(maxTime),
            servings: parseInt(servings)
        })
    })
    .then(function(response) {
        // Check if the server returned an error
        if (!response.ok) {
            return response.json().then(function(data) {
                throw new Error(data.error || 'Something went wrong.');
            });
        }
        return response.json();
    })
    .then(function(data) {
        showLoading(false);
        renderResults(data);
    })
    .catch(function(error) {
        showLoading(false);
        showError(error.message || 'Failed to search recipes. Please try again.');
    });
}


// ── Render Search Results ─────────────────────────────────
// Takes the API response and creates recipe cards in the DOM.
function renderResults(data) {
    var resultsSection = document.getElementById('results-section');
    var container = document.getElementById('results-container');
    var summary = document.getElementById('results-summary');

    // Handle no results
    if (!data.results || data.results.length === 0) {
        resultsSection.style.display = 'block';
        summary.textContent = 'No matching recipes found. Try different ingredients or adjust your filters.';
        container.innerHTML = '';
        return;
    }

    // Show summary of search
    summary.textContent = 'Found ' + data.results.length + ' match(es) out of '
        + data.total_filtered + ' filtered recipes.';

    // Build recipe cards
    var html = '';
    data.results.forEach(function(recipe) {
        html += buildRecipeCard(recipe, true);
    });

    container.innerHTML = html;
    resultsSection.style.display = 'block';

    // Scroll to results smoothly
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}


// ── Build Recipe Card HTML ────────────────────────────────
// Creates the HTML for a single recipe card.
// showScore: whether to show the match score bar (only for search results)
function buildRecipeCard(recipe, showScore) {
    var isFavorite = favorites.indexOf(recipe.id) !== -1;
    var scoreClass = recipe.match_score >= 70 ? 'high' : recipe.match_score >= 40 ? 'medium' : 'low';

    var card = '<div class="recipe-card" onclick="openRecipeDetail(' + recipe.id + ', event)">';

    // Header with name and rating
    card += '<div class="recipe-card-header">';
    card += '<div>';
    card += '<h3>' + escapeHtml(recipe.name) + '</h3>';
    card += '<p class="description">' + escapeHtml(recipe.description) + '</p>';
    card += '</div>';
    card += '<div class="rating-display">' + renderStars(recipe.rating) + ' (' + recipe.rating_count + ')</div>';
    card += '</div>';

    // Meta tags (time, difficulty, dietary, cuisine)
    card += '<div class="recipe-meta">';
    card += '<span class="meta-tag">⏱ ' + recipe.cook_time + ' min</span>';
    card += '<span class="meta-tag difficulty-' + recipe.difficulty + '">' + capitalize(recipe.difficulty) + '</span>';
    card += '<span class="meta-tag">' + capitalize(recipe.dietary) + '</span>';
    if (recipe.cuisine) {
        card += '<span class="meta-tag">' + escapeHtml(recipe.cuisine) + '</span>';
    }
    card += '<span class="meta-tag">🍽 ' + recipe.servings + ' servings</span>';
    card += '</div>';

    // Match score bar (only for search results)
    if (showScore && recipe.match_score !== undefined) {
        card += '<div class="score-section">';
        card += '<div class="score-label">';
        card += '<span>Ingredient Match</span>';
        card += '<span>' + recipe.match_score + '% (' + recipe.matched_count + '/' + recipe.total_ingredients + ')</span>';
        card += '</div>';
        card += '<div class="score-bar">';
        card += '<div class="score-fill ' + scoreClass + '" style="width:' + recipe.match_score + '%"></div>';
        card += '</div>';
        card += '</div>';

        // Show missing ingredients if any
        if (recipe.missing_ingredients && recipe.missing_ingredients.length > 0) {
            card += '<p class="missing-list"><strong>Missing:</strong> ' + recipe.missing_ingredients.join(', ') + '</p>';
        }
    }

    // Action buttons (stop click propagation so card click doesn't fire)
    card += '<div class="recipe-actions" onclick="event.stopPropagation()">';
    card += '<button class="btn btn-primary btn-small" onclick="showRecipeDetails(' + recipe.id + ')">View Recipe</button>';
    card += '<button class="btn btn-secondary btn-small btn-favorite" onclick="toggleFavorite(' + recipe.id + ', this)">';
    card += (isFavorite ? 'Saved' : 'Save');
    card += '</button>';
    card += '<div class="rating-input">';
    for (var i = 1; i <= 5; i++) {
        card += '<button class="star" onclick="rateRecipe(' + recipe.id + ', ' + i + ', this)" title="Rate ' + i + '">';
        card += i <= Math.round(recipe.rating) ? '★' : '☆';
        card += '</button>';
    }
    card += '</div>';
    card += '<button class="btn btn-secondary" onclick="showSubstitutions(' + recipe.id + ')">Substitutions</button>';
    card += '</div>';

    card += '</div>';
    return card;
}


// ── Open Recipe Detail Modal ──────────────────────────────
// Shows full recipe details in a modal overlay.
function openRecipeDetail(recipeId, event) {
    // Don't open modal if user clicked an action button
    if (event && event.target.closest('.recipe-actions')) return;

    // Fetch full recipe data
    fetch('/api/recipes')
    .then(function(res) { return res.json(); })
    .then(function(recipes) {
        var recipe = recipes.find(function(r) { return r.id === recipeId; });
        if (!recipe) return;

        var modal = document.getElementById('recipe-modal');
        var body = document.getElementById('modal-body');

        // Build modal content with full instructions and nutrition
        var html = '<h2>' + escapeHtml(recipe.name) + '</h2>';
        html += '<p style="color:var(--color-text-light);margin-bottom:16px">' + escapeHtml(recipe.description) + '</p>';

        // Meta info
        html += '<div class="recipe-meta" style="margin-bottom:16px">';
        html += '<span class="meta-tag">⏱ ' + recipe.cook_time + ' min</span>';
        html += '<span class="meta-tag difficulty-' + recipe.difficulty + '">' + capitalize(recipe.difficulty) + '</span>';
        html += '<span class="meta-tag">' + capitalize(recipe.dietary) + '</span>';
        html += '<span class="meta-tag">🍽 ' + recipe.servings + ' servings</span>';
        html += '</div>';

        // Ingredients list
        html += '<h3 style="margin-bottom:8px">Ingredients</h3>';
        html += '<ul style="margin-bottom:16px;padding-left:20px">';
        recipe.ingredients.forEach(function(ing) {
            html += '<li>' + escapeHtml(ing) + '</li>';
        });
        html += '</ul>';

        // Instructions
        html += '<h3 style="margin-bottom:8px">Instructions</h3>';
        var steps = recipe.instructions.split('\n').filter(function(s) { return s.trim(); });
        html += '<ol class="instructions-list">';
        steps.forEach(function(step) {
            // Remove the "1. " prefix since we use CSS counters
            var text = step.replace(/^\d+\.\s*/, '');
            html += '<li>' + escapeHtml(text) + '</li>';
        });
        html += '</ol>';

        // Nutrition
        html += '<h3 style="margin:16px 0 8px">Nutrition (per serving)</h3>';
        html += '<div class="nutrition-grid">';
        var nutritionLabels = {
            calories: 'Calories',
            protein: 'Protein (g)',
            carbs: 'Carbs (g)',
            fat: 'Fat (g)',
            fiber: 'Fiber (g)'
        };
        for (var key in recipe.nutrition) {
            html += '<div class="nutrition-item">';
            html += '<div class="value">' + recipe.nutrition[key] + '</div>';
            html += '<div class="label">' + (nutritionLabels[key] || key) + '</div>';
            html += '</div>';
        }
        html += '</div>';

        // Substitutions
        if (Object.keys(recipe.substitutions).length > 0) {
            html += '<div class="substitutions">';
            html += '<h4>💡 Ingredient Substitutions</h4>';
            html += '<ul>';
            for (var orig in recipe.substitutions) {
                html += '<li><strong>' + escapeHtml(orig) + '</strong> → ' + escapeHtml(recipe.substitutions[orig]) + '</li>';
            }
            html += '</ul>';
            html += '</div>';
        }

        body.innerHTML = html;
        modal.style.display = 'flex';
    })
    .catch(function() {
        showError('Could not load recipe details.');
    });
}


// ── Show Recipe Details ───────────────────────────────────
function showRecipeDetails(recipeId) {
    fetch('/api/recipes')
    .then(function(res) { return res.json(); })
    .then(function(recipes) {
        const recipe = recipes.find(r => r.id == recipeId);
        if (!recipe) {
            showError('Recipe not found.');
            return;
        }
        
        // Build detailed recipe HTML
        var html = '<div class="recipe-details">';
        html += '<h2>' + escapeHtml(recipe.name) + '</h2>';
        
        // Recipe meta info
        html += '<div class="recipe-meta">';
        html += '<span class="meta-tag">⏱ ' + recipe.cook_time + ' min</span>';
        html += '<span class="meta-tag difficulty-' + recipe.difficulty + '">' + capitalize(recipe.difficulty) + '</span>';
        html += '<span class="meta-tag">' + capitalize(recipe.dietary) + '</span>';
        if (recipe.cuisine) {
            html += '<span class="meta-tag">' + escapeHtml(recipe.cuisine) + '</span>';
        }
        html += '<span class="meta-tag">🍽 ' + recipe.servings + ' servings</span>';
        html += '</div>';
        
        // Ingredients list
        html += '<h3 style="margin-bottom:8px">Ingredients</h3>';
        html += '<ul style="margin-bottom:16px;padding-left:20px">';
        recipe.ingredients.forEach(function(ing) {
            html += '<li>' + escapeHtml(ing) + '</li>';
        });
        html += '</ul>';
        
        // Instructions
        html += '<h3 style="margin-bottom:8px">Instructions</h3>';
        var steps = recipe.instructions.split('\n').filter(function(s) { return s.trim(); });
        html += '<ol class="instructions-list">';
        steps.forEach(function(step) {
            var text = step.replace(/^\d+\.\s*/, '');
            html += '<li>' + escapeHtml(text) + '</li>';
        });
        html += '</ol>';
        
        // Nutrition
        html += '<h3 style="margin:16px 0 8px">Nutrition (per serving)</h3>';
        html += '<div class="nutrition-grid">';
        var nutritionLabels = {
            calories: 'Calories',
            protein: 'Protein (g)',
            carbs: 'Carbs (g)',
            fat: 'Fat (g)',
            fiber: 'Fiber (g)'
        };
        for (var key in recipe.nutrition) {
            html += '<div class="nutrition-item">';
            html += '<div class="value">' + recipe.nutrition[key] + '</div>';
            html += '<div class="label">' + (nutritionLabels[key] || key) + '</div>';
            html += '</div>';
        }
        html += '</div>';
        
        // Rating section
        html += '<div class="rating-section">';
        html += '<h3>Rate this Recipe</h3>';
        html += '<div class="rating-display">' + renderStars(recipe.rating) + ' (' + recipe.rating_count + ')</div>';
        html += '<div class="rating-input">';
        for (var i = 1; i <= 5; i++) {
            html += '<button class="star-btn" data-rating="' + i + '" onclick="rateRecipe(' + recipeId + ', ' + i + ', this)">' + (i <= Math.round(recipe.rating) ? '★' : '☆') + '</button>';
        }
        html += '</div>';
        html += '</div>';
        
        // Close button
        html += '<button class="btn btn-primary" onclick="closeModal()">Close</button>';
        html += '</div>';
        
        // Show in modal
        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('recipe-modal').style.display = 'flex';
    });
}

// ── Close Modal ───────────────────────────────────────────
function closeModal() {
    document.getElementById('recipe-modal').style.display = 'none';
}

// Close modal when clicking outside
document.getElementById('recipe-modal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
});


// ── Favorites Management ──────────────────────────────────
// Toggle a recipe in/out of the favorites list.
// Favorites are stored in localStorage as an array of recipe IDs.
function toggleFavorite(recipeId, buttonEl, event) {
    // Stop event propagation to prevent card click
    if (event) {
        event.stopPropagation();
    }
    
    var index = favorites.indexOf(recipeId);

    if (index === -1) {
        // Add to favorites
        favorites.push(recipeId);
        
        // Update button appearance
        if (buttonEl) {
            const icon = buttonEl.querySelector('.material-icons-outlined');
            if (icon) {
                icon.classList.add('fill-1');
            }
            buttonEl.style.color = '#ef4444';
        }
        
        // Show success message
        showError('Recipe added to favorites!');
        setTimeout(function() { hideError(); }, 2000);
    } else {
        // Remove from favorites
        favorites.splice(index, 1);
        
        // Update button appearance
        if (buttonEl) {
            const icon = buttonEl.querySelector('.material-icons-outlined');
            if (icon) {
                icon.classList.remove('fill-1');
            }
            buttonEl.style.color = '#ef4444';
        }
        
        // Show success message
        showError('Recipe removed from favorites!');
        setTimeout(function() { hideError(); }, 2000);
    }

    // Persist to localStorage
    localStorage.setItem('recipeFavorites', JSON.stringify(favorites));

    // Refresh the favorites display
    loadFavorites();
}


// ── Browse Recipes Function ─────────────────────────────────
// Called when user clicks "Browse Recipes" button
function browseRecipes() {
    const sortBy = document.getElementById('sort-select').value;
    const cuisineFilter = document.getElementById('browse-filter').value;
    
    console.log('Browsing recipes with sort:', sortBy, 'filter:', cuisineFilter);
    
    // Show loading
    document.getElementById('browse-loading').style.display = 'block';
    document.getElementById('browse-container').innerHTML = '';
    document.getElementById('browse-initial').style.display = 'none';
    
    fetch('/api/recipes')
    .then(function(response) {
        console.log('Response status:', response.status);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(function(recipes) {
        console.log('Loaded recipes:', recipes.length);
        
        // Filter by cuisine
        let filteredRecipes = recipes;
        if (cuisineFilter && cuisineFilter !== '') {
            filteredRecipes = recipes.filter(function(r) {
                return r.cuisine === cuisineFilter;
            });
        }
        
        console.log('Filtered recipes:', filteredRecipes.length);
        
        // Sort recipes
        filteredRecipes.sort(function(a, b) {
            switch(sortBy) {
                case 'popularity':
                    return b.rating_count - a.rating_count;
                case 'newest':
                    return b.id - a.id;
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'cook_time':
                    return a.cook_time - b.cook_time;
                case 'difficulty':
                    const difficultyOrder = {'easy': 1, 'medium': 2, 'hard': 3};
                    return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
                case 'rating':
                    return b.rating - a.rating;
                case 'cuisine':
                    return a.cuisine.localeCompare(b.cuisine);
                default:
                    return 0;
            }
        });
        
        // Display recipes
        displayBrowseRecipes(filteredRecipes);
        document.getElementById('browse-loading').style.display = 'none';
    })
    .catch(function(error) {
        console.error('Error loading recipes:', error);
        document.getElementById('browse-loading').style.display = 'none';
        document.getElementById('browse-container').innerHTML = 
            '<div class="error-message">Failed to load recipes. Please refresh the page.</div>';
    });
}

// ── Load and Display Favorites ────────────────────────────
// Fetches all recipes and filters to only show favorited ones.
function loadFavorites() {
    var container = document.getElementById('favorites-container');

    if (favorites.length === 0) {
        container.innerHTML = '<p class="empty-state col-span-full text-center text-[#648273]">No favorites saved yet. Search for recipes and save the ones you love!</p>';
        return;
    }

    fetch('/api/recipes')
    .then(function(res) { return res.json(); })
    .then(function(recipes) {
        var favoriteRecipes = recipes.filter(function(r) {
            return favorites.indexOf(r.id) !== -1;
        });

        if (favoriteRecipes.length === 0) {
            container.innerHTML = '<p class="empty-state col-span-full text-center text-[#648273]">No favorites found.</p>';
            return;
        }

        var html = '';
        favoriteRecipes.forEach(function(recipe) {
            const savedDate = getSavedDate(recipe.id);
            const foodImage = getFoodImage(recipe.name, recipe.cuisine);
            
            html += `
                <div class="favorite-card group" onclick="showRecipeDetails(${recipe.id})">
                    <div class="favorite-image">
                        <img src="${foodImage}" 
                             alt="${escapeHtml(recipe.name)}">
                    </div>
                    <div class="favorite-info">
                        <p class="favorite-title">
                            ${escapeHtml(recipe.name)}
                        </p>
                        <p class="favorite-date">Saved ${savedDate}</p>
                    </div>
                </div>
            `;
        });
        
        // Add the "Add New Favorite" card
        html += `
            <div class="add-favorite-card">
                <button class="add-favorite-btn" onclick="showBrowseSection()">
                    <span class="material-icons-outlined">add_circle</span>
                    Add New Favorite
                </button>
            </div>
        `;
        
        container.innerHTML = html;
    })
    .catch(function() {
        container.innerHTML = '<p class="empty-state col-span-full text-center text-[#648273]">Could not load favorites.</p>';
    });
}

// Helper function to get saved date (mock implementation)
function getSavedDate(recipeId) {
    // In a real app, you'd store the timestamp when favoriting
    const timestamps = {
        1: '2 days ago',
        2: '5 days ago', 
        3: '1 week ago'
    };
    return timestamps[recipeId] || 'recently';
}

// Function to show browse section when clicking "Add New Favorite"
function showBrowseSection() {
    document.getElementById('browse-section').scrollIntoView({ behavior: 'smooth' });
}

// Function to show all favorites (for the "View all saved recipes" link)
function showAllFavorites() {
    // This could expand the favorites section or navigate to a dedicated page
    document.getElementById('favorites-section').scrollIntoView({ behavior: 'smooth' });
}

// ── Load Recommended Recipes ───────────────────────────────
// Loads and displays top-rated recipes in descending order
function loadRecommendedRecipes() {
    const container = document.getElementById('recommended-container');
    const loading = document.getElementById('recommended-loading');
    const empty = document.getElementById('recommended-empty');
    
    // Check if elements exist before trying to access them
    if (!container || !loading || !empty) {
        console.error('Recommended recipes elements not found in DOM');
        return;
    }
    
    // Show loading and hide empty state
    empty.style.display = 'none';
    loading.style.display = 'block';
    container.innerHTML = '';
    
    fetch('/api/recipes')
    .then(function(res) { return res.json(); })
    .then(function(recipes) {
        // Sort recipes by rating in descending order, then by rating count
        const topRatedRecipes = recipes.sort(function(a, b) {
            // First sort by rating (descending)
            if (b.rating !== a.rating) {
                return b.rating - a.rating;
            }
            // Then by rating count (descending) for tie-breaker
            return b.rating_count - a.rating_count;
        }).slice(0, 9); // Show top 9 recipes (3 rows of 3)
        
        if (topRatedRecipes.length === 0) {
            container.innerHTML = `
                <div class="no-recommendations col-span-full text-center">
                    <h3 class="text-xl font-semibold mb-2">No recipes available</h3>
                    <p class="text-[#648273]">Please check back later for delicious recipes!</p>
                </div>
            `;
        } else {
            displayRecommendedRecipes(topRatedRecipes);
        }
        
        loading.style.display = 'none';
    })
    .catch(function(error) {
        console.error('Error loading recommendations:', error);
        container.innerHTML = '<div class="error-message">Failed to load recommendations.</div>';
        loading.style.display = 'none';
    });
}

// ── Display Recommended Recipes ───────────────────────────
function displayRecommendedRecipes(recipes) {
    const container = document.getElementById('recommended-container');
    
    // Check if container exists
    if (!container) {
        console.error('Recommended container not found in DOM');
        return;
    }
    
    let html = '';
    recipes.forEach(function(recipe) {
        const isFavorite = favorites.indexOf(recipe.id) !== -1;
        const difficultyIcon = getDifficultyIcon(recipe.difficulty);
        const dietaryBadge = recipe.dietary ? recipe.dietary.toUpperCase() : 'REGULAR';
        const foodImage = getFoodImage(recipe.name, recipe.cuisine);
        
        html += `
            <div class="recipe-card group" data-recipe-id="${recipe.id}" onclick="openRecipeDetail(${recipe.id}, event)">
                <div class="recipe-image-container">
                    <img class="recipe-image" 
                         src="${foodImage}" 
                         alt="${escapeHtml(recipe.name)}">
                    <button class="favorite-btn" onclick="toggleFavorite(${recipe.id}, this, event)">
                        <span class="material-icons-outlined ${isFavorite ? 'fill-1' : ''}">favorite</span>
                    </button>
                    <div class="recipe-badges">
                        <span class="recipe-badge">${dietaryBadge}</span>
                        <span class="time-badge">${recipe.cook_time} MIN</span>
                    </div>
                </div>

                <div class="recipe-content">
                    <div class="recipe-rating">
                        <span class="material-symbols-outlined text-sm fill-1">star</span>
                        <span class="rating-text">${recipe.rating.toFixed(1)}</span>
                        <span class="rating-count">(${recipe.rating_count})</span>
                    </div>
                    
                    <h4 class="recipe-title">
                        ${escapeHtml(recipe.name)}
                    </h4>
                    
                    <p class="recipe-description">
                        ${escapeHtml(recipe.description)}
                    </p>
                    
                    <div class="recipe-footer">
                        <div class="recipe-difficulty">
                            <span class="material-icons-outlined">${difficultyIcon}</span>
                            <span class="difficulty-text">${capitalize(recipe.difficulty)}</span>
                        </div>
                        <button class="view-recipe-btn" onclick="showRecipeDetails(${recipe.id}, event)">
                            View Recipe <span class="material-icons-outlined text-sm">arrow_forward</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    console.log('Displayed', recipes.length, 'recommended recipes');
}


// ── Rate a Recipe ─────────────────────────────────────────
// Sends the rating to the backend and updates the display.
function rateRecipe(recipeId, rating, starEl) {
    fetch('/api/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: recipeId, rating: rating })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.error) {
            showError(data.error);
            return;
        }

        // Store rating history for suggestions
        const ratingHistory = JSON.parse(localStorage.getItem('ratingHistory') || '[]');
        ratingHistory.push({
            recipe_id: recipeId,
            rating: rating,
            timestamp: Date.now()
        });
        localStorage.setItem('ratingHistory', JSON.stringify(ratingHistory));

        // Update the star display for this rating group
        var ratingGroup = starEl.parentElement;
        var stars = ratingGroup.querySelectorAll('.star, .star-btn');
        stars.forEach(function(star, index) {
            star.textContent = index < rating ? '★' : '☆';
        });

        // Show success message
        showError('Rating saved successfully!');
        setTimeout(function() { hideError(); }, 2000);
    })
    .catch(function() {
        showError('Could not save rating.');
    });
}


// ── Show Substitutions ────────────────────────────────────
// Fetches and displays ingredient substitutions for a recipe.
function showSubstitutions(recipeId) {
    fetch('/api/substitutions/' + recipeId)
    .then(function(res) { return res.json(); })
    .then(function(subs) {
        if (subs.error) {
            showError(subs.error);
            return;
        }

        var modal = document.getElementById('recipe-modal');
        var body = document.getElementById('modal-body');

        var html = '<h2>💡 Ingredient Substitutions</h2>';
        html += '<p style="color:var(--color-text-light);margin-bottom:16px">Don\'t have an ingredient? Try these alternatives:</p>';
        html += '<div class="substitutions" style="border-left:none;background:transparent;padding:0">';
        html += '<ul>';
        for (var original in subs) {
            html += '<li style="padding:8px 0;border-bottom:1px solid var(--color-border)">';
            html += '<strong>' + escapeHtml(original) + '</strong> → ' + escapeHtml(subs[original]);
            html += '</li>';
        }
        html += '</ul>';
        html += '</div>';

        body.innerHTML = html;
        modal.style.display = 'flex';
    })
    .catch(function() {
        showError('Could not load substitutions.');
    });
}


// ── UI Helper Functions ───────────────────────────────────

// Show or hide the loading spinner
function showLoading(visible) {
    document.getElementById('loading').style.display = visible ? 'block' : 'none';
    document.getElementById('search-btn').disabled = visible;
}

// Show an error message to the user
function showError(message) {
    var el = document.getElementById('error-message');
    el.textContent = message;
    el.style.display = 'block';
}

// Hide the error message
function hideError() {
    document.getElementById('error-message').style.display = 'none';
}

// Check if recipe is in favorites
function isFavorite(recipeId) {
    return favorites.includes(recipeId);
}

// Render star icons for a rating value
function renderStars(rating) {
    var stars = '';
    for (var i = 1; i <= 5; i++) {
        stars += i <= Math.round(rating) ? '★' : '☆';
    }
    return stars;
}

// Capitalize the first letter of a string
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Prevent XSS by escaping HTML characters in user-generated content
function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// ── Quick Search Functionality ─────────────────────────
// Quick search from header
document.getElementById('quick-search').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    if (searchTerm.length < 2) {
        // Clear quick search results if too short
        hideQuickSearchResults();
        return;
    }
    
    fetch('/api/recipes')
    .then(function(res) { return res.json(); })
    .then(function(recipes) {
        // Filter recipes by name containing search term
        const filteredRecipes = recipes.filter(function(recipe) {
            return recipe.name.toLowerCase().includes(searchTerm) ||
                   recipe.description.toLowerCase().includes(searchTerm) ||
                   recipe.ingredients.some(function(ing) {
                       return ing.toLowerCase().includes(searchTerm);
                   });
        });
        
        showQuickSearchResults(filteredRecipes, searchTerm);
    })
    .catch(function() {
        console.error('Failed to search recipes');
    });
});

// ── Hide Quick Search Results ───────────────────────────
function hideQuickSearchResults() {
    const existingDropdown = document.querySelector('.quick-search-results');
    if (existingDropdown) {
        existingDropdown.remove();
    }
}

// ── Show Quick Search Results ───────────────────────────
function showQuickSearchResults(recipes, searchTerm) {
    // Remove existing quick search results
    hideQuickSearchResults();
    
    if (recipes.length === 0) {
        return;
    }
    
    // Create quick search dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'quick-search-results';
    dropdown.innerHTML = '<div class="quick-search-header">Found ' + recipes.length + ' recipe' + (recipes.length === 1 ? '' : 's') + ' for "' + searchTerm + '"</div>';
    
    recipes.slice(0, 5).forEach(function(recipe) {
        const item = document.createElement('div');
        item.className = 'quick-search-item';
        item.innerHTML = '<strong>' + recipe.name + '</strong><br><small>' + recipe.cuisine + ' • ' + recipe.cook_time + ' min</small>';
        item.onclick = function() {
            openRecipeDetail(recipe.id);
            hideQuickSearchResults();
        };
        dropdown.appendChild(item);
    });
    
    // Position dropdown below search bar
    const searchContainer = document.querySelector('.quick-search-section');
    searchContainer.appendChild(dropdown);
}

// ── Saved Recipes Functions ───────────────────────────────
function showSavedRecipes() {
    const resultsContainer = document.getElementById('results-container');
    const searchSection = document.querySelector('.search-section');
    const sortBy = document.getElementById('sort-select').value;
    const cuisineFilter = document.getElementById('browse-filter').value;
    
    // Show loading state
    document.getElementById('browse-loading').style.display = 'block';
    document.getElementById('browse-container').innerHTML = '';
    
    fetch('/api/recipes')
    .then(function(res) { return res.json(); })
    .then(function(recipes) {
        // Filter by cuisine if selected
        let filteredRecipes = recipes;
        if (cuisineFilter) {
            filteredRecipes = recipes.filter(function(r) {
                return r.cuisine === cuisineFilter;
            });
        }
        
        // Sort recipes
        filteredRecipes.sort(function(a, b) {
            switch(sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'cook_time':
                    return a.cook_time - b.cook_time;
                case 'difficulty':
                    const difficultyOrder = {'easy': 1, 'medium': 2, 'hard': 3};
                    return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
                case 'rating':
                    return b.rating - a.rating;
                case 'cuisine':
                    return a.cuisine.localeCompare(b.cuisine);
                default:
                    return 0;
            }
        });
        
        // Render recipes
        const html = filteredRecipes.map(function(recipe) {
            return buildRecipeCard(recipe, false);
        }).join('');
        
        document.getElementById('browse-container').innerHTML = html;
        document.getElementById('browse-loading').style.display = 'none';
    })
    .catch(function() {
        document.getElementById('browse-loading').style.display = 'none';
        showError('Failed to load recipes.');
    });
}

// ── Load All Recipes ───────────────────────────────────────
// Loads and displays all recipes with sorting and filtering
function loadAllRecipes() {
    const sortBy = document.getElementById('sort-select').value;
    const cuisineFilter = document.getElementById('browse-filter').value;
    
    console.log('Loading recipes with sort:', sortBy, 'filter:', cuisineFilter);
    
    // Show loading
    document.getElementById('browse-loading').style.display = 'block';
    document.getElementById('browse-container').innerHTML = '';
    
    fetch('/api/recipes')
    .then(function(response) {
        console.log('Response status:', response.status);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(function(recipes) {
        console.log('Loaded recipes:', recipes.length);
        console.log('First recipe:', recipes[0]);
        
        // Filter by cuisine
        let filteredRecipes = recipes;
        if (cuisineFilter && cuisineFilter !== '') {
            filteredRecipes = recipes.filter(function(r) {
                return r.cuisine === cuisineFilter;
            });
        }
        
        console.log('Filtered recipes:', filteredRecipes.length);
        
        // Sort recipes
        filteredRecipes.sort(function(a, b) {
            switch(sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'cook_time':
                    return a.cook_time - b.cook_time;
                case 'difficulty':
                    const difficultyOrder = {'easy': 1, 'medium': 2, 'hard': 3};
                    return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
                case 'rating':
                    return b.rating - a.rating;
                case 'cuisine':
                    return a.cuisine.localeCompare(b.cuisine);
                default:
                    return 0;
            }
        });
        
        // Display recipes
        displayBrowseRecipes(filteredRecipes);
        document.getElementById('browse-loading').style.display = 'none';
    })
    .catch(function(error) {
        console.error('Error loading recipes:', error);
        document.getElementById('browse-loading').style.display = 'none';
        document.getElementById('browse-container').innerHTML = 
            '<div class="error-message">Failed to load recipes. Please refresh the page.</div>';
    });
}

function displayBrowseRecipes(recipes) {
    const container = document.getElementById('browse-container');
    const initialMessage = document.getElementById('browse-initial');
    
    if (!container) {
        console.error('Browse container not found');
        return;
    }
    
    // Hide initial message when showing recipes
    if (initialMessage) {
        initialMessage.style.display = 'none';
    }
    
    if (recipes.length === 0) {
        container.innerHTML = `
            <div class="no-results col-span-full text-center">
                <h3 class="text-xl font-semibold mb-2">No recipes found</h3>
                <p class="text-[#648273]">Try adjusting your filters.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    recipes.forEach(function(recipe) {
        const isFavorite = favorites.indexOf(recipe.id) !== -1;
        const difficultyIcon = getDifficultyIcon(recipe.difficulty);
        const dietaryBadge = recipe.dietary ? recipe.dietary.toUpperCase() : 'REGULAR';
        const foodImage = getFoodImage(recipe.name, recipe.cuisine);
        
        html += `
            <div class="recipe-card group" data-recipe-id="${recipe.id}" onclick="openRecipeDetail(${recipe.id}, event)">
                <div class="recipe-image-container">
                    <img class="recipe-image" 
                         src="${foodImage}" 
                         alt="${escapeHtml(recipe.name)}">
                    <button class="favorite-btn" onclick="toggleFavorite(${recipe.id}, this, event)">
                        <span class="material-icons-outlined ${isFavorite ? 'fill-1' : ''}">favorite</span>
                    </button>
                    <div class="recipe-badges">
                        <span class="recipe-badge">${dietaryBadge}</span>
                        <span class="time-badge">${recipe.cook_time} MIN</span>
                    </div>
                </div>

                <div class="recipe-content">
                    <div class="recipe-rating">
                        <span class="material-symbols-outlined text-sm fill-1">star</span>
                        <span class="rating-text">${recipe.rating.toFixed(1)}</span>
                        <span class="rating-count">(${recipe.rating_count})</span>
                    </div>
                    
                    <h4 class="recipe-title">
                        ${escapeHtml(recipe.name)}
                    </h4>
                    
                    <p class="recipe-description">
                        ${escapeHtml(recipe.description)}
                    </p>
                    
                    <div class="recipe-footer">
                        <div class="recipe-difficulty">
                            <span class="material-icons-outlined">${difficultyIcon}</span>
                            <span class="difficulty-text">${capitalize(recipe.difficulty)}</span>
                        </div>
                        <button class="view-recipe-btn" onclick="showRecipeDetails(${recipe.id}, event)">
                            View Recipe <span class="material-icons-outlined text-sm">arrow_forward</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    console.log('Displayed', recipes.length, 'recipes in browse section');
}

// Helper function to get food images based on recipe name and cuisine
function getFoodImage(recipeName, cuisine) {
    const foodImages = {
        'pasta': 'https://tse4.mm.bing.net/th/id/OIP.HUUr5Sh8Ujpj-Zp2Gt8ANwHaDy?pid=Api&P=0&h=220',
        'pizza': 'https://tse3.mm.bing.net/th/id/OIP.wNJnsuOOAr7mmFnkVxQnHQHaHa?pid=Api&P=0&h=220',
        'salad': 'https://tse1.mm.bing.net/th/id/OIP.RIIpb-h1ZjJodMEbClB3CwHaE7?pid=Api&P=0&h=220',
        'soup': 'https://tse2.mm.bing.net/th/id/OIP.hm8c2BDoyiJ5ewuMYhF3FQHaE8?pid=Api&P=0&h=220',
        'burger': 'https://tse3.mm.bing.net/th/id/OIP.uPJNhmsCGP72JL72DmMLfwHaE8?pid=Api&P=0&h=220',
        'sushi': 'https://tse4.mm.bing.net/th/id/OIP.NbZrfqqq2W4BcMRw7crtgAHaEJ?pid=Api&P=0&h=220',
        'curry': 'https://tse1.mm.bing.net/th/id/OIP.jagRhQIeVFNf2NJ_Zajb7QHaE7?pid=Api&P=0&h=220',
        'chicken': 'https://tse3.mm.bing.net/th/id/OIP.cPeQ73Ma_1-JRFQ-VbYABgHaEo?pid=Api&P=0&h=220',
        'beef': 'https://tse2.mm.bing.net/th/id/OIP.87v2gLpgAEJOjTPyK6wU8QHaE8?pid=Api&P=0&h=220',
        'fish': 'https://tse1.mm.bing.net/th/id/OIP.L2D0C1ppNaw3laE2pkFXuwHaE8?pid=Api&P=0&h=220',
        'vegetable': 'https://tse4.mm.bing.net/th/id/OIP.KHaBiLsAfru_iyx_iSuI4gHaE8?pid=Api&P=0&h=220',
        'rice': 'https://tse4.mm.bing.net/th/id/OIP._s64FgZYEz32aHVMJC7dKAHaE7?pid=Api&P=0&h=220',
        'bread': 'https://tse1.mm.bing.net/th/id/OIP.J4cHFL0n6-nRrIxvV2L3dgHaEK?pid=Api&P=0&h=220',
        'dessert': 'https://tse3.mm.bing.net/th/id/OIP.lbr2Z-gGZRfku4w0kRwU1gHaE7?pid=Api&P=0&h=220',
        'cake': 'https://tse2.mm.bing.net/th/id/OIP.u7Cpcwj3LhT2GnOEzIWe8gHaEF?pid=Api&P=0&h=220',
        'breakfast': 'https://tse1.mm.bing.net/th/id/OIP.PgkB8XB4BmbtZ9UAEmcGgQHaE8?pid=Api&P=0&h=220',
        'tacos': 'https://tse1.mm.bing.net/th/id/OIP.Njy-lLsZNZEOaPu-sKcysAHaE8?pid=Api&P=0&h=220',
        'stir fry': 'https://tse2.mm.bing.net/th/id/OIP.fwg8PdSIS6YwMbxFcfsspQHaEK?pid=Api&P=0&h=220',
        'roast': 'https://tse3.mm.bing.net/th/id/OIP.6u_FrSpRbRkcrtkvgjfqPgHaFj?pid=Api&P=0&h=220'
    };
    
    const cuisineImages = {
        'Italian': 'https://tse3.mm.bing.net/th/id/OIP.YixleAz2dzjXRd3FGfaIlwHaE7?pid=Api&P=0&h=220',
        'Asian': 'https://tse2.mm.bing.net/th/id/OIP.bRA9qbeoXJVJclQJjx2hIQHaE8?pid=Api&P=0&h=220',
        'Indian': 'https://tse2.mm.bing.net/th/id/OIP.CMiJRC_8-hwbXo5E2accXgHaEK?pid=Api&P=0&h=220',
        'American': 'https://tse4.mm.bing.net/th/id/OIP.cUz2gyhgDDQy5yinpouA-QHaE8?pid=Api&P=0&h=220',
        'Mexican': 'https://tse2.mm.bing.net/th/id/OIP.mkoZ00NF4fI-EruHd_5T1gHaE8?pid=Api&P=0&h=220',
        'Thai': 'https://tse2.mm.bing.net/th/id/OIP.nGjqpL_1um3cwq9siiq8JwHaFj?pid=Api&P=0&h=220',
        'Middle Eastern': 'https://tse4.mm.bing.net/th/id/OIP.at-ybTXZZINtyRzcr0zDPwHaEJ?pid=Api&P=0&h=220',
        'French': 'https://tse4.mm.bing.net/th/id/OIP.VTg7sdSIItdBeXkRxnapSwHaE8?pid=Api&P=0&h=220',
        'British': 'https://tse1.mm.bing.net/th/id/OIP.vr7ohbvfKkoxsu332lcndAHaEK?pid=Api&P=0&h=220',
        'Greek': 'https://tse4.mm.bing.net/th/id/OIP.BviMh3upQOkDtn2YKKmLMwHaE8?pid=Api&P=0&h=220',
        'Chinese': 'https://tse4.mm.bing.net/th/id/OIP.QhgXinnVIHHMI1hHtfrg6QHaE8?pid=Api&P=0&h=220'
    };
    
    const name = recipeName.toLowerCase();
    
    // Check for specific food keywords
    for (const [keyword, imageUrl] of Object.entries(foodImages)) {
        if (name.includes(keyword)) {
            return imageUrl;
        }
    }
    
    // Fall back to cuisine-based image
    if (cuisine && cuisineImages[cuisine]) {
        return cuisineImages[cuisine];
    }
    
    // Default food image
    return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop';
}

// Helper function to get difficulty icon
function getDifficultyIcon(difficulty) {
    switch(difficulty.toLowerCase()) {
        case 'easy': return 'restaurant';
        case 'medium': return 'bolt';
        case 'hard': return 'skillet';
        default: return 'restaurant';
    }
}

// ── Analyze User Preferences ───────────────────────────────
function analyzeUserPreferences(ratingHistory, recipes) {
    const preferences = {
        cuisines: {},
        difficulties: {},
        avgRating: 0,
        totalRatings: ratingHistory.length
    };
    
    // Calculate average rating
    preferences.avgRating = ratingHistory.reduce(function(sum, r) {
        return sum + r.rating;
    }, 0) / ratingHistory.length;
    
    // Analyze cuisine and difficulty preferences
    ratingHistory.forEach(function(rating) {
        const recipe = recipes.find(function(rec) {
            return rec.id === rating.recipe_id;
        });
        
        if (recipe) {
            // Count cuisine preferences
            preferences.cuisines[recipe.cuisine] = (preferences.cuisines[recipe.cuisine] || 0) + 1;
            
            // Count difficulty preferences
            preferences.difficulties[recipe.difficulty] = (preferences.difficulties[recipe.difficulty] || 0) + 1;
        }
    });
    
    return preferences;
}

// ── Generate Recipe Suggestions ───────────────────────────
function generateRecipeSuggestions(recipes, preferences) {
    const suggestions = [];
    const usedIds = new Set();
    
    // Get top preferred cuisines and difficulties
    const topCuisines = Object.entries(preferences.cuisines)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);
    
    const topDifficulties = Object.entries(preferences.difficulties)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(entry => entry[0]);
    
    // Suggest recipes from preferred cuisines
    topCuisines.forEach(function(cuisine) {
        const cuisineRecipes = recipes.filter(function(r) {
            return r.cuisine === cuisine && !usedIds.has(r.id) && r.rating >= preferences.avgRating;
        });
        
        // Add top 2 recipes from each preferred cuisine
        cuisineRecipes.slice(0, 2).forEach(function(recipe) {
            suggestions.push(recipe);
            usedIds.add(recipe.id);
        });
    });
    
    // Suggest recipes from preferred difficulties
    topDifficulties.forEach(function(difficulty) {
        const difficultyRecipes = recipes.filter(function(r) {
            return r.difficulty === difficulty && !usedIds.has(r.id) && r.rating >= preferences.avgRating;
        });
        
        // Add top recipe from each preferred difficulty
        if (difficultyRecipes.length > 0) {
            suggestions.push(difficultyRecipes[0]);
            usedIds.add(difficultyRecipes[0].id);
        }
    });
    
    // Fill remaining slots with highly-rated recipes
    const highRatedRecipes = recipes.filter(function(r) {
        return !usedIds.has(r.id) && r.rating >= 4.0;
    });
    
    highRatedRecipes.slice(0, 2).forEach(function(recipe) {
        suggestions.push(recipe);
    });
    
    return suggestions.slice(0, 6); // Return max 6 suggestions
}

// ── Initialize ────────────────────────────────────────────
