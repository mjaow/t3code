import { ProviderInstanceId, type ProviderOptionDescriptor } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { buildTraitsTriggerDisplay, getDescriptorStringValue } from "./modelTraits.ts";

describe("buildTraitsTriggerDisplay", () => {
  it.each([
    { id: "serviceTier", requested: "priority", applied: "default" },
    { id: "fastMode", requested: true, applied: false },
  ])(
    "uses the backend's applied $id rather than the requested speed",
    ({ id, requested, applied }) => {
      const descriptor: ProviderOptionDescriptor =
        id === "fastMode"
          ? { id, label: "Fast Mode", type: "boolean", currentValue: true }
          : {
              id,
              label: "Service Tier",
              type: "select",
              currentValue: "priority",
              options: [
                { id: "default", label: "Standard" },
                { id: "priority", label: "Fast" },
              ],
            };
      const modelSelection = {
        instanceId: ProviderInstanceId.make("provider"),
        model: "model",
        options: [{ id, value: requested }],
      };
      const display = (instanceId = modelSelection.instanceId) =>
        buildTraitsTriggerDisplay({
          descriptors: [descriptor],
          primarySelectDescriptorId: null,
          ultrathinkPromptControlled: false,
          modelSelection,
          reportedModelSelection: {
            ...modelSelection,
            instanceId,
            options: [{ id, value: applied }],
          },
        });
      expect(display().speedLabel).toBeNull();
      expect(display(ProviderInstanceId.make("other-account")).speedLabel).toBe("Fast");
    },
  );
  it.each([
    { currentValue: undefined, defaultValue: undefined, value: null, label: "Thinking" },
    { currentValue: undefined, defaultValue: "high", value: "high", label: "High" },
    { currentValue: "low", defaultValue: undefined, value: "low", label: "Low" },
    { currentValue: "max", defaultValue: "high", value: "max", label: "Max" },
    { id: "effort", currentValue: undefined, defaultValue: undefined, value: null, label: "" },
  ])("labels Pi thinking without inventing a selection: $label ($value)", (input) => {
    const descriptor: Extract<ProviderOptionDescriptor, { type: "select" }> = {
      id: input.id ?? "thinking",
      label: "Thinking",
      type: "select",
      options: ["low", "high", "max"].map((id) => ({
        id,
        label: id[0]!.toUpperCase() + id.slice(1),
        ...(id === input.defaultValue ? { isDefault: true } : {}),
      })),
      ...(input.currentValue ? { currentValue: input.currentValue } : {}),
    };

    expect(
      buildTraitsTriggerDisplay({
        descriptors: [descriptor],
        primarySelectDescriptorId: descriptor.id,
        ultrathinkPromptControlled: false,
      }).label,
    ).toBe(input.label);
    expect(getDescriptorStringValue(descriptor)).toBe(input.value);
  });
});
