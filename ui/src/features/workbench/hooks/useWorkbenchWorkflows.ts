import { useQuery } from "@tanstack/react-query";
import { fetchWorkbenchWorkflows } from "../services/workbenchApi";
import { workbenchKeys } from "./queryKeys";

/** Lists the workflows available for execution in the workbench. */
export function useWorkbenchWorkflows() {
  return useQuery({
    queryKey: workbenchKeys.workflows(),
    queryFn: fetchWorkbenchWorkflows,
  });
}
