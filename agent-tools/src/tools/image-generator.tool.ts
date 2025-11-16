import { Tool, ToolContext } from "@frontmcp/sdk";
import { z } from "zod";

@Tool({
    name: "generate_image",
    description: "Generate an image from a text prompt using Freepik Imagen 3.",
    inputSchema: {
        prompt: z.string().describe("Text prompt for the image generation"),
        aspectRatio: z
            .enum(["square_1_1", "landscape_16_9", "landscape_4_3", "portrait_3_4", "portrait_9_16"])
            .optional()
            .describe("Aspect ratio for the generated image (default: square_1_1)")
    },
    outputSchema: {
        imageUrl: z.string(),
        success: z.boolean(),
        message: z.string()
    }
})
export default class ImageGeneratorTool extends ToolContext {
    async execute(input: { prompt: string; aspectRatio?: string }) {
        const apiKey = process.env.FREEPIK_API_KEY;

        if (!apiKey) {
            throw new Error("FREEPIK_API_KEY not set in environment variables");
        }

        console.log("🎨 Generating image via Freepik Imagen 3...");

        const url = "https://api.freepik.com/v1/ai/text-to-image/imagen3";
        const body = {
            prompt: input.prompt,
            num_images: 1,
            aspect_ratio: input.aspectRatio || "square_1_1"
        };

        try {
            // Step 1: Submit the generation request
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "x-freepik-api-key": apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Freepik API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const taskId = data?.data?.task_id || data?.task_id;

            if (!taskId) {
                throw new Error("No task ID returned from API");
            }

            console.log("⏳ Task created, polling for result...");

            // Step 2: Poll for the result
            const imageUrl = await this.pollForImage(apiKey, taskId);

            console.log("🖼️ Image generated:", imageUrl);

            return {
                imageUrl,
                success: true,
                message: "Image generated successfully."
            };
        } catch (error: any) {
            console.error("❌ Error generating image:", error.message);
            return {
                imageUrl: "",
                success: false,
                message: "Failed: " + error.message
            };
        }
    }

    private async pollForImage(apiKey: string, taskId: string, maxAttempts = 20): Promise<string> {
        const pollUrl = `https://api.freepik.com/v1/ai/text-to-image/imagen3/${taskId}`;
        const pollInterval = 3000; // 3 seconds

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            console.log(`🔄 Checking status (attempt ${attempt + 1}/${maxAttempts})...`);

            try {
                const response = await fetch(pollUrl, {
                    method: "GET",
                    headers: {
                        "x-freepik-api-key": apiKey
                    }
                });

                if (!response.ok) {
                    console.log(`⚠️  Status check failed: ${response.status}, retrying...`);
                    continue; // Continue polling instead of throwing
                }

                const data = await response.json();
                const status = data?.data?.status || data?.status || 'unknown';
                console.log(`📊 Status: ${status}`);

                if (status === 'COMPLETED' || status === 'SUCCESS') {
                    // Try multiple possible locations for the image URL
                    const generatedImages = data?.data?.generated || data?.generated;
                    const imageUrl =
                        (generatedImages && Array.isArray(generatedImages) && generatedImages.length > 0) ? generatedImages[0] :
                            data?.data?.images?.[0]?.url ||
                            data?.images?.[0]?.url ||
                            data?.data?.image ||
                            data?.image;

                    if (!imageUrl) {
                        throw new Error(`Task completed but no image found. Response: ${JSON.stringify(data)}`);
                    }

                    console.log(`✅ Image generated successfully!`);
                    return imageUrl;
                } else if (status === 'FAILED' || status === 'ERROR') {
                    throw new Error(`Task failed: ${JSON.stringify(data)}`);
                }
            } catch (error: any) {
                // If it's a final error (not a network issue), throw it
                if (error.message.includes('Task failed') || error.message.includes('no image found')) {
                    throw error;
                }
                // Otherwise log and continue polling
                console.log(`⚠️  Error during polling: ${error.message}, retrying...`);
            }
        }

        throw new Error(`Timeout waiting for image generation after ${maxAttempts * pollInterval / 1000} seconds`);
    }
}
