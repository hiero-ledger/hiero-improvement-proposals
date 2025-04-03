class HIPPRIntegration {
    constructor() {
        // Wait for full page load to ensure all elements are available
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('Initializing HIP PR Integration');
        if (this.isMainPage()) {
            this.setupStyles();
            this.initialize();
        } else {
            console.log('Not on main page, skipping initialization');
        }
    }

    isMainPage() {
        const isMainPath = window.location.pathname === '/' || 
                          window.location.pathname === '/index.html' ||
                          window.location.pathname.endsWith('/HIPs/') ||
                          window.location.pathname === '/hips/';
                          
        const hasMainPageElements = document.querySelector('.hip-filters') !== null;
        const layout = document.querySelector('body')?.dataset?.layout;
        const title = document.querySelector('body')?.dataset?.title;
        
        console.log('Page Check:', {
            path: window.location.pathname,
            isMainPath,
            hasMainPageElements,
            layout,
            title
        });
        
        return isMainPath || (layout === 'page' && title === 'HIPs');
    }

    setupStyles() {
        if (!document.querySelector('#hip-modal-styles')) {
            const styles = `
                .hip-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .hip-modal-content {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    max-width: 80%;
                    max-height: 80vh;
                    overflow-y: auto;
                    position: relative;
                }
                .hip-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 10px;
                }
                .close-button {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                }
                .hip-modal-body {
                    line-height: 1.6;
                }
                .hip-modal-body img {
                    max-width: 100%;
                }
                .draft-hip-section {
                    margin-top: 30px;
                    margin-bottom: 30px;
                }
                .draft-label {
                    background-color: #f0ad4e;
                    color: white;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 0.8em;
                    margin-left: 5px;
                }
            `;
            const styleSheet = document.createElement('style');
            styleSheet.id = 'hip-modal-styles';
            styleSheet.textContent = styles;
            document.head.appendChild(styleSheet);
        }
    }

    async initialize() {
        try {
            console.log('Starting initialization');
            const prData = await this.fetchPRData();
            
            if (prData && Array.isArray(prData) && prData.length > 0) {
                console.log(`Fetched ${prData.length} PRs successfully`);
                // We'll trust the backend filtering but still do our own validation
                const validHips = await this.processHIPPRs(prData);
                
                if (validHips.length > 0) {
                    console.log(`Found ${validHips.length} valid HIPs`);
                    this.addHIPsToTable(validHips);
                } else {
                    console.log('No valid HIPs found');
                }
            } else {
                console.log('No PR data available or empty dataset');
            }
        } catch (error) {
            console.error('Failed to initialize PR integration:', error);
        }
    }

    async fetchPRData() {
        try {
            console.log('Fetching PR data...');
            // Get base URL from meta tag or default to empty string
            const baseUrl = document.querySelector('meta[name="site-baseurl"]')?.content || '';
            const timestamp = new Date().getTime(); // Add cache busting
            const url = `${baseUrl}/_data/draft_hips.json?t=${timestamp}`;
            console.log('Fetching from URL:', url);
            
            const response = await fetch(url, { 
                cache: 'no-store' // Ensure we don't get cached data
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch draft HIPs data: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Successfully fetched PR data');
            return data;
        } catch (error) {
            console.error('Error in fetchPRData:', error);
            throw error;
        }
    }

    async processHIPPRs(prs) {
        console.log('Processing HIPs from PRs...');
        const validHips = [];
        const seenPRs = new Set();

        for (const pr of prs) {
            // Skip if we've already seen this PR number
            if (seenPRs.has(pr.number)) {
                console.log(`Skipping duplicate PR: ${pr.number}`);
                continue;
            }
            
            try {
                // Find markdown files that could be HIPs
                const mdFiles = pr.files.edges
                    .filter(file => {
                        const path = file.node.path;
                        return path.endsWith('.md') && 
                               path.includes('/hip-') && 
                               !path.includes('/template');
                    });
                
                console.log(`Found ${mdFiles.length} potential HIP markdown files in PR ${pr.number}`);
                
                if (mdFiles.length === 0) {
                    console.log(`PR ${pr.number} doesn't contain valid HIP files, skipping`);
                    continue;
                }
                
                let bestMetadata = null;
                let bestFile = null;

                for (const file of mdFiles) {
                    try {
                        const contentUrl = `https://raw.githubusercontent.com/hiero-ledger/hiero-improvement-proposals/${pr.headRefOid}/${file.node.path}`;
                        console.log(`Fetching content from: ${contentUrl}`);
                        
                        const response = await fetch(contentUrl);
                        if (!response.ok) {
                            console.warn(`Failed to fetch file content from ${contentUrl}: ${response.status}`);
                            continue;
                        }
                        
                        const content = await response.text();
                        const metadata = this.parseHIPMetadata(content);

                        // Skip template files or files without proper metadata
                        if (!metadata.title || metadata.title.trim() === '') {
                            console.log(`Skipping file without valid title: ${file.node.path}`);
                            continue;
                        }

                        // If this is our first valid metadata or it's better than what we have
                        if (!bestMetadata || 
                            (metadata.title && metadata.title.length > bestMetadata.title.length)) {
                            console.log(`Found better metadata in file: ${file.node.path}`);
                            bestMetadata = metadata;
                            bestFile = file.node;
                        }
                    } catch (error) {
                        console.error(`Error processing file ${file.node.path}:`, error);
                    }
                }

                if (bestMetadata && bestFile) {
                    console.log(`Adding valid HIP from PR ${pr.number}: ${bestMetadata.title}`);
                    validHips.push({
                        pr,
                        metadata: bestMetadata,
                        filePath: bestFile.path
                    });
                    seenPRs.add(pr.number);
                } else {
                    console.log(`No valid metadata found in PR ${pr.number}, skipping`);
                }
            } catch (err) {
                console.error(`Error processing PR ${pr.number}:`, err);
            }
        }

        console.log(`Processing complete. Found ${validHips.length} valid HIPs`);
        return validHips;
    }

    parseHIPMetadata(content) {
        const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (!frontmatterMatch) {
            console.log('No frontmatter found in content');
            return {};
        }

        const metadata = {};
        const lines = frontmatterMatch[1].split('\n');

        for (const line of lines) {
            // Handle multi-line values and proper key-value splitting
            if (line.trim() === '' || !line.includes(':')) continue;
            
            const colonIndex = line.indexOf(':');
            const key = line.substring(0, colonIndex).trim().toLowerCase();
            const value = line.substring(colonIndex + 1).trim();
            
            if (key && value) {
                metadata[key] = value;
            }
        }

        return metadata;
    }

    addHIPsToTable(hips) {
        console.log('Adding HIPs to table');
        const wrapper = document.querySelector('main .wrapper');
        if (!wrapper) {
            console.error('Could not find wrapper element');
            return;
        }

        // Check if section already exists, remove it if it does
        const existingSection = document.getElementById('draft-hip-section');
        if (existingSection) {
            existingSection.remove();
        }

        // Find status reference point - usually the last status section or fall back to first element
        const referencePoint = wrapper.querySelector('h2[id]:last-of-type') || wrapper.firstElementChild;
        
        // Create draft section
        const draftContainer = document.createElement('div');
        draftContainer.id = 'draft-hip-section';
        draftContainer.className = 'draft-hip-section';
        draftContainer.innerHTML = `
            <h2 id="draft-hips">Draft PRs <span class="status-tooltip" data-tooltip="Draft HIPs in Pull Requests">ⓘ</span></h2>
            <p>These are HIPs currently under development in pull requests.</p>
            <table class="hipstable draft-hip-table">
                <thead>
                    <tr>
                        <th class="numeric">PR #</th>
                        <th>Title</th>
                        <th>Author</th>
                        <th>Needs Council Approval</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;

        // Insert after the reference point
        if (referencePoint.nextSibling) {
            wrapper.insertBefore(draftContainer, referencePoint.nextSibling);
        } else {
            wrapper.appendChild(draftContainer);
        }
        
        const tbody = draftContainer.querySelector('tbody');

        // Add each HIP to the table
        hips.forEach(({ pr, metadata }) => {
            if (!metadata.title || metadata.title.trim() === '') {
                console.log(`Skipping HIP with empty title from PR ${pr.number}`);
                return;
            }

            // Determine if this HIP needs council approval
            const needsApproval = String(metadata['needs-council-approval'] || '')?.toLowerCase() === 'true' ||
                String(metadata['needs-tsc-approval'] || '')?.toLowerCase() === 'true' ||
                String(metadata.needs_council_approval || '')?.toLowerCase() === 'true' ||
                metadata.type?.toLowerCase() === 'standards track';

            // Create row with appropriate data attributes
            const row = document.createElement('tr');
            row.dataset.type = (metadata.type || 'core').toLowerCase();
            row.dataset.status = 'draft';
            row.dataset.councilApproval = needsApproval.toString();
            row.dataset.category = metadata.category || '';
            row.dataset.prNumber = pr.number;

            // Process authors - handle different author formats
            let authorsHtml = 'Unknown';
            if (metadata.author) {
                const authors = metadata.author.split(',').map(author => {
                    const trimmedAuthor = author.trim();
                    // Match name and optional contact info
                    const match = trimmedAuthor.match(/([^<(]+)(?:[<(]([^>)]+)[>)])?/);
                    if (!match) return trimmedAuthor;

                    const name = match[1].trim();
                    const linkInfo = match[2]?.trim();

                    if (linkInfo) {
                        if (linkInfo.startsWith('@')) {
                            // GitHub username
                            const username = linkInfo.substring(1);
                            return `<a href="https://github.com/${username}" target="_blank">${name}</a>`;
                        } else if (linkInfo.includes('@')) {
                            // Email address
                            return `<a href="mailto:${linkInfo}">${name}</a>`;
                        }
                    }
                    return name;
                });
                authorsHtml = authors.join(', ');
            }

            // Build the row
            row.innerHTML = `
                <td class="hip-number"><a href="${pr.url}" target="_blank">PR-${pr.number}</a></td>
                <td class="title"><a href="${pr.url}" target="_blank">${metadata.title}</a></td>
                <td class="author">${authorsHtml}</td>
                <td class="council-approval">${needsApproval ? 'Yes' : 'No'}</td>
            `;

            tbody.appendChild(row);
        });

        // Set up sorting for the table
        this.setupTableSorting(draftContainer.querySelector('.hipstable'));
        console.log('Finished adding HIPs to table');
    }

    setupTableSorting(table) {
        if (!table) return;
        
        table.querySelectorAll('th').forEach((header, index) => {
            header.style.cursor = 'pointer';
            header.title = 'Click to sort';
            
            header.addEventListener('click', function() {
                const tbody = table.querySelector('tbody');
                const isAscending = header.classList.contains('asc');
                const isNumeric = header.classList.contains('numeric') || index === 0; // First column is PR number
                
                // Sort rows
                Array.from(tbody.querySelectorAll('tr'))
                    .sort((rowA, rowB) => {
                        let cellA = rowA.querySelectorAll('td')[index].textContent;
                        let cellB = rowB.querySelectorAll('td')[index].textContent;

                        // For PR numbers
                        if (isNumeric && cellA.startsWith('PR-') && cellB.startsWith('PR-')) {
                            const numA = parseInt(cellA.replace('PR-', ''));
                            const numB = parseInt(cellB.replace('PR-', ''));
                            return (isAscending ? numB - numA : numA - numB);
                        }

                        // For other numeric columns
                        if (isNumeric) {
                            return isAscending ? 
                                parseFloat(cellB) - parseFloat(cellA) : 
                                parseFloat(cellA) - parseFloat(cellB);
                        }
                        
                        // For text columns
                        return isAscending ? 
                            cellB.localeCompare(cellA) : 
                            cellA.localeCompare(cellB);
                    })
                    .forEach(tr => tbody.appendChild(tr));

                // Update header classes
                header.classList.toggle('asc', !isAscending);
                header.classList.toggle('desc', isAscending);

                // Remove sorting classes from other headers
                Array.from(header.parentNode.children)
                    .filter(th => th !== header)
                    .forEach(th => th.classList.remove('asc', 'desc'));
            });
        });
    }
}

// Initialize when the script loads
console.log('PR Integration script loaded at:', new Date().toISOString());
new HIPPRIntegration();