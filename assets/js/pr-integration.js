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
            if (prData) {
                console.log('Fetched PR data successfully');
                const validHips = await this.filterHIPPRs(prData);
                if (validHips.length > 0) {
                    console.log(`Found ${validHips.length} valid HIPs`);
                    this.addHIPsToTable(validHips);
                } else {
                    console.log('No valid HIPs found');
                }
            }
        } catch (error) {
            console.error('Failed to initialize PR integration:', error);
        }
    }

    async fetchPRData() {
        try {
            console.log('Fetching PR data...');
            const baseUrl = document.querySelector('meta[name="site-baseurl"]')?.content || '';
            const url = `${baseUrl}/_data/draft_hips.json`;
            console.log('Fetching from URL:', url);
            
            const response = await fetch(url);
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

    async filterHIPPRs(prs) {
        console.log('Filtering HIPs from PRs...');
        const validHips = [];
        const seenPRs = new Set();

        for (const pr of prs) {
            if (seenPRs.has(pr.number)) {
                console.log(`Skipping duplicate PR: ${pr.number}`);
                continue;
            }

            const mdFiles = pr.files.edges.filter(file => file.node.path.endsWith('.md'));
            console.log(`Found ${mdFiles.length} markdown files in PR ${pr.number}`);
            
            let bestMetadata = null;
            let bestFile = null;

            for (const file of mdFiles) {
                try {
                    const contentUrl = `https://raw.githubusercontent.com/hiero-ledger/hiero-improvement-proposals/${pr.headRefOid}/${file.node.path}`;
                    console.log(`Fetching content from: ${contentUrl}`);
                    
                    const response = await fetch(contentUrl);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch file content: ${response.status}`);
                    }
                    
                    const content = await response.text();
                    const metadata = this.parseHIPMetadata(content);

                    if (file.node.path.includes('template') || !metadata.title) {
                        console.log(`Skipping template or invalid file: ${file.node.path}`);
                        continue;
                    }

                    if (!bestMetadata ||
                        (metadata.title && metadata.title.length > 3 &&
                            (!bestMetadata.title || metadata.title.length > bestMetadata.title.length))) {
                        console.log(`Found better metadata in file: ${file.node.path}`);
                        bestMetadata = metadata;
                        bestFile = file;
                    }
                } catch (error) {
                    console.error(`Error checking file ${file.node.path}:`, error);
                }
            }

            if (bestMetadata && bestFile) {
                console.log(`Adding valid HIP from PR ${pr.number}`);
                validHips.push({
                    pr,
                    metadata: bestMetadata,
                    filePath: bestFile.node.path
                });
                seenPRs.add(pr.number);
            }
        }

        console.log(`Filtering complete. Found ${validHips.length} valid HIPs`);
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
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length) {
                const value = valueParts.join(':').trim();
                metadata[key.trim().toLowerCase()] = value;
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

        const lastStatusSection = wrapper.lastElementChild;
        const draftContainer = document.createElement('div');
        draftContainer.innerHTML = `
            <h2 id="draft">Draft <span class="status-tooltip" data-tooltip="Draft">ⓘ</span></h2>
            <table class="hipstable">
                <thead>
                    <tr>
                        <th class="numeric">Number</th>
                        <th>Title</th>
                        <th>Author</th>
                        <th>Needs Hiero Approval</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `;

        wrapper.insertBefore(draftContainer, lastStatusSection.nextSibling);
        const tbody = draftContainer.querySelector('tbody');
        const table = draftContainer.querySelector('.hipstable');

        hips.forEach(({ pr, metadata }) => {
            if (!metadata.title || metadata.title.trim() === '') {
                console.log(`Skipping HIP with empty title from PR ${pr.number}`);
                return;
            }

            const needsApproval = String(metadata['needs-council-approval']).toLowerCase() === 'true' ||
                String(metadata['needs-hiero-approval']).toLowerCase() === 'true' ||
                String(metadata.needs_council_approval).toLowerCase() === 'true' ||
                metadata.type?.toLowerCase() === 'standards track';

            const row = document.createElement('tr');
            row.dataset.type = (metadata.type || 'core').toLowerCase();
            row.dataset.status = 'draft';
            row.dataset.councilApproval = needsApproval.toString();
            row.dataset.category = metadata.category || '';

            const authors = metadata.author.split(',').map(author => {
                const match = author.trim().match(/([^<(]+)(?:[<(]([^>)]+)[>)])?/);
                if (!match) return author.trim();

                const name = match[1].trim();
                const linkInfo = match[2]?.trim();

                if (linkInfo) {
                    if (linkInfo.startsWith('@')) {
                        const username = linkInfo.substring(1);
                        return `<a href="https://github.com/${username}">${name}</a>`;
                    } else if (linkInfo.includes('@')) {
                        return `<a href="mailto:${linkInfo}">${name}</a>`;
                    }
                }
                return name;
            });

            row.innerHTML = `
                <td class="hip-number"><a href="${pr.url}" target="_blank">PR-${pr.number}</a></td>
                <td class="title"><a href="${pr.url}" target="_blank">${metadata.title}</a></td>
                <td class="author">${authors.join(', ')}</td>
                <td class="council-approval">${needsApproval ? 'Yes' : 'No'}</td>
            `;

            tbody.appendChild(row);
        });

        this.setupTableSorting(table);
        console.log('Finished adding HIPs to table');
    }

    setupTableSorting(table) {
        table.querySelectorAll('th').forEach(header => {
            header.addEventListener('click', function() {
                const tbody = table.querySelector('tbody');
                const index = Array.from(header.parentNode.children).indexOf(header);
                const isAscending = header.classList.contains('asc');
                const isNumeric = header.classList.contains('numeric');
                const isVersion = header.classList.contains('version');

                Array.from(tbody.querySelectorAll('tr'))
                    .sort((rowA, rowB) => {
                        let cellA = rowA.querySelectorAll('td')[index].textContent;
                        let cellB = rowB.querySelectorAll('td')[index].textContent;

                        if (isNumeric && cellA.startsWith('PR-') && cellB.startsWith('PR-')) {
                            const numA = parseInt(cellA.replace('PR-', ''));
                            const numB = parseInt(cellB.replace('PR-', ''));
                            return (numA - numB) * (isAscending ? 1 : -1);
                        }

                        if (isVersion) {
                            cellA = cellA.replace('v', '').split('.').map(Number);
                            cellB = cellB.replace('v', '').split('.').map(Number);
                            return cellA > cellB ? (isAscending ? 1 : -1) : cellA < cellB ? (isAscending ? -1 : 1) : 0;
                        }

                        return isNumeric ? 
                            (parseFloat(cellA) - parseFloat(cellB)) * (isAscending ? 1 : -1) : 
                            cellA.localeCompare(cellB) * (isAscending ? 1 : -1);
                    })
                    .forEach(tr => tbody.appendChild(tr));

                header.classList.toggle('asc', !isAscending);
                header.classList.toggle('desc', isAscending);

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
