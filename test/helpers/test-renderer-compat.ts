/**
 * Compatibility bridge: replaces the deprecated `react-test-renderer` with
 * the lightweight `test-renderer` package while keeping the same test API
 * (`create`, `act`, `findByType`, `findAllByType`, `findAll`).
 *
 * Usage — replace:
 *   import { act, create, type ReactTestRenderer } from 'react-test-renderer';
 * with:
 *   import { act, create, type ReactTestRenderer } from '../../test/helpers/test-renderer-compat';
 */
import { createRoot, TestInstance } from 'test-renderer';

export { act } from 'react';

// ---------------------------------------------------------------------------
// Resolve a component reference or string to its host-element type name.
// Works because our mocked host components set `displayName` to match the
// host-element string (e.g. `createHostComponent('Text')` → displayName 'Text').
// ---------------------------------------------------------------------------
type ComponentType = React.ComponentType<any> | string;

const getTypeName = (type: ComponentType): string => {
  if (typeof type === 'string') return type;
  return (type as { displayName?: string }).displayName ?? type.name ?? '';
};

// ---------------------------------------------------------------------------
// Monkey-patch TestInstance prototype with react-test-renderer query helpers.
// ---------------------------------------------------------------------------
const sampleRoot = createRoot();
const proto = Object.getPrototypeOf(sampleRoot.container) as Record<string, unknown>;

proto.findByType = function findByType(this: TestInstance, type: ComponentType): TestInstance {
  const name = getTypeName(type);
  const results = this.queryAll((n) => n.type === name, { includeSelf: true });
  if (results.length === 0) {
    throw new Error(`No instances found with node type: "${name}"`);
  }
  if (results.length > 1) {
    throw new Error(`Expected 1 but found ${results.length} instances with node type: "${name}"`);
  }
  return results[0];
};

proto.findAllByType = function findAllByType(
  this: TestInstance,
  type: ComponentType,
): TestInstance[] {
  const name = getTypeName(type);
  return this.queryAll((n) => n.type === name, { includeSelf: true });
};

proto.findAll = function findAll(
  this: TestInstance,
  predicate: (node: TestInstance) => boolean,
): TestInstance[] {
  return this.queryAll(predicate, { includeSelf: true });
};

// ---------------------------------------------------------------------------
// Type augmentation so callers get full IntelliSense.
// ---------------------------------------------------------------------------
declare module 'test-renderer' {
  interface TestInstance {
    findByType(type: ComponentType): TestInstance;
    findAllByType(type: ComponentType): TestInstance[];
    findAll(predicate: (node: TestInstance) => boolean): TestInstance[];
  }
}

// ---------------------------------------------------------------------------
// `create` — drop-in replacement for react-test-renderer's `create()`.
// Must be called inside `act()` (same as the original).
// ---------------------------------------------------------------------------
export interface ReactTestRenderer {
  readonly root: TestInstance;
  toJSON(): ReturnType<TestInstance['toJSON']>;
  unmount(): void;
}

export const create = (element: React.ReactElement): ReactTestRenderer => {
  const root = createRoot();
  root.render(element);

  return {
    get root() {
      return root.container;
    },
    toJSON() {
      // react-test-renderer returns the rendered element's JSON (not the
      // container wrapper). Unwrap the container to match that behavior.
      const first = root.container.children.find((c): c is TestInstance => typeof c !== 'string');
      return first ? first.toJSON() : null;
    },
    unmount() {
      root.unmount();
    },
  };
};
