const toFinitePositionNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const formatPositionCoordinate = (value, fallback = 0) =>
  toFinitePositionNumber(value, fallback).toFixed(2);

export const roundPositionCoordinate = (value, fallback = 0) =>
  Number(formatPositionCoordinate(value, fallback));

export const formatNodePosition = (position = {}) => ({
  x: roundPositionCoordinate(position?.x),
  y: roundPositionCoordinate(position?.y),
});

