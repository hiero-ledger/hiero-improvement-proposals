document.addEventListener('DOMContentLoaded', () => {
    const statusSelect = $('#status-filter');
    const hederaReviewFilters = document.querySelectorAll('input[name="hedera-review-filter"]');
    const hieroApprovalFilters = document.querySelectorAll('input[name="hiero-review-filter"]');
    const noHipsMessage = document.querySelector('.no-hips-message');
    const hederaReviewRadios = document.querySelectorAll('input[name="hedera-review-filter"]');
    const hieroApprovalRadios = document.querySelectorAll('input[name="hiero-review-filter"]');

    hederaReviewRadios.forEach(radio => {
        radio.addEventListener('click', (e) => {
            if (e.currentTarget.checked && e.currentTarget.getAttribute('data-checked') === 'true') {
                e.currentTarget.checked = false;
                e.currentTarget.setAttribute('data-checked', 'false');
                filterRows();
            } else {
                hederaReviewRadios.forEach(r => r.setAttribute('data-checked', 'false'));
                e.currentTarget.setAttribute('data-checked', 'true');
            }
        });
    });

    hieroApprovalRadios.forEach(radio => {
        radio.addEventListener('click', (e) => {
            if (e.currentTarget.checked && e.currentTarget.getAttribute('data-checked') === 'true') {
                e.currentTarget.checked = false;
                e.currentTarget.setAttribute('data-checked', 'false');
                filterRows();
            } else {
                hieroApprovalRadios.forEach(r => r.setAttribute('data-checked', 'false'));
                e.currentTarget.setAttribute('data-checked', 'true');
            }
        });
    });

    $('#status-filter').select2({
        placeholder: "Select statuses",
        allowClear: true,
        width: 'style'
    }).on('change', () => {
        filterRows();
    });

    $('#type-filter').select2({
        placeholder: "Select types",
        allowClear: true,
        width: 'style'
    }).on('change', () => {
        filterRows();
    });

    function filterRows() {
        const rawSelectedTypes = $('#type-filter').val(); // Changed variable name for clarity
        let selectedCategoriesForFilter = [];

        if (Array.isArray(rawSelectedTypes)) {
            selectedCategoriesForFilter = rawSelectedTypes
                .map(cat => (typeof cat === 'string' ? cat.trim().toLowerCase() : ''))
                .filter(cat => cat !== '');
        } else if (typeof rawSelectedTypes === 'string' && rawSelectedTypes.trim() !== '') {
            // Handle case where .val() might return a single string for a single selection
            selectedCategoriesForFilter = [rawSelectedTypes.trim().toLowerCase()];
        }
        // If rawSelectedTypes is null (e.g., filter cleared), selectedCategoriesForFilter remains []

        const selectedStatuses = statusSelect.val().length > 0 ? statusSelect.val() : ['all'];
        const selectedHederaReview = document.querySelector('input[name="hedera-review-filter"]:checked')?.value || 'all';
        const selectedHieroReview = document.querySelector('input[name="hiero-review-filter"]:checked')?.value || 'all';
        
        let anyRowVisible = false;
        document.querySelectorAll('.hipstable tbody tr').forEach(row => {
            const categoryAttr = row.getAttribute('data-category');
            const rowCategories = categoryAttr ? categoryAttr.trim().toLowerCase().split(',').map(cat => cat.trim()).filter(cat => cat !== '') : [];

            const statusAttr = row.getAttribute('data-status');
            const rowStatus = statusAttr ? statusAttr.trim().toLowerCase() : 'unknown'; // Default to a non-matching status if missing
            
            const hederaReviewAttr = row.getAttribute('data-hedera-review');
            const councilReviewAttr = row.getAttribute('data-council-review');
            const rowHederaReview = (hederaReviewAttr === 'true' || councilReviewAttr === 'true') ? 'true' : 'false';
                                   
            const hieroReviewAttr = row.getAttribute('data-hiero-review');
            const rowHieroReview = hieroReviewAttr ? hieroReviewAttr : 'false'; 

            let categoryMatch = true; 
            if (selectedCategoriesForFilter.length > 0) { // Apply filter only if categories are selected
                categoryMatch = selectedCategoriesForFilter.every(selCat => {
                    // selCat is a category selected in the filter, e.g., 'core', 'mirror'
                    // rowCategories is an array of categories from the HIP, e.g., ['core', 'service', 'mirror node']

                    // Direct match:
                    if (rowCategories.includes(selCat)) {
                        return true;
                    }

                    // Alias: filter 'mirror' should match data 'mirror node'
                    if (selCat === 'mirror' && rowCategories.includes('mirror node')) {
                        return true;
                    }
                    
                    // Add more specific aliases here if needed in the future.

                    return false; // This selected filter category was not found in the HIP's categories (considering aliases)
                });
            }
            
            const statusMatch = selectedStatuses.includes('all') || selectedStatuses.includes(rowStatus);
            const hederaReviewMatch = selectedHederaReview === 'all' || selectedHederaReview === rowHederaReview;
            const hieroReviewMatch = selectedHieroReview === 'all' || selectedHieroReview === rowHieroReview;

            if (categoryMatch && statusMatch && hederaReviewMatch && hieroReviewMatch) {
                row.style.display = '';
                anyRowVisible = true;
            } else {
                row.style.display = 'none';
            }
        });

        noHipsMessage.style.display = anyRowVisible ? 'none' : 'block';
        updateTableVisibility();
    }

    function updateTableVisibility() {
        let anyTableVisible = false;
        document.querySelectorAll('.hipstable').forEach(table => {
            const isVisible = Array.from(table.querySelectorAll('tbody tr')).some(row => row.style.display !== 'none');
            anyTableVisible = anyTableVisible || isVisible;
            table.style.display = isVisible ? '' : 'none';
            const heading = table.previousElementSibling;
            heading.style.display = isVisible ? '' : 'none';
        });
        noHipsMessage.textContent = anyTableVisible ? '' : 'No HIPs match this filter.';
    }

    function bindEventListeners() {
        if (hederaReviewFilters.length > 0) {
            hederaReviewFilters.forEach(filter => filter.addEventListener('change', filterRows));
        }
        if (hieroApprovalFilters.length > 0) {
            hieroApprovalFilters.forEach(filter => filter.addEventListener('change', filterRows));
        }
    }
    
    bindEventListeners();
    filterRows();
});