<!-- HIP Information Header -->
<div class="hip-info-header">
    <h2>About Hiero Improvement Proposals (HIPs)</h2>
    <p>
        <strong>Hiero Improvement Proposals (HIPs)</strong> are design documents that propose new features, 
        collect community input, and document design decisions for the Hiero codebase. HIPs are the primary 
        mechanism for proposing changes to the Hiero network and ecosystem.
    </p>
    <p>
        The table below shows all HIPs organized by status. Each HIP progresses through various stages 
        from Draft to Final implementation. To learn more about the HIP process or submit your own proposal:
    </p>
    <div class="hip-links">
        <a href="HIP/hip-1.html" class="hip-process-link">📖 Read HIP-1: HIP Process</a><br>
        <a href="https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/hip-0000-template.md" 
           class="hip-template-link" target="_blank">🚀 Use the HIP Template</a>
    </div>
</div>

<div class="hip-filters filter-wrap">
    <div class="filter-group">
        <h4>Type&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</h4>
        <select id="type-filter" class="type-filter" multiple>
            <option value="core">Core</option>
            <option value="service">Service</option>
            <option value="mirror">Mirror</option>
            <option value="application">Application</option>
            <option value="informational">Informational</option>
            <option value="process">Process</option>
            <option value="block node">Block Node</option>
        </select>
    </div>
    
    <div class="filter-group">
        <h4>Status&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</h4>
        <select id="status-filter" class="status-filter" multiple>
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="last call">Last Call</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="final">Final</option>
            <option value="active">Active</option>
            <option value="replaced">Replaced</option>
            <option value="stagnant">Stagnant</option>
            <option value="deferred">Deferred</option>
            <option value="withdrawn">Withdrawn</option>
        </select>
    </div>
    <div class="filter-group">
        <h4>Hiero Approval&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</h4>
        <label>
            <input type="radio" name="hiero-review-filter" class="hiero-filter" value="true"> Yes
        </label>
        <label>
            <input type="radio" name="hiero-review-filter" class="hiero-filter" value="false"> No
        </label>
    </div>
    
    <div class="filter-group">
        <h4>Hedera Review&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</h4>
        <label>
            <input type="radio" name="hedera-review-filter" class="hedera-filter" value="true"> Yes
        </label>
        <label>
            <input type="radio" name="hedera-review-filter" class="hedera-filter" value="false"> No
        </label>
    </div>
    
</div>

<div class="no-hips-message" style="display: none;">
    No HIPs exist for this filter.
</div>

<!-- First render the draft section -->
<h2 id="draft">Draft <span class="status-tooltip" data-tooltip="Draft">ⓘ</span></h2>
<table class="hipstable draft-table">
    <thead>
        <tr>
            <th class="numeric">Number</th>
            <th>Title</th>
            <th>Author</th>
            <th>Needs Hiero Approval</th>
            <th>Needs Hedera Review</th>
        </tr>
    </thead>
    <tbody class="draft-tbody"></tbody>
</table>

<!-- Then render the rest of the statuses -->
{% for status in site.data.statuses %}
    {% if status == "Accepted" %}
        {% continue %}
    {% endif %}
    
    {% if status == "Approved" %}
        <!-- Combine Approved and Accepted HIPs under "Approved" -->
        {% assign approved_hips = include.hips | where: "status", "Approved" | where: "category", category | where: "type", type | sort: "hip" | reverse %}
        {% assign accepted_hips = include.hips | where: "status", "Accepted" | where: "category", category | where: "type", type | sort: "hip" | reverse %}
        {% assign combined_hips = approved_hips | concat: accepted_hips | sort: "hip" | reverse %}
        {% assign count = combined_hips.size %}
        {% if count > 0 %}
            <h2 id="approved">
                Approved
                <span class="status-tooltip" data-tooltip="Approved">ⓘ</span>
            </h2>
            
            <table class="hipstable">
                <thead>
                    <tr>
                        <th class="numeric">Number</th>
                        <th>Title</th>
                        <th>Author</th>
                        <th>Needs Hiero Approval</th>
                        <th>Needs Hedera Review</th>
                        <th class="numeric version">Release</th>
                    </tr>
                </thead>
                <tbody>
                    {% for page in combined_hips %}
                        <tr data-type="{{ page.type | downcase }}"
                            data-category="{{ page.category | downcase }}"
                            data-status="approved"
                            data-hedera-review="{{ page.needs-hedera-review | default: page.needs-council-approval | default: false | downcase }}"
                            data-council-review="{{ page.needs-council-approval | default: false | downcase }}"
                            data-hedera-review-date="{{ page.hedera-review-date }}"
                            data-hiero-review="{{ page.needs-hiero-approval | downcase }}">
                            
                            <td class="hip-number">
                                <a href="{{ page.url | relative_url }}">{{ page.hip | xml_escape }}</a>
                            </td>
                            
                            <td class="title">
                                <a href="{{ page.url | relative_url }}">{{ page.title | xml_escape }}</a>
                            </td>
                            
                            <td class="author">
                                {% include authorslist.html authors=page.author %}
                            </td>
                            
                            <td class="hiero-review" data-label="Needs Hiero Approval">
                                {% if page.needs-hiero-approval %}
                                    Yes
                                {% else %}
                                    No
                                {% endif %}
                            </td>
                            
                            <td class="hedera-review" data-label="Needs Hedera Review">
                                {% if page.needs-hedera-review or page.needs-council-approval %}
                                    Yes
                                {% else %}
                                    No
                                {% endif %}
                            </td>
                            
                            {% if page.category == "Mirror" %}
                                <td class="release">
                                    <a href="https://github.com/hiero-ledger/hiero-mirror-node/releases/tag/{{page.release}}">
                                        {{page.release|xml_escape}}
                                    </a>
                                </td>
                            {% else %}
                                <td class="release">
                                    <a href="https://github.com/hashgraph/hedera-services/releases/tag/{{page.release}}">
                                        {{page.release|xml_escape}}
                                    </a>
                                </td>
                            {% endif %}
                        </tr>
                    {% endfor %}
                </tbody>
            </table>
        {% endif %}
    {% else %}
        {% assign hips = include.hips | where: "status", status | where: "category", category | where: "type", type | sort: "hip" | reverse %}
        {% assign count = hips.size %}
        {% if count > 0 %}
            <h2 id="{{ status | slugify }}">
                {{ status | capitalize }} 
                <span class="status-tooltip" data-tooltip="{{ status }}">ⓘ</span>
            </h2>
            
            <table class="hipstable">
                <thead>
                    <tr>
                        <th class="numeric">Number</th>
                        <th>Title</th>
                        <th>Author</th>
                        <th>Needs Hiero Approval</th>
                        <th>Needs Hedera Review</th>
                        {% if status == "Last Call" %}
                            <th>Last Call Period Ends</th>
                        {% else %}
                            <th class="numeric version">Release</th>
                        {% endif %}
                    </tr>
                </thead>
                <tbody>
                    {% for page in hips %}
                        <tr data-type="{{ page.type | downcase }}"
                            data-category="{{ page.category | downcase }}"
                            data-status="{{ page.status | downcase }}"
                            data-hedera-review="{{ page.needs-hedera-review | default: page.needs-council-approval | default: false | downcase }}"
                            data-council-review="{{ page.needs-council-approval | default: false | downcase }}"
                            data-hedera-review-date="{{ page.hedera-review-date }}"
                            data-hiero-review="{{ page.needs-hiero-approval | downcase }}">
                            
                            <td class="hip-number">
                                <a href="{{ page.url | relative_url }}">{{ page.hip | xml_escape }}</a>
                            </td>
                            
                            <td class="title">
                                <a href="{{ page.url | relative_url }}">{{ page.title | xml_escape }}</a>
                            </td>
                            
                            <td class="author">
                                {% include authorslist.html authors=page.author %}
                            </td>
                            
                            <td class="hiero-review" data-label="Needs Hiero Approval">
                                {% if page.needs-hiero-approval %}
                                    Yes
                                {% else %}
                                    No
                                {% endif %}
                            </td>
                            
                            <td class="hedera-review" data-label="Needs Hedera Review">
                                {% if page.needs-hedera-review or page.needs-council-approval %}
                                    Yes
                                {% else %}
                                    No
                                {% endif %}
                            </td>
                            
                            {% if status == "Last Call" %}
                                <td class="last-call-date-time">
                                    {{ page.last-call-date-time | date_to_rfc822 }}
                                </td>
                            {% else %}
                                {% if page.category == "Mirror" %}
                                    <td class="release">
                                        <a href="https://github.com/hiero-ledger/hiero-mirror-node/releases/tag/{{page.release}}">
                                            {{page.release|xml_escape}}
                                        </a>
                                    </td>
                                {% else %}
                                    <td class="release">
                                        <a href="https://github.com/hashgraph/hedera-services/releases/tag/{{page.release}}">
                                            {{page.release|xml_escape}}
                                        </a>
                                    </td>
                                {% endif %}
                            {% endif %}
                        </tr>
                    {% endfor %}
                </tbody>
            </table>
        {% endif %}
    {% endif %}
{% endfor %}