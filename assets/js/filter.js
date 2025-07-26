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
        const rawSelectedTypes = $('#type-filter').val();
        let selectedTypesForFilter = [];

        if (Array.isArray(rawSelectedTypes)) {
            selectedTypesForFilter = rawSelectedTypes
                .map(type => (typeof type === 'string' ? type.trim().toLowerCase() : ''))
                .filter(type => type !== '');
        } else if (typeof rawSelectedTypes === 'string' && rawSelectedTypes.trim() !== '') {
            selectedTypesForFilter = [rawSelectedTypes.trim().toLowerCase()];
        }

        const rawSelectedStatuses = statusSelect.val();
        const selectedStatuses = rawSelectedStatuses && rawSelectedStatuses.length > 0 ? rawSelectedStatuses.map(s => s.toLowerCase()) : ['all'];
        const selectedHederaReview = document.querySelector('input[name="hedera-review-filter"]:checked')?.value || 'all';
        const selectedHieroReview = document.querySelector('input[name="hiero-review-filter"]:checked')?.value || 'all';
        
        let anyRowVisible = false;
        document.querySelectorAll('.hipstable tbody tr').forEach(row => {
            const typeAttr = row.getAttribute('data-type');
            const rowType = typeAttr ? typeAttr.trim().toLowerCase() : '';
            const categoryAttr = row.getAttribute('data-category');
            const rowCategory = categoryAttr ? categoryAttr.trim().toLowerCase() : '';

            const statusAttr = row.getAttribute('data-status');
            const rowStatus = statusAttr ? statusAttr.trim().toLowerCase() : 'unknown'; // Default to a non-matching status if missing
            
            const hederaReviewAttr = row.getAttribute('data-hedera-review');
            const councilReviewAttr = row.getAttribute('data-council-review');
            const rowHederaReview = (hederaReviewAttr === 'true' || councilReviewAttr === 'true') ? 'true' : 'false';
                                   
            const hieroReviewAttr = row.getAttribute('data-hiero-review');
            const rowHieroReview = hieroReviewAttr ? hieroReviewAttr : 'false'; 

            let typeMatch = true; 
            if (selectedTypesForFilter.length > 0) { // Apply filter only if types are selected
                // For Standards Track HIPs, check the category; for Informational/Process HIPs, check the type
                if (rowType === 'standards track') {
                    // Standards Track HIPs: check against category (core, service, mirror, application, block node)
                    const hipCategories = rowCategory.split(',').map(cat => cat.trim());
                    typeMatch = selectedTypesForFilter.some(selType => hipCategories.includes(selType));
                } else {
                    // Informational/Process HIPs: check against type (informational, process)
                    typeMatch = selectedTypesForFilter.includes(rowType);
                }
            }
            
            const statusMatch = selectedStatuses.includes('all') || 
                            selectedStatuses.includes(rowStatus) ||
                            (selectedStatuses.includes('approved') && rowStatus === 'accepted');
            const hederaReviewMatch = selectedHederaReview === 'all' || selectedHederaReview === rowHederaReview;
            const hieroReviewMatch = selectedHieroReview === 'all' || selectedHieroReview === rowHieroReview;

            if (typeMatch && statusMatch && hederaReviewMatch && hieroReviewMatch) {
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
            const visibleRows = Array.from(table.querySelectorAll('tbody tr')).filter(row => row.style.display !== 'none');
            const isVisible = visibleRows.length > 0;
            anyTableVisible = anyTableVisible || isVisible;
            table.style.display = isVisible ? '' : 'none';
            const heading = table.previousElementSibling;
            if (heading && heading.tagName === 'H2') {
                heading.style.display = isVisible ? '' : 'none';
            }
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