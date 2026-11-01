import React from "react";
import {
  UniversalActionNode,
  type UniversalActionNodeProps,
} from "@/features/designer/components/actions/UniversalActionNode";
import {
  exportHttpActionData,
  serializeHttpNodeForJson,
} from "@/features/designer/components/node-panel/definitions/http";

export interface HttpActionNodeProps extends UniversalActionNodeProps {
  onRun?: (nodeId: string, runConfig?: any) => Promise<any>;
}

export function HttpActionNode(props: HttpActionNodeProps) {
  return <UniversalActionNode {...props} type="HTTP_ACTION" />;
}

export { exportHttpActionData, serializeHttpNodeForJson };
export default HttpActionNode;
