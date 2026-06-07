/**
 * Parses a single directive line into a structured DirectiveLine.
 * Handles: aliases, conditional selectors, HTML-attribute args, positional args.
 */

import type { DirectiveLine, Warning } from '../model/types.js';
import {
  normalizeName,
  SECTION_CLOSE_TO_KIND,
  isKnownDirective,
  TIER2_METADATA_MAP,
} from './directives.js';

export interface ParseDirectiveResult {
  directive: DirectiveLine | null;
  warnings: Warning[];
}

/**
 * Parse the body inside `{...}` into a DirectiveLine.
 * `lineNumber` is 1-based for warning reporting.
 * `source` is the full `{...}` text for round-trip.
 */
export function parseDirectiveBody(
  body: string,
  source: string,
  lineNumber: number,
): ParseDirectiveResult {
  const warnings: Warning[] = [];

  // 1. Extract name (possibly with selector/negation suffix)
  //    Pattern: name[-selector[!]][: arg] or name[-selector[!]][ attrs]
  const nameMatch = body.match(/^([A-Za-z_][A-Za-z0-9_]*)(-([A-Za-z0-9_]+)(!)?)?/);
  if (!nameMatch) {
    warnings.push({ line: lineNumber, code: 'INVALID_DIRECTIVE', message: `Malformed directive: ${source}` });
    return { directive: null, warnings };
  }

  const rawName = nameMatch[1] ?? '';
  const selector = nameMatch[3];
  const negated = nameMatch[4] === '!';

  const canonicalName = normalizeName(rawName);

  // Tier-2 metadata mapping
  const tier2Key = TIER2_METADATA_MAP[canonicalName];
  const resolvedName = tier2Key != null ? tier2Key : canonicalName;

  // 2. Check for end directives with selector (disallowed by spec)
  if (selector && SECTION_CLOSE_TO_KIND[canonicalName] !== undefined) {
    warnings.push({
      line: lineNumber,
      code: 'SELECTOR_ON_END_DIRECTIVE',
      message: `End directive ${rawName} must not carry a selector`,
    });
  }

  // 3. Rest of the body after name (+ selector + optional negation)
  const afterName = body.slice(nameMatch[0]?.length ?? 0).trimStart();

  // 4. Parse attributes and argument
  let argument: string | undefined;
  const attributes: Record<string, string> = {};

  if (afterName.startsWith(':')) {
    // {name: arg} or {name: key="val" ...}
    const rest = afterName.slice(1).trimStart();
    const attrResult = parseAttributes(rest);
    if (attrResult.hasAttrs) {
      Object.assign(attributes, attrResult.attrs);
      // If there's a bare (non-attr) value it becomes the argument
      if (attrResult.bare) argument = attrResult.bare;
    } else {
      argument = rest || undefined;
    }
  } else if (afterName.length > 0) {
    // {name attr-or-positional} — no colon
    // Check if it's attribute-style (has key=value pattern)
    const attrResult = parseAttributes(afterName);
    if (attrResult.hasAttrs) {
      Object.assign(attributes, attrResult.attrs);
      if (attrResult.bare) argument = attrResult.bare;
    } else {
      // Positional label: {start_of_verse Verse 1} treated as label="Verse 1"
      argument = afterName;
      attributes['label'] = afterName;
    }
  }

  // 5. Warn on unknown directives (not x_-prefixed)
  if (!isKnownDirective(resolvedName) && !rawName.startsWith('x_') && !rawName.startsWith('x-')) {
    warnings.push({
      line: lineNumber,
      code: 'UNKNOWN_DIRECTIVE',
      message: `Unknown directive: ${rawName}`,
    });
  }

  const directive: DirectiveLine = {
    type: 'directive',
    name: resolvedName,
    originalName: rawName,
    attributes,
    source,
  };
  if (argument) directive.argument = argument;

  if (selector !== undefined) {
    directive.selector = selector;
    if (negated) directive.negated = true;
  }

  return { directive, warnings };
}

interface AttrParseResult {
  hasAttrs: boolean;
  attrs: Record<string, string>;
  bare?: string;
}

/**
 * Parse HTML-attribute-style key=value pairs from a string.
 * Both single and double quotes are supported.
 * Returns `hasAttrs:true` if at least one key=value found.
 */
function parseAttributes(input: string): AttrParseResult {
  const attrs: Record<string, string> = {};
  // Match key="value" or key='value' or key=bareword
  const attrRe = /([A-Za-z_][A-Za-z0-9_-]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match;
  let hasAttrs = false;
  // Track consumed ranges
  const consumed = new Set<number>();

  while ((match = attrRe.exec(input)) !== null) {
    hasAttrs = true;
    const key = match[1] ?? '';
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[key] = val;
    for (let i = match.index; i < match.index + match[0].length; i++) {
      consumed.add(i);
    }
  }

  // Whatever wasn't consumed may be a bare argument
  let bare: string | undefined;
  if (hasAttrs) {
    const remaining = [...input].filter((_, i) => !consumed.has(i)).join('').trim();
    if (remaining) bare = remaining;
  }

  const result: AttrParseResult = { hasAttrs, attrs };
  if (bare) result.bare = bare;
  return result;
}
