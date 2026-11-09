import {
  WeaverAutocompleteVariables,
  WeaverAutocompleteVariablesProps,
} from "components/FlatMapForm/WeaverAutocompleteVariables";

/**
 * Autocomplete for optional LLM numeric params (temperature, topP, …).
 * Clears empty values to null so they are omitted from the task payload —
 * important for providers like Claude that reject temperature + top_p together,
 * and that treat 0 differently from "unset".
 *
 * Non-LLM forms should keep using {@link WeaverAutocompleteVariables}, which
 * preserves the historical "" → 0 coercion for numeric fields.
 */
export function LLMAutocompleteVariables(
  props: WeaverAutocompleteVariablesProps,
) {
  return <WeaverAutocompleteVariables {...props} clearEmptyNumberAsNull />;
}
