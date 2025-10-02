// unit-converter.ts
// Helper functions for converting between different units of measurement

import { Unit } from "../types";

/**
 * Conversion factors to base units (grams for weight, ml for volume)
 */
const CONVERSION_TO_BASE: Record<string, number> = {
  // Weight conversions (base: grams)
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,

  // Volume conversions (base: milliliters)
  ml: 1,
  l: 1000,
  "fl oz": 29.5735,
  cup: 236.588,
  pint: 473.176,
  quart: 946.353,
  gallon: 3785.41,

  // Spoon conversions (base: teaspoon)
  tsp: 1,
  tbsp: 3,

  // Count
  piece: 1,
};

/**
 * Categories of units for validation
 */
const UNIT_CATEGORIES = {
  weight: ["g", "kg", "oz", "lb"],
  volume: ["ml", "l", "fl oz", "cup", "pint", "quart", "gallon"],
  spoon: ["tsp", "tbsp"],
  count: ["piece"],
  freeText: ["free_text"],
};

/**
 * Get the category of a unit
 */
function getUnitCategory(unit: Unit): string | null {
  for (const [category, units] of Object.entries(UNIT_CATEGORIES)) {
    if (units.includes(unit)) {
      return category;
    }
  }
  return null;
}

/**
 * Check if two units are compatible (can be converted)
 */
export function areUnitsCompatible(fromUnit: Unit, toUnit: Unit): boolean {
  // Same unit is always compatible
  if (fromUnit === toUnit) {
    return true;
  }

  // free_text is never compatible with anything else
  if (fromUnit === "free_text" || toUnit === "free_text") {
    return false;
  }

  // Check if both units are in the same category
  const fromCategory = getUnitCategory(fromUnit);
  const toCategory = getUnitCategory(toUnit);

  return fromCategory !== null && fromCategory === toCategory;
}

/**
 * Convert a quantity from one unit to another
 * @param quantity The amount to convert
 * @param fromUnit The source unit
 * @param toUnit The target unit
 * @returns The converted quantity
 * @throws Error if units are incompatible
 */
export function convertUnit(
  quantity: number,
  fromUnit: Unit,
  toUnit: Unit
): number {
  // If units are the same, no conversion needed
  if (fromUnit === toUnit) {
    return quantity;
  }

  // Check if conversion is possible
  if (!areUnitsCompatible(fromUnit, toUnit)) {
    throw new Error(
      `Cannot convert from ${fromUnit} to ${toUnit}: incompatible unit types`
    );
  }

  // Get the category to determine which base to use
  const category = getUnitCategory(fromUnit);

  if (!category) {
    throw new Error(`Unknown unit: ${fromUnit}`);
  }

  // Convert to base unit, then to target unit
  const fromFactor = CONVERSION_TO_BASE[fromUnit];
  const toFactor = CONVERSION_TO_BASE[toUnit];

  if (fromFactor === undefined || toFactor === undefined) {
    throw new Error(
      `Missing conversion factor for ${fromUnit} or ${toUnit}`
    );
  }

  // Convert: quantity * (fromFactor / toFactor)
  return (quantity * fromFactor) / toFactor;
}

/**
 * Convert a price per unit to a different unit
 * @param pricePerUnit The price in the original unit
 * @param fromUnit The original price unit
 * @param toUnit The target unit for the price
 * @returns The price per target unit
 */
export function convertPricePerUnit(
  pricePerUnit: number,
  fromUnit: Unit,
  toUnit: Unit
): number {
  // Convert 1 unit of fromUnit to toUnit
  // If 1kg costs 100, and we want price per g:
  // 1kg = 1000g, so price per g = 100 / 1000 = 0.1
  const oneUnitInTargetUnit = convertUnit(1, fromUnit, toUnit);
  return pricePerUnit / oneUnitInTargetUnit;
}

/**
 * Format a unit name for display
 */
export function formatUnit(unit: Unit): string {
  const unitNames: Record<Unit, string> = {
    g: "grams",
    kg: "kilograms",
    ml: "milliliters",
    l: "liters",
    oz: "ounces",
    lb: "pounds",
    tsp: "teaspoons",
    tbsp: "tablespoons",
    "fl oz": "fluid ounces",
    cup: "cups",
    pint: "pints",
    quart: "quarts",
    gallon: "gallons",
    piece: "pieces",
    free_text: "free text",
  };
  return unitNames[unit] || unit;
}

/**
 * Round a number to a reasonable precision for display
 */
export function roundToPrecision(value: number, precision: number = 2): number {
  return Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);
}
