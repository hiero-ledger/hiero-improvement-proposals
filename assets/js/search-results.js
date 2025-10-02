document.addEventListener('DOMContentLoaded', function () {
    var searchInput = document.getElementById('search-input');
    var resultsContainer = document.getElementById('results-container');

    if (searchInput && resultsContainer) {
        searchInput.addEventListener('input', function () {
            if (searchInput.value.trim() !== '') {
                resultsContainer.classList.add('results-visible');
            } else {
                resultsContainer.classList.remove('results-visible');
            }
        });

        // Hide results when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.classList.remove('results-visible');
            }
        });

        // Show results when focusing on search input if there's content
        searchInput.addEventListener('focus', function() {
            if (searchInput.value.trim() !== '' && resultsContainer.children.length > 0) {
                resultsContainer.classList.add('results-visible');
            }
        });
    }
});