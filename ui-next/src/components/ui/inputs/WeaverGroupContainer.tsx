import { Box, BoxProps, GridProps } from "@mui/material";
import { FC, ReactNode } from "react";

export type WeaverGroupContainerProps = {
  Wrapper?: FC<BoxProps | GridProps>;
  children?: ReactNode;
};

export const WeaverGroupContainer = ({
  Wrapper = Box,
  children,
}: WeaverGroupContainerProps) => {
  return <Wrapper>{children}</Wrapper>;
};
