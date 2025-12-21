import { isObject, define } from 'is-kit';

export type Disposable = { dispose: () => void };

/**
 * Narrow unknown to an object with a callable dispose() method.
 * Uses is-kit helpers to avoid ad-hoc type guards.
 * @param value Unknown value
 * @returns true if value has a function dispose()
 */
export const isDisposable = define<Disposable>((value): value is Disposable => {
  return (
    isObject(value) &&
    'dispose' in value &&
    typeof (value as Record<string, unknown>).dispose === 'function'
  );
});
