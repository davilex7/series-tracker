// src/app/api/genkit/[...flow]/route.ts
// *** USING DIRECT GOOGLE AI SDK - GENKIT REMOVED FROM THIS FILE ***

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"; // Import Google AI SDK
import dotenv from 'dotenv';
import path from 'path';
import * as z from 'zod'; // Keep Zod for input validation if desired

// --- Environment & Configuration ---
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const googleApiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!googleApiKey) {
    console.error("Google AI API Route CRITICAL: GOOGLE_API_KEY or GEMINI_API_KEY is not defined.");
    // We'll handle this per-request below, but log it once on load
}

// --- Zod Schemas (Optional but recommended for input validation) ---
const RatedSeriesSchema = z.object({
    title: z.string(),
    rating: z.number().min(0).max(5),
});
const RecommendationInputSchema = z.object({
    ratedSeries: z.array(RatedSeriesSchema),
    count: z.number().int().positive().optional().default(5),
    excludeTitles: z.array(z.string()).optional().default([]),
});
// Define the structure we expect the LLM to return *inside* the JSON string
const RecommendationSchema = z.object({
    title: z.string(),
    reason: z.string().optional(),
});
const ExpectedLLMResponseSchema = z.object({
    recommendations: z.array(RecommendationSchema),
});
// ---

// --- Safety Settings for Google AI ---
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
// ---

// --- Standard Next.js POST Handler ---
export async function POST(req: NextRequest) {
    console.log("Google AI API Route: Received request.");

    if (!googleApiKey) {
        console.error("Google AI API Route: API Key is missing.");
        return NextResponse.json({ error: { message: "Error de configuración del servidor: Falta la clave API." } }, { status: 500 });
    }

    try {
        // 1. Parse Request Body
        const body = await req.json();
        const inputData = body.data; // Assuming data is nested under 'data'

        // 2. Validate Input (Optional but recommended)
        const validationResult = RecommendationInputSchema.safeParse(inputData);
        if (!validationResult.success) {
            console.warn("Invalid input data:", validationResult.error.errors);
            return NextResponse.json({ error: { message: "Datos de entrada inválidos.", details: validationResult.error.format() } }, { status: 400 });
        }
        const { ratedSeries, count, excludeTitles } = validationResult.data;

        // 3. Check for sufficient input
        const positiveRatedSeries = ratedSeries.filter(s => s.rating >= 3);
        if (positiveRatedSeries.length === 0) {
            console.log("Google AI API Route: No positively rated series provided.");
            // Return a specific message instead of calling the API
            return NextResponse.json({ recommendations: [], message: "Valora algunas series con 3 estrellas o más para obtener recomendaciones." });
        }

        // 4. Initialize Google AI Client & Model
        const genAI = new GoogleGenerativeAI(googleApiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash", // Or your preferred model
            safetySettings,
            // Explicitly ask for JSON output via generationConfig (recommended)
            generationConfig: { responseMimeType: "application/json" }
        });

        // 5. Construct Prompt (same as before)
        const ratedSeriesString = positiveRatedSeries
            .map(s => `- ${s.title} (${s.rating}/5)`)
            .join('\n');
        const excludeTitlesString = excludeTitles.join(', ');
        const prompt = `
              Eres un experto recomendador de series de TV. Basándote en las siguientes series que al usuario le han gustado (con sus valoraciones de 0 a 5 estrellas), recomiéndale ${count} nuevas series que podrían gustarle.

              Series que le han gustado al usuario:
              ${ratedSeriesString}

              Series que ya tiene en su lista (NO las incluyas en las recomendaciones):
              ${excludeTitlesString || 'Ninguna'}

              Proporciona únicamente una lista de títulos de series recomendadas, opcionalmente con una breve razón para cada una. Formatea tu respuesta como un objeto JSON con una clave "recommendations", donde cada elemento es un objeto con "title" (string) y opcionalmente "reason" (string).

              Ejemplo de formato de respuesta deseado:
              {
                "recommendations": [
                  { "title": "Nombre Serie 1", "reason": "Similar en tono a..." },
                  { "title": "Nombre Serie 2" }
                ]
              }

              IMPORTANTE: Solo devuelve el objeto JSON válido, sin ningún texto introductorio, explicaciones adicionales, ni markdown (como \`\`\`json).
            `;
        console.log("Google AI API Route: Sending prompt to model...");

        // 6. Call Google AI API
        const result = await model.generateContent(prompt);
        const response = result.response;
        const responseText = response.text(); // Get the raw text response

        console.log("Google AI API Route: Received raw response text:", responseText);

        // 7. Parse and Validate JSON Response
        let parsedRecommendations;
        try {
            // Attempt to parse the text as JSON
            const rawParsed = JSON.parse(responseText);
            // Validate the parsed structure against our Zod schema
            const validation = ExpectedLLMResponseSchema.safeParse(rawParsed);
            if (!validation.success) {
                console.error("Google AI API Route: LLM response JSON structure validation failed:", validation.error.errors);
                throw new Error(`La respuesta de la IA no tiene el formato JSON esperado. ${validation.error.message}`);
            }
            parsedRecommendations = validation.data; // Use validated data

        } catch (parseError: any) {
            console.error("Google AI API Route: Failed to parse LLM response as JSON:", parseError);
            throw new Error(`No se pudo interpretar la respuesta de la IA como JSON válido. ${parseError.message}`);
        }

        // 8. Filter out excluded titles (redundant check, but safe)
        const finalRecommendations = parsedRecommendations.recommendations.filter(
            rec => !excludeTitles.some(exclude => rec.title.toLowerCase() === exclude.toLowerCase())
        );

        console.log("Google AI API Route: Filtered recommendations:", finalRecommendations);

        // 9. Return Success Response
        return NextResponse.json({ recommendations: finalRecommendations }); // Return only the recommendations array

    } catch (error: any) {
        console.error(`Google AI API Route: Error during execution:`, error);
        // Provide a more specific error if possible
        let errorMessage = error.message || 'Error desconocido del servidor';
        let statusCode = 500;

        if (error.message?.includes('API key not valid')) {
            errorMessage = 'Clave API de Google AI inválida.';
            statusCode = 401; // Unauthorized
        } else if (error.message?.includes('quota')) {
            errorMessage = 'Cuota de API excedida.';
            statusCode = 429; // Too Many Requests
        } else if (error.message?.includes('JSON')) {
            // Keep the JSON parse error message
            statusCode = 500; // Internal server error as we couldn't process response
        }

        return NextResponse.json(
            { error: { message: errorMessage } },
            { status: statusCode }
        );
    }
}

// Optional: Add a GET handler for basic testing
export async function GET(req: NextRequest) {
    return NextResponse.json({ message: `Google AI API route active.` });
}
