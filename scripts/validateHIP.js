const fs = require('fs');
const axios = require('axios');

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
    console.log(`Validating ${hip}`);
    
    // Read the HIP file content
    const draftHip = fs.readFileSync(hip, 'utf8');
    
    // Prepare the request data
    const requestData = {
      interaction: "Evaluate_HIP_Format",
      data: {
        hip_spec: ".",
        draft_hip: draftHip
      }
    };

    // Send request to the Vertesia API
    const response = await axios.post(
      'https://studio-server-production.api.vertesia.io/api/v1/execute/',
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-10d0ff210ff2e3b58ef67cf2b2889476'
        }
      }
    );

    // Parse the API response
    const result = response.data.result;
    
    if (result.is_valid) {
      console.log("Great Success");
      return;
    } else {
      // If validation fails, throw error with all suggestions
      const errors = result.issues.map(issue => 
        new Error(`${issue.field}: ${issue.issue}. Suggestion: ${issue.suggestion}`)
      );
      
      throw errors;
    }
  } catch (error) {
    if (Array.isArray(error)) {
      console.log('You must correct the following header errors to pass validation: ', error);
    } else if (error.response) {
      console.log('API Error:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    process.exit(1);
  }
}

// Execute the validation function
validateHIP().catch(error => {
  console.log(error);
  process.exit(1);
});