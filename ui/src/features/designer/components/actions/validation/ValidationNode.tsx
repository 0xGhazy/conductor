import React from "react";
import {
  UniversalActionNode,
  type UniversalActionNodeProps,
} from "@/features/designer/components/actions/UniversalActionNode";
import type { ValidationNodeData } from "./model/validationDto";
import "./ValidationNode.css";

export interface ValidationNodeProps extends UniversalActionNodeProps {
  data: ValidationNodeData;
}

export function ValidationNode(props: ValidationNodeProps) {
  return <UniversalActionNode {...props} type="VALIDATION_ACTION" />;
}

export const ValidationActionNode = ValidationNode;
export default ValidationNode;
