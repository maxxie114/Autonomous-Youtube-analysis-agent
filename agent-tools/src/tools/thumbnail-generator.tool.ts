import { Tool, ToolContext } from '@frontmcp/sdk';
import * as fs from 'fs';
import { z } from 'zod';

@Tool({
    name: 'generate_thumbnail',
    description: 'Generate a thumbnail using Freepik Gemini AI API. Takes a reference image and prompt to create a customized thumbnail. Returns image URL. Default output size is 1280x720 pixels (YouTube standard).',
    inputSchema: {
        baseImage: z.string().describe('Path to the reference image file (JPG or PNG)'),
        prompt: z.string().describe('Text prompt describing the desired thumbnail')
    },
    outputSchema: {
        imageUrl: z.string(),
        success: z.boolean(),
        message: z.string()
    }
})
export default class ThumbnailGeneratorTool extends ToolContext {
    async execute(input: {
        baseImage: string;
        prompt: string;
    }) {
        const apiKey = process.env.FREEPIK_API_KEY;
        if (!apiKey) {
            throw new Error('FREEPIK_API_KEY not set in environment variables');
        }

        // Validate base image exists
        if (!fs.existsSync(input.baseImage)) {
            throw new Error(`Base image not found: ${input.baseImage}`);
        }

        console.log('🎨 Generating thumbnail with Freepik Gemini AI...');

        // Read the base image and convert to base64
        const imageBuffer = fs.readFileSync(input.baseImage);
        const imageBase64 = imageBuffer.toString('base64');

        // Prepare the API request
        const requestBody = {
            prompt: input.prompt,
            reference_images: [imageBase64]
        };

        const apiUrl = 'https://api.freepik.com/v1/ai/gemini-2-5-flash-image-preview';
        console.log(`📡 Calling Freepik Gemini API...`);

        try {
            // Create the generation task
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-freepik-api-key': apiKey
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Freepik API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            if (!result.data || !result.data.task_id) {
                throw new Error(`No task_id in API response: ${JSON.stringify(result)}`);
            }

            const taskId = result.data.task_id;
            console.log(`✅ Task created: ${taskId}`);
            console.log(`⏳ Polling for result...`);

            // Poll for the result using the correct endpoint format
            const maxAttempts = 20; // Reduced from 30
            const pollInterval = 3000; // 3 seconds

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));

                console.log(`🔄 Checking status (attempt ${attempt + 1}/${maxAttempts})...`);

                const statusUrl = `https://api.freepik.com/v1/ai/gemini-2-5-flash-image-preview/${taskId}`;
                const statusResponse = await fetch(statusUrl, {
                    method: 'GET',
                    headers: {
                        'x-freepik-api-key': apiKey
                    }
                });

                if (!statusResponse.ok) {
                    console.log(`⚠️  Status check failed: ${statusResponse.status}`);
                    continue;
                }

                const statusResult = await statusResponse.json();
                const currentStatus = statusResult.data?.status || statusResult.status || 'unknown';
                console.log(`📊 Status: ${currentStatus}`);

                if (currentStatus === 'COMPLETED' || currentStatus === 'SUCCESS') {
                    // Check for image in the response - it's inside data.generated
                    const generatedImages = statusResult.data?.generated || statusResult.generated;

                    if (generatedImages && Array.isArray(generatedImages) && generatedImages.length > 0) {
                        const imageUrl = generatedImages[0];
                        console.log(`✅ Thumbnail generated successfully!`);
                        console.log(`🖼️  Image URL: ${imageUrl}\n`);

                        return {
                            imageUrl: imageUrl,
                            success: true,
                            message: 'Thumbnail generated successfully (1280x720 default size)'
                        };
                    }

                    throw new Error(`Task completed but no image found. Response: ${JSON.stringify(statusResult)}`);
                } else if (currentStatus === 'FAILED' || currentStatus === 'ERROR') {
                    throw new Error(`Task failed: ${JSON.stringify(statusResult)}`);
                }
            }

            throw new Error(`Timeout waiting for image generation after ${maxAttempts * pollInterval / 1000} seconds`);

        } catch (error: any) {
            console.error('❌ Error:', error.message);
            return {
                imageUrl: '',
                success: false,
                message: `Failed: ${error.message}`
            };
        }
    }
}
