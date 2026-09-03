import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { invokeLLM } from "./_core/llm";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

const mockedInvokeLLM = vi.mocked(invokeLLM);
const context = { user: undefined, req: {} as any, res: {} as any };

describe("voice.parseIntent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps a spoken search request through Claude's strict JSON response", async () => {
    mockedInvokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ action: "search_web", confidence: 0.94, url: null, query: "Web Speech API", note: null, reminderText: null, reminderMinutes: null, response: "Searching the web." }) } }] } as any);
    const result = await appRouter.createCaller(context).voice.parseIntent({ transcript: "Search the web for Web Speech API" });
    expect(result.action).toBe("search_web");
    expect(result.query).toBe("Web Speech API");
    expect(mockedInvokeLLM).toHaveBeenCalledOnce();
  });

  it("rejects an invalid model payload before it reaches the client", async () => {
    mockedInvokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ action: "launch_missile", confidence: 1, response: "No" }) } }] } as any);
    await expect(appRouter.createCaller(context).voice.parseIntent({ transcript: "Do something" })).rejects.toThrow();
  });
});
