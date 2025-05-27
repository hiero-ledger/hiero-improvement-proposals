/**
 * Enhanced Search Script for HIPs
 * Combines regular HIPs with draft HIPs from PR data
 */

class EnhancedHIPSearch {
    constructor(options) {
        this.options = {
            searchInput: null,
            resultsContainer: null,
            publishedHipsUrl: './search.json',
            draftHipsUrl: './_data/draft_hips.json',
            noResultsText: 'No results found',
            limit: 10,
            ...options
        };
        
        this.publishedHips = [];
        this.draftHips = [];
        this.allHips = [];
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        try {
            console.log('Initializing Enhanced HIP Search...');
            
            // Load both published and draft HIPs
            await Promise.all([
                this.loadPublishedHips(),
                this.loadDraftHips()
            ]);
            
            // Combine and setup search
            this.combineData();
            this.setupEventListeners();
            this.isInitialized = true;
            
            console.log(`Enhanced search initialized with ${this.allHips.length} HIPs (${this.publishedHips.length} published, ${this.draftHips.length} draft)`);
        } catch (error) {
            console.error('Failed to initialize enhanced search:', error);
            // Fallback to basic search if available
            this.fallbackToBasicSearch();
        }
    }

    async loadPublishedHips() {
        try {
            const response = await fetch(this.options.publishedHipsUrl);
            if (!response.ok) {
                throw new Error(`Failed to load published HIPs: ${response.status}`);
            }
            this.publishedHips = await response.json();
            console.log(`Loaded ${this.publishedHips.length} published HIPs`);
        } catch (error) {
            console.error('Error loading published HIPs:', error);
            this.publishedHips = [];
        }
    }

    async loadDraftHips() {
        try {
            const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '');
            const draftUrl = `${baseUrl}/_data/draft_hips.json`;
            console.log('Loading draft HIPs from:', draftUrl);
            
            const response = await fetch(draftUrl);
            if (!response.ok) {
                throw new Error(`Failed to load draft HIPs: ${response.status} ${response.statusText}`);
            }
            const draftData = await response.json();
            this.draftHips = await this.processDraftHips(draftData);
            console.log(`Loaded ${this.draftHips.length} draft HIPs`);
        } catch (error) {
            console.error('Error loading draft HIPs:', error);
            // Try alternative URL path
            try {
                const altUrl = '/_data/draft_hips.json';
                console.log('Trying alternative URL:', altUrl);
                const response = await fetch(altUrl);
                if (response.ok) {
                    const draftData = await response.json();
                    this.draftHips = await this.processDraftHips(draftData);
                    console.log(`Loaded ${this.draftHips.length} draft HIPs from alternative URL`);
                } else {
                    this.draftHips = [];
                }
            } catch (altError) {
                console.error('Alternative URL also failed:', altError);
                this.draftHips = [];
            }
        }
    }

    async processDraftHips(draftData) {
        const processedDrafts = [];
        const seenPRs = new Set();

        for (const pr of draftData) {
            if (seenPRs.has(pr.number)) {
                continue;
            }

            // Look for markdown files that could be HIPs
            const mdFiles = pr.files.edges.filter(file => 
                file.node.path.endsWith('.md') && 
                !file.node.path.includes('template') &&
                (file.node.path.includes('HIP/') || file.node.path.includes('hip-'))
            );

            if (mdFiles.length === 0) {
                continue;
            }

            // For now, create a draft entry based on PR info and file paths
            // We'll enhance this later when we can access the actual content
            const bestFile = mdFiles[0]; // Take the first valid file
            
            // Extract potential HIP number from filename
            const hipNumberMatch = bestFile.node.path.match(/hip-(\d+)\.md/i);
            const potentialHipNum = hipNumberMatch ? hipNumberMatch[1] : null;

            // Create display format - just use HIP number if available, otherwise use a generic draft identifier
            const displayHipNum = potentialHipNum ? potentialHipNum : `Draft-${pr.number}`;

            // Create a searchable entry for this draft HIP
            processedDrafts.push({
                title: pr.title || `Draft HIP ${potentialHipNum || pr.number}`,
                hipnum: displayHipNum,
                category: 'draft',
                content: `${pr.title || ''} ${pr.author.login} draft pr pull request ${potentialHipNum || ''}`,
                url: pr.url,
                type: 'Draft HIP',
                status: 'draft',
                author: pr.author.login,
                prNumber: pr.number,
                filePath: bestFile.node.path,
                extractedHipNumber: potentialHipNum
            });
            
            seenPRs.add(pr.number);
        }

        console.log(`Processed ${processedDrafts.length} draft HIPs`);
        return processedDrafts;
    }

    parseHIPMetadata(content) {
        const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) {
            return {};
        }

        const metadata = {};
        const lines = frontmatterMatch[1].split('\n');

        for (const line of lines) {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length) {
                const value = valueParts.join(':').trim();
                metadata[key.trim().toLowerCase()] = value;
            }
        }

        return metadata;
    }

    combineData() {
        // Process published HIPs
        const processedPublished = this.publishedHips.map(hip => ({
            ...hip,
            type: `HIP-${hip.hipnum}`,
            status: 'published'
        }));

        // Combine all HIPs
        this.allHips = [...processedPublished, ...this.draftHips];
    }

    setupEventListeners() {
        if (!this.options.searchInput || !this.options.resultsContainer) {
            console.error('Search input or results container not found');
            return;
        }

        this.options.searchInput.addEventListener('keyup', (e) => {
            if (this.isWhitelistedKey(e.which)) {
                this.emptyResultsContainer();
                const query = e.target.value;
                if (this.isValidQuery(query)) {
                    const results = this.search(query);
                    this.render(results);
                }
            }
        });
    }

    search(query) {
        if (!query || query.length === 0) {
            return [];
        }

        const lowerQuery = query.toLowerCase();
        const results = [];

        console.log(`Searching for: "${query}" in ${this.allHips.length} total HIPs`);

        for (const hip of this.allHips) {
            const matchResult = this.calculateMatchScore(hip, lowerQuery);
            if (matchResult.matched) {
                results.push({ ...hip, score: matchResult.score });
            }
        }

        // Sort by score (descending) and limit results
        const sortedResults = results
            .sort((a, b) => b.score - a.score)
            .slice(0, this.options.limit);

        console.log(`Found ${results.length} matches, showing top ${sortedResults.length}`);
        return sortedResults;
    }

    calculateMatchScore(hip, lowerQuery) {
        let score = 0;
        let matched = false;

        const matchResults = [
            this.checkTitleMatch(hip, lowerQuery),
            this.checkHipNumberMatch(hip, lowerQuery),
            this.checkPrNumberMatch(hip, lowerQuery),
            this.checkCategoryMatch(hip, lowerQuery),
            this.checkContentMatch(hip, lowerQuery),
            this.checkAuthorMatch(hip, lowerQuery),
            this.checkDraftMatch(hip, lowerQuery)
        ];

        matchResults.forEach(result => {
            if (result.matched) {
                score += result.score;
                matched = true;
            }
        });

        return { score, matched };
    }

    checkTitleMatch(hip, lowerQuery) {
        if (this.checkField(hip.title, lowerQuery)) {
            const score = hip.title.toLowerCase().indexOf(lowerQuery) === 0 ? 10 : 5;
            return { score, matched: true };
        }
        return { score: 0, matched: false };
    }

    checkHipNumberMatch(hip, lowerQuery) {
        if (this.checkField(hip.hipnum, lowerQuery)) {
            return { score: 15, matched: true };
        }
        return { score: 0, matched: false };
    }

    checkPrNumberMatch(hip, lowerQuery) {
        if (hip.prNumber && lowerQuery.includes(hip.prNumber.toString())) {
            return { score: 12, matched: true };
        }
        return { score: 0, matched: false };
    }

    checkCategoryMatch(hip, lowerQuery) {
        if (this.checkField(hip.category, lowerQuery)) {
            return { score: 3, matched: true };
        }
        return { score: 0, matched: false };
    }

    checkContentMatch(hip, lowerQuery) {
        if (this.checkField(hip.content, lowerQuery)) {
            return { score: 1, matched: true };
        }
        return { score: 0, matched: false };
    }

    checkAuthorMatch(hip, lowerQuery) {
        if (this.checkField(hip.author, lowerQuery)) {
            return { score: 4, matched: true };
        }
        return { score: 0, matched: false };
    }

    checkDraftMatch(hip, lowerQuery) {
        if (lowerQuery.includes('draft') && hip.status === 'draft') {
            return { score: 8, matched: true };
        }
        return { score: 0, matched: false };
    }

    checkField(field, query) {
        return field && field.toLowerCase().includes(query);
    }

    render(results) {
        this.clearResults();
        
        if (results.length === 0) {
            this.addNoResultsMessage();
            return;
        }

        results.forEach(result => this.addResultItem(result));
    }

    clearResults() {
        while (this.options.resultsContainer.firstChild) {
            this.options.resultsContainer.removeChild(this.options.resultsContainer.firstChild);
        }
    }

    addNoResultsMessage() {
        const li = document.createElement('li');
        li.textContent = this.options.noResultsText;
        this.options.resultsContainer.appendChild(li);
    }

    addResultItem(result) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        
        // Safely set attributes
        a.href = this.sanitizeUrl(result.url);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        
        // Create safe content
        const displayTitle = this.createDisplayTitle(result);
        const displayType = result.status === 'draft' ? 'Draft HIP' : 'HIP';
        
        // Create bold element for type
        const typeElement = document.createElement('b');
        typeElement.textContent = displayType + ':';
        
        // Add icon
        const icon = document.createElement('span');
        try {
            const parsedUrl = new URL(result.url);
            icon.textContent = parsedUrl.host === 'github.com' ? '📝 ' : '📄 ';
        } catch (e) {
            console.warn('Invalid URL provided:', result.url);
            icon.textContent = '📄 ';
        }
        
        // Assemble the link content safely
        a.appendChild(icon);
        a.appendChild(typeElement);
        a.appendChild(document.createTextNode(' ' + displayTitle));
        
        li.appendChild(a);
        this.options.resultsContainer.appendChild(li);
    }

    createDisplayTitle(result) {
        if (result.status === 'draft') {
            if (result.extractedHipNumber) {
                return `HIP-${result.hipnum}: ${result.title}`;
            } else {
                return `Draft HIP: ${result.title}`;
            }
        } else {
            return `HIP-${result.hipnum}: ${result.title}`;
        }
    }

    sanitizeUrl(url) {
        try {
            const validUrl = new URL(url);
            // Only allow http and https protocols
            if (validUrl.protocol === 'http:' || validUrl.protocol === 'https:') {
                return validUrl.href;
            }
        } catch (e) {
            console.warn('Invalid URL provided:', url);
        }
        return '#';
    }

    emptyResultsContainer() {
        this.clearResults();
    }

    isValidQuery(query) {
        return query && query.length > 0;
    }

    isWhitelistedKey(key) {
        return [13, 16, 20, 37, 38, 39, 40, 91].indexOf(key) === -1;
    }

    fallbackToBasicSearch() {
        console.log('Falling back to basic SimpleJekyllSearch');
        if (window.SimpleJekyllSearch) {
            window.SimpleJekyllSearch({
                searchInput: this.options.searchInput,
                resultsContainer: this.options.resultsContainer,
                json: this.options.publishedHipsUrl,
                searchResultTemplate: this.createBasicResultTemplate(),
                noResultsText: this.options.noResultsText,
                limit: this.options.limit
            });
        }
    }

    createBasicResultTemplate() {
        // Return a template function that creates DOM elements
        return function(item) {
            const li = document.createElement('li');
            const a = document.createElement('a');
            const b = document.createElement('b');
            
            a.href = item.url;
            b.textContent = `HIP-${item.hipnum}:`;
            a.appendChild(b);
            a.appendChild(document.createTextNode(` ${item.title}`));
            li.appendChild(a);
            
            return li.outerHTML;
        };
    }
}

// Export for use
window.EnhancedHIPSearch = EnhancedHIPSearch;
