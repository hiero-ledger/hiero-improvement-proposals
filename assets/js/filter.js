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
        let selectedCategoriesForFilter = $('#type-filter').val();
        if (!selectedCategoriesForFilter || selectedCategoriesForFilter.length === 0) {
            // If no categories are selected in the filter, treat all categories as selected (i.e., don't filter by category)
        }

        const selectedStatuses = statusSelect.val().length > 0 ? statusSelect.val() : ['all'];
        const selectedHederaReview = document.querySelector('input[name="hedera-review-filter"]:checked')?.value || 'all';
        const selectedHieroReview = document.querySelector('input[name="hiero-review-filter"]:checked')?.value || 'all';
        
        let anyRowVisible = false;
        document.querySelectorAll('.hipstable tbody tr').forEach(row => {
            const rowCategories = row.getAttribute('data-category').trim().toLowerCase().split(',').map(cat => cat.trim()).filter(cat => cat !== '');
            const rowStatus = row.getAttribute('data-status').trim().toLowerCase();
            
            const rowHederaReview = row.getAttribute('data-hedera-review') === 'true' || 
                                   row.getAttribute('data-council-review') === 'true' ? 'true' : 'false';
                                   
            const rowHieroReview = row.getAttribute('data-hiero-review') || 'false'; 

            let categoryMatch = true; // Default to true, meaning no category filter applied or matches
            if (selectedCategoriesForFilter && selectedCategoriesForFilter.length > 0) {
                // Apply category filter only if categories are selected
                categoryMatch = selectedCategoriesForFilter.every(selCat => rowCategories.includes(selCat));
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