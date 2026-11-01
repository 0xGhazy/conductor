export const START_NODE_ID = "00000000-0000-0000-0000-000000000000";
export const LEGACY_START_NODE_ID = "start";
export const END_NODE_ID = "end";

export const initialNodes = [
  {
    id: START_NODE_ID,
    type: "startFlag",
    position: { x: 220, y: 140 },
    data: {
      name: "Start",
      config: {
        timeoutSeconds: 10,
        timeoutPolicy: "TIME_OUT_WF",
      },
    },
    draggable: false,
    selectable: false,
  },
  {
    id: END_NODE_ID,
    type: "endFlag",
    position: { x: 220, y: 280 },
    data: {
      name: "End",
    },
    draggable: false,
    selectable: false,
  },
];
