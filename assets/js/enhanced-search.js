class EnhancedHIPSearch {
    constructor(options) {
        this.searchInput = options.searchInput;
        this.resultsContainer = options.resultsContainer;
        this.publishedHipsUrl = options.publishedHipsUrl;
        this.draftHipsUrl = options.draftHipsUrl;
        this.noResultsText = options.noResultsText || 'No results found';
        this.limit = options.limit || 15;
        
        this.publishedHips = [];
        this.draftHips = [];
        this.isLoading = false;
        
        this.init();
    }
    
    async init() {
        await this.loadData();
        this.setupEventListeners();
    }
    
    async loadData() {
        try {
            // Load published HIPs
            const publishedResponse = await fetch(this.publishedHipsUrl);
            this.publishedHips = await publishedResponse.json();
            
            // Load draft HIPs
            const draftResponse = await fetch(this.draftHipsUrl);
            this.draftHips = await draftResponse.json();
        } catch (error) {
            console.error('Error loading search data:', error);
        }
    }
    
    setupEventListeners() {
        this.searchInput.addEventListener('input', this.debounce(() => {
            this.performSearch();
        }, 300));
        
        this.searchInput.addEventListener('focus', () => {
            if (this.searchInput.value.trim() && this.resultsContainer.children.length > 0) {
                this.showResults();
            }
        });
        
        // Hide results when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.searchInput.contains(e.target) && !this.resultsContainer.contains(e.target)) {
                this.hideResults();
            }
        });
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    performSearch() {
        const query = this.searchInput.value.trim().toLowerCase();
        
        if (!query) {
            this.hideResults();
            return;
        }
        
        const results = this.searchAllHips(query);
        this.displayResults(results);
    }
    
    searchAllHips(query) {
        const allResults = [];
        
        // Search published HIPs
        const publishedResults = this.searchHips(this.publishedHips, query, 'published');
        allResults.push(...publishedResults);
        
        // Search draft HIPs
        const draftResults = this.searchHips(this.draftHips, query, 'draft');
        allResults.push(...draftResults);
        
        // Sort by relevance (exact matches first, then partial matches)
        allResults.sort((a, b) => {
            const aExact = this.isExactMatch(a, query);
            const bExact = this.isExactMatch(b, query);
            
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            
            return 0;
        });
        
        return allResults.slice(0, this.limit);
    }
    
    searchHips(hips, query, type) {
        return hips
            .filter(hip => this.matchesQuery(hip, query, type))
            .map(hip => ({
                ...hip,
                type: type,
                url: this.getHipUrl(hip, type)
            }));
    }
    
    matchesQuery(hip, query, type) {
        const searchFields = [];
        
        if (type === 'published') {
            searchFields.push(
                hip.title || '',
                hip.hipnum || '',
                hip.category || '',
                hip.content || ''
            );
        } else if (type === 'draft') {
            searchFields.push(
                hip.title || '',
                hip.number ? hip.number.toString() : ''
            );
        }
        
        return searchFields.some(field => 
            field.toLowerCase().includes(query)
        );
    }
    
    isExactMatch(hip, query) {
        const title = (hip.title || '').toLowerCase();
        const hipnum = hip.hipnum || hip.number?.toString() || '';
        
        return title === query || 
               hipnum === query || 
               title.includes(query) && title.startsWith(query);
    }
    
    getHipUrl(hip, type) {
        if (type === 'published') {
            // For published HIPs, use the URL from search.json
            return hip.url;
        } else if (type === 'draft') {
            // For draft HIPs, use the GitHub PR URL from draft_hips.json
            return hip.url;
        }
        return '#';
    }
    
    displayResults(results) {
        this.resultsContainer.innerHTML = '';
        
        if (results.length === 0) {
            const noResultsItem = document.createElement('li');
            noResultsItem.className = 'search-no-results';
            noResultsItem.textContent = this.noResultsText;
            this.resultsContainer.appendChild(noResultsItem);
        } else {
            results.forEach(result => {
                const listItem = this.createResultItem(result);
                this.resultsContainer.appendChild(listItem);
            });
        }
        
        this.showResults();
    }
    
    createResultItem(result) {
        const listItem = document.createElement('li');
        listItem.className = `search-result search-result--${result.type}`;
        
        const link = document.createElement('a');
        link.href = result.url;
        link.target = result.type === 'draft' ? '_blank' : '_self';
        
        // Create title with HIP number
        const hipNumber = result.type === 'published' ? result.hipnum : result.number;
        const title = result.title || 'Untitled';
        const displayTitle = hipNumber ? `HIP-${hipNumber}: ${title}` : title;
        
        link.innerHTML = `
            <div class="search-result__title">${this.escapeHtml(displayTitle)}</div>
            <div class="search-result__meta">
                <span class="search-result__type">${result.type === 'draft' ? 'Draft PR' : 'Published'}</span>
                ${result.category ? `<span class="search-result__category">${this.escapeHtml(result.category)}</span>` : ''}
            </div>
        `;
        
        listItem.appendChild(link);
        return listItem;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    showResults() {
        this.resultsContainer.classList.add('results-visible');
    }
    
    hideResults() {
        this.resultsContainer.classList.remove('results-visible');
    }
}

// Make the class available globally
window.EnhancedHIPSearch = EnhancedHIPSearch;