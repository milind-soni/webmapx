
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractDistricts") {
        extractDistrictsWithOpenAI(request.text)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({error: error.message}));
        return true;  // Indicates that the response is sent asynchronously
    }
});

async function extractDistrictsWithOpenAI(text, retries = 3) {
    console.log("Extracting districts from:", text.substring(0, 100) + "...");
    
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [{
                        role: "system",
                        content: "You are a helpful assistant that extracts district names from text. Please respond with a JSON array of district names. If no districts are found, respond with an empty array. Do not include any additional text or formatting in your response, just the raw JSON array."
                    }, {
                        role: "user",
                        content: `Extract the district names from the following text: ${text}`
                    }],
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText}\n${errorBody}`);
            }

            const data = await response.json();
            let content = data.choices[0].message.content.trim();
            
            console.log("Raw OpenAI response:", content);

            // Remove any markdown formatting
            content = content.replace(/```json\n?|\n?```/g, '');
            
            try {
                const extractedData = JSON.parse(content);
                console.log("Parsed extracted data:", extractedData);
                
                if (!Array.isArray(extractedData) || extractedData.length === 0) {
                    console.warn("No districts found in the text");
                }

                return { districts: extractedData };
            } catch (error) {
                console.error('Error parsing JSON:', content);
                throw new Error(`Failed to parse OpenAI response: ${error.message}`);
            }
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            if (i === retries - 1) {
                throw error;
            }
            // Wait for a short time before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}