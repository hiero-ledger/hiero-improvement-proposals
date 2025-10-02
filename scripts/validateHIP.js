const fs = require('fs');
const https = require('https');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m'
};

// Get API key from environment variable or use a fallback for development
const API_KEY = process.env.VERTESIA_API_KEY || '';


/**
 * Validates a HIP file by sending it to the Vertesia API endpoint.
 *
 * @async
 * @function validateHIP
 * @param {string} hipPath - Path to the HIP file.
 */
async function validateHIP(hipPath) {
  try {
    const hip = hipPath || process.argv[2];

    // Skip validation for hipstable files
    if (hip.includes('hipstable')) {
      console.log(`${colors.green}${colors.bold}✓ Great Success${colors.reset}`);
      return;
    }

    console.log(`${colors.cyan}Validating ${hip}${colors.reset}`);

    // Read the HIP file content
    let draftHip = fs.readFileSync(hip, 'utf8');

    // Clean up special characters that can break JSON encoding
    // Replace common problematic Unicode characters with ASCII equivalents
    draftHip = draftHip
      .replace(/—/g, '-')  // em dash to hyphen
      .replace(/–/g, '-')  // en dash to hyphen
      .replace(/'/g, "'")  // left single quote
      .replace(/'/g, "'")  // right single quote
      .replace(/"/g, '"')  // left double quote
      .replace(/"/g, '"')  // right double quote
      .replace(/…/g, '...') // ellipsis
      .replace(/[\u2028\u2029]/g, '\n') // line/paragraph separators
      .replace(/'/g, "'")  // another type of smart quote (u2019)
      .replace(/"/g, '"')  // another type of smart quote (u201C)
      .replace(/"/g, '"'); // another type of smart quote (u201D)

    // Check if API key is available
    if (!API_KEY) {
      throw new Error('VERTESIA_API_KEY environment variable not set');
    }

    // Properly escape the content for JSON
    // The draftHip may contain special characters that need to be escaped
    const requestData = JSON.stringify({
      interaction: "Evaluate_HIP_Format",
      data: {
        hip_spec: ".",
        draft_hip: draftHip
      }
    });

    // Send request to the Vertesia API using native https
    const result = await makeRequest(requestData);

    if (result.is_valid) {
      console.log(`${colors.green}${colors.bold}✓ Great Success${colors.reset}`);
      return;
    } else {
      // Format issues with numbers instead of bullets
      const issues = result.issues.map((issue, index) =>
        `${colors.yellow}${index + 1}. ${colors.bold}${issue.field}${colors.reset}${colors.yellow}: ${issue.issue}${colors.reset}\n  ${colors.cyan}Suggestion: ${issue.suggestion}${colors.reset}`
      );

      console.log(`${colors.red}${colors.bold}You must correct the following header issues to pass validation:${colors.reset}\n${issues.join('\n\n')}`);
      process.exit(1);
    }
  } catch (error) {
    console.log(`${colors.red}${colors.bold}Error:${colors.reset} ${error.message || error}`);
    process.exit(1);
  }
}

/**
 * Makes an HTTPS request to the Vertesia API.
 * 
 * @async
 * @function makeRequest
 * @param {string} data - The request payload.
 * @returns {Promise<Object>} The parsed response.
 */
function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'studio-server-production.api.vertesia.io',
      port: 443,
      path: '/api/v1/execute/',
      method: 'POST',
      timeout: 120000, // 120 second timeout (2 minutes for Claude API calls)
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data, 'utf8'),
        'Authorization': `Bearer ${API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        // Log the full response for debugging
        if (process.env.DEBUG_API) {
          console.log(`Status Code: ${res.statusCode}`);
          console.log(`Headers: ${JSON.stringify(res.headers)}`);
          console.log(`Response: ${responseData.substring(0, 500)}`);
        }

        // Check if we got an error status code
        if (res.statusCode !== 200) {
          // Check if response looks like HTML (common for error pages)
          if (responseData.trim().startsWith('<') || responseData.includes('<!DOCTYPE')) {
            reject(`API returned HTML error page (HTTP ${res.statusCode}). The Vertesia API endpoint may be down or the URL may have changed. Please check: https://studio-server-production.api.vertesia.io/api/v1/execute/`);
          } else {
            reject(`API returned error status ${res.statusCode}: ${responseData}`);
          }
          return;
        }

        try {
          // Check if response is HTML instead of JSON
          if (responseData.trim().startsWith('<') || responseData.includes('<!DOCTYPE')) {
            reject(`API returned HTML instead of JSON. This usually means the endpoint is unavailable or has moved. Response preview: ${responseData.substring(0, 200)}...`);
            return;
          }

          const parsedData = JSON.parse(responseData);
          if (parsedData.result) {
            resolve(parsedData.result);
          } else {
            reject(`Invalid API response format. Expected 'result' field but got: ${JSON.stringify(parsedData).substring(0, 200)}`);
          }
        } catch (e) {
          // Provide more context about what was received
          const preview = responseData.substring(0, 200);
          reject(`Failed to parse API response as JSON: ${e.message}\nResponse preview: ${preview}${responseData.length > 200 ? '...' : ''}`);
        }
      });
    });

    req.on('error', (error) => {
      reject(`Request failed: ${error.message}`);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(`Request timed out after 120 seconds. The Vertesia API may be unavailable.`);
    });

    req.write(data);
    req.end();
  });
}

// Execute the validation function
validateHIP().catch(error => {
  console.log(`${colors.red}${colors.bold}Error:${colors.reset} ${error}`);
  process.exit(1);
});