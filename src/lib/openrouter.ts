import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import { z } from "zod";

export const getLasagnaRecipe = async (modelName: string) => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
  });
  const response = streamText({
    model: openrouter(modelName),
    prompt: "Write a vegetarian lasagna recipe for 4 people.",
  });
  await response.consumeStream();
  return response.text;
};

export const getWeather = async (modelName: string) => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
  });
  const response = streamText({
    model: openrouter(modelName),
    prompt: "What is the weather in San Francisco, CA in Fahrenheit?",
    tools: {
      getCurrentWeather: {
        description: "Get the current weather in a given location",
        parameters: z.object({
          location: z
            .string()
            .describe("The city and state, e.g. San Francisco, CA"),
          unit: z.enum(["celsius", "fahrenheit"]).optional(),
        }),
        execute: async ({ location, unit = "celsius" }) => {
          const weatherData = {
            "Boston, MA": { celsius: "15\u00B0C", fahrenheit: "59\u00B0F" },
            "San Francisco, CA": {
              celsius: "18\u00B0C",
              fahrenheit: "64\u00B0F",
            },
          } as const;
          const weather = weatherData[location as keyof typeof weatherData];
          if (!weather) {
            return `Weather data for ${location} is not available.`;
          }
          return `The current weather in ${location} is ${weather[unit]}.`;
        },
      },
    },
  });
  await response.consumeStream();
  return response.text;
};
