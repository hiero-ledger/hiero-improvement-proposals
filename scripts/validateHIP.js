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
    if (!API_KEY) {
      throw new Error('VERTESIA_API_KEY environment variable not set');
    }

    const hip = hipPath || process.argv[2];
    
    // Skip validation for hipstable files
    if (hip.includes('hipstable')) {
      console.log(`${colors.green}${colors.bold}✓ Great Success${colors.reset}`);
      return;
    }
    
    console.log(`${colors.cyan}Validating ${hip}${colors.reset}`);
    
    // Read the HIP file content
    const draftHip = fs.readFileSync(hip, 'utf8');
    
    // Prepare the request data
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
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': `Bearer ${API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (parsedData.result) {
            resolve(parsedData.result);
          } else {
            reject(`Invalid API response format: ${responseData}`);
          }
        } catch (e) {
          reject(`Failed to parse API response: ${e.message}`);
        }
      });
    });

    req.on('error', (error) => {
      reject(`Request failed: ${error.message}`);
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