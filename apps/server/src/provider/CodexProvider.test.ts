import { assert, it } from "@effect/vitest";

import {
  applyPreferredCodexDefaultModel,
  codexRoutesSpendNativeQuota,
  codexHasAccountSpeedTiers,
  mapCodexModelCapabilities,
} from "./CodexProvider.ts";

it("maps current Codex model capability fields", () => {
  const capabilities = mapCodexModelCapabilities({
    additionalSpeedTiers: [],
    defaultReasoningEffort: "super-high",
    description: "Test model",
    displayName: "GPT Test",
    hidden: false,
    id: "gpt-test",
    isDefault: true,
    model: "gpt-test",
    availableAccessPrograms: { cyber: ["standard", "daybreakBlue"] },
    defaultServiceTier: "flex",
    serviceTiers: [
      {
        id: "priority",
        name: "Fast",
        description: "Lower latency responses.",
      },
      {
        id: "flex",
        name: "Flex",
        description: "Lower-cost asynchronous routing.",
      },
    ],
    supportedReasoningEfforts: [
      {
        description: "Maximum reasoning",
        reasoningEffort: "super-high",
      },
    ],
  });

  assert.deepStrictEqual(capabilities.optionDescriptors, [
    {
      id: "reasoningEffort",
      label: "Reasoning",
      type: "select",
      options: [{ id: "super-high", label: "super-high", isDefault: true }],
      currentValue: "super-high",
    },
    {
      id: "serviceTier",
      label: "Service Tier",
      type: "select",
      options: [
        { id: "default", label: "Standard" },
        {
          id: "priority",
          label: "Fast",
          description: "Lower latency responses.",
        },
        {
          id: "flex",
          label: "Flex",
          description: "Lower-cost asynchronous routing.",
          isDefault: true,
        },
      ],
      currentValue: "flex",
    },
    {
      id: "cyberAccessProgram",
      label: "Cyber Access",
      type: "select",
      options: [
        { id: "standard", label: "Standard", isDefault: true },
        { id: "daybreakBlue", label: "Daybreak Blue" },
      ],
      currentValue: "standard",
    },
  ]);
});

it("uses standard routing when the catalog has no default service tier", () => {
  const capabilities = mapCodexModelCapabilities({
    additionalSpeedTiers: ["fast"],
    defaultReasoningEffort: "medium",
    defaultServiceTier: null,
    description: "Test model",
    displayName: "GPT Test",
    hidden: false,
    id: "gpt-test",
    isDefault: true,
    model: "gpt-test",
    serviceTiers: [
      {
        id: "priority",
        name: "Fast",
        description: "1.5x speed, increased usage",
      },
      {
        id: "ultrafast",
        name: "Ultrafast",
        description: "The fastest available responses for latency-sensitive work.",
      },
    ],
    supportedReasoningEfforts: [],
  });

  assert.deepStrictEqual(capabilities.optionDescriptors, [
    {
      id: "serviceTier",
      label: "Service Tier",
      type: "select",
      options: [
        { id: "default", label: "Standard", isDefault: true },
        {
          id: "priority",
          label: "Fast",
          description: "1.5x speed, increased usage",
        },
        {
          id: "ultrafast",
          label: "Ultrafast",
          description: "Even faster, more expensive",
        },
      ],
      currentValue: "default",
    },
  ]);
});

it("does not revive Fast from legacy tiers when the backend returns an empty tier list", () => {
  const capabilities = mapCodexModelCapabilities({
    additionalSpeedTiers: ["fast"],
    serviceTiers: [],
    defaultServiceTier: "priority",
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: [],
    description: "Test",
    displayName: "Test",
    hidden: false,
    id: "test",
    model: "test",
    isDefault: true,
  });
  assert.deepStrictEqual(capabilities.optionDescriptors, []);
});

it("requires a signed-in native route and an account catalog for speed eligibility", () => {
  const account = {
    account: { type: "chatgpt", email: "test@example.com", planType: "plus" },
    requiresOpenaiAuth: true,
  } as const;
  for (const [config, expected] of [
    [{}, true],
    [{ model_provider: "openai", model_catalog_json: null }, true],
    [{ model_catalog_json: "copilot-models.json" }, false],
    [
      {
        model_provider: "github",
        model_providers: { github: { base_url: "https://api.githubcopilot.com" } },
      },
      false,
    ],
    [{ openai_base_url: "https://gateway.example" }, false],
    [undefined, false],
  ] as const) {
    assert.strictEqual(codexHasAccountSpeedTiers(account, config), expected);
  }
  assert.strictEqual(
    codexHasAccountSpeedTiers({ ...account, requiresOpenaiAuth: false }, {}),
    false,
  );
  assert.strictEqual(
    codexHasAccountSpeedTiers({ account: null, requiresOpenaiAuth: true }, {}),
    false,
  );
  assert.strictEqual(
    codexHasAccountSpeedTiers({ account: { type: "apiKey" }, requiresOpenaiAuth: true }, {}),
    false,
  );
});

it("marks the most preferred available model as default", () => {
  const models = applyPreferredCodexDefaultModel([
    { slug: "gpt-5.6-terra", name: "GPT-5.6-Terra", isCustom: false, capabilities: null },
    { slug: "gpt-5.4", name: "GPT-5.4", isCustom: false, isDefault: true, capabilities: null },
  ]);

  assert.deepStrictEqual(
    models.map((model) => ({ slug: model.slug, isDefault: model.isDefault })),
    [
      { slug: "gpt-5.6-terra", isDefault: true },
      { slug: "gpt-5.4", isDefault: undefined },
    ],
  );
});

it("ranks qualified Codex models while preserving their wire ids", () => {
  const models = applyPreferredCodexDefaultModel([
    {
      slug: "openai.gpt-5.6-luna",
      name: "Luna",
      isCustom: false,
      isDefault: true,
      capabilities: null,
    },
    { slug: "openai.gpt-5.6-sol", name: "Sol", isCustom: false, capabilities: null },
  ]);
  assert.deepStrictEqual(
    models.filter((model) => model.isDefault).map((model) => model.slug),
    ["openai.gpt-5.6-sol"],
  );
});

it("ignores custom models that shadow a preferred slug", () => {
  const models = applyPreferredCodexDefaultModel([
    { slug: "gpt-5.6-sol", name: "gpt-5.6-sol", isCustom: true, capabilities: null },
    { slug: "gpt-5.4", name: "GPT-5.4", isCustom: false, isDefault: true, capabilities: null },
  ]);

  assert.deepStrictEqual(models.find((model) => model.isDefault)?.slug, "gpt-5.4");
});

it("reports native quota only for an OpenAI login on a native route", () => {
  const chatgpt = { type: "chatgpt", email: "a@example.com", planType: "pro" } as const;
  const hub = {
    model_provider: "hub",
    model_providers: { hub: { base_url: "https://hub.example.com/v1" } },
  };
  const cases = [
    ["default route", chatgpt, true, {}, true],
    ["openai base url", chatgpt, true, { openai_base_url: "https://chatgpt.com/x" }, true],
    ["openai proxy url", chatgpt, true, { openai_base_url: "https://proxy.example.com" }, false],
    ["custom provider", chatgpt, true, hub, false],
    ["unknown provider id", chatgpt, true, { model_provider: "missing" }, false],
    ["unreadable config", chatgpt, true, null, false],
    ["login not required", chatgpt, false, {}, false],
    ["api key", { type: "apiKey" }, true, {}, false],
  ] as const;
  for (const [name, account, requiresOpenaiAuth, config, expected] of cases) {
    assert.strictEqual(
      codexRoutesSpendNativeQuota({ account, requiresOpenaiAuth }, config),
      expected,
      name,
    );
  }
});
